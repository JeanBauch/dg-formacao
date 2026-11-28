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
import { printedDuring } from "@/test/console";
import { connect, testDatabase } from "@/test/db/test-database";
import { closedGate, type Gate, removeGate } from "@/test/db/write-gate";
import { nextTestIp } from "@/test/ip";
import { fakeMailer, linkOf, resetTokenOf } from "@/test/mailer";
import { holderPassword, signedInHolder } from "@/test/request";
import { staffAccount } from "@/test/staff";
import { countFailedSignIn } from "./sign-in-lockout";

// Seam 1: the Better Auth HTTP handler, in the process, over the test database.
// The rate limit counts per IP, so each attempt comes from its own simulated
// IP, and only the account's lockout can refuse it. The code under test
// connects as the application role; this file reads the rows and cleans up as
// the migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  await owner.end();
});

// The instant each test starts at. Only Date is faked: the database driver
// keeps its real timers, and the lockout, like the rate limit, reads the time
// through Date.
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

function post(path: string, body: Record<string, unknown>, ip = nextTestIp()) {
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

function signIn(email: string, password: string, ip?: string) {
  return post("/sign-in/email", { email, password }, ip);
}

const wrongPassword = "outra-senha-errada";

// This many failed sign-ins in a row, each refused as a wrong password.
async function failSignIns(email: string, failures: number) {
  for (let failure = 1; failure <= failures; failure += 1) {
    expect((await signIn(email, wrongPassword)).status).toBe(401);
  }
}

// A holder's account, with the password it signs in with.
async function holderAccount() {
  const { email, userId } = await signedInHolder();
  return { email, userId, password: holderPassword };
}

describe("the lockout of an account after failed sign-ins in a row (A2.15)", () => {
  test.each([
    ["a holder", holderAccount],
    ["an instructor", () => staffAccount("instructor")],
    ["an admin", () => staffAccount("admin")],
  ])(
    "of %s: the 5th failure locks its sign-in for 1 minute",
    async (_, account) => {
      const { email, password } = await account();
      await failSignIns(email, 5);

      secondsLater(59);
      expect((await signIn(email, password)).status).toBe(429);
      secondsLater(61);
      expect((await signIn(email, password)).status).toBe(200);
    },
  );

  test("4 failures in a row lock nothing: the right password still signs in", async () => {
    const { email, password } = await holderAccount();
    await failSignIns(email, 4);

    expect((await signIn(email, password)).status).toBe(200);
  });

  test("each failure after a lock locks it for longer: 5 minutes, then 15, the ceiling", async () => {
    const { email, password } = await holderAccount();
    await failSignIns(email, 5);

    // The 6th failure, once the first lock has ended, locks for 5 minutes.
    secondsLater(61);
    await failSignIns(email, 1);
    secondsLater(61 + 5 * 60 - 1);
    expect((await signIn(email, password)).status).toBe(429);

    // The 7th, once that one has ended, for 15 minutes.
    secondsLater(61 + 5 * 60 + 1);
    await failSignIns(email, 1);
    const seventh = 61 + 5 * 60 + 1;
    secondsLater(seventh + 15 * 60 - 1);
    expect((await signIn(email, password)).status).toBe(429);

    // The 8th, for 15 minutes again: the ceiling.
    secondsLater(seventh + 15 * 60 + 1);
    await failSignIns(email, 1);
    const eighth = seventh + 15 * 60 + 1;
    secondsLater(eighth + 15 * 60 - 1);
    expect((await signIn(email, password)).status).toBe(429);
    secondsLater(eighth + 15 * 60 + 1);
    expect((await signIn(email, password)).status).toBe(200);
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

describe("the security log of a lockout (A5.1)", () => {
  beforeEach(async () => {
    await owner`truncate app.security_events`;
  });

  test("gains an account_locked row for the failure that starts the lock, with the time, the account, the full IP, the user agent and the lock's minutes", async () => {
    const { email, userId } = await holderAccount();
    await failSignIns(email, 4);
    const ip = nextTestIp();

    await signIn(email, wrongPassword, ip);

    expect(
      (await securityEvents()).filter(
        ({ event }) => event === "account_locked",
      ),
    ).toEqual([
      {
        event: "account_locked",
        user_id: userId,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/sign-in/email",
        details: { lockMinutes: 1 },
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
  });

  test("gains one account_locked row for each lock, with its minutes: 1, then 5, then 15", async () => {
    const { email } = await holderAccount();
    await failSignIns(email, 5);
    secondsLater(61);
    await failSignIns(email, 1);
    secondsLater(61 + 5 * 60 + 1);
    await failSignIns(email, 1);

    expect(
      await owner`
        select details, count from app.security_events
        where event = 'account_locked' order by first_at`,
    ).toEqual([
      { details: { lockMinutes: 1 }, count: 1 },
      { details: { lockMinutes: 5 }, count: 1 },
      { details: { lockMinutes: 15 }, count: 1 },
    ]);
  });

  test("gains nothing for a sign-in refused during the lock, with the right password or a wrong one", async () => {
    const { email, password } = await holderAccount();
    await failSignIns(email, 5);
    const before = await securityEvents();

    secondsLater(30);
    expect((await signIn(email, password)).status).toBe(429);
    expect((await signIn(email, wrongPassword)).status).toBe(429);

    expect(await securityEvents()).toEqual(before);
  });
});

// The token of a password reset for this e-mail, which the app's page receives
// once its link is opened. The message is the last one to the e-mail: the
// sign-up sent its confirmation before.
async function resetTokenFor(email: string) {
  await post("/request-password-reset", {
    email,
    redirectTo: "/redefinir-senha",
  });
  const message = fakeMailer.sent.filter(({ to }) => to === email).at(-1);
  if (message === undefined) throw new Error("No password reset e-mail");
  return resetTokenOf(linkOf(message));
}

// A password reset by the e-mail's link, as the app's page completes it.
async function resetPassword(email: string, newPassword: string) {
  const token = await resetTokenFor(email);
  const reset = await post("/reset-password", { token, newPassword });
  expect(reset.status).toBe(200);
}

// That the next lock is the first one again: 4 failures leave the sign-in
// open, and the 5th locks it for 1 minute only.
async function expectFirstLockNext(email: string, password: string) {
  await failSignIns(email, 5);
  const fifth = Date.now();
  vi.setSystemTime(fifth + 59_000);
  expect((await signIn(email, password)).status).toBe(429);
  vi.setSystemTime(fifth + 61_000);
  expect((await signIn(email, password)).status).toBe(200);
}

describe("the failed sign-ins of an account, counted again from zero (A2.17)", () => {
  test("after a sign-in with the right password: the next lock is the first one, for 1 minute", async () => {
    const { email, password } = await holderAccount();
    await failSignIns(email, 5);
    secondsLater(61);
    await failSignIns(email, 1);
    secondsLater(61 + 5 * 60 + 1);
    expect((await signIn(email, password)).status).toBe(200);

    await expectFirstLockNext(email, password);
  });

  test("after a password reset: a locked account signs in at once with the new password, and the next lock is the first one", async () => {
    const { email } = await holderAccount();
    const newPassword = "senha-nova-de-teste-2";
    await failSignIns(email, 5);
    secondsLater(61);
    await failSignIns(email, 1);
    // Within the 5 minutes of the second lock.
    secondsLater(61 + 60);

    await resetPassword(email, newPassword);

    expect((await signIn(email, newPassword)).status).toBe(200);
    await expectFirstLockNext(email, newPassword);
  });
});

// The failed sign-ins in a row of an account, as the lockout counts them.
async function failuresOf(userId: string) {
  return owner<{ failures: number }[]>`
    select failures from app.sign_in_failures where user_id = ${userId}`;
}

// A sign-in with the old password that Better Auth checked before a password
// reset committed is refused as a wrong password once its session exists
// (A3.6), and is recorded as one.
describe("a sign-in with the old password, refused after a password reset that crossed it", () => {
  let gate: Gate | undefined;

  afterEach(async () => {
    await removeGate(owner, gate);
    gate = undefined;
  });

  test("counts as a failure in a row, as a wrong password does", async () => {
    const { email, userId, password } = await holderAccount();
    const token = await resetTokenFor(email);
    // The sign-in has checked the old password, and waits at its session's
    // write until the reset has answered.
    gate = await closedGate(owner, "insert", "session", userId);
    const signingIn = signIn(email, password);
    await gate.reached();
    const reset = await post("/reset-password", {
      token,
      newPassword: "senha-nova-de-teste-2",
    });
    expect(reset.status).toBe(200);

    await gate.open();

    expect((await signingIn).status).toBe(401);
    expect(await failuresOf(userId)).toEqual([{ failures: 1 }]);
  });
});

// Seam 2: the auth module's count of a failed sign-in, the one its sign-in
// hook calls, against the real Postgres.
describe("failed sign-ins of one account at the same time (A2.18)", () => {
  let gate: Gate | undefined;

  afterEach(async () => {
    await removeGate(owner, gate);
    gate = undefined;
  });

  test("each count: 4 at once leave the counter at 4, and each gets its own count back", async () => {
    const { email, userId } = await holderAccount();
    // The four writes wait at the gate together, then go on at once.
    gate = await closedGate(owner, "insert", "sign_in_failures", userId);
    const counting = Promise.all(
      Array.from({ length: 4 }, () => countFailedSignIn(email)),
    );
    await gate.reached(4);

    await gate.open();
    const counts = await counting;

    expect(counts.map((counted) => counted?.failures).sort()).toEqual([
      1, 2, 3, 4,
    ]);
    expect(await failuresOf(userId)).toEqual([{ failures: 4 }]);
  });
});

// What a sign-in answers, as the client reads it.
async function answerOf(response: Response) {
  return { status: response.status, body: (await response.json()) as unknown };
}

describe("a sign-in to a locked account (A2.16)", () => {
  test("answers 429 with what to do, the same with the right password and a wrong one", async () => {
    const { email, password } = await holderAccount();
    await failSignIns(email, 5);
    secondsLater(30);

    const right = await answerOf(await signIn(email, password));
    const wrong = await answerOf(await signIn(email, wrongPassword));

    expect(right).toEqual(wrong);
    expect(right).toEqual({
      status: 429,
      body: {
        code: "ACCOUNT_LOCKED",
        message:
          "Muitas tentativas; tente de novo em alguns minutos ou redefina a senha.",
      },
    });
  });

  test("sets no session cookie with the right password", async () => {
    const { email, password } = await holderAccount();
    await failSignIns(email, 5);
    secondsLater(30);

    const response = await signIn(email, password);

    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe("the work of a sign-in to a locked account (NF-7)", () => {
  // Better Auth's own password functions, which its sign-in calls: the check
  // of the password against the account's hash, and the hash it computes for
  // an e-mail without an account. Both are slow on purpose.
  async function passwordWork() {
    const { password: passwords } = await auth.$context;
    return [vi.spyOn(passwords, "verify"), vi.spyOn(passwords, "hash")];
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("checks no password, right or wrong: Better Auth's password check is never called", async () => {
    const { email, password } = await holderAccount();
    await failSignIns(email, 4);
    const [verify, hash] = await passwordWork();
    // The 5th failure is checked as any other, and starts the lock.
    await failSignIns(email, 1);
    expect(verify).toHaveBeenCalledTimes(1);
    verify.mockClear();
    secondsLater(30);

    await signIn(email, password);
    await signIn(email, wrongPassword);

    expect(verify).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
});

// The sessions of an account, and its occurrences in the security log.
async function recordsOf(userId: string) {
  const [records] = await owner<{ sessions: number; occurrences: number }[]>`
    select
      (select count(*)::int from app.session where user_id = ${userId})
        as sessions,
      (select coalesce(sum(count), 0)::int from app.security_events
        where user_id = ${userId}) as occurrences`;
  return records;
}

describe("a sign-in whose update of the failed sign-ins fails", () => {
  // The application role loses the right to change the failed sign-ins while
  // each test runs, so the database refuses the count and its clearing. It
  // still reads them, so the lockout's own check runs.
  beforeEach(async () => {
    await owner`revoke insert, update, delete on app.sign_in_failures from dg_app`;
  });

  afterEach(async () => {
    await owner`grant insert, update, delete on app.sign_in_failures to dg_app`;
  });

  test.each([
    ["the right password", holderPassword],
    ["a wrong password", wrongPassword],
  ])(
    "with %s answers the sign-in's failure, leaves no new session, no cookie and no occurrence, and logs it without the e-mail (NF-2, RNF-OBS-01)",
    async (_, tried) => {
      const { email, userId } = await holderAccount();
      const before = await recordsOf(userId);

      const { result: response, printed } = await printedDuring(() =>
        signIn(email, tried),
      );

      expect(await response.json()).toMatchObject({ code: "SIGN_IN_FAILED" });
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(await recordsOf(userId)).toEqual(before);
      expect(printed).toMatch(
        /Sign-in failed updating its account's failed sign-ins: \w+ \(42501\)/,
      );
      expect(printed).not.toContain(email);
    },
  );
});

describe("a sign-in whose read of the lockout fails", () => {
  // The application role loses the right to read the failed sign-ins while
  // each test runs, so the database refuses the lockout's check.
  beforeEach(async () => {
    await owner`revoke select on app.sign_in_failures from dg_app`;
  });

  afterEach(async () => {
    await owner`grant select on app.sign_in_failures to dg_app`;
  });

  test("answers a server error before any password is checked, sets no cookie, and logs it without the e-mail (RNF-OBS-01)", async () => {
    const { email, userId } = await holderAccount();
    const before = await recordsOf(userId);

    const { result: response, printed } = await printedDuring(() =>
      signIn(email, holderPassword),
    );

    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await recordsOf(userId)).toEqual(before);
    expect(printed).toMatch(/An auth request failed: \w+ \(42501\)/);
    expect(printed).not.toContain(email);
  });
});

describe("a password reset whose count of the failed sign-ins from zero fails", () => {
  // The application role loses the right to delete the failed sign-ins while
  // each test runs, so the database refuses the clearing after the reset.
  beforeEach(async () => {
    await owner`revoke delete on app.sign_in_failures from dg_app`;
  });

  afterEach(async () => {
    await owner`grant delete on app.sign_in_failures to dg_app`;
  });

  test("still completes the reset, and logs the failure without the e-mail", async () => {
    const { email, userId } = await holderAccount();
    await failSignIns(email, 1);

    const { printed } = await printedDuring(() =>
      resetPassword(email, "senha-nova-de-teste-2"),
    );

    expect(printed).toMatch(
      /Password reset failed counting the failed sign-ins from zero: \w+ \(42501\)/,
    );
    expect(printed).not.toContain(email);
    expect(await failuresOf(userId)).toEqual([{ failures: 1 }]);
  });
});
