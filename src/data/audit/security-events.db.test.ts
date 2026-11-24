import { v7 as uuidv7 } from "uuid";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { recordSecurityEvent } from "@/data/audit";
import type { SecurityEvent } from "@/domain/audit";
import { createFakeTelemetry } from "@/infra/telemetry/fake";
import { columnTypes } from "@/test/db/column-types";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp } from "@/test/ip";

// Seam 2: the audit module's public interface, over the test database, as the
// application role. This file reads the rows and cleans up as the migrations
// role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);
const app = connect(testDatabase.appUrl);

// Every event of a test happens at a known instant, so the minute it falls in
// is known. Only Date is faked: the database driver keeps its real timers.
const instant = new Date("2026-11-24T13:05:30.000Z");

beforeEach(async () => {
  await owner`truncate app.security_events`;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await Promise.all([owner.end(), app.end()]);
});

type StoredEvent = {
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
    select event, user_id, ip, user_agent, route, details, count, first_at,
      last_at
    from app.security_events order by first_at, id`;
}

describe("the security log's events (A5.1)", () => {
  test("have their type in a closed database enum with the eight values", async () => {
    const values = await owner<{ value: string }[]>`
      select e.enumlabel as value from pg_attribute a
      join pg_enum e on e.enumtypid = a.atttypid
      where a.attrelid = 'app.security_events'::regclass and a.attname = 'event'
      order by e.enumsortorder`;

    expect(values.map(({ value }) => value)).toEqual([
      "sign_in_succeeded",
      "sign_in_failed",
      "staff_sign_in_succeeded",
      "password_reset_requested",
      "password_reset_completed",
      "rate_limited",
      "account_locked",
      "access_denied",
    ]);
  });

  test("keep the user in the type of the user's ID, text, the full IP in inet and up to 256 characters of user agent", async () => {
    // The user's ID has the type that A2.6 recorded.
    expect(await columnTypes(owner, 'app."user"')).toMatchObject({
      id: "text",
    });
    expect(await columnTypes(owner, "app.security_events")).toMatchObject({
      user_id: "text",
      ip: "inet",
      user_agent: "character varying(256)",
    });
  });

  test("the database refuses an event type outside the enum", async () => {
    await expect(app`
      insert into app.security_events
        (id, event, route, count, first_at, last_at, dedupe_key)
      values (${uuidv7()}, 'pin_locked', '/sign-in/email', 1, now(), now(),
        'pin_locked')`).rejects.toMatchObject({
      code: "22P02", // invalid_text_representation
    });
  });

  test("an event becomes a row with its time, type, account, full IP and user agent", async () => {
    const userId = uuidv7();
    const ip = nextTestIp();

    await recordSecurityEvent({
      event: "sign_in_succeeded",
      userId,
      ip,
      userAgent: "Mozilla/5.0 (Navegador Fictício)",
      route: "/sign-in/email",
    });

    expect(await storedEvents()).toEqual([
      {
        event: "sign_in_succeeded",
        user_id: userId,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/sign-in/email",
        details: null,
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
  });
});

describe("a row of the security log has a fixed size (A5.13)", () => {
  // What every occurrence below shares: no user, so only the event and its
  // details tell the rows apart. Each one comes from its own simulated IP.
  function anonymous() {
    return {
      userId: null,
      ip: nextTestIp(),
      userAgent: null,
      route: "/sign-in/email",
    };
  }

  test.each<[string, SecurityEvent, unknown]>([
    [
      "the reason of a failed sign-in",
      {
        ...anonymous(),
        event: "sign_in_failed",
        reason: "invalid_credentials",
      },
      { reason: "invalid_credentials" },
    ],
    [
      "the reason of a staff sign-in refused for a short password",
      {
        ...anonymous(),
        event: "sign_in_failed",
        reason: "staff_password_too_short",
      },
      { reason: "staff_password_too_short" },
    ],
    [
      "the status of a 404 refusal",
      { ...anonymous(), event: "access_denied", status: 404 },
      { status: 404 },
    ],
    [
      "the status of a 403 refusal",
      { ...anonymous(), event: "access_denied", status: 403 },
      { status: 403 },
    ],
    [
      "the level of an account lockout",
      { ...anonymous(), event: "account_locked", lockMinutes: 15 },
      { lockMinutes: 15 },
    ],
    [
      "nothing for a successful sign-in",
      { ...anonymous(), event: "sign_in_succeeded" },
      null,
    ],
    [
      "nothing for a staff sign-in",
      { ...anonymous(), event: "staff_sign_in_succeeded" },
      null,
    ],
    [
      "nothing for a password reset request",
      { ...anonymous(), event: "password_reset_requested" },
      null,
    ],
    [
      "nothing for a completed password reset",
      { ...anonymous(), event: "password_reset_completed" },
      null,
    ],
    [
      "nothing for a rate-limit block",
      { ...anonymous(), event: "rate_limited" },
      null,
    ],
  ])("whose details hold %s", async (_, occurrence, details) => {
    await recordSecurityEvent(occurrence);

    expect(await storedEvents()).toEqual([
      expect.objectContaining({ event: occurrence.event, details }),
    ]);
  });

  test("whose user agent of 8 KB keeps its first 256 characters", async () => {
    // A user agent of 8,192 characters, with a character outside the BMP at
    // the cut, which counts as one character.
    const userAgent = `${"M".repeat(255)}😀${"x".repeat(7_936)}`;

    await recordSecurityEvent({
      ...anonymous(),
      event: "sign_in_succeeded",
      userAgent,
    });

    const [row] = await storedEvents();
    expect(row.user_agent).toBe(`${"M".repeat(255)}😀`);
  });

  test.each([
    ["a route of the list as it is", "/sign-in/email", "/sign-in/email"],
    [
      "a path with a dynamic segment as its pattern",
      "/reset-password/token-ficticio-123",
      "/reset-password/[token]",
    ],
    ["a path outside the list as other", "/cursos/curso-ficticio", "other"],
    [
      "a path with a query string as other",
      "/sign-in/email?retorno=/conta",
      "other",
    ],
  ])("whose route keeps %s", async (_, route, stored) => {
    await recordSecurityEvent({ ...anonymous(), event: "rate_limited", route });

    expect(await storedEvents()).toEqual([
      expect.objectContaining({ route: stored }),
    ]);
  });

  test("whose details leave out anything else the occurrence carries", async () => {
    // An e-mail that reached the call by mistake, as from an untyped caller.
    const occurrence = {
      ...anonymous(),
      event: "sign_in_failed",
      reason: "invalid_credentials",
      email: "titular@example.com",
    } as const;

    await recordSecurityEvent(occurrence);

    const [row] = await storedEvents();
    expect(row.details).toEqual({ reason: "invalid_credentials" });
    expect(JSON.stringify(row)).not.toContain("titular@example.com");
  });
});

describe("the occurrences of an event in a minute (A5.3)", () => {
  const holder = uuidv7();

  // The test's own simulated IP, which every occurrence of the test shares.
  let ip: string;

  beforeEach(() => {
    ip = nextTestIp();
  });

  // A failed sign-in of a known user, from the test's IP.
  function failure(change: Partial<SecurityEvent> = {}) {
    return {
      event: "sign_in_failed",
      reason: "invalid_credentials",
      userId: holder,
      ip,
      userAgent: "Mozilla/5.0 (Navegador Fictício)",
      route: "/sign-in/email",
      ...change,
    } as SecurityEvent;
  }

  test("of two users make one row each", async () => {
    const otherUser = uuidv7();

    await recordSecurityEvent(failure());
    await recordSecurityEvent(failure({ userId: otherUser }));
    await recordSecurityEvent(failure({ userId: null }));
    await recordSecurityEvent(failure());

    expect(
      (await storedEvents()).map(({ user_id, count }) => ({ user_id, count })),
    ).toEqual([
      { user_id: holder, count: 2 },
      { user_id: otherUser, count: 1 },
      { user_id: null, count: 1 },
    ]);
  });

  test("make one row with the first and the last time, and the next minute, in UTC, starts a new row", async () => {
    // 13:05:30 UTC, the instant every test starts at.
    await recordSecurityEvent(failure());
    vi.setSystemTime(new Date("2026-11-24T13:05:59.999Z"));
    await recordSecurityEvent(failure());
    vi.setSystemTime(new Date("2026-11-24T13:06:00.000Z"));
    await recordSecurityEvent(failure());

    expect(
      (await storedEvents()).map(({ count, first_at, last_at }) => ({
        count,
        first_at,
        last_at,
      })),
    ).toEqual([
      {
        count: 2,
        first_at: new Date("2026-11-24T13:05:30.000Z"),
        last_at: new Date("2026-11-24T13:05:59.999Z"),
      },
      {
        count: 1,
        first_at: new Date("2026-11-24T13:06:00.000Z"),
        last_at: new Date("2026-11-24T13:06:00.000Z"),
      },
    ]);
  });

  test("recorded out of order keep the earliest time as the first and the latest as the last", async () => {
    // Two requests of the same minute whose inserts reach the database in the
    // reverse order of their times.
    vi.setSystemTime(new Date("2026-11-24T13:05:59.995Z"));
    await recordSecurityEvent(failure());
    vi.setSystemTime(new Date("2026-11-24T13:05:59.990Z"));
    await recordSecurityEvent(failure());

    expect(
      (await storedEvents()).map(({ count, first_at, last_at }) => ({
        count,
        first_at,
        last_at,
      })),
    ).toEqual([
      {
        count: 2,
        first_at: new Date("2026-11-24T13:05:59.990Z"),
        last_at: new Date("2026-11-24T13:05:59.995Z"),
      },
    ]);
  });

  test("with two reasons of a failed sign-in, or two refusal statuses, make one row each", async () => {
    const refusal = { ...failure(), event: "access_denied" } as const;

    await recordSecurityEvent(failure({ reason: "invalid_credentials" }));
    await recordSecurityEvent(failure({ reason: "staff_password_too_short" }));
    await recordSecurityEvent(failure({ reason: "invalid_credentials" }));
    await recordSecurityEvent({ ...refusal, status: 404 });
    await recordSecurityEvent({ ...refusal, status: 403 });

    expect(
      (await storedEvents()).map(({ details, count }) => ({ details, count })),
    ).toEqual([
      { details: { reason: "invalid_credentials" }, count: 2 },
      { details: { reason: "staff_password_too_short" }, count: 1 },
      { details: { status: 404 }, count: 1 },
      { details: { status: 403 }, count: 1 },
    ]);
  });

  test("of account lockouts share one row whatever their level, with the first one's", async () => {
    const lockout = { ...failure(), event: "account_locked" } as const;

    await recordSecurityEvent({ ...lockout, lockMinutes: 1 });
    await recordSecurityEvent({ ...lockout, lockMinutes: 5 });

    expect(
      (await storedEvents()).map(({ details, count }) => ({ details, count })),
    ).toEqual([{ details: { lockMinutes: 1 }, count: 2 }]);
  });

  test("from one IP range make one row, with the first occurrence's full IP and user agent", async () => {
    // Better Auth's rate-limit range: an IPv4 address whole, an IPv4-mapped
    // IPv6 address as its IPv4, and an IPv6 address by its /64 network.
    await recordSecurityEvent(
      failure({ ip: "2001:db8:0:1::a", userAgent: "Primeiro Navegador" }),
    );
    await recordSecurityEvent(
      failure({ ip: "2001:db8:0:1:ffff::b", userAgent: "Segundo Navegador" }),
    );
    await recordSecurityEvent(failure({ ip: "2001:db8:0:2::a" }));
    await recordSecurityEvent(failure({ ip: "192.0.2.1" }));
    await recordSecurityEvent(failure({ ip: "::ffff:192.0.2.1" }));
    await recordSecurityEvent(failure({ ip: "192.0.2.2" }));

    expect(
      (await storedEvents()).map(({ ip, user_agent, count }) => ({
        ip,
        user_agent,
        count,
      })),
    ).toEqual([
      { ip: "2001:db8:0:1::a", user_agent: "Primeiro Navegador", count: 2 },
      {
        ip: "2001:db8:0:2::a",
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        count: 1,
      },
      {
        ip: "192.0.2.1",
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        count: 2,
      },
      {
        ip: "192.0.2.2",
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        count: 1,
      },
    ]);
  });

  test.each(["::ffff:192.0.2.1", "::ffff:c000:201"])(
    "from the IPv4-mapped IPv6 address %s keep its IPv4, which a search by the IPv4 finds",
    async (mapped) => {
      await recordSecurityEvent(failure({ ip: mapped }));

      expect(
        await owner`
          select count from app.security_events
          where ip = '192.0.2.1' and ip <<= '192.0.2.0/24'`,
      ).toEqual([{ count: 1 }]);
    },
  );

  test("from a value that is not an IP make the row of no IP, without failing", async () => {
    await recordSecurityEvent(failure({ ip: "not-an-ip" }));
    await recordSecurityEvent(failure({ ip: null }));

    expect(
      (await storedEvents()).map(({ ip, count }) => ({ ip, count })),
    ).toEqual([{ ip: null, count: 2 }]);
  });

  test.each<[string, SecurityEvent, string]>([
    [
      "an anonymous failure from an IPv4 address",
      {
        event: "sign_in_failed",
        reason: "invalid_credentials",
        userId: null,
        ip: "192.0.2.1",
        userAgent: null,
        route: "/sign-in/email",
      },
      "sign_in_failed:invalid_credentials:-:192.0.2.1:/sign-in/email:2026-11-24T13:05",
    ],
    [
      "a user's refusal from an IPv6 address",
      {
        event: "access_denied",
        status: 404,
        userId: holder,
        ip: "2001:db8:0:1::a",
        userAgent: null,
        route: "/backoffice",
      },
      `access_denied:404:${holder}:2001:0db8:0000:0001:0000:0000:0000:0000:/backoffice:2026-11-24T13:05`,
    ],
    [
      "a rate-limit block with no IP",
      {
        event: "rate_limited",
        userId: null,
        ip: null,
        userAgent: null,
        route: "/cursos/curso-ficticio",
      },
      "rate_limited:-:-:-:other:2026-11-24T13:05",
    ],
  ])(
    "are keyed by event, detail, user, IP range, route and minute, as in %s",
    async (_, occurrence, key) => {
      await recordSecurityEvent(occurrence);

      expect(await owner`select dedupe_key from app.security_events`).toEqual([
        { dedupe_key: key },
      ]);
    },
  );

  test("of a rate-limit block, 20 in one minute, make one row of 20, and the next minute a new row", async () => {
    const blocked = {
      event: "rate_limited",
      userId: null,
      ip,
      userAgent: null,
      route: "/sign-in/email",
    } as const;

    for (let request = 0; request < 20; request += 1) {
      await recordSecurityEvent(blocked);
    }
    vi.setSystemTime(new Date("2026-11-24T13:06:10.000Z"));
    await recordSecurityEvent(blocked);

    expect(
      (await storedEvents()).map(({ event, count }) => ({ event, count })),
    ).toEqual([
      { event: "rate_limited", count: 20 },
      { event: "rate_limited", count: 1 },
    ]);
  });

  test("on two routes make one row each", async () => {
    const blocked = { ...failure(), event: "rate_limited" } as const;

    await recordSecurityEvent({ ...blocked, route: "/sign-in/email" });
    await recordSecurityEvent({ ...blocked, route: "/sign-up/email" });
    await recordSecurityEvent({ ...blocked, route: "/sign-in/email" });

    expect(
      (await storedEvents()).map(({ route, count }) => ({ route, count })),
    ).toEqual([
      { route: "/sign-in/email", count: 2 },
      { route: "/sign-up/email", count: 1 },
    ]);
  });
});

describe("a sign-in attack (A5.12, NF-5)", () => {
  // 25 IPv4 addresses and 25 IPv6 /64 networks, in the ranges reserved for
  // documentation (RFC 5737 and RFC 3849). Each IPv6 attempt comes from another
  // address of its network.
  const ranges = Array.from({ length: 25 }, (_, n) => [
    () => `198.51.100.${n + 1}`,
    (attempt: number) =>
      `2001:db8:0:${n.toString(16)}::${attempt.toString(16)}`,
  ]).flat();

  test("of 5,000 failures with e-mails that have no account, from 50 IP ranges in the same minute, adds at most 50 rows that count 5,000", async () => {
    const attempts = Array.from({ length: 5_000 }, (_, attempt) =>
      recordSecurityEvent({
        event: "sign_in_failed",
        reason: "invalid_credentials",
        userId: null,
        ip: ranges[attempt % ranges.length](attempt + 1),
        userAgent: "Mozilla/5.0 (Robô Fictício)",
        route: "/sign-in/email",
      }),
    );
    await Promise.all(attempts);

    const [{ rows, total }] = await owner<{ rows: number; total: number }[]>`
      select count(*)::int as rows, sum(count)::int as total
      from app.security_events`;
    // One row per IP range (A5.3), so 50 at most.
    expect({ rows, total }).toEqual({ rows: 50, total: 5_000 });
  }, 60_000);
});

describe("two simultaneous occurrences with the same key (A5.10)", () => {
  test("leave one row, with count 2", async () => {
    const occurrence = {
      event: "sign_in_succeeded",
      userId: uuidv7(),
      ip: nextTestIp(),
      userAgent: "Mozilla/5.0 (Navegador Fictício)",
      route: "/sign-in/email",
    } as const;

    await Promise.all([
      recordSecurityEvent(occurrence),
      recordSecurityEvent(occurrence),
    ]);

    expect(await storedEvents()).toEqual([
      expect.objectContaining({ event: "sign_in_succeeded", count: 2 }),
    ]);
  });

  test("leave one row, with count 2, also with no user and no IP", async () => {
    const occurrence = {
      event: "password_reset_requested",
      userId: null,
      ip: null,
      userAgent: null,
      route: "/request-password-reset",
    } as const;

    await Promise.all([
      recordSecurityEvent(occurrence),
      recordSecurityEvent(occurrence),
    ]);

    expect(await storedEvents()).toEqual([
      expect.objectContaining({
        event: "password_reset_requested",
        user_id: null,
        ip: null,
        count: 2,
      }),
    ]);
  });
});

describe("the daily cap of new rows (A5.14)", () => {
  test("is 1,000 by default: the 1,000th new row of the day is a row, and the next one goes to overflow", async () => {
    const { telemetry, warnings } = createFakeTelemetry();
    // One failed sign-in from each of 1,001 IPv6 /64 networks of the range
    // reserved for documentation (RFC 3849).
    const attempt = (range: number) =>
      recordSecurityEvent(
        {
          event: "sign_in_failed",
          reason: "invalid_credentials",
          userId: null,
          ip: `2001:db8:0:${range.toString(16)}::1`,
          userAgent: null,
          route: "/sign-in/email",
        },
        telemetry,
      );

    for (let range = 0; range < 1_000; range += 1) {
      await attempt(range);
    }
    expect(
      await owner`select count(*)::int as rows from app.security_events`,
    ).toEqual([{ rows: 1_000 }]);
    expect(warnings).toEqual([]);

    await attempt(1_000);

    expect(
      await owner`
        select dedupe_key, count from app.security_events
        where dedupe_key like 'overflow:%'`,
    ).toEqual([
      { dedupe_key: "overflow:sign_in_failed:2026-11-24T13", count: 1 },
    ]);
    expect(warnings).toHaveLength(1);
  }, 60_000);
});
