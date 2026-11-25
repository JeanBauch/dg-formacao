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
import { columnTypes } from "@/test/db/column-types";
import { statementsSentDuring } from "@/test/db/statements";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp, nextTestIpv6Network } from "@/test/ip";

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

const password = "senha-de-teste-1";
let holders = 0;

// A holder who signed up, with an e-mail of a domain reserved for
// documentation.
async function signedUpHolder() {
  holders += 1;
  const email = `titular-login-${holders}@example.com`;
  const response = await post("/sign-up/email", {
    name: "Maria Fictícia",
    email,
    password,
    adultDeclaration: true,
    acceptance: true,
  });
  expect(response.status).toBe(200);
  const [{ id }] = await owner<{ id: string }[]>`
    select id from app."user" where email = ${email}`;
  return { email, userId: id };
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

// The cookies a response sets, as the browser sends them back.
function cookiesOf(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
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
function setCookie(response: Response, name: string) {
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
    const { email } = await signedUpHolder();

    const response = await post("/sign-in/email", {
      email,
      password,
      rememberMe: true,
    });

    expect(response.status).toBe(200);
    expect(setCookie(response, sessionCookie)).toMatchObject({
      httponly: true,
      secure: true,
      samesite: "Lax",
      "max-age": String(7 * 24 * 60 * 60),
    });
  });

  test("without 'Lembrar de mim' sets a session cookie that ends when the browser closes: no Max-Age nor Expires", async () => {
    const { email } = await signedUpHolder();

    const response = await post("/sign-in/email", {
      email,
      password,
      rememberMe: false,
    });

    expect(response.status).toBe(200);
    const cookie = setCookie(response, sessionCookie);
    expect(cookie).toMatchObject({
      httponly: true,
      secure: true,
      samesite: "Lax",
    });
    expect(cookie).not.toHaveProperty("max-age");
    expect(cookie).not.toHaveProperty("expires");
  });

  describe("with 'Lembrar de mim', the session", () => {
    // Only Date is faked: the database driver keeps its real timers.
    const signedInAt = new Date("2026-11-24T13:05:30.000Z");

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(signedInAt);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("lasts 7 days, and a use within the day does not renew it", async () => {
      const { email } = await signedUpHolder();
      const response = await post("/sign-in/email", {
        email,
        password,
        rememberMe: true,
      });
      const token = await sessionToken(response);

      expect(await sessionExpiry(token)).toEqual(
        new Date(signedInAt.getTime() + 7 * day),
      );
      vi.setSystemTime(signedInAt.getTime() + day - 60_000);
      expect((await get("/get-session", cookiesOf(response))).status).toBe(200);
      expect(await sessionExpiry(token)).toEqual(
        new Date(signedInAt.getTime() + 7 * day),
      );
    });

    test("is renewed for 7 more days by a use a day later, and so is its cookie", async () => {
      const { email, userId } = await signedUpHolder();
      const response = await post("/sign-in/email", {
        email,
        password,
        rememberMe: true,
      });
      const usedAt = signedInAt.getTime() + day + 60_000;
      vi.setSystemTime(usedAt);

      const use = await get("/get-session", cookiesOf(response));

      expect(await use.json()).toMatchObject({ user: { id: userId } });
      expect(await sessionExpiry(await sessionToken(response))).toEqual(
        new Date(usedAt + 7 * day),
      );
      expect(setCookie(use, sessionCookie)).toMatchObject({
        "max-age": String(7 * 24 * 60 * 60),
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
    const { email } = await signedUpHolder();
    const signIn = await post("/sign-in/email", { email, password });
    const token = await sessionToken(signIn);
    expect(await sessionsWithToken(token)).toBe(1);

    const response = await post("/sign-out", {}, { cookie: cookiesOf(signIn) });

    expect(response.status).toBe(200);
    expect(await sessionsWithToken(token)).toBe(0);
    expect(setCookie(response, sessionCookie)).toMatchObject({
      "max-age": "0",
    });
  });

  test("leaves the old cookie unauthenticated", async () => {
    const { email } = await signedUpHolder();
    const signIn = await post("/sign-in/email", { email, password });
    const oldCookie = cookiesOf(signIn);
    await post("/sign-out", {}, { cookie: oldCookie });

    const response = await get("/get-session", oldCookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});

describe("the session of a sign-in (A5.4)", () => {
  test("keeps no IP, and the rate limit still counts the sign-in by the client's IP", async () => {
    const { email } = await signedUpHolder();
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
  // Every sign-in of a test happens at a known instant, so the minute its row
  // falls in is known. Only Date is faked.
  const instant = new Date("2026-11-24T13:05:30.000Z");

  beforeEach(async () => {
    await owner`truncate app.security_events`;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instant);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("gains a sign_in_succeeded row with the time, the account, the full IP and the user agent", async () => {
    const { email, userId } = await signedUpHolder();
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
    const { email, userId } = await signedUpHolder();
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
      const { email } = await signedUpHolder();
      const ip = nextIp();

      await post("/sign-in/email", { email, password }, { ip });

      expect(await securityEvents()).toMatchObject([
        { event: "sign_in_succeeded", ip, count: 1 },
      ]);
    });

    test("in one row for two IPv6 addresses of the same /64, with the first one's", async () => {
      const { email } = await signedUpHolder();
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
      const { email, userId } = await signedUpHolder();

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
    const { email } = await signedUpHolder();

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
    // Only Date is faked, so both sign-ins fall in the same minute and the
    // elapsed time is still measured.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-24T13:05:30.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("writes exactly one session and one occurrence in the security log, a new row or one more on the minute's row, in under 2 s", async () => {
      const { email, userId } = await signedUpHolder();
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
    const { email, userId } = await signedUpHolder();
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
