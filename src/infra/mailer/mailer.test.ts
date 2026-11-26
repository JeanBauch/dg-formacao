// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Next's after(), held by the test: a task runs only when the test says that the
// response has been sent, as Next runs it then.
const heldTasks = vi.hoisted((): (() => unknown)[] => []);
vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    heldTasks.push(task);
  },
}));

const email = {
  to: "titular-adaptador@example.com",
  subject: "Assunto",
  text: "Texto com o link https://dg-formacao.test/confirmar\n",
};

const repositoryRoot = process.cwd();
let workingDirectory: string;

// The mailbox is a folder of the server's working directory, so each test works
// in an empty one of its own.
beforeEach(async () => {
  heldTasks.length = 0;
  workingDirectory = await mkdtemp(join(tmpdir(), "dg-mailer-"));
  process.chdir(workingDirectory);
});

afterEach(async () => {
  process.chdir(repositoryRoot);
  await rm(workingDirectory, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.resetModules();
});

// A mailbox that does not exist yet holds no message; one that cannot be read
// fails the test.
async function mailbox(): Promise<unknown[]> {
  const files = await readdir(".mailbox").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  return Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(join(".mailbox", file), "utf8")),
    ),
  );
}

// The application's mailer, as the server builds it from this configuration.
async function mailerFor(configuration: Record<string, string>) {
  for (const [name, value] of Object.entries(configuration)) {
    vi.stubEnv(name, value);
  }
  return (await import("@/infra/mailer")).mailer;
}

const localWithTheFileAdapter = {
  APP_ENV: "local",
  SIGNUP_ENABLED: "true",
  DATABASE_URL: "postgresql://fake_user:fake_pass@localhost:5432/fake_db",
  MAILER_ADAPTER: "file",
  VERCEL: "",
};

const hostedWithResend = {
  SIGNUP_ENABLED: "true",
  DATABASE_URL:
    "postgresql://fake_user:fake_pass@db.example.test:6543/fake_db?sslmode=require",
  MAILER_ADAPTER: "resend",
  RESEND_API_KEY: "fake-resend-api-key",
  MAILER_FROM: "nao-responda@dg-formacao.test",
  VERCEL: "",
};

// The adapter the configuration chooses, seen by where a message goes. Resend's
// own send has no test in spec A (the real one is a criterion of B1 and B4), so
// the network is cut here and only the address asked for is read.
describe("the adapter the configuration chooses", () => {
  const hostsAsked: string[] = [];

  beforeEach(() => {
    hostsAsked.length = 0;
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      hostsAsked.push(new URL(new Request(input).url).host);
      return Response.json({ id: "fictitious" });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // A send of the application's mailer, with the response already sent.
  async function sendWith(configuration: Record<string, string>) {
    const mailer = await mailerFor(configuration);
    const sending = mailer.send(email);
    await Promise.all(heldTasks.map((task) => task()));
    await sending;
  }

  test.each(["local", "ci"])(
    "in %s with the file adapter, takes the server's e-mails to the file mailbox, and nothing leaves",
    async (APP_ENV) => {
      await sendWith({ ...localWithTheFileAdapter, APP_ENV });

      expect(await mailbox()).toEqual([email]);
      expect(hostsAsked).toEqual([]);
    },
  );

  test.each(["staging", "production"])(
    "in %s, takes the server's e-mails to Resend, and none to the file mailbox",
    async (APP_ENV) => {
      await sendWith({ ...hostedWithResend, APP_ENV });

      expect(hostsAsked).toEqual(["api.resend.com"]);
      expect(await mailbox()).toEqual([]);
    },
  );
});

test("the file adapter holds the send in after(), and the message reaches the mailbox only when Next runs it", async () => {
  const mailer = await mailerFor(localWithTheFileAdapter);
  let sent = false;

  const sending = mailer.send(email).then(() => {
    sent = true;
  });

  expect(heldTasks).toHaveLength(1);
  // Long enough for a send that did not wait to have written its message.
  await delay(100);
  expect(await mailbox()).toEqual([]);
  expect(sent).toBe(false);

  await heldTasks[0]();
  await sending;

  expect(await mailbox()).toEqual([email]);
});

// Next prints a failed after() task with its whole error, whose message could
// name the recipient, so the failure goes to whoever started the send, which
// logs its name and code alone (A3.9, RNF-OBS-01).
test("a delivery that fails inside after() rejects the send, and the task Next runs does not fail", async () => {
  const mailer = await mailerFor(localWithTheFileAdapter);
  // A file where the mailbox's folder goes: the message cannot be written.
  await writeFile(".mailbox", "");

  const failure = expect(mailer.send(email)).rejects.toMatchObject({
    code: "EEXIST",
  });

  await expect(Promise.resolve(heldTasks[0]())).resolves.toBeUndefined();
  await failure;
});
