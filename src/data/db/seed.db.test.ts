import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  afterAll,
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
import { nextTestIp } from "@/test/ip";
import { seedHolder } from "@/test/seed-accounts";

const seedScript = resolve(import.meta.dirname, "../../../scripts/db-seed.mts");

// Each run spawns the script, which loads the whole authentication.
vi.setConfig({ testTimeout: 60_000 });

// A1.8, seen from outside: the seed runs as a Node script, as `pnpm db:seed`
// does, against the test database as the application role, and these tests
// read what it left there as the migrations role, which owns the tables. The
// holder's sign-in goes through the Better Auth HTTP handler (seam 1).
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

beforeEach(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  await owner.end();
});

// The environment of a local or CI run of the seed, as .env.example has it,
// pointed at the test database.
const seedEnvironment = {
  APP_ENV: "ci",
  SIGNUP_ENABLED: "true",
  DATABASE_URL: testDatabase.appUrl,
  MAILER_ADAPTER: "file",
  VERCEL: "",
  BETTER_AUTH_URL: "",
};

// What Vitest adds to the environment of the tests: NODE_ENV=test puts Better
// Auth in test mode, which skips the origin check and the secret's validation,
// and `pnpm db:seed` runs with none of them.
function setByVitest(name: string) {
  return name === "NODE_ENV" || name === "TEST" || name.startsWith("VITEST");
}

// Runs the seed script and resolves with what it printed; rejects, with the
// script's own output, when it exits with an error.
async function runSeed(environment: Record<string, string> = {}) {
  // Next.js types NODE_ENV as always set; this child, as `pnpm db:seed`, has
  // none.
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !setByVitest(name)),
  ) as NodeJS.ProcessEnv;
  try {
    const { stdout, stderr } = await promisify(execFile)(
      process.execPath,
      [seedScript],
      { env: { ...inherited, ...seedEnvironment, ...environment } },
    );
    return `${stdout}${stderr}`;
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    throw new Error(`The seed failed:\n${stdout ?? ""}${stderr ?? ""}`, {
      cause: error,
    });
  }
}

// Every row of the holder's, counted table by table.
async function storedRows() {
  const [counts] = await owner<
    {
      users: number;
      accounts: number;
      holderProfiles: number;
      profiles: number;
      consents: number;
    }[]
  >`
    select
      (select count(*)::int from app."user") as users,
      (select count(*)::int from app.account) as accounts,
      (select count(*)::int from app.profiles where is_primary)
        as "holderProfiles",
      (select count(*)::int from app.profiles) as profiles,
      (select count(*)::int from app.consents) as consents`;
  return counts;
}

function holderRow() {
  return owner<{ email_verified: boolean }[]>`
    select email_verified from app."user" where email = ${seedHolder.email}`;
}

describe("the seed of the holder (A1.8)", () => {
  test("creates a holder with the e-mail confirmed, their profile and their consents", async () => {
    await runSeed();

    expect(await holderRow()).toEqual([{ email_verified: true }]);
    expect(
      await owner`
        select p.name, p.kind, p.is_primary from app.profiles p
        join app."user" u on u.id = p.user_id
        where u.email = ${seedHolder.email}`,
    ).toEqual([{ name: seedHolder.name, kind: "standard", is_primary: true }]);
    expect(
      await owner`
        select c.document from app.consents c
        join app."user" u on u.id = c.user_id
        where u.email = ${seedHolder.email}
        order by c.document::text`,
    ).toEqual([
      { document: "adult_declaration" },
      { document: "privacy_policy" },
      { document: "terms_of_use" },
    ]);
  });

  test("leaves a holder who signs in with the seed's password, through the real route", async () => {
    await runSeed();

    const response = await auth.handler(
      new Request(`${testBaseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: testBaseUrl,
          "x-forwarded-for": nextTestIp(),
        },
        body: JSON.stringify({
          email: seedHolder.email,
          password: seedHolder.password,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { email: seedHolder.email, emailVerified: true },
    });
  });

  test("gives the holder an e-mail of a domain reserved for tests", async () => {
    await runSeed();

    // RFC 2606, kept by RFC 6761: example.com, example.net and example.org,
    // and the names under .test, .example, .invalid and .localhost.
    const reserved =
      /@(example\.(com|net|org)|([a-z0-9-]+\.)+(test|example|invalid|localhost))$/;
    const emails = (
      await owner<{ email: string }[]>`select email from app."user"`
    ).map(({ email }) => email);
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatch(reserved);
  });

  test("run twice, duplicates nothing", async () => {
    await runSeed();
    const afterTheFirst = await storedRows();

    await runSeed();

    expect(afterTheFirst).toEqual({
      users: 1,
      accounts: 1,
      holderProfiles: 1,
      profiles: 1,
      consents: 3,
    });
    expect(await storedRows()).toEqual(afterTheFirst);
    expect(await holderRow()).toEqual([{ email_verified: true }]);
  });

  test("finishes the holder an earlier run left with the e-mail unconfirmed", async () => {
    // The sign-up of a run that stopped before opening the link.
    const signedUp = await auth.handler(
      new Request(`${testBaseUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: testBaseUrl,
          "x-forwarded-for": nextTestIp(),
        },
        body: JSON.stringify({
          name: seedHolder.name,
          email: seedHolder.email,
          password: seedHolder.password,
          adultDeclaration: true,
          acceptance: true,
        }),
      }),
    );
    expect(signedUp.status).toBe(200);
    expect(await holderRow()).toEqual([{ email_verified: false }]);

    await runSeed();

    expect(await holderRow()).toEqual([{ email_verified: true }]);
    expect((await storedRows()).users).toBe(1);
  });

  test("counts its requests under the holder's own IP, for the rate limit", async () => {
    await runSeed();

    // A key is the IP and the route: `${ip}|${route}`.
    const ips = (
      await owner<{ key: string }[]>`select key from app.rate_limit`
    ).map(({ key }) => key.slice(0, key.indexOf("|")));
    expect(new Set(ips)).toEqual(new Set([seedHolder.ip]));
  });

  test("gives the holder a simulated IP that no test is ever given", () => {
    // RFC 5737: 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24.
    expect(seedHolder.ip).toMatch(
      /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/,
    );
    // At least one full cycle of the tests' IP helper over its three ranges,
    // whatever its cap per range: a /24 holds 256 addresses.
    const issued = Array.from({ length: 3 * 256 }, () => nextTestIp());
    expect(issued).not.toContain(seedHolder.ip);
  });

  test("prints no e-mail, password or link", async () => {
    const printed = await runSeed();

    expect(printed).not.toContain(seedHolder.email);
    expect(printed).not.toContain(seedHolder.password);
    expect(printed).not.toContain("token=");
  });

  test("refuses to run against a hosted environment, and writes nothing", async () => {
    await expect(
      runSeed({
        APP_ENV: "production",
        DATABASE_URL: `${testDatabase.appUrl}?sslmode=require`,
        MAILER_ADAPTER: "resend",
      }),
    ).rejects.toThrow("The seed runs only with APP_ENV local or ci");

    expect((await storedRows()).users).toBe(0);
  });

  test("refuses, with APP_ENV ci too, a database off this machine, without naming it, and writes nothing", async () => {
    const run = runSeed({
      DATABASE_URL:
        "postgresql://dg_app:hosted-password@db.example.invalid:5432/dg_formacao_test",
    });

    await expect(run).rejects.toThrow(
      "The seed runs only against a database on this machine",
    );
    await expect(run).rejects.not.toThrow(
      /db\.example\.invalid|hosted-password|postgresql:/,
    );
    expect(await storedRows()).toEqual({
      users: 0,
      accounts: 0,
      holderProfiles: 0,
      profiles: 0,
      consents: 0,
    });
  });
});
