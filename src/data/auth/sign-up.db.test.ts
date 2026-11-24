import { format } from "node:util";
import { v7 as uuidv7 } from "uuid";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { auth } from "@/data/auth";
import { connect, testDatabase } from "@/test/db/test-database";
import { nextTestIp } from "@/test/ip";

// Seam 1: the Better Auth HTTP handler, in the process, over the test database.
// The code under test connects as the application role; this file reads the
// rows and cleans up as the migrations role, which owns the tables.
const owner = connect(testDatabase.migrationsUrl);
const app = connect(testDatabase.appUrl);

beforeAll(async () => {
  await owner`truncate app."user", app.verification, app.rate_limit cascade`;
});

afterAll(async () => {
  await Promise.all([owner.end(), app.end()]);
});

// A2.2: after every scenario, each user in the database has exactly one
// holder's profile.
afterEach(async () => {
  const broken = await owner`
    select u.id, count(p.id)::int as holder_profiles from app."user" u
    left join app.profiles p on p.user_id = u.id and p.is_primary
    group by u.id having count(p.id) <> 1`;

  expect(broken).toEqual([]);
});

let signUps = 0;

// The form of a valid sign-up by a fictitious holder, with an e-mail of a
// domain reserved for documentation: the adult declaration and the acceptance
// are checked.
function holder() {
  signUps += 1;
  return {
    name: "Maria Fictícia",
    email: `titular-${signUps}@example.com`,
    password: "senha-de-teste-1",
    adultDeclaration: true,
    acceptance: true,
  };
}

// Every row a user can have, counted table by table.
async function storedRows() {
  const [counts] = await owner<
    {
      users: number;
      loginIdentities: number;
      sessions: number;
      verifications: number;
      profiles: number;
      holderProfiles: number;
      consents: number;
    }[]
  >`
    select
      (select count(*)::int from app."user") as users,
      (select count(*)::int from app.account) as "loginIdentities",
      (select count(*)::int from app.session) as sessions,
      (select count(*)::int from app.verification) as verifications,
      (select count(*)::int from app.profiles) as profiles,
      (select count(*)::int from app.profiles where is_primary)
        as "holderProfiles",
      (select count(*)::int from app.consents) as consents`;
  return counts;
}

function signUp(body: Record<string, unknown>, ip = nextTestIp()) {
  return auth.handler(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

// A sign-up's answer and everything printed while it ran, as one text: Better
// Auth's logger, which the hook logs through, prints to the console.
async function signUpLogged(body: Record<string, unknown>) {
  const printed: string[] = [];
  const spies = (["error", "warn", "info", "log"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args) => {
      printed.push(format(...args));
    }),
  );
  try {
    const response = await signUp(body);
    return { response, log: printed.join("\n") };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

// The profiles of the user who signed up with this e-mail.
function profilesOf(email: string) {
  return owner<{ name: string; kind: string; is_primary: boolean }[]>`
    select p.name, p.kind, p.is_primary from app.profiles p
    join app."user" u on u.id = p.user_id
    where u.email = ${email}`;
}

// The consents of the user who signed up with this e-mail, by document.
function consentsOf(email: string) {
  return owner<{ document: string; version: string; accepted_at: Date }[]>`
    select c.document, c.version, c.accepted_at from app.consents c
    join app."user" u on u.id = c.user_id
    where u.email = ${email}
    order by c.document::text`;
}

describe("a valid sign-up (A2.1)", () => {
  test("creates the user in the same request", async () => {
    const form = holder();

    const response = await signUp(form);

    expect(response.status).toBe(200);
    expect(
      await owner`select name, email from app."user" where email = ${form.email}`,
    ).toEqual([{ name: "Maria Fictícia", email: form.email }]);
  });

  test("gives the user the holder's profile, standard, primary and with the sign-up name", async () => {
    const form = holder();

    await signUp(form);

    expect(await profilesOf(form.email)).toEqual([
      { name: "Maria Fictícia", kind: "standard", is_primary: true },
    ]);
  });

  test("records one consent per document, with its version and time", async () => {
    const form = holder();
    const sent = Date.now();

    await signUp(form);

    const consents = await consentsOf(form.email);
    // The provisional versions of DP-02 and DP-04.
    expect(
      consents.map(({ document, version }) => ({ document, version })),
    ).toEqual([
      { document: "adult_declaration", version: "2026-11-provisoria" },
      { document: "privacy_policy", version: "2026-11-provisoria" },
      { document: "terms_of_use", version: "2026-11-provisoria" },
    ]);
    // The time of the sign-up, give or take the clocks of the host and the
    // database container.
    for (const { accepted_at } of consents) {
      expect(Math.abs(accepted_at.getTime() - sent)).toBeLessThan(10_000);
    }
  });

  test("keeps a consent's document, version and time, and no IP nor IP hash", async () => {
    const columns = await owner<{ name: string; type: string }[]>`
      select column_name as name, data_type as type
      from information_schema.columns
      where table_schema = 'app' and table_name = 'consents'`;

    expect(columns.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["document", "version", "accepted_at"]),
    );
    // No column named for an IP or a hash, and none of an address type.
    expect(
      columns.filter(
        ({ name, type }) =>
          /(^|_)(ip|hash)/.test(name) || ["inet", "cidr"].includes(type),
      ),
    ).toEqual([]);
  });
});

describe("the holder's profile, one per user (A2.2)", () => {
  // The ID of a user that signed up, as the application role finds it.
  async function signedUpUserId() {
    const form = holder();
    await signUp(form);
    const [{ id }] = await app<{ id: string }[]>`
      select id from app."user" where email = ${form.email}`;
    return id;
  }

  test("the database refuses a second holder's profile for the same user", async () => {
    const userId = await signedUpUserId();

    await expect(app`
      insert into app.profiles (id, user_id, name, kind, is_primary)
      values (${uuidv7()}, ${userId}, 'Outro Titular', 'standard', true)`).rejects.toMatchObject(
      { code: "23505" }, // unique_violation
    );
  });

  test("the database accepts another profile that is not the holder's", async () => {
    const userId = await signedUpUserId();

    await app`
      insert into app.profiles (id, user_id, name, kind, is_primary)
      values (${uuidv7()}, ${userId}, 'Perfil Fictício', 'standard', false)`;

    expect(
      await app`select is_primary from app.profiles where user_id = ${userId} order by is_primary`,
    ).toEqual([{ is_primary: false }, { is_primary: true }]);
  });
});

describe("a sign-up without the adult declaration or the acceptance (A2.3)", () => {
  test.each([
    [
      "without the adult declaration",
      { adultDeclaration: undefined },
      "ADULT_DECLARATION_REQUIRED",
    ],
    [
      "with the adult declaration unchecked",
      { adultDeclaration: false },
      "ADULT_DECLARATION_REQUIRED",
    ],
    [
      "without the acceptance",
      { acceptance: undefined },
      "ACCEPTANCE_REQUIRED",
    ],
    [
      "with the acceptance unchecked",
      { acceptance: false },
      "ACCEPTANCE_REQUIRED",
    ],
  ])("is refused %s, and nothing is written", async (_, change, code) => {
    const before = await storedRows();

    const response = await signUp({ ...holder(), ...change });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code });
    expect(await storedRows()).toEqual(before);
  });
});

// The name goes to the user and to the holder's profile, so it is validated
// at the boundary like the rest of the sign-up.
describe("the name of a sign-up", () => {
  test.each([
    ["missing", { name: undefined }],
    ["empty", { name: "" }],
    ["only whitespace", { name: " \t " }],
  ])("is refused when %s, and nothing is written", async (_, change) => {
    const before = await storedRows();

    const response = await signUp({ ...holder(), ...change });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "NAME_REQUIRED" });
    expect(await storedRows()).toEqual(before);
  });

  test("is refused over 100 characters, and nothing is written", async () => {
    const before = await storedRows();

    const response = await signUp({ ...holder(), name: "M".repeat(101) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "NAME_TOO_LONG" });
    expect(await storedRows()).toEqual(before);
  });

  test("is accepted with 100 characters", async () => {
    const response = await signUp({ ...holder(), name: "M".repeat(100) });

    expect(response.status).toBe(200);
  });
});

// Better Auth would store an image URL sent by the client in the user, and no
// image from a third party is shown (RNF-SEG-12).
describe("an image in a sign-up", () => {
  test.each([
    ["a third-party URL", "https://example.com/foto.png"],
    ["a relative path", "/foto.png"],
    ["an empty text", ""],
  ])("is refused as %s, and nothing is written", async (_, image) => {
    const before = await storedRows();

    const response = await signUp({ ...holder(), image });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "IMAGE_NOT_ACCEPTED",
    });
    expect(await storedRows()).toEqual(before);
  });
});

describe("the password of a sign-up (A2.4)", () => {
  test("is refused under 8 characters, and nothing is written", async () => {
    const before = await storedRows();

    const response = await signUp({ ...holder(), password: "1234567" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "PASSWORD_TOO_SHORT" });
    expect(await storedRows()).toEqual(before);
  });

  test("is accepted with 8 characters", async () => {
    const response = await signUp({ ...holder(), password: "12345678" });

    expect(response.status).toBe(200);
  });
});

describe("Better Auth's tables in the app schema (A2.5)", () => {
  test("receive the user, its login identity, its session and the rate-limit counter of a sign-up", async () => {
    const form = holder();
    const ip = nextTestIp();

    await signUp(form, ip);

    const [created] = await owner<
      { id: string; role: string | null; banned: boolean | null }[]
    >`select id, role, banned from app."user" where email = ${form.email}`;
    // The admin plugin's fields, with the values it gives a new user.
    expect(created).toMatchObject({ role: "user", banned: false });
    expect(
      await owner`select provider_id from app.account where user_id = ${created.id}`,
    ).toEqual([{ provider_id: "credential" }]);
    expect(
      await owner`select count(*)::int as sessions from app.session where user_id = ${created.id}`,
    ).toEqual([{ sessions: 1 }]);
    expect(
      await owner`select count from app.rate_limit where key = ${`${ip}|/sign-up/email`}`,
    ).toEqual([{ count: 1 }]);
  });

  test("are all in app, with the admin plugin's fields, and no table is in public", async () => {
    const tables = await owner<{ schema: string; name: string }[]>`
      select table_schema as schema, table_name as name
      from information_schema.tables
      where table_name in ('user', 'account', 'session', 'verification', 'rate_limit')
        or table_schema = 'public'
      order by table_name`;
    const adminFields = await owner<{ table: string; column: string }[]>`
      select table_name as table, column_name as column
      from information_schema.columns
      where table_schema = 'app'
        and (table_name, column_name) in (('user', 'role'), ('user', 'banned'),
          ('user', 'ban_reason'), ('user', 'ban_expires'),
          ('session', 'impersonated_by'))
      order by table_name, column_name`;

    expect(tables).toEqual([
      { schema: "app", name: "account" },
      { schema: "app", name: "rate_limit" },
      { schema: "app", name: "session" },
      { schema: "app", name: "user" },
      { schema: "app", name: "verification" },
    ]);
    expect(adminFields).toEqual([
      { table: "session", column: "impersonated_by" },
      { table: "user", column: "ban_expires" },
      { table: "user", column: "ban_reason" },
      { table: "user", column: "banned" },
      { table: "user", column: "role" },
    ]);
  });
});

describe("the user's ID (A2.6)", () => {
  test("of a new user is a UUIDv7", async () => {
    const form = holder();

    await signUp(form);

    const [{ id }] = await owner<{ id: string }[]>`
      select id from app."user" where email = ${form.email}`;
    // RFC 9562: version 7 in the 13th digit, variant 10xx in the 17th.
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  test("is text, as the Better Auth CLI generates it, and so is every key to the user", async () => {
    const [{ type }] = await owner<{ type: string }[]>`
      select format_type(atttypid, atttypmod) as type from pg_attribute
      where attrelid = 'app."user"'::regclass and attname = 'id'`;
    const keys = await owner<{ table: string; type: string }[]>`
      select c.conrelid::regclass::text as table,
        format_type(a.atttypid, a.atttypmod) as type
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.confrelid = 'app."user"'::regclass
      order by 1`;

    // The type the CLI wrote for the user's ID (U2).
    expect(type).toBe("text");
    expect(keys).toEqual([
      { table: "app.account", type: "text" },
      { table: "app.consents", type: "text" },
      { table: "app.profiles", type: "text" },
      { table: "app.session", type: "text" },
    ]);
  });
});

// Probes the migrations role adds to the test database while the hook's tests
// run, as a later migration would add a table. A trigger refuses the write of a
// login identity, a profile or a consent for a user with a marker name, as a
// database failure would. A sequence counts every attempt to write a profile:
// a sequence does not roll back, so it sees an attempt whose transaction
// failed. And a profile is refused unless its user is already committed by
// another transaction: the user row must be visible, and the transaction that
// wrote it (its xmin) must not be the one writing the profile.
const failingWrites = {
  account: "Falha na Identidade",
  profiles: "Falha no Perfil",
  consents: "Falha no Consentimento",
};

// A user whose profile write fails and whose deletion is refused too, as when
// the connection drops before the hook deletes the user.
const failingDeletion = "Falha na Exclusão";

async function addProbes() {
  await owner`create sequence app.test_profile_writes`;
  await owner`grant usage on sequence app.test_profile_writes to dg_app`;
  await owner.unsafe(`
    create function app.test_probe() returns trigger language plpgsql as $$
    declare
      holder text;
      written_here boolean;
    begin
      select name, xmin::text::bigint = txid_current() % 4294967296
        into holder, written_here
        from app."user" where id = new.user_id;
      if tg_table_name = 'profiles' then
        perform nextval('app.test_profile_writes');
        if written_here is null then
          raise exception 'probe: the user of the profile is not committed';
        end if;
        if written_here then
          raise exception 'probe: the profile is written inside the user transaction';
        end if;
      end if;
      if (tg_table_name, holder) in (
        ('account', '${failingWrites.account}'),
        ('profiles', '${failingWrites.profiles}'),
        ('profiles', '${failingDeletion}'),
        ('consents', '${failingWrites.consents}')
      ) then
        raise exception 'simulated failure writing %', tg_table_name;
      end if;
      return new;
    end $$`);
  for (const table of Object.keys(failingWrites)) {
    await owner.unsafe(`create trigger test_probe before insert on app.${table}
      for each row execute function app.test_probe()`);
  }
  await owner.unsafe(`
    create function app.test_refuse_deletion() returns trigger language plpgsql as $$
    begin
      if old.name = '${failingDeletion}' then
        raise exception 'simulated failure deleting the user';
      end if;
      return old;
    end $$`);
  await owner`create trigger test_refuse_deletion before delete on app."user"
    for each row execute function app.test_refuse_deletion()`;
}

async function removeProbes() {
  for (const table of Object.keys(failingWrites)) {
    await owner.unsafe(`drop trigger if exists test_probe on app.${table}`);
  }
  await owner`drop trigger if exists test_refuse_deletion on app."user"`;
  await owner`drop function if exists app.test_refuse_deletion()`;
  await owner`drop function if exists app.test_probe()`;
  await owner`drop sequence if exists app.test_profile_writes`;
}

async function profileWriteAttempts() {
  const [{ attempts }] = await owner<{ attempts: number }[]>`
    select case when is_called then last_value else 0 end::int as attempts
    from app.test_profile_writes`;
  return attempts;
}

describe("the after-hook of user creation", () => {
  beforeAll(addProbes);
  afterAll(removeProbes);

  describe("with the adapter's transaction on (A2.12)", () => {
    test("runs in the sign-up request, after the user's commit, outside its transaction", async () => {
      const form = holder();
      const attempts = await profileWriteAttempts();

      const response = await signUp(form);

      expect(response.status).toBe(200);
      expect(await profileWriteAttempts()).toBe(attempts + 1);
      expect(await profilesOf(form.email)).toMatchObject([{ name: form.name }]);
    });

    test("does not run when the login identity write fails and its transaction rolls back, the user with it", async () => {
      const before = await storedRows();
      const attempts = await profileWriteAttempts();

      // The login identity fails, not the user: a failing user write never queues the hook.
      const response = await signUp({
        ...holder(),
        name: failingWrites.account,
      });

      expect(response.ok).toBe(false);
      expect(await storedRows()).toEqual(before);
      expect(await profileWriteAttempts()).toBe(attempts);
    });
  });

  describe("when it fails (A2.13)", () => {
    test.each([
      ["writing the profile", failingWrites.profiles],
      ["writing the consents", failingWrites.consents],
    ])(
      "while %s deletes the new user with everything written for it, and the sign-up answers an error without a session",
      async (_, name) => {
        const form = { ...holder(), name };
        const before = await storedRows();

        const { response, log } = await signUpLogged(form);

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ code: "SIGN_UP_FAILED" });
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(await storedRows()).toEqual(before);
        // The log records the failure without personal data (RNF-OBS-01).
        expect(log).toMatch(
          /recording the holder's profile and consents: \w+ \(P0001\)/,
        );
        expect(log).not.toContain(form.email);
        expect(log).not.toContain(form.name);
      },
    );

    test("when deleting the new user fails too, the sign-up still answers its error without a session, and the log records both failures", async () => {
      const form = { ...holder(), name: failingDeletion };

      try {
        const { response, log } = await signUpLogged(form);

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ code: "SIGN_UP_FAILED" });
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(log).toMatch(
          /recording the holder's profile and consents: \w+ \(P0001\)/,
        );
        expect(log).toMatch(/deleting the new user failed too: \w+ \(P0001\)/);
        expect(log).not.toContain(form.email);
        expect(log).not.toContain(form.name);
      } finally {
        // The user the refused deletion leaves behind is for the cleanup of
        // A2.14. Removed here, after its name stops matching the probe, so the
        // invariant of A2.2 holds for the scenarios that follow.
        await owner`update app."user" set name = 'Removida' where email = ${form.email}`;
        await owner`delete from app."user" where email = ${form.email}`;
      }
    });
  });
});

describe("the writes of a sign-up (NF-3)", () => {
  test("are exactly one user, one profile, the holder's, and three consents, one per document, in under 2 s", async () => {
    const form = holder();
    const before = await storedRows();
    const started = performance.now();

    const response = await signUp(form);

    const elapsed = performance.now() - started;
    const after = await storedRows();
    const consents = await consentsOf(form.email);
    expect(response.status).toBe(200);
    expect({
      users: after.users - before.users,
      profiles: after.profiles - before.profiles,
      holderProfiles: after.holderProfiles - before.holderProfiles,
      consents: after.consents - before.consents,
      documents: consents.map(({ document }) => document),
    }).toEqual({
      users: 1,
      profiles: 1,
      holderProfiles: 1,
      consents: 3,
      documents: ["adult_declaration", "privacy_policy", "terms_of_use"],
    });
    expect(elapsed).toBeLessThan(2_000);
  });
});
