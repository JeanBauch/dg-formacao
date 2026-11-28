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
import { closedGate, type Gate, removeGate } from "@/test/db/write-gate";
import { nextTestIp } from "@/test/ip";
import { signUp } from "@/test/sign-up";
import { type StaffRole, staffUser } from "@/test/staff";

// Seam 1: the Better Auth HTTP handler, in the process, over the test database,
// signing in the staff users of the tests' staff helper, one per staff role.
// Each attempt comes from its own simulated IP, so the rate limit never
// refuses one. The code under test connects as the application role; this
// file reads the rows and cleans up as the migrations role, which owns the
// tables.
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  await owner.end();
});

function signIn(email: string, password: string, ip = nextTestIp()) {
  return auth.handler(
    new Request(`${testBaseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: testBaseUrl,
        "x-forwarded-for": ip,
        "user-agent": "Mozilla/5.0 (Navegador Fictício)",
      },
      body: JSON.stringify({ email, password }),
    }),
  );
}

async function sessionsOf(userId: string) {
  const [{ sessions }] = await owner<{ sessions: number }[]>`
    select count(*)::int as sessions from app.session
    where user_id = ${userId}`;
  return sessions;
}

// Passwords of 11 and of 12 characters.
const elevenCharacters = "senha-11-ch";
const twelveCharacters = "senha-12-cha";

const staffRoles: StaffRole[] = ["instructor", "admin"];

describe("a staff sign-in with the right password, of fewer than 12 characters (A4.11, U8)", () => {
  let gate: Gate | undefined;

  afterEach(async () => {
    await removeGate(owner, gate);
    gate = undefined;
  });

  test.each(staffRoles)(
    "of an %s, with 11, is refused and sends the person to set a new password, and the session the sign-in created is gone, with its cookie",
    async (role) => {
      const { email, userId, password } = await staffUser(role, {
        password: elevenCharacters,
      });
      // The sign-in writes its session: the write reaches the database and
      // waits there, so the session exists before the after-hook runs.
      gate = await closedGate(owner, "insert", "session", userId);
      const signingIn = signIn(email, password);
      await gate.reached();

      await gate.open();
      const response = await signingIn;

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        code: "STAFF_PASSWORD_TOO_SHORT",
        message:
          'Defina uma senha nova, com pelo menos 12 caracteres, em "Esqueci minha senha".',
      });
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(await sessionsOf(userId)).toBe(0);
    },
  );

  test.each(staffRoles)("of an %s, with 12, signs in", async (role) => {
    const { email, userId, password } = await staffUser(role, {
      password: twelveCharacters,
    });

    const response = await signIn(email, password);

    expect(response.status).toBe(200);
    expect(await sessionsOf(userId)).toBe(1);
  });

  test("of a holder, with 11, signs in: the 12 characters are the staff's", async () => {
    await signUp("titular-onze@example.com", elevenCharacters);

    expect(
      (await signIn("titular-onze@example.com", elevenCharacters)).status,
    ).toBe(200);
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

// The instant the sign-ins of the security log's tests happen at. Only Date is
// faked: the database driver keeps its real timers.
const instant = new Date("2026-11-24T13:05:30.000Z");

describe("the security log of a staff sign-in (A4.13, A4.11)", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instant);
    await owner`truncate app.security_events`;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.each(staffRoles)(
    "of an %s gains one staff_sign_in_succeeded row, in place of sign_in_succeeded, with the time, the account, the full IP and the user agent",
    async (role) => {
      const { email, userId, password } = await staffUser(role);
      const ip = nextTestIp();

      await signIn(email, password, ip);

      expect(await securityEvents()).toEqual([
        {
          event: "staff_sign_in_succeeded",
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
    },
  );

  test("refused for a password of 11 characters gains a sign_in_failed row with that reason", async () => {
    const { email, userId, password } = await staffUser("admin", {
      password: elevenCharacters,
    });
    const ip = nextTestIp();

    await signIn(email, password, ip);

    expect(await securityEvents()).toEqual([
      {
        event: "sign_in_failed",
        user_id: userId,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/sign-in/email",
        details: { reason: "staff_password_too_short" },
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
  });
});

describe("a staff sign-in refused for a password of fewer than 12 characters, and the lockout (A4.11, A2.15)", () => {
  test("neither counts as a failure nor counts the failures from zero: the password was right", async () => {
    const { email, password } = await staffUser("instructor", {
      password: elevenCharacters,
    });
    for (let failure = 1; failure <= 4; failure += 1) {
      expect((await signIn(email, "outra-senha-errada")).status).toBe(401);
    }

    // Counted as failures, these would have locked the sign-in at the first.
    expect((await signIn(email, password)).status).toBe(403);
    expect((await signIn(email, password)).status).toBe(403);
    // The failures before them still count: this is the 5th in a row.
    expect((await signIn(email, "outra-senha-errada")).status).toBe(401);

    expect((await signIn(email, password)).status).toBe(429);
  });
});
