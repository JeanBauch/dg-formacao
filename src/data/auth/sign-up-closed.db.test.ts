import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { auth } from "@/data/auth";
import { testBaseUrl } from "@/test/base-url";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp } from "@/test/ip";

// The public sign-up is closed in this file, as in production until DP-02,
// DP-04 and DP-11 are answered (A1.13). The configuration is read when the code
// under test loads, so it is set before the imports run, and restored after the
// file.
vi.hoisted(() => {
  vi.stubEnv("SIGNUP_ENABLED", "false");
});

// Seam 1: the Better Auth HTTP handler, in the process, over the test database.
// The code under test connects as the application role; this file reads the
// rows and cleans up as the migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit, app.security_events cascade`;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await owner.end();
});

const password = "senha-de-teste-1";

// The form of a valid sign-up by a fictitious holder.
function holder() {
  return {
    name: "Maria Fictícia",
    email: `titular-${randomUUID()}@example.com`,
    password,
    adultDeclaration: true,
    acceptance: true,
  };
}

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

async function users() {
  const [{ count }] = await owner<{ count: number }[]>`
    select count(*)::int as count from app."user"`;
  return count;
}

describe("with the public sign-up closed (A2.20)", () => {
  test("the sign-up route answers 404, and creates no account", async () => {
    const before = await users();

    const response = await post("/sign-up/email", holder());

    expect(response.status).toBe(404);
    expect(await users()).toBe(before);
  });

  test("a holder who has an account still signs in", async () => {
    // An account the server creates, as the invite and the bootstrap will:
    // the closed sign-up bars only the HTTP route.
    const form = holder();
    await auth.api.signUpEmail({ body: form });

    const response = await post("/sign-in/email", {
      email: form.email,
      password,
    });

    expect(response.status).toBe(200);
  });
});
