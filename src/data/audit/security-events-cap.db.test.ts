import { v7 as uuidv7 } from "uuid";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { recordSecurityEvent } from "@/data/audit";
import type { SecurityEvent } from "@/domain/audit";
import { createFakeTelemetry } from "@/infra/telemetry/fake";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp } from "@/test/ip";

// The cap of this file is 3 new rows a day, so a few events reach it (A5.14).
// The configuration is read when the code under test loads, so it is set before
// the imports run, and restored after the file. The default cap of 1,000 is in
// security-events.db.test.ts.
vi.hoisted(() => {
  vi.stubEnv("SECURITY_EVENTS_DAILY_CAP", "3");
});

// Seam 2: the audit module's public interface, over the test database, as the
// application role. This file reads the rows, adds accounts and cleans up as
// the migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);

// Every event of a test happens at a known instant, so the day and the hour it
// falls in are known. Only Date is faked: the database driver keeps its real
// timers.
const instant = new Date("2026-11-24T13:05:30.000Z");

beforeAll(async () => {
  await owner`truncate app."user" cascade`;
});

beforeEach(async () => {
  await owner`truncate app.security_events`;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await owner.end();
});

// The fake the cap's warning goes to, new for each test.
let fake = createFakeTelemetry();

beforeEach(() => {
  fake = createFakeTelemetry();
});

function record(occurrence: SecurityEvent) {
  return recordSecurityEvent(occurrence, fake.telemetry);
}

type StoredEvent = {
  dedupe_key: string;
  event: string;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  route: string;
  details: unknown;
  count: number;
  first_at: Date;
  last_at: Date;
};

// The rows of the security log, oldest first.
function storedEvents() {
  return owner<StoredEvent[]>`
    select dedupe_key, event, user_id, ip, user_agent, route, details, count,
      first_at, last_at
    from app.security_events order by first_at, dedupe_key`;
}

// An account of the given role, as the admin plugin stores it.
async function insertUser(role: string | null) {
  const id = uuidv7();
  await owner`
    insert into app."user" (id, name, email, role)
    values (${id}, 'Conta Fictícia', ${`${id}@example.com`}, ${role})`;
  return id;
}

// The overflow rows, which are the ones whose key starts with overflow.
function overflowRows() {
  return owner<StoredEvent[]>`
    select dedupe_key, event, user_id, ip, user_agent, route, details, count,
      first_at, last_at
    from app.security_events where dedupe_key like 'overflow:%'
    order by dedupe_key`;
}

// A new row of the log: a sign-in that no other occurrence of the test shares
// the IP of, so its key is its own.
function newRow(change: Partial<SecurityEvent> = {}) {
  return {
    event: "sign_in_succeeded",
    userId: null,
    ip: nextTestIp(),
    userAgent: "Mozilla/5.0 (Navegador Fictício)",
    route: "/sign-in/email",
    ...change,
  } as SecurityEvent;
}

// Records new rows until the day's cap of 3 is reached.
async function reachTheCap() {
  for (let row = 0; row < 3; row += 1) {
    await record(newRow());
  }
}

describe("above the day's cap (A5.14)", () => {
  test("an event that would create a row goes to the overflow row of its event and hour, with only a counter", async () => {
    await reachTheCap();

    await record(newRow());

    expect(await storedEvents()).toHaveLength(4);
    expect(await overflowRows()).toEqual([
      {
        dedupe_key: "overflow:sign_in_succeeded:2026-11-24T13",
        event: "sign_in_succeeded",
        user_id: null,
        ip: null,
        user_agent: null,
        route: "other",
        details: null,
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
  });

  test("an event that sums to an existing row keeps summing, whatever the cap", async () => {
    const first = newRow();
    await record(first);
    await record(newRow());
    await record(newRow());

    await record(first);
    await record(first);

    expect(await overflowRows()).toEqual([]);
    expect(
      await owner`select count from app.security_events where ip = ${first.ip}`,
    ).toEqual([{ count: 3 }]);
    expect(await storedEvents()).toHaveLength(3);
  });

  test("the new rows of an event in an hour count in one overflow row, and another event or hour has its own", async () => {
    await reachTheCap();

    for (let row = 0; row < 5; row += 1) {
      await record(newRow());
    }
    vi.setSystemTime(new Date("2026-11-24T13:59:59.999Z"));
    await record(newRow());
    await record(newRow({ event: "rate_limited" }));
    vi.setSystemTime(new Date("2026-11-24T14:00:00.000Z"));
    await record(newRow());

    expect(
      (await overflowRows()).map(
        ({ dedupe_key, count, first_at, last_at }) => ({
          dedupe_key,
          count,
          first_at,
          last_at,
        }),
      ),
    ).toEqual([
      {
        dedupe_key: "overflow:rate_limited:2026-11-24T13",
        count: 1,
        first_at: new Date("2026-11-24T13:59:59.999Z"),
        last_at: new Date("2026-11-24T13:59:59.999Z"),
      },
      {
        dedupe_key: "overflow:sign_in_succeeded:2026-11-24T13",
        count: 6,
        first_at: instant,
        last_at: new Date("2026-11-24T13:59:59.999Z"),
      },
      {
        dedupe_key: "overflow:sign_in_succeeded:2026-11-24T14",
        count: 1,
        first_at: new Date("2026-11-24T14:00:00.000Z"),
        last_at: new Date("2026-11-24T14:00:00.000Z"),
      },
    ]);
  });

  test("the cap is of the UTC day: the next day records new rows as usual again", async () => {
    await reachTheCap();
    await record(newRow());
    vi.setSystemTime(new Date("2026-11-24T23:59:59.999Z"));
    await record(newRow());

    vi.setSystemTime(new Date("2026-11-25T00:00:00.000Z"));
    const nextDay = newRow();
    await record(nextDay);

    expect(
      (await overflowRows()).map(({ dedupe_key, count }) => ({
        dedupe_key,
        count,
      })),
    ).toEqual([
      { dedupe_key: "overflow:sign_in_succeeded:2026-11-24T13", count: 1 },
      { dedupe_key: "overflow:sign_in_succeeded:2026-11-24T23", count: 1 },
    ]);
    expect(
      await owner`select count from app.security_events where ip = ${nextDay.ip}`,
    ).toEqual([{ count: 1 }]);
  });

  test.each<[string, Partial<SecurityEvent>]>([
    ["a staff sign-in", { event: "staff_sign_in_succeeded" }],
    [
      "an account lockout",
      { event: "account_locked", lockMinutes: 5 } as Partial<SecurityEvent>,
    ],
  ])("%s stays outside the cap, as a row of its own", async (_, change) => {
    await reachTheCap();

    const staff = await insertUser("instructor");
    await record(newRow({ ...change, userId: staff }));

    expect(await overflowRows()).toEqual([]);
    expect(await storedEvents()).toHaveLength(4);
  });

  // The events whose place depends on the account being staff (A5.14).
  const bySession: [string, Partial<SecurityEvent>][] = [
    [
      "a completed password reset",
      { event: "password_reset_completed", route: "/reset-password" },
    ],
    [
      "a refusal",
      { event: "access_denied", status: 404, route: "/backoffice" },
    ] as [string, Partial<SecurityEvent>],
  ];

  describe.each(bySession)("%s", (_, change) => {
    test.each(["instructor", "admin", "instructor,admin"])(
      "of an account with the role %s stays outside the cap",
      async (role) => {
        await reachTheCap();

        await record(newRow({ ...change, userId: await insertUser(role) }));

        expect(await overflowRows()).toEqual([]);
        expect(await storedEvents()).toHaveLength(4);
      },
    );

    test.each<[string, () => Promise<string | null>]>([
      ["a student", () => insertUser("user")],
      ["an account with no role", () => insertUser(null)],
      ["an account that no longer exists", () => Promise.resolve(uuidv7())],
      ["no account", () => Promise.resolve(null)],
    ])("of %s goes to overflow, with no account", async (__, userId) => {
      await reachTheCap();

      await record(newRow({ ...change, userId: await userId() }));

      expect(
        (await overflowRows()).map(({ dedupe_key, user_id, count }) => ({
          dedupe_key,
          user_id,
          count,
        })),
      ).toEqual([
        {
          dedupe_key: `overflow:${change.event}:2026-11-24T13`,
          user_id: null,
          count: 1,
        },
      ]);
    });
  });

  // What any visitor who knows an e-mail can produce (A5.14).
  const byVisitor: [string, Partial<SecurityEvent>][] = [
    [
      "a failed sign-in",
      { event: "sign_in_failed", reason: "invalid_credentials" },
    ] as [string, Partial<SecurityEvent>],
    [
      "a password reset request",
      { event: "password_reset_requested", route: "/request-password-reset" },
    ],
  ];

  describe.each(byVisitor)("%s", (_, change) => {
    test("against a staff account, from any IP range, goes to the overflow row of that account", async () => {
      await reachTheCap();
      const staff = await insertUser("instructor");
      const otherStaff = await insertUser("admin");

      for (let range = 0; range < 4; range += 1) {
        await record(newRow({ ...change, userId: staff }));
      }
      await record(newRow({ ...change, userId: otherStaff }));

      // Largest first: the order of two account IDs is the database's.
      expect(
        (await overflowRows())
          .map(({ dedupe_key, user_id, ip, route, count }) => ({
            dedupe_key,
            user_id,
            ip,
            route,
            count,
          }))
          .sort((a, b) => b.count - a.count),
      ).toEqual([
        {
          dedupe_key: `overflow:${change.event}:${staff}:2026-11-24T13`,
          user_id: staff,
          ip: null,
          route: "other",
          count: 4,
        },
        {
          dedupe_key: `overflow:${change.event}:${otherStaff}:2026-11-24T13`,
          user_id: otherStaff,
          ip: null,
          route: "other",
          count: 1,
        },
      ]);
    });

    test("against a student, or an e-mail with no account, goes to the overflow row with no account", async () => {
      await reachTheCap();
      const student = await insertUser("user");

      await record(newRow({ ...change, userId: student }));
      await record(newRow({ ...change, userId: null }));

      expect(
        (await overflowRows()).map(({ dedupe_key, user_id, count }) => ({
          dedupe_key,
          user_id,
          count,
        })),
      ).toEqual([
        {
          dedupe_key: `overflow:${change.event}:2026-11-24T13`,
          user_id: null,
          count: 2,
        },
      ]);
    });
  });
});

describe("the warning of the cap (A5.14)", () => {
  const reached = {
    name: "security-log-daily-cap-reached",
    context: { cap: 3, day: "2026-11-24" },
  };

  test("does not go out while the day's rows are at the cap or below it", async () => {
    await reachTheCap();
    await record(newRow({ event: "staff_sign_in_succeeded" }));
    await record(
      newRow({
        event: "account_locked",
        lockMinutes: 1,
      } as Partial<SecurityEvent>),
    );

    expect(fake.warnings).toEqual([]);
  });

  test("goes out once the day, when the first new row goes to overflow", async () => {
    await reachTheCap();
    expect(fake.warnings).toEqual([]);

    await record(newRow());
    expect(fake.warnings).toEqual([reached]);

    // Neither more of that overflow row, nor another event, nor another hour,
    // nor a staff account's own overflow row warns again.
    await record(newRow());
    await record(newRow({ event: "rate_limited" }));
    vi.setSystemTime(new Date("2026-11-24T20:00:00.000Z"));
    await record(newRow());
    await record(
      newRow({
        event: "sign_in_failed",
        reason: "invalid_credentials",
        userId: await insertUser("admin"),
      } as Partial<SecurityEvent>),
    );
    expect(fake.warnings).toEqual([reached]);
  });

  test("goes out once the day when many events reach the first overflow together, as in a sign-in flood, and again the next day", async () => {
    // 40 events at once, each of which would create a new row.
    const flood = () =>
      Promise.all(Array.from({ length: 40 }, () => record(newRow())));

    await reachTheCap();
    await flood();
    vi.setSystemTime(new Date("2026-11-25T00:00:00.000Z"));
    await reachTheCap();
    await flood();

    expect(fake.warnings).toEqual([
      reached,
      { ...reached, context: { cap: 3, day: "2026-11-25" } },
    ]);
    // Every event of the floods is counted.
    expect(
      (await overflowRows()).map(({ dedupe_key, count }) => ({
        dedupe_key,
        count,
      })),
    ).toEqual([
      { dedupe_key: "overflow:sign_in_succeeded:2026-11-24T13", count: 40 },
      { dedupe_key: "overflow:sign_in_succeeded:2026-11-25T00", count: 40 },
    ]);
  });

  test("goes out again on the next day, when its cap is reached and exceeded", async () => {
    await reachTheCap();
    await record(newRow());

    vi.setSystemTime(new Date("2026-11-25T00:00:00.000Z"));
    await reachTheCap();
    await record(newRow());

    expect(fake.warnings).toEqual([
      reached,
      { ...reached, context: { cap: 3, day: "2026-11-25" } },
    ]);
  });
});

describe("a sign-in attack on a staff account above the cap (A5.14)", () => {
  test("of 1,000 IP ranges in an hour adds one overflow row with the account and the counter, and the lockouts stay outside the cap", async () => {
    await reachTheCap();
    const staff = await insertUser("admin");
    const lockouts = [1, 5, 15] as const;

    // 1,000 IPv6 /64 networks of the range reserved for documentation (RFC
    // 3849), one failed attempt each, 3.6 seconds apart: an hour.
    for (let range = 0; range < 1_000; range += 1) {
      vi.setSystemTime(
        new Date(
          new Date("2026-11-24T13:00:00.000Z").getTime() + range * 3_600,
        ),
      );
      await record(
        newRow({
          event: "sign_in_failed",
          reason: "invalid_credentials",
          userId: staff,
          ip: `2001:db8:0:${range.toString(16)}::1`,
        } as Partial<SecurityEvent>),
      );
      if (range % 300 === 299) {
        await record(
          newRow({
            event: "account_locked",
            lockMinutes: lockouts[Math.floor(range / 300)],
            userId: staff,
          } as Partial<SecurityEvent>),
        );
      }
    }

    expect(
      (await overflowRows()).map(({ dedupe_key, user_id, ip, count }) => ({
        dedupe_key,
        user_id,
        ip,
        count,
      })),
    ).toEqual([
      {
        dedupe_key: `overflow:sign_in_failed:${staff}:2026-11-24T13`,
        user_id: staff,
        ip: null,
        count: 1_000,
      },
    ]);
    expect(
      (await storedEvents())
        .filter(({ event }) => event === "account_locked")
        .map(({ details, count }) => ({ details, count })),
    ).toEqual([
      { details: { lockMinutes: 1 }, count: 1 },
      { details: { lockMinutes: 5 }, count: 1 },
      { details: { lockMinutes: 15 }, count: 1 },
    ]);
    expect(fake.warnings).toHaveLength(1);
  }, 60_000);
});
