import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { auth } from "@/data/auth";
import { testBaseUrl } from "@/test/base-url";
import { printedDuring } from "@/test/console";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp } from "@/test/ip";
import { signedInHolder } from "@/test/request";

// Seam 1: the Better Auth HTTP handler, in the process, over the test database.
// The code under test connects as the application role; this file sets roles
// and cleans up as the migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  await owner.end();
});

// A request to a route of Better Auth, from its own simulated IP, so the rate
// limit never refuses it.
function request(
  method: string,
  path: string,
  { cookie, body }: { cookie?: string; body?: Record<string, unknown> } = {},
) {
  return auth.handler(
    new Request(`${testBaseUrl}/api/auth${path}`, {
      method,
      headers: {
        origin: testBaseUrl,
        "x-forwarded-for": nextTestIp(),
        ...(body && { "content-type": "application/json" }),
        ...(cookie && { cookie }),
      },
      body: body && JSON.stringify(body),
    }),
  );
}

// A holder with this role field, set in the database as the invite will set
// it: one staff role, or both, separated by a comma.
async function signedInStaff(role: string) {
  const staff = await signedInHolder();
  await owner`update app."user" set role = ${role} where id = ${staff.userId}`;
  return staff;
}

const signedInAdmin = () => signedInStaff("admin");

// The routes the R0 uses, as A4.17 lists them: sign-up, sign-in, sign-out and
// the session read; the request and completion of a password reset, with the
// e-mail's link; and sending and confirming the e-mail verification.
const r0Routes = [
  "/sign-up/email",
  "/sign-in/email",
  "/sign-out",
  "/get-session",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/send-verification-email",
  "/verify-email",
];

// Every endpoint the installed Better Auth exposes with this configuration, its
// plugins' included, once per method it answers: its path as the router
// declares it, with a parameter written as `:name`. An endpoint with no path is
// reachable only from the server.
const exposedEndpoints = Object.values(auth.api).flatMap(
  ({ path, options }: { path?: string; options: { method: unknown } }) =>
    path === undefined
      ? []
      : [options.method].flat().map((method) => [String(method), path]),
);

// A path as a request sends it: each parameter takes a fictitious value.
function concretePath(path: string) {
  return path.replace(/:[^/]+/g, "valor-ficticio");
}

describe("the routes of Better Auth's HTTP handler (A4.17)", () => {
  test("include every route the R0 uses", () => {
    expect(exposedEndpoints.map(([, path]) => path)).toEqual(
      expect.arrayContaining(r0Routes),
    );
  });

  describe("that the R0 uses answer", () => {
    test.each(exposedEndpoints.filter(([, path]) => r0Routes.includes(path)))(
      "%s %s",
      async (method, path) => {
        const response = await request(method, concretePath(path), {
          body: method === "GET" ? undefined : {},
        });

        expect(response.status).not.toBe(404);
      },
    );
  });

  // A new endpoint after an upgrade answers until it joins the disabled paths
  // or the list of A4.17, so this breaks and forces a decision.
  describe("that the R0 does not use answer 404, the admin plugin's and the account's own included", () => {
    test.each(exposedEndpoints.filter(([, path]) => !r0Routes.includes(path)))(
      "%s %s",
      async (method, path) => {
        const response = await request(method, concretePath(path), {
          body: method === "GET" ? undefined : {},
        });

        expect(response.status).toBe(404);
      },
    );
  });

  // The app's handler names a route without its trailing slashes, as the rate
  // limit does, and the social sign-in's return stays refused when spelled so.
  test.each([
    ["GET", "/callback/valor-ficticio/"],
    ["POST", "/callback/valor-ficticio/"],
    ["GET", "/callback/valor-ficticio//"],
  ])(
    "the social sign-in's return answers 404 to %s %s",
    async (method, path) => {
      const response = await request(method, path, {
        body: method === "GET" ? undefined : {},
      });

      expect(response.status).toBe(404);
    },
  );
});

describe("the admin plugin's impersonation (A4.12)", () => {
  test.each([
    ["an anonymous visitor", async () => undefined],
    ["a holder", async () => (await signedInHolder()).cookie],
    ["an instructor", async () => (await signedInStaff("instructor")).cookie],
    ["an admin", async () => (await signedInAdmin()).cookie],
    [
      "an account with both staff roles",
      async () => (await signedInStaff("instructor,admin")).cookie,
    ],
  ])("answers 404 to %s", async (_, cookieOf) => {
    const target = await signedInHolder();
    const cookie = await cookieOf();

    const response = await request("POST", "/admin/impersonate-user", {
      cookie,
      body: { userId: target.userId },
    });

    expect(response.status).toBe(404);
  });

  test.each([
    ["with a trailing slash", "/admin/impersonate-user/"],
    ["in upper case", "/ADMIN/IMPERSONATE-USER"],
    ["with a doubled slash", "/admin//impersonate-user"],
    ["with a letter percent-encoded", "/admin/impersonate-%75ser"],
  ])("answers 404 to an admin who spells it %s", async (_, path) => {
    const target = await signedInHolder();
    const { cookie } = await signedInAdmin();

    const response = await request("POST", path, {
      cookie,
      body: { userId: target.userId },
    });

    expect(response.status).toBe(404);
  });
});

describe("a route that answers with a server error", () => {
  // A holder signs in, and then the application role loses the right to read
  // sessions while each test runs, so the database refuses the session read.
  let cookie: string;

  beforeEach(async () => {
    ({ cookie } = await signedInHolder());
    await owner`revoke select on app.session from dg_app`;
  });

  afterEach(async () => {
    await owner`grant select on app.session to dg_app`;
  });

  test("is logged with the status and the route (RNF-OBS-01)", async () => {
    const { result: response, printed } = await printedDuring(() =>
      request("GET", "/get-session", { cookie }),
    );

    expect(response.status).toBe(500);
    expect(printed).toMatch(/An auth request to \/get-session answered 500/);
  });
});
