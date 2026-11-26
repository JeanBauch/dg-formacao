// The seed (A1.8), for the local database and the CI one: it creates the
// fictitious holder, with the e-mail confirmed, and nothing else yet.
//
//   pnpm db:seed
//
// It reads the same variables as the app. The pnpm script loads them from
// .env.local when that file exists; a bare `node scripts/db-seed.mts` does not,
// so it needs the variables exported in the shell first. It refuses to run
// unless APP_ENV is local or ci and DATABASE_URL points at this machine.
//
// It has no way of writing of its own: the holder signs up through Better
// Auth's HTTP handler, which runs the hook that writes the holder's profile and
// consents, and confirms the e-mail by opening the link of the message the fake
// mailer captured, as a person opens it. It runs once or many times and ends in
// the same state.
//
// It runs as a plain Node script, outside Next.js. The app's source imports
// each other by the `@/` alias and without extensions, which Node does not
// resolve, so the hooks below do it. They also give the two modules that stand
// for something else here:
//   - `server-only`, which Next.js enforces at build time, becomes empty;
//   - the mailer becomes the fake of the tests, which captures the messages in
//     the process: the server's adapters hold the send with `after()`, which
//     works only inside Next.js.
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sourceUrl = `${pathToFileURL(resolve(import.meta.dirname, "../src")).href}/`;

const replacements: Record<string, string> = {
  "server-only": "@/test/empty",
  "@/infra/mailer": "@/test/mailer",
};

// What Node answers to a file or a folder named without its extension.
const notFound = ["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const wanted = replacements[specifier] ?? specifier;
    const path = wanted.startsWith("@/")
      ? new URL(wanted.slice(2), sourceUrl).href
      : wanted;
    // A package resolves as it always does.
    if (!path.startsWith("file:") && !path.startsWith(".")) {
      return nextResolve(path, context);
    }
    // A file of the app, named as TypeScript does: with no extension, or as a
    // folder with an index.
    let notFoundAsNamed: unknown;
    for (const candidate of [path, `${path}.ts`, `${path}/index.ts`]) {
      try {
        const resolved = nextResolve(candidate, context);
        // Said outright, so Node strips the types at once, instead of first
        // trying the file as CommonJS, as the package.json without a `type`
        // would have it do (and warn).
        return resolved.url.endsWith(".ts")
          ? { ...resolved, format: "module-typescript" }
          : resolved;
      } catch (error) {
        if (!notFound.includes((error as { code?: string }).code ?? "")) {
          throw error;
        }
        notFoundAsNamed ??= error;
      }
    }
    throw notFoundAsNamed;
  },
});

// Better Auth starts the links of its e-mails with this address, and the seed
// calls it by the same one.
const baseUrl = (process.env.BETTER_AUTH_URL ||= "http://localhost:3000");

// The app's own modules load from here on, through the hooks. Before the guard
// below, only the configuration and modules that connect to nothing load.
const { env } = await import("@/env");
const { hostedEnvironments } = await import("@/domain/config/env");
const { loggable } = await import("@/data/auth/loggable");

// A seed's own failure, whose message is safe to print: it names what failed
// and never a value, such as an e-mail, a password or a link (RNF-OBS-01).
class SeedFailure extends Error {
  name = "SeedFailure";
}

// The hosts of a database on this machine, as a URL names them: an IPv6
// address keeps its brackets. Any other name is refused, an alias included.
const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];

// The fictitious accounts and their known passwords must never reach a hosted
// database (RNF-SEG-14). APP_ENV alone does not say where DATABASE_URL points,
// so the seed checks both. The refusal names the rule, never the URL.
function refuseAHostedDatabase() {
  if (hostedEnvironments.includes(env.APP_ENV)) {
    throw new SeedFailure(
      `The seed runs only with APP_ENV local or ci, not ${env.APP_ENV}.`,
    );
  }
  if (!loopbackHosts.includes(new URL(env.DATABASE_URL).hostname)) {
    throw new SeedFailure(
      "The seed runs only against a database on this machine: the host of DATABASE_URL must be localhost, 127.0.0.1 or ::1.",
    );
  }
}

// The seed itself. The modules that can connect to the database load only
// here, once the guard has let the seed run.
async function seedTheHolder() {
  const { eq } = await import("drizzle-orm");
  // The auth itself, not the module's public interface: that one also loads
  // the session gate, which reads the request headers of Next.js.
  const { auth } = await import("@/data/auth/auth");
  const { db } = await import("@/data/db/client");
  const { user } = await import("@/data/db/schema");
  const { fakeMailer, linkOf } = await import("@/test/mailer");
  const { seedHolder } = await import("@/test/seed-accounts");

  async function holderState() {
    const [found] = await db
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, seedHolder.email));
    if (!found) return "absent";
    return found.emailVerified ? "confirmed" : "unconfirmed";
  }

  // A POST to the Better Auth router, as a browser sends it, from the holder's
  // own IP.
  async function post(path: string, body: Record<string, unknown>) {
    const response = await auth.handler(
      new Request(`${baseUrl}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-forwarded-for": seedHolder.ip,
        },
        body: JSON.stringify(body),
      }),
    );
    if (!response.ok) {
      const { code } = (await response.json().catch(() => ({}))) as {
        code?: string;
      };
      throw new SeedFailure(
        `The request to ${path} answered ${response.status}${code ? ` (${code})` : ""}.`,
      );
    }
  }

  async function signUpHolder() {
    await post("/sign-up/email", {
      name: seedHolder.name,
      email: seedHolder.email,
      password: seedHolder.password,
      adultDeclaration: true,
      acceptance: true,
    });
  }

  // The sign-up of an earlier run that stopped before the confirmation left
  // the holder there: the real route sends the link again.
  async function askForAnotherConfirmation() {
    await post("/send-verification-email", { email: seedHolder.email });
  }

  // Opens the link of the confirmation e-mail the fake mailer captured. The
  // sign-up's answer comes back with the send still pending (A3.7), so the
  // seed waits for the mailer to receive it first.
  async function openConfirmationLink() {
    await fakeMailer.settled();
    const [confirmation] = fakeMailer.sent;
    if (!confirmation) {
      throw new SeedFailure("No confirmation e-mail was sent.");
    }
    const response = await auth.handler(
      new Request(linkOf(confirmation), {
        headers: { "x-forwarded-for": seedHolder.ip },
      }),
    );
    // A refused link leads to the home page with the error's code in the
    // `error` parameter. The failure prints that code alone: the rest of the
    // query can carry values (RNF-OBS-01).
    const sentTo = new URL(response.headers.get("location") ?? "", baseUrl);
    const error = sentTo.searchParams.get("error");
    if (response.status !== 302 || error !== null) {
      throw new SeedFailure(
        `Opening the confirmation link answered ${response.status}${error ? ` with the error ${error}` : ""}.`,
      );
    }
  }

  try {
    const state = await holderState();
    if (state === "confirmed") return;
    if (state === "absent") await signUpHolder();
    else await askForAnotherConfirmation();
    await openConfirmationLink();
    if ((await holderState()) !== "confirmed") {
      throw new SeedFailure("The holder's e-mail is not confirmed.");
    }
  } finally {
    await db.$client.end();
  }
}

try {
  refuseAHostedDatabase();
  await seedTheHolder();
  console.log("Seed done: the holder is ready.");
} catch (error) {
  console.error(
    `Seed failed: ${error instanceof SeedFailure ? error.message : loggable(error)}`,
  );
  process.exitCode = 1;
}
