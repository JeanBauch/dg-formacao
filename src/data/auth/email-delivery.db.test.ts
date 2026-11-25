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
// connects as the application role; this file cleans up as the migrations
// role, which owns the tables.
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
    email: `titular-envio-${signUps}@example.com`,
    password: "senha-de-teste-1",
    adultDeclaration: true,
    acceptance: true,
  };
}

type Holder = ReturnType<typeof holder>;

function post(path: string, body: Record<string, unknown>) {
  return auth.handler(
    new Request(`${testBaseUrl}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: testBaseUrl,
        "x-forwarded-for": nextTestIp(),
      },
      body: JSON.stringify(body),
    }),
  );
}

// A holder who already signed up, with the mailer as if nothing had been sent.
async function signUpFirst(form: Holder) {
  await post("/sign-up/email", form);
  await fakeMailer.reset();
}

// The requests that make the application send an e-mail: the sign-up, and the
// holder's later requests for another confirmation and for a password reset.
// `ask` is the request itself; `prepare` is what has to exist before it.
const requests = [
  {
    name: "a sign-up",
    kind: "verification",
    time: "1 hora",
    prepare: async () => {},
    ask: (form: Holder) => post("/sign-up/email", form),
  },
  {
    name: "a request for another confirmation",
    kind: "verification",
    time: "1 hora",
    prepare: signUpFirst,
    ask: (form: Holder) =>
      post("/send-verification-email", { email: form.email }),
  },
  {
    name: "a request for a password reset",
    kind: "password reset",
    time: "30 minutos",
    prepare: signUpFirst,
    ask: (form: Holder) =>
      post("/request-password-reset", {
        email: form.email,
        redirectTo: "/redefinir-senha",
      }),
  },
];

describe("the response of a request that sends an e-mail (A3.7, NF-4)", () => {
  test.each(requests)(
    "to $name comes back with the send still pending, and the message is captured once the send ends",
    async ({ prepare, ask }) => {
      const form = holder();
      await prepare(form);
      fakeMailer.hold();

      const response = await ask(form);

      expect(response.status).toBe(200);
      expect(fakeMailer.inFlight).toBe(1);
      expect(fakeMailer.sent).toEqual([]);

      await fakeMailer.release();

      expect(fakeMailer.inFlight).toBe(0);
      expect(fakeMailer.sent).toHaveLength(1);
      expect(fakeMailer.sent[0].to).toBe(form.email);
    },
  );
});

// What the provider answers when its limit is reached: an error whose message
// names the recipient, as a provider's error can.
class ProviderLimitError extends Error {
  name = "ProviderLimitError";
}

describe("a request whose e-mail fails to send (A3.9)", () => {
  // The request, and everything printed until the failed send has ended.
  async function askWithSendFailing(
    ask: (form: Holder) => Promise<Response>,
    form: Holder,
  ) {
    fakeMailer.failWith(
      new ProviderLimitError(`Daily limit reached sending to ${form.email}`),
    );
    return printedDuring(async () => {
      const response = await ask(form);
      await fakeMailer.settled();
      return response;
    });
  }

  test.each(requests)(
    "does not break the request to $name, and logs the failure as an error of the mailer, without the recipient",
    async ({ prepare, ask, kind }) => {
      const form = holder();
      await prepare(form);

      const { result: response, printed } = await askWithSendFailing(ask, form);

      expect(response.status).toBe(200);
      // The app's own mailer failed, not Better Auth: the line says so.
      expect(printed).toMatch(
        new RegExp(
          `^ERROR \\[Mailer\\]: Sending the ${kind} e-mail failed: ProviderLimitError$`,
          "m",
        ),
      );
      expect(printed).not.toContain(form.email);
      expect(printed).not.toContain(form.email.split("@")[0]);
      expect(fakeMailer.sent).toEqual([]);
    },
  );

  test("leaves the sign-up with its account and its session", async () => {
    const form = holder();

    const { result: response } = await askWithSendFailing(
      (form) => post("/sign-up/email", form),
      form,
    );

    expect(response.headers.getSetCookie()).not.toEqual([]);
    expect(
      await owner`select email from app."user" where email = ${form.email}`,
    ).toEqual([{ email: form.email }]);
  });
});

describe("the content of an e-mail of the R0 (A3.10)", () => {
  test.each(requests)(
    "sent for $name carries the link and its time, and nothing of the holder",
    async ({ prepare, ask, time }) => {
      const form = holder();
      await prepare(form);

      await ask(form);

      expect(fakeMailer.sent).toHaveLength(1);
      const email = fakeMailer.sent[0];
      const link = linkOf(email);
      const words = `${email.subject}
${email.text.replace(link, "")}`;
      expect(email.text).toContain(time);
      expect(words).not.toContain("Maria");
      expect(words).not.toContain("Fictícia");
      expect(words).not.toContain(form.email.split("@")[0]);
    },
  );

  describe("with the clock stopped", () => {
    const instant = new Date("2026-11-25T13:05:30.000Z");

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(instant);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("the password reset e-mail names the 30 minutes its link really lasts", async () => {
      const form = holder();
      await signUpFirst(form);

      await post("/request-password-reset", {
        email: form.email,
        redirectTo: "/redefinir-senha",
      });

      // The link carries the token in its path: .../reset-password/<token>?...
      const token = new URL(linkOf(fakeMailer.sent[0])).pathname
        .split("/")
        .pop();
      const [{ expires_at }] = await owner<{ expires_at: Date }[]>`
        select expires_at from app.verification
        where identifier = ${`reset-password:${token}`}`;
      expect(expires_at).toEqual(new Date("2026-11-25T13:35:30.000Z"));
    });
  });
});
