import { format } from "node:util";
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
import { auth } from "@/data/auth";
import { testBaseUrl } from "@/test/base-url";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp, nextTestIpv6Network } from "@/test/ip";

// Seam 1: the Better Auth HTTP handler, in the process, over the test database.
// The rate limit is on here as in every environment, with its counters in the
// database. The client's IP is simulated in `x-forwarded-for`, and each test
// picks its own, so the counters of one test never reach another. The code
// under test connects as the application role; this file reads the rows and
// cleans up as the migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  await owner.end();
});

// The instant each test starts at. Only Date is faked: the database driver
// keeps its real timers, and the rate limit reads the time through Date.
const instant = new Date("2026-11-24T13:05:30.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
});

afterEach(() => {
  vi.useRealTimers();
});

// The clock, this many seconds after the instant.
function secondsLater(seconds: number) {
  vi.setSystemTime(instant.getTime() + seconds * 1000);
}

function post(path: string, body: Record<string, unknown>, ip: string) {
  return auth.handler(
    new Request(`${testBaseUrl}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: testBaseUrl,
        "x-forwarded-for": ip,
        "user-agent": "Mozilla/5.0 (Navegador Fictício)",
      },
      body: JSON.stringify(body),
    }),
  );
}

// A sign-in attempt with an e-mail that has no account, which Better Auth
// refuses with 401 when the rate limit lets it through.
function signInAttempt(ip: string, email = "ninguem-cadastrado@example.com") {
  return post("/sign-in/email", { email, password: "senha-tentada-1" }, ip);
}

// The counter of the rate limit for this IP and route, as the database keeps it.
function counter(ip: string, route: string) {
  return owner<{ count: number }[]>`
    select count from app.rate_limit where key = ${`${ip}|${route}`}`;
}

describe("the rate limit of the sign-in (A2.11)", () => {
  test("answers 429 to the 6th attempt from the same IP within 60 s, and keeps the counter in the app schema", async () => {
    const ip = nextTestIp();
    const statuses: number[] = [];

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      statuses.push((await signInAttempt(ip)).status);
    }
    secondsLater(59);
    statuses.push((await signInAttempt(ip)).status);

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    expect(await counter(ip, "/sign-in/email")).toEqual([{ count: 5 }]);
  });

  test("counts each IP apart: another IP still gets its first attempt through", async () => {
    const blocked = nextTestIp();
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await signInAttempt(blocked);
    }

    const other = nextTestIp();
    const response = await signInAttempt(other);

    expect(response.status).toBe(401);
    expect(await counter(other, "/sign-in/email")).toEqual([{ count: 1 }]);
  });
});

let signUps = 0;

// A valid sign-up by a fictitious holder, with an e-mail of a domain reserved
// for documentation.
function signUpAttempt(ip: string) {
  signUps += 1;
  return post(
    "/sign-up/email",
    {
      name: "Maria Fictícia",
      email: `titular-limite-${signUps}@example.com`,
      password: "senha-de-teste-1",
      adultDeclaration: true,
      acceptance: true,
    },
    ip,
  );
}

describe("the rate limit of the sign-up (A2.11)", () => {
  test("answers 429 to the 4th attempt from the same IP within 60 s, and keeps the counter in the app schema", async () => {
    const ip = nextTestIp();
    const statuses: number[] = [];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      statuses.push((await signUpAttempt(ip)).status);
    }
    secondsLater(59);
    statuses.push((await signUpAttempt(ip)).status);

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(await counter(ip, "/sign-up/email")).toEqual([{ count: 3 }]);
  });
});

// The names the rules of the rate limit match a route by are the names of its
// counters: Better Auth keys both on the request's path without the base path.
describe("the names of the routes in the rate limit of Better Auth 1.7 (U9)", () => {
  test.each([
    ["/sign-in/email", { email: "ninguem@example.com", password: "senha-1" }],
    ["/sign-up/email", { email: "ninguem@example.com" }],
    ["/request-password-reset", { email: "ninguem@example.com" }],
    ["/send-verification-email", { email: "ninguem@example.com" }],
  ])("are %s", async (route, body) => {
    const ip = nextTestIp();

    await post(route, body, ip);

    expect(await counter(ip, route)).toEqual([{ count: 1 }]);
  });
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

// The rows of the security log with this event, oldest first.
function securityEvents(event: string) {
  return owner<StoredEvent[]>`
    select event, user_id, ip, user_agent, route, details, count, first_at,
      last_at
    from app.security_events where event = ${event} order by first_at, id`;
}

describe("the security log of a request the rate limit blocks (A5.1, A5.2)", () => {
  beforeEach(async () => {
    await owner`truncate app.security_events`;
  });

  test("gains a rate_limited row with the time, the route, the client's full IP and the user agent, and no account", async () => {
    const ip = nextTestIp();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await signInAttempt(ip);
    }

    await signInAttempt(ip);

    expect(await securityEvents("rate_limited")).toEqual([
      {
        event: "rate_limited",
        user_id: null,
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

  test("of a sign-up names the sign-up's route", async () => {
    const ip = nextTestIp();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await signUpAttempt(ip);
    }

    await signUpAttempt(ip);

    expect(await securityEvents("rate_limited")).toMatchObject([
      { ip, route: "/sign-up/email", count: 1 },
    ]);
  });
});

// What `run` returns, and everything printed while it ran, as one text: Better
// Auth's logger prints to the console.
async function printedDuring<T>(run: () => Promise<T>) {
  const printed: string[] = [];
  const spies = (["error", "warn", "info", "log"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args) => {
      printed.push(format(...args));
    }),
  );
  try {
    return { result: await run(), printed: printed.join("\n") };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

describe("a request the rate limit blocks, when its security log write fails", () => {
  // The application role loses the right to add rows to the security log
  // while each test runs, so the database refuses the write.
  beforeEach(async () => {
    await owner`revoke insert on app.security_events from dg_app`;
  });

  afterEach(async () => {
    await owner`grant insert on app.security_events to dg_app`;
  });

  test("is still refused with 429, and the failure is logged without the IP or the user agent (RNF-SEG-15)", async () => {
    const ip = nextTestIp();
    await printedDuring(async () => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await signInAttempt(ip);
      }
    });

    const { result: response, printed } = await printedDuring(() =>
      signInAttempt(ip),
    );

    expect(response.status).toBe(429);
    expect(printed).toMatch(
      /Rate limit refusal failed recording its security event: \w+ \(42501\)/,
    );
    expect(printed).not.toContain(ip);
    expect(printed).not.toContain("Navegador Fictício");
  });
});

describe("six failed sign-ins of one e-mail with no account, from one IP range in one minute (A5.15)", () => {
  beforeEach(async () => {
    await owner`truncate app.security_events`;
  });

  test("leave one sign_in_failed row counting 5 and one rate_limited row counting 1, and no lockout", async () => {
    // Six addresses of one IPv6 /64: the rate limit counts them as one IP, and
    // the security log as one range.
    const network = nextTestIpv6Network();

    for (let host = 1; host <= 6; host += 1) {
      await signInAttempt(`${network}::${host}`, "sem-conta-a515@example.com");
    }

    expect(
      await owner`
        select event, user_id, ip, count from app.security_events
        order by event`,
    ).toEqual([
      { event: "sign_in_failed", user_id: null, ip: `${network}::1`, count: 5 },
      { event: "rate_limited", user_id: null, ip: `${network}::6`, count: 1 },
    ]);
  });
});
