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
import { nextTestIp } from "@/test/ip";
import { fakeMailer, linkOf } from "@/test/mailer";

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

let signUps = 0;

// The form of a valid sign-up by a fictitious holder, with an e-mail of a
// domain reserved for documentation.
function holder() {
  signUps += 1;
  return {
    name: "Maria Fictícia",
    email: `titular-confirmacao-${signUps}@example.com`,
    password: "senha-de-teste-1",
    adultDeclaration: true,
    acceptance: true,
  };
}

function signUp(form: ReturnType<typeof holder>) {
  return auth.handler(
    new Request(`${testBaseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: testBaseUrl,
        "x-forwarded-for": nextTestIp(),
      },
      body: JSON.stringify(form),
    }),
  );
}

// A link of an e-mail, opened as a webmail opens it: the browser navigates its
// tab to it from another site, which the handler lets through (#12).
function open(link: string) {
  return auth.handler(
    new Request(link, {
      headers: {
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        "x-forwarded-for": nextTestIp(),
      },
    }),
  );
}

async function emailVerified(email: string) {
  const [{ email_verified }] = await owner<{ email_verified: boolean }[]>`
    select email_verified from app."user" where email = ${email}`;
  return email_verified;
}

const minute = 60 * 1000;

// The instant the tests that move the clock start from. Only Date is faked:
// the database driver keeps its real timers.
const instant = new Date("2026-11-25T13:05:30.000Z");

function stopClockAtInstant() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instant);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}

describe("the confirmation e-mail of a sign-up (A3.1)", () => {
  test("goes out through the mailer, to the holder, with a link", async () => {
    const form = holder();

    const response = await signUp(form);

    expect(response.status).toBe(200);
    expect(fakeMailer.sent).toHaveLength(1);
    expect(fakeMailer.sent[0].to).toBe(form.email);
    expect(linkOf(fakeMailer.sent[0])).toContain(
      `${testBaseUrl}/api/auth/verify-email?token=`,
    );
  });

  test("confirms the holder's e-mail when its link is opened", async () => {
    const form = holder();
    await signUp(form);
    expect(await emailVerified(form.email)).toBe(false);

    const response = await open(linkOf(fakeMailer.sent[0]));

    // The link sends the holder on to a page of the app, the home.
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(await emailVerified(form.email)).toBe(true);
  });

  describe("with the clock moved", () => {
    stopClockAtInstant();

    test("still confirms the e-mail 59 minutes later", async () => {
      const form = holder();
      await signUp(form);

      vi.setSystemTime(instant.getTime() + 59 * minute);
      await open(linkOf(fakeMailer.sent[0]));

      expect(await emailVerified(form.email)).toBe(true);
    });

    test("no longer confirms it 61 minutes later, and sends the holder to a page of the app with the error", async () => {
      const form = holder();
      await signUp(form);

      vi.setSystemTime(instant.getTime() + 61 * minute);
      const response = await open(linkOf(fakeMailer.sent[0]));

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toMatch(/^\/\?error=/);
      expect(await emailVerified(form.email)).toBe(false);
    });
  });
});

// The confirmation goes out only once the sign-up has ended well: its user
// committed, with the holder's profile and consents, and its session. A
// sign-up that fails leaves no account, so a link to it would lead nowhere.
describe("a sign-up that does not end well (A3.1)", () => {
  // The sign-up's answer, once every send it started has ended. Its failure
  // is logged, which `printedDuring` keeps off the terminal.
  async function signUpToTheEnd(form: ReturnType<typeof holder>) {
    const { result: response } = await printedDuring(() => signUp(form));
    await fakeMailer.settled();
    return response;
  }

  test("refused before its account exists sends nothing", async () => {
    const response = await signUpToTheEnd({ ...holder(), acceptance: false });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "ACCEPTANCE_REQUIRED",
    });
    expect(fakeMailer.sent).toEqual([]);
  });

  describe("whose session write fails", () => {
    // The application role loses the right to add sessions while each test
    // runs, so the session's write is refused inside the user's transaction,
    // and the user rolls back with it.
    beforeEach(async () => {
      await owner`revoke insert on app.session from dg_app`;
    });

    afterEach(async () => {
      await owner`grant insert on app.session to dg_app`;
    });

    test("answers an error and sends nothing", async () => {
      const response = await signUpToTheEnd(holder());

      expect(response.status).toBe(500);
      expect(fakeMailer.sent).toEqual([]);
    });
  });

  describe("whose holder's profile write fails", () => {
    // The application role loses the right to add profiles while each test
    // runs, so the write after the user's commit is refused, and the sign-up
    // deletes the user it had created (A2.13).
    beforeEach(async () => {
      await owner`revoke insert on app.profiles from dg_app`;
    });

    afterEach(async () => {
      await owner`grant insert on app.profiles to dg_app`;
    });

    test("answers its error and sends nothing", async () => {
      const form = holder();

      const response = await signUpToTheEnd(form);

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ code: "SIGN_UP_FAILED" });
      expect(fakeMailer.sent).toEqual([]);
    });
  });
});

describe("a sign-in with an e-mail not yet confirmed (A3.4)", () => {
  test("works with the right e-mail and password, and the e-mail stays unconfirmed", async () => {
    const form = holder();
    await signUp(form);

    const response = await auth.handler(
      new Request(`${testBaseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: testBaseUrl,
          "x-forwarded-for": nextTestIp(),
        },
        body: JSON.stringify({ email: form.email, password: form.password }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).not.toEqual([]);
    expect(await response.json()).toMatchObject({
      user: { email: form.email, emailVerified: false },
    });
    expect(await emailVerified(form.email)).toBe(false);
  });
});
