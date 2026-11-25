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
import { cookiesOf } from "@/test/cookies";
import { columnTypes } from "@/test/db/column-types";
import { statementsSentDuring } from "@/test/db/statements";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp, nextTestIpv6Network } from "@/test/ip";
import { holderPassword as password, signedInHolder } from "@/test/request";

// Seam 1: the Better Auth HTTP handler, in the process, over the test database,
// at the base URL of the tests, which is https. The code under test connects as
// the application role; this file reads the rows and cleans up as the
// migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  await owner.end();
});

// The instant the tests that need a known time run at. Only Date is faked: the
// database driver keeps its real timers, and an elapsed time is still measured.
const instant = new Date("2026-11-24T13:05:30.000Z");

// Stops the clock at the instant for each test of the block it is called in.
function stopClockAtInstant() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instant);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}

function post(
  path: string,
  body: Record<string, unknown>,
  { ip = nextTestIp(), cookie }: { ip?: string; cookie?: string } = {},
) {
  return auth.handler(
    new Request(`${testBaseUrl}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: testBaseUrl,
        "x-forwarded-for": ip,
        "user-agent": "Mozilla/5.0 (Navegador Fictício)",
        ...(cookie && { cookie }),
      },
      body: JSON.stringify(body),
    }),
  );
}

function get(path: string, cookie: string) {
  return auth.handler(
    new Request(`${testBaseUrl}/api/auth${path}`, {
      headers: { cookie, "x-forwarded-for": nextTestIp() },
    }),
  );
}

// The token of the session a sign-in created, which its answer carries.
async function sessionToken(signIn: Response) {
  const { token } = (await signIn.clone().json()) as { token: string };
  return token;
}

// When the session with this token expires, as the database keeps it.
async function sessionExpiry(token: string) {
  const [{ expires_at }] = await owner<{ expires_at: Date }[]>`
    select expires_at from app.session where token = ${token}`;
  return expires_at;
}

const day = 24 * 60 * 60 * 1000;

// The attributes of the cookie with this name that a response sets, by
// attribute name in lower case, or undefined when it sets no such cookie.
function cookieAttributes(response: Response, name: string) {
  const found = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${name}=`));
  if (found === undefined) return undefined;
  const [, ...attributes] = found.split(";").map((part) => part.trim());
  return Object.fromEntries(
    attributes.map((attribute) => {
      const [key, value = true] = attribute.split("=");
      return [key.toLowerCase(), value];
    }),
  );
}

// Better Auth's session cookie, with the prefix it takes under an https base URL.
const sessionCookie = "__Secure-better-auth.session_token";

describe("a sign-in with the right e-mail and password (A2.7)", () => {
  test("with 'Lembrar de mim' sets the session cookie httpOnly, Secure and SameSite=Lax, for 7 days", async () => {
    const { email } = await signedInHolder();

    const response = await post("/sign-in/email", {
      email,
      password,
      rememberMe: true,
    });

    expect(response.status).toBe(200);
    expect(cookieAttributes(response, sessionCookie)).toMatchObject({
      httponly: true,
      secure: true,
      samesite: "Lax",
      "max-age": "604800",
    });
  });

  test("without 'Lembrar de mim' sets a session cookie that ends when the browser closes: no Max-Age nor Expires", async () => {
    const { email } = await signedInHolder();

    const response = await post("/sign-in/email", {
      email,
      password,
      rememberMe: false,
    });

    expect(response.status).toBe(200);
    const cookie = cookieAttributes(response, sessionCookie);
    expect(cookie).toMatchObject({
      httponly: true,
      secure: true,
      samesite: "Lax",
    });
    expect(cookie).not.toHaveProperty("max-age");
    expect(cookie).not.toHaveProperty("expires");
  });

  describe("with 'Lembrar de mim', the session", () => {
    // The holder signs in at the instant.
    stopClockAtInstant();

    test("lasts 7 days, and a use within the day does not renew it", async () => {
      const { email } = await signedInHolder();
      const response = await post("/sign-in/email", {
        email,
        password,
        rememberMe: true,
      });
      const token = await sessionToken(response);

      expect(await sessionExpiry(token)).toEqual(
        new Date(instant.getTime() + 7 * day),
      );
      vi.setSystemTime(instant.getTime() + day - 60_000);
      expect((await get("/get-session", cookiesOf(response))).status).toBe(200);
      expect(await sessionExpiry(token)).toEqual(
        new Date(instant.getTime() + 7 * day),
      );
    });

    test("is renewed for 7 more days by a use a day later, and so is its cookie", async () => {
      const { email, userId } = await signedInHolder();
      const response = await post("/sign-in/email", {
        email,
        password,
        rememberMe: true,
      });
      const usedAt = instant.getTime() + day + 60_000;
      vi.setSystemTime(usedAt);

      const use = await get("/get-session", cookiesOf(response));

      expect(await use.json()).toMatchObject({ user: { id: userId } });
      expect(await sessionExpiry(await sessionToken(response))).toEqual(
        new Date(usedAt + 7 * day),
      );
      expect(cookieAttributes(use, sessionCookie)).toMatchObject({
        "max-age": "604800",
      });
    });
  });
});

// The sessions with this token in the database: one, or none.
async function sessionsWithToken(token: string) {
  const [{ sessions }] = await owner<{ sessions: number }[]>`
    select count(*)::int as sessions from app.session where token = ${token}`;
  return sessions;
}

describe("a sign-out (A2.8)", () => {
  test("deletes the session from the database and clears its cookie", async () => {
    const { email } = await signedInHolder();
    const signIn = await post("/sign-in/email", { email, password });
    const token = await sessionToken(signIn);
    expect(await sessionsWithToken(token)).toBe(1);

    const response = await post("/sign-out", {}, { cookie: cookiesOf(signIn) });

    expect(response.status).toBe(200);
    expect(await sessionsWithToken(token)).toBe(0);
    expect(cookieAttributes(response, sessionCookie)).toMatchObject({
      "max-age": "0",
    });
  });

  test("leaves the old cookie unauthenticated", async () => {
    const { email } = await signedInHolder();
    const signIn = await post("/sign-in/email", { email, password });
    const oldCookie = cookiesOf(signIn);
    await post("/sign-out", {}, { cookie: oldCookie });

    const response = await get("/get-session", oldCookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  describe("whose session deletion fails", () => {
    // The application role loses the right to delete sessions while each test
    // runs, so the database refuses the deletion.
    beforeEach(async () => {
      await owner`revoke delete on app.session from dg_app`;
    });

    afterEach(async () => {
      await owner`grant delete on app.session to dg_app`;
    });

    test("logs the failure without the session's token (RNF-OBS-01)", async () => {
      const { email } = await signedInHolder();
      const signIn = await post("/sign-in/email", { email, password });
      const token = await sessionToken(signIn);

      const { printed } = await printedDuring(() =>
        post("/sign-out", {}, { cookie: cookiesOf(signIn) }),
      );

      expect(printed).toMatch(/\w+ \(42501\)/);
      expect(printed).not.toContain(token);
    });
  });
});

describe("the session of a sign-in (A5.4)", () => {
  test("keeps no IP, and the rate limit still counts the sign-in by the client's IP", async () => {
    const { email } = await signedInHolder();
    const ip = nextTestIp();

    const response = await post("/sign-in/email", { email, password }, { ip });

    const [session] = await owner<{ ip_address: string | null }[]>`
      select ip_address from app.session
      where token = ${await sessionToken(response)}`;
    expect(session).toEqual({ ip_address: null });
    expect(
      await owner`select count from app.rate_limit where key = ${`${ip}|/sign-in/email`}`,
    ).toEqual([{ count: 1 }]);
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

// The rows of the security log, oldest first.
function securityEvents() {
  return owner<StoredEvent[]>`
    select event, user_id, ip, user_agent, route, details, count, first_at,
      last_at
    from app.security_events order by first_at, id`;
}

describe("the security log of a sign-in (A5.1)", () => {
  beforeEach(async () => {
    await owner`truncate app.security_events`;
  });

  // Every sign-in of a test happens at the instant, so the minute its row falls
  // in is known.
  stopClockAtInstant();

  test("gains a sign_in_succeeded row with the time, the account, the full IP and the user agent", async () => {
    const { email, userId } = await signedInHolder();
    const ip = nextTestIp();

    await post("/sign-in/email", { email, password }, { ip });

    expect(await securityEvents()).toEqual([
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

  test("gains a sign_in_failed row with the account, when the e-mail has one and the password is wrong", async () => {
    const { email, userId } = await signedInHolder();
    const ip = nextTestIp();

    await post(
      "/sign-in/email",
      { email, password: "outra-senha-errada" },
      { ip },
    );

    expect(await securityEvents()).toEqual([
      {
        event: "sign_in_failed",
        user_id: userId,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/sign-in/email",
        details: { reason: "invalid_credentials" },
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
  });

  test("gains a sign_in_failed row with no account when the e-mail has none, and no row keeps the e-mail tried (A5.9)", async () => {
    const ip = nextTestIp();
    const email = "Sem.Conta.A59@example.com";

    await post(
      "/sign-in/email",
      { email, password: "senha-tentada-1" },
      { ip },
    );

    expect(await securityEvents()).toEqual([
      {
        event: "sign_in_failed",
        user_id: null,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/sign-in/email",
        details: { reason: "invalid_credentials" },
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
    // Nor its part before the @, in any case and in any column, the key
    // included; nor the password tried (RNF-OBS-01).
    expect(
      await owner`
        select dedupe_key from app.security_events s
        where row_to_json(s)::text ilike any (array[
          ${"%sem.conta.a59%"}, ${"%senha-tentada%"}])`,
    ).toEqual([]);
  });

  describe("keeps the client's IP (A5.11)", () => {
    test("in a column of type inet", async () => {
      expect(await columnTypes(owner, "app.security_events")).toMatchObject({
        ip: "inet",
      });
    });

    test.each([
      ["an IPv4 address", () => nextTestIp()],
      ["an IPv6 address", () => `${nextTestIpv6Network()}::a1`],
    ])("as it came, for %s", async (_, nextIp) => {
      const { email } = await signedInHolder();
      const ip = nextIp();

      await post("/sign-in/email", { email, password }, { ip });

      expect(await securityEvents()).toMatchObject([
        { event: "sign_in_succeeded", ip, count: 1 },
      ]);
    });

    test.each([
      ["a trailing comma", (ip: string) => `${ip},`],
      ["spaces around it", (ip: string) => `${ip} , `],
    ])(
      "the one the rate limit counts, for one address with %s",
      async (_, header) => {
        const { email } = await signedInHolder();
        const ip = nextTestIp();

        await post("/sign-in/email", { email, password }, { ip: header(ip) });

        expect(await securityEvents()).toMatchObject([
          { event: "sign_in_succeeded", ip, count: 1 },
        ]);
        expect(
          await owner`select count from app.rate_limit where key = ${`${ip}|/sign-in/email`}`,
        ).toEqual([{ count: 1 }]);
      },
    );

    test("in one row for two IPv6 addresses of the same /64, with the first one's", async () => {
      const { email } = await signedInHolder();
      const network = nextTestIpv6Network();

      await post(
        "/sign-in/email",
        { email, password },
        { ip: `${network}::1` },
      );
      await post(
        "/sign-in/email",
        { email, password },
        { ip: `${network}::2` },
      );

      expect(await securityEvents()).toMatchObject([
        { event: "sign_in_succeeded", ip: `${network}::1`, count: 2 },
      ]);
    });

    test("empty for a value that is not an IP, and the sign-in still succeeds", async () => {
      const { email, userId } = await signedInHolder();

      const response = await post(
        "/sign-in/email",
        { email, password },
        { ip: "nao-e-um-ip" },
      );

      expect(response.status).toBe(200);
      expect(await securityEvents()).toMatchObject([
        { event: "sign_in_succeeded", user_id: userId, ip: null, count: 1 },
      ]);
    });
  });
});

describe("a sign-in with a wrong e-mail or password (A2.10)", () => {
  test("answers the same error, which does not say which of the two is wrong", async () => {
    const { email } = await signedInHolder();

    const wrongPassword = await post("/sign-in/email", {
      email,
      password: "outra-senha-errada",
    });
    const unknownEmail = await post("/sign-in/email", {
      email: "ninguem-cadastrado@example.com",
      password: "outra-senha-errada",
    });

    const answers = [
      { status: wrongPassword.status, body: await wrongPassword.text() },
      { status: unknownEmail.status, body: await unknownEmail.text() },
    ].map(({ status, body }) => ({
      status,
      body: JSON.parse(body) as unknown,
    }));
    expect(answers[0]).toEqual(answers[1]);
    expect(answers[0]).toEqual({
      status: 401,
      body: {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      },
    });
  });
});

// The sessions of a user, and its occurrences and rows in the security log.
async function recordsOf(userId: string) {
  const [records] = await owner<
    { sessions: number; occurrences: number; rows: number }[]
  >`
    select
      (select count(*)::int from app.session where user_id = ${userId})
        as sessions,
      (select coalesce(sum(count), 0)::int from app.security_events
        where user_id = ${userId}) as occurrences,
      (select count(*)::int from app.security_events where user_id = ${userId})
        as rows`;
  return records;
}

describe("the work of a sign-in (NF-2)", () => {
  describe("in one minute", () => {
    // Both sign-ins happen at the instant, so they fall in the same minute.
    stopClockAtInstant();

    test("writes exactly one session and one occurrence in the security log, a new row or one more on the minute's row, in under 2 s", async () => {
      const { email, userId } = await signedInHolder();
      const ip = nextTestIp();
      const before = await recordsOf(userId);
      const started = performance.now();

      const first = await post("/sign-in/email", { email, password }, { ip });

      const elapsed = performance.now() - started;
      const afterFirst = await recordsOf(userId);
      await post("/sign-in/email", { email, password }, { ip });
      const afterSecond = await recordsOf(userId);
      expect(first.status).toBe(200);
      expect(elapsed).toBeLessThan(2_000);
      // The first sign-in of the minute adds a row; the second one, from the
      // same IP, adds 1 to that row's count (A5.3).
      expect(afterFirst).toEqual({
        sessions: before.sessions + 1,
        occurrences: before.occurrences + 1,
        rows: before.rows + 1,
      });
      expect(afterSecond).toEqual({
        sessions: afterFirst.sessions + 1,
        occurrences: afterFirst.occurrences + 1,
        rows: afterFirst.rows,
      });
    });
  });

  test("sends the database the same 8 statements, whatever sessions and events the account already has", async () => {
    const { email, userId } = await signedInHolder();
    const signIn = () =>
      statementsSentDuring(() =>
        post("/sign-in/email", { email, password }, { ip: nextTestIp() }),
      );
    const { statements: first } = await signIn();
    // A history for the account: sessions and successful and failed sign-ins,
    // each from its own IP, so each is a row of its own in the security log.
    for (let index = 0; index < 10; index += 1) {
      await post("/sign-in/email", { email, password });
      await post("/sign-in/email", { email, password: "outra-senha-errada" });
    }
    expect(await recordsOf(userId)).toMatchObject({
      sessions: 12, // the sign-up's, the first measured one's and these 10
      rows: 21,
    });

    const { statements: later } = await signIn();

    // The rate limit of the IP (its row read, then created), the user with
    // the e-mail and its login identities, the user again for the admin
    // plugin's ban check, the session, and the security log: the day's rows
    // for the daily cap, then the minute's row.
    expect(first).toHaveLength(8);
    expect(later).toEqual(first);
  });
});

// What `run` returns, and everything printed while it ran, as one text: Better
// Auth's logger and its router print to the console.
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

describe("a sign-in whose security log write fails", () => {
  // The application role loses the right to add rows to the security log
  // while each test runs, so the database refuses the write.
  beforeEach(async () => {
    await owner`revoke insert on app.security_events from dg_app`;
  });

  afterEach(async () => {
    await owner`grant insert on app.security_events to dg_app`;
  });

  test("with the right password answers an error, and leaves no session and no cookie (NF-2)", async () => {
    const { email, userId } = await signedInHolder();
    const before = await recordsOf(userId);

    const { result: response } = await printedDuring(() =>
      post("/sign-in/email", { email, password }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await recordsOf(userId)).toEqual(before);
    expect(await response.json()).toMatchObject({ code: "SIGN_IN_FAILED" });
  });

  test.each([
    ["the right password", password],
    ["a wrong password", "outra-senha-errada"],
  ])(
    "with %s answers the sign-in's failure, and logs it without the IP, the user agent or the e-mail (RNF-SEG-15, RNF-OBS-01)",
    async (_, tried) => {
      const { email } = await signedInHolder();
      const ip = nextTestIp();

      const { result: response, printed } = await printedDuring(() =>
        post("/sign-in/email", { email, password: tried }, { ip }),
      );

      expect(await response.json()).toMatchObject({ code: "SIGN_IN_FAILED" });
      expect(printed).toMatch(
        /Sign-in failed recording its security event: \w+ \(42501\)/,
      );
      expect(printed).not.toContain(ip);
      expect(printed).not.toContain("Navegador Fictício");
      expect(printed).not.toContain(email);
    },
  );
});
