import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { currentUser } from "@/data/auth";
import { connect, testDatabase } from "@/test/db/test-database";
import { serveRequestWith, signedInHolder } from "@/test/request";

// Seam 2: the user of the session, as the user's page (/conta) shows it, over
// the test database as the application role. Of Next.js, only `headers()` is
// swapped, by the helper of seam 2, which hands the cookie of a real session.
// This file cleans up as the migrations role, which owns the tables.
vi.mock("next/headers", () => import("@/test/request"));

const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit cascade`;
});

afterAll(async () => {
  await owner.end();
});

describe("the user of the session (currentUser)", () => {
  test("gives the holder their name, e-mail and whether it is confirmed", async () => {
    const holder = await signedInHolder();
    serveRequestWith(holder.cookie);

    expect(await currentUser()).toEqual({
      name: "Maria Fictícia",
      email: holder.email,
      emailVerified: false,
    });
  });

  test("gives another holder their own user, never the first one's", async () => {
    const first = await signedInHolder();
    const other = await signedInHolder();
    serveRequestWith(other.cookie);

    const user = await currentUser();

    expect(user).toMatchObject({ email: other.email });
    expect(user?.email).not.toBe(first.email);
  });

  test("gives nothing to an anonymous request", async () => {
    serveRequestWith(null);

    expect(await currentUser()).toBeNull();
  });
});
