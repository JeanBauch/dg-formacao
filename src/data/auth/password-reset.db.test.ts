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
import { cookiesOf } from "@/test/cookies";
import { connect, testDatabase } from "@/test/db/test-database";
import { closedGate, type Gate, removeGate } from "@/test/db/write-gate";
import { nextTestIp } from "@/test/ip";
import { fakeMailer, linkOf, openLink, resetTokenOf } from "@/test/mailer";

// Seam 1: the Better Auth HTTP handler, in the process, over the test database,
// with the e-mail going through the in-process adapter. The code under test
// connects as the application role; this file reads the rows and cleans up as
// the migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  await owner.end();
});

const password = "senha-de-teste-1";
const newPassword = "senha-nova-de-teste-2";

let signUps = 0;

// The form of a valid sign-up by a fictitious holder, with an e-mail of a
// domain reserved for documentation.
function holder() {
  signUps += 1;
  return {
    name: "Maria Fictícia",
    email: `titular-redefinicao-${signUps}@example.com`,
    password,
    adultDeclaration: true,
    acceptance: true,
  };
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

// A holder who signed up, which signed them in: their account and the cookie
// of that first session. The confirmation the sign-up sends is cleared.
async function signedUp() {
  const form = holder();
  const response = await post("/sign-up/email", form);
  const { user } = (await response.json()) as { user: { id: string } };
  await fakeMailer.reset();
  return { ...form, userId: user.id, cookie: cookiesOf(response) };
}

// The link of the password reset this e-mail asks for, as the message carries
// it, with the app's page for setting the new password as its destination.
async function resetLinkFor(email: string) {
  await post("/request-password-reset", {
    email,
    redirectTo: "/redefinir-senha",
  });
  const [message] = fakeMailer.sent.filter(({ to }) => to === email);
  return linkOf(message);
}

// What the app's page sends to set the new password.
function resetPassword(token: string, chosen = newPassword, ip = nextTestIp()) {
  return post("/reset-password", { token, newPassword: chosen }, { ip });
}

function signIn(email: string, tried: string) {
  return post("/sign-in/email", { email, password: tried });
}

// A new password long enough for a staff account too (A4.19).
const staffLengthPassword = "senha-nova-da-equipe-12";

async function emailVerified(userId: string) {
  const [{ email_verified }] = await owner<{ email_verified: boolean }[]>`
    select email_verified from app."user" where id = ${userId}`;
  return email_verified;
}

async function sessionsOf(userId: string) {
  const [{ sessions }] = await owner<{ sessions: number }[]>`
    select count(*)::int as sessions from app.session
    where user_id = ${userId}`;
  return sessions;
}

// What a password reset request answers, as the client reads it.
async function answerOf(response: Response) {
  return { status: response.status, body: await response.text() };
}

describe("a password reset request (A3.5, U5)", () => {
  test("answers an e-mail with no account exactly as an e-mail with an account, verified or not, and only the accounts get a message", async () => {
    const unverified = await signedUp();
    const verified = await signedUp();
    await owner`
      update app."user" set email_verified = true
      where id = ${verified.userId}`;
    const unknown = "sem-conta-redefinicao@example.com";

    const answers = [];
    for (const email of [unknown, unverified.email, verified.email]) {
      answers.push(
        await answerOf(
          await post("/request-password-reset", {
            email,
            redirectTo: "/redefinir-senha",
          }),
        ),
      );
    }

    expect(answers[0].status).toBe(200);
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    await fakeMailer.settled();
    expect(fakeMailer.sent.map(({ to }) => to)).toEqual([
      unverified.email,
      verified.email,
    ]);
  });
});

// The destination is the app's page the link sends the holder to. Without it,
// the link would end on Better Auth's own error page, which is disabled (#13).
describe("the destination of a password reset request", () => {
  test("is required: a request without it is refused, the same for an e-mail with an account and one without, and sends nothing", async () => {
    const account = await signedUp();

    const withAccount = await answerOf(
      await post("/request-password-reset", { email: account.email }),
    );
    const withoutAccount = await answerOf(
      await post("/request-password-reset", {
        email: "sem-conta-sem-destino@example.com",
      }),
    );

    expect(withAccount.status).toBe(400);
    expect(JSON.parse(withAccount.body)).toMatchObject({
      code: "RESET_DESTINATION_REQUIRED",
    });
    expect(withoutAccount).toEqual(withAccount);
    await fakeMailer.settled();
    expect(fakeMailer.sent).toEqual([]);
  });

  test("on another domain is refused, and sends nothing", async () => {
    const account = await signedUp();

    const response = await post("/request-password-reset", {
      email: account.email,
      redirectTo: "https://outro-site.example/redefinir-senha",
    });

    expect(response.status).toBe(403);
    await fakeMailer.settled();
    expect(fakeMailer.sent).toEqual([]);
  });
});

describe("a password reset by the e-mail's link (A3.6)", () => {
  test("changes the password and revokes every session of the account", async () => {
    const account = await signedUp();
    const otherDevice = cookiesOf(await signIn(account.email, password));
    expect(await sessionsOf(account.userId)).toBe(2);
    const token = await resetTokenOf(await resetLinkFor(account.email));

    const response = await resetPassword(token);

    expect(response.status).toBe(200);
    expect(await sessionsOf(account.userId)).toBe(0);
    for (const cookie of [account.cookie, otherDevice]) {
      expect(await (await get("/get-session", cookie)).json()).toBeNull();
    }
    expect((await signIn(account.email, password)).status).toBe(401);
    expect((await signIn(account.email, newPassword)).status).toBe(200);
  });

  test("works once: used again, the link sends the holder to the app's page with the error, and its token is refused", async () => {
    const account = await signedUp();
    const link = await resetLinkFor(account.email);
    const token = await resetTokenOf(link);
    await resetPassword(token);

    const opened = await openLink(link);
    const sent = await resetPassword(token, "senha-de-outra-tentativa-3");

    expect(opened.status).toBe(302);
    expect(opened.headers.get("location")).toBe(
      `${testBaseUrl}/redefinir-senha?error=INVALID_TOKEN`,
    );
    expect(sent.status).toBe(400);
    expect(await sent.json()).toMatchObject({ code: "INVALID_TOKEN" });
    expect((await signIn(account.email, newPassword)).status).toBe(200);
  });

  describe("of an account whose e-mail is not verified (A3.13)", () => {
    // The role a sign-up gives, and each staff role, set as the invite will.
    test.each([
      ["a holder", "user"],
      ["an instructor", "instructor"],
      ["an admin", "admin"],
    ])(
      "of %s marks the e-mail verified: using the link proves the e-mail reaches them",
      async (_, role) => {
        const account = await signedUp();
        await owner`
          update app."user" set role = ${role} where id = ${account.userId}`;
        expect(await emailVerified(account.userId)).toBe(false);
        const token = await resetTokenOf(await resetLinkFor(account.email));

        const response = await resetPassword(token, staffLengthPassword);

        expect(response.status).toBe(200);
        expect(await emailVerified(account.userId)).toBe(true);
      },
    );

    describe("whose mark fails", () => {
      // The application role loses the right to change users while each test
      // runs, so the database refuses the mark, after the new password is saved.
      beforeEach(async () => {
        await owner`revoke update on app."user" from dg_app`;
      });

      afterEach(async () => {
        await owner`grant update on app."user" to dg_app`;
      });

      test("still answers success with the new password in force, logs the failure without the e-mail, and leaves the verification pending", async () => {
        const account = await signedUp();
        const token = await resetTokenOf(await resetLinkFor(account.email));

        const { result: response, printed } = await printedDuring(() =>
          resetPassword(token),
        );

        expect(response.status).toBe(200);
        expect(printed).toMatch(
          /Password reset failed marking the e-mail verified: \w+ \(42501\)/,
        );
        expect(printed).not.toContain(account.email);
        expect(printed).not.toContain(account.email.split("@")[0]);
        expect(await emailVerified(account.userId)).toBe(false);
        expect((await signIn(account.email, newPassword)).status).toBe(200);
      });
    });
  });

  describe("with the clock moved", () => {
    // The instant the link is asked for. Only Date is faked: the database
    // driver keeps its real timers.
    const instant = new Date("2026-11-26T13:05:30.000Z");

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(instant);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const minutesLater = (minutes: number) =>
      vi.setSystemTime(instant.getTime() + minutes * 60 * 1000);

    test("still changes the password 29 minutes later", async () => {
      const account = await signedUp();
      const link = await resetLinkFor(account.email);

      minutesLater(29);
      const response = await resetPassword(await resetTokenOf(link));

      expect(response.status).toBe(200);
      expect((await signIn(account.email, newPassword)).status).toBe(200);
    });

    test("no longer does 31 minutes later: the link sends the holder to the app's page with the error, its token is refused, and the password stays", async () => {
      const account = await signedUp();
      const link = await resetLinkFor(account.email);
      const token = await resetTokenOf(link);

      minutesLater(31);
      const opened = await openLink(link);
      const sent = await resetPassword(token);

      expect(opened.status).toBe(302);
      expect(opened.headers.get("location")).toBe(
        `${testBaseUrl}/redefinir-senha?error=INVALID_TOKEN`,
      );
      expect(sent.status).toBe(400);
      expect(await sent.json()).toMatchObject({ code: "INVALID_TOKEN" });
      expect((await signIn(account.email, password)).status).toBe(200);
    });
  });
});

// Someone who knows the old password, the reason a holder resets it, signs in
// with it while the reset runs. Better Auth's sign-in reads the password, checks
// it, and only then writes the session; its reset revokes the sessions and saves
// the new password in one transaction. Whichever way the two cross, the sign-in
// keeps no session (A3.6).
describe("a sign-in with the old password that runs alongside the password reset (A3.6)", () => {
  let gate: Gate | undefined;

  afterEach(async () => {
    await removeGate(owner, gate);
    gate = undefined;
  });

  test("loses its session when it writes it while the reset's transaction is still open", async () => {
    const account = await signedUp();
    const token = await resetTokenOf(await resetLinkFor(account.email));
    // The reset stops at the new password's write, after it has revoked the
    // sessions and before it commits.
    gate = await closedGate(owner, "update", "account", account.userId);
    const reset = resetPassword(token);
    await gate.reached();

    const signedIn = await signIn(account.email, password);
    await gate.open();

    expect(signedIn.status).toBe(200);
    expect((await reset).status).toBe(200);
    expect(await sessionsOf(account.userId)).toBe(0);
    expect(
      await (await get("/get-session", cookiesOf(signedIn))).json(),
    ).toBeNull();
  });

  test("is refused as a wrong password when it writes its session after the reset has ended, and keeps no session", async () => {
    const account = await signedUp();
    const token = await resetTokenOf(await resetLinkFor(account.email));
    // The sign-in has read and checked the old password, and stops at its
    // session's write until the reset has answered.
    gate = await closedGate(owner, "insert", "session", account.userId);
    const signingIn = signIn(account.email, password);
    await gate.reached();
    expect((await resetPassword(token)).status).toBe(200);

    await gate.open();
    const signedIn = await signingIn;

    expect(signedIn.status).toBe(401);
    expect(await signedIn.json()).toEqual({
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    });
    expect(signedIn.headers.getSetCookie()).toEqual([]);
    expect(await sessionsOf(account.userId)).toBe(0);
    expect(
      await owner`
        select event, details, count from app.security_events
        where user_id = ${account.userId}
          and event in ('sign_in_succeeded', 'sign_in_failed')`,
    ).toEqual([
      {
        event: "sign_in_failed",
        details: { reason: "invalid_credentials" },
        count: 1,
      },
    ]);
  });
});

describe("a password reset whose revocation after its commit fails", () => {
  // The reset waits at its new password's write, past the revocation of its
  // own transaction, while the application role loses the right to delete
  // sessions until the test ends. The database then refuses the revocation
  // that follows the commit.
  let gate: Gate | undefined;

  afterEach(async () => {
    await removeGate(owner, gate);
    gate = undefined;
    await owner`grant delete on app.session to dg_app`;
  });

  test("still answers success with the new password in force and the sessions revoked, and logs the failure without the e-mail", async () => {
    const account = await signedUp();
    const token = await resetTokenOf(await resetLinkFor(account.email));
    gate = await closedGate(owner, "update", "account", account.userId);
    const resetting = printedDuring(() => resetPassword(token));
    await gate.reached();
    await owner`revoke delete on app.session from dg_app`;

    await gate.open();
    const { result: response, printed } = await resetting;

    expect(response.status).toBe(200);
    expect(printed).toMatch(
      /Password reset failed revoking the sessions again: \w+ \(42501\)/,
    );
    expect(printed).not.toContain(account.email);
    expect(printed).not.toContain(account.email.split("@")[0]);
    expect(await sessionsOf(account.userId)).toBe(0);
    expect(await emailVerified(account.userId)).toBe(true);
    expect((await signIn(account.email, newPassword)).status).toBe(200);
  });
});

describe("the e-mail's link of a password reset whose database read fails", () => {
  // Once the link is sent, the application role loses the right to read the
  // links' tokens until the test ends, so the database refuses the read the
  // link makes.
  afterEach(async () => {
    await owner`grant select on app.verification to dg_app`;
  });

  test("answers a server error, and the log never carries the link's token (RNF-OBS-01)", async () => {
    const account = await signedUp();
    const link = await resetLinkFor(account.email);
    const token = new URL(link).pathname.split("/").pop() ?? "";
    await owner`revoke select on app.verification from dg_app`;

    const { result: response, printed } = await printedDuring(() =>
      openLink(link),
    );

    expect(response.status).toBe(500);
    expect(printed).toMatch(/An auth request failed: \w+ \(42501\)/);
    expect(token).toHaveLength(24);
    expect(printed).not.toContain(token);
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

describe("the security log of a password reset (A5.1)", () => {
  // Every request of a test happens at this instant, so the minute its row
  // falls in is known. Only Date is faked.
  const instant = new Date("2026-11-26T14:20:10.000Z");

  beforeEach(async () => {
    await owner`truncate app.security_events`;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instant);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("gains a password_reset_requested row with the time, the account, the full IP and the user agent", async () => {
    const account = await signedUp();
    const ip = nextTestIp();

    await post(
      "/request-password-reset",
      { email: account.email, redirectTo: "/redefinir-senha" },
      { ip },
    );

    expect(await securityEvents("password_reset_requested")).toEqual([
      {
        event: "password_reset_requested",
        user_id: account.userId,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/request-password-reset",
        details: null,
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
  });

  test("gains a password_reset_requested row with no account when the e-mail has none, and no row keeps the e-mail", async () => {
    const ip = nextTestIp();

    await post(
      "/request-password-reset",
      { email: "Sem.Conta.Pedido@example.com", redirectTo: "/redefinir-senha" },
      { ip },
    );

    expect(await securityEvents("password_reset_requested")).toEqual([
      {
        event: "password_reset_requested",
        user_id: null,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/request-password-reset",
        details: null,
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
    expect(
      await owner`
        select dedupe_key from app.security_events s
        where row_to_json(s)::text ilike ${"%sem.conta.pedido%"}`,
    ).toEqual([]);
  });

  test("gains nothing for a request the reset refuses", async () => {
    await post("/request-password-reset", {
      email: "isto-nao-e-um-email",
      redirectTo: "/redefinir-senha",
    });
    await post("/request-password-reset", {
      email: "sem-destino@example.com",
    });

    expect(await securityEvents("password_reset_requested")).toEqual([]);
  });

  // Better Auth's router checks the destination's origin before any hook runs.
  test("gains nothing for a request whose destination is on another domain", async () => {
    const account = await signedUp();

    const response = await post("/request-password-reset", {
      email: account.email,
      redirectTo: "https://outro-site.example/redefinir-senha",
    });

    expect(response.status).toBe(403);
    expect(await securityEvents("password_reset_requested")).toEqual([]);
  });

  test("gains a password_reset_completed row with the time, the account, the full IP and the user agent", async () => {
    const account = await signedUp();
    const token = await resetTokenOf(await resetLinkFor(account.email));
    const ip = nextTestIp();

    await resetPassword(token, newPassword, ip);

    expect(await securityEvents("password_reset_completed")).toEqual([
      {
        event: "password_reset_completed",
        user_id: account.userId,
        ip,
        user_agent: "Mozilla/5.0 (Navegador Fictício)",
        route: "/reset-password",
        details: null,
        count: 1,
        first_at: instant,
        last_at: instant,
      },
    ]);
  });

  test("gains no password_reset_completed row for a token the reset refuses", async () => {
    await resetPassword("token-ficticio-invalido");

    expect(await securityEvents("password_reset_completed")).toEqual([]);
  });
});

describe("a password reset whose security log write fails", () => {
  // The application role loses the right to add rows to the security log
  // while each test runs, so the database refuses the write.
  beforeEach(async () => {
    await owner`revoke insert on app.security_events from dg_app`;
  });

  afterEach(async () => {
    await owner`grant insert on app.security_events to dg_app`;
  });

  // What was printed carries neither the requester's IP and user agent nor the
  // account's e-mail (RNF-SEG-15, RNF-OBS-01).
  function expectNoRequesterNorEmail(
    printed: string,
    { ip, email }: { ip: string; email: string },
  ) {
    expect(printed).not.toContain(ip);
    expect(printed).not.toContain("Navegador Fictício");
    expect(printed).not.toContain(email);
    expect(printed).not.toContain(email.split("@")[0]);
  }

  test("still answers the request as any other, sends the link, and logs the failure without the IP, the user agent or the e-mail", async () => {
    const account = await signedUp();
    const ip = nextTestIp();
    const { result: unknownAnswer } = await printedDuring(async () =>
      answerOf(
        await post("/request-password-reset", {
          email: "sem-conta-falha@example.com",
          redirectTo: "/redefinir-senha",
        }),
      ),
    );

    const { result: response, printed } = await printedDuring(() =>
      post(
        "/request-password-reset",
        { email: account.email, redirectTo: "/redefinir-senha" },
        { ip },
      ),
    );

    expect(unknownAnswer.status).toBe(200);
    expect(await answerOf(response)).toEqual(unknownAnswer);
    expect(printed).toMatch(
      /Password reset request failed recording its security event: \w+ \(42501\)/,
    );
    expectNoRequesterNorEmail(printed, { ip, email: account.email });
    await fakeMailer.settled();
    expect(fakeMailer.sent.map(({ to }) => to)).toEqual([account.email]);
  });

  test("still completes the reset with the new password in force, and logs the failure without the IP, the user agent or the e-mail", async () => {
    const account = await signedUp();
    const { result: link } = await printedDuring(() =>
      resetLinkFor(account.email),
    );
    const token = await resetTokenOf(link);
    const ip = nextTestIp();

    const { result: response, printed } = await printedDuring(() =>
      resetPassword(token, newPassword, ip),
    );

    expect(response.status).toBe(200);
    expect(printed).toMatch(
      /Password reset failed recording its security event: \w+ \(42501\)/,
    );
    expectNoRequesterNorEmail(printed, { ip, email: account.email });
    expect(await emailVerified(account.userId)).toBe(true);
    // A sign-in records its own event, so the right is given back first.
    await owner`grant insert on app.security_events to dg_app`;
    expect((await signIn(account.email, newPassword)).status).toBe(200);
  });
});
