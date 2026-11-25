import { inspect } from "node:util";
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
import { verifySession } from "@/data/auth";
import { printedDuring } from "@/test/console";
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

describe("the session gate when the database fails the session read", () => {
  // A holder signs in, and then the application role loses the right to read
  // sessions while each test runs, so the database refuses the session read.
  let token: string;

  beforeEach(async () => {
    const holder = await signedInHolder();
    [{ token }] = await owner<{ token: string }[]>`
      select token from app.session where user_id = ${holder.userId}`;
    serveRequestWith(holder.cookie);
    await owner`revoke select on app.session from dg_app`;
  });

  afterEach(async () => {
    await owner`grant select on app.session to dg_app`;
  });

  // Next.js prints a thrown error with its causes, and the failed query's
  // error holds its values, the session's token among them.
  test("throws an error with no cause, and neither it nor the log carries the session's token (RNF-OBS-01)", async () => {
    const { result: thrown, printed } = await printedDuring(() =>
      verifySession().then(
        () => undefined,
        (error: unknown) => error,
      ),
    );

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).cause).toBeUndefined();
    expect(inspect(thrown, { depth: null })).not.toContain(token);
    expect(printed).toMatch(/Reading the session failed: APIError \(42501\)/);
    expect(printed).not.toContain(token);
  });
});

// When the session of a user expires, as the database keeps it.
async function expiryOf(userId: string) {
  const [{ expires_at }] = await owner<{ expires_at: Date }[]>`
    select expires_at from app.session where user_id = ${userId}`;
  return expires_at;
}

describe("the session gate and the daily renewal (A2.7)", () => {
  // Only Date is faked: the database driver keeps its real timers.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T13:05:30.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("leaves a session due for renewal as it is, for the HTTP read that renews its cookie too", async () => {
    const holder = await signedInHolder();
    vi.setSystemTime(new Date("2026-11-25T13:06:30.000Z"));
    serveRequestWith(holder.cookie);

    expect(await verifySession()).toMatchObject({ userId: holder.userId });
    expect(await expiryOf(holder.userId)).toEqual(
      new Date("2026-12-01T13:05:30.000Z"),
    );
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
