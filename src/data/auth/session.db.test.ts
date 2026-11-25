import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { verifySession } from "@/data/auth";
import { statementsSentDuring } from "@/test/db/statements";
import { connect, testDatabase } from "@/test/db/test-database";
import { serveRequestWith, signedInHolder } from "@/test/request";
import { inOneServerRender } from "@/test/server-render";

// Seam 2: the session gate of the data layer, over the test database, as the
// application role. Of Next.js, only `headers()` is swapped, by the helper of
// seam 2, which hands the cookie of a real session. This file reads the rows
// and cleans up as the migrations role, which owns the tables.
vi.mock("next/headers", () => import("@/test/request"));

const owner = connect(testDatabase.migrationsUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit cascade`;
});

afterAll(async () => {
  await owner.end();
});

// The session a user has in the database, as the gate should give it.
async function sessionOf(userId: string) {
  const [session] = await owner<{ id: string; created_at: Date }[]>`
    select id, created_at from app.session where user_id = ${userId}`;
  return session;
}

describe("the session gate (verifySession)", () => {
  test("gives the owner of a session their account, roles and session", async () => {
    const holder = await signedInHolder();
    serveRequestWith(holder.cookie);

    const session = await verifySession();

    const stored = await sessionOf(holder.userId);
    expect(session).toEqual({
      userId: holder.userId,
      roles: ["user"],
      emailVerified: false,
      sessionId: stored.id,
      sessionCreatedAt: stored.created_at,
    });
  });

  test("gives another holder their own account, never the first one's", async () => {
    const first = await signedInHolder();
    const other = await signedInHolder();
    serveRequestWith(other.cookie);

    const session = await verifySession();

    expect(session).toMatchObject({ userId: other.userId });
    expect(session?.userId).not.toBe(first.userId);
  });

  test("gives nothing to an anonymous request", async () => {
    serveRequestWith(null);

    expect(await verifySession()).toBeNull();
  });

  test("gives nothing for the cookie of a session the database no longer has", async () => {
    const holder = await signedInHolder();
    await owner`delete from app.session where user_id = ${holder.userId}`;
    serveRequestWith(holder.cookie);

    expect(await verifySession()).toBeNull();
  });
});

// A statement that reads the session table.
function readsSession(statement: string) {
  return /\bfrom "app"\."session"/.test(statement);
}

describe("the session gate in one request (NF-1)", () => {
  test("reads the session from the database once, when three callers ask for it", async () => {
    const holder = await signedInHolder();
    serveRequestWith(holder.cookie);

    const { result: sessions, statements } = await statementsSentDuring(() =>
      inOneServerRender([verifySession, verifySession, verifySession]),
    );

    expect(sessions.map((session) => session?.userId)).toEqual([
      holder.userId,
      holder.userId,
      holder.userId,
    ]);
    expect(statements.filter(readsSession)).toHaveLength(1);
  });

  test("reads it again in the next request", async () => {
    const holder = await signedInHolder();
    serveRequestWith(holder.cookie);

    const { statements } = await statementsSentDuring(async () => {
      await inOneServerRender([verifySession]);
      await inOneServerRender([verifySession]);
    });

    expect(statements.filter(readsSession)).toHaveLength(2);
  });
});
