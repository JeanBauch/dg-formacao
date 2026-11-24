---
name: data-layer
description: Postgres data layer with Drizzle ORM 0.45 in this project, covering the `app` schema, connections, owner-scoped queries, transactions, idempotent writes, IDs, search text and database tests. Use when a change touches `src/data/`, the Drizzle schema, a migration, or a test that hits the database.
---

Rules for this project's data layer. Pinned versions: `drizzle-orm` 0.45.x with `drizzle-kit` 0.31.x. Parts of the Drizzle docs already describe 1.0 (RC) APIs and file layouts. The installed package and these rules win.

The decisions behind these rules are in ADR-007 and ADR-009 (`docs/adr/`), and the authorization pattern is in [RBAC.md](../next-architecture/RBAC.md).

## Plain Postgres

- Every table, enum and index lives in the `app` schema. Declare `export const app = pgSchema('app')`, then `app.table(...)` and `app.enum(...)`. Better Auth's tables are generated into the same schema (skill `auth-identity`).
- The database is plain Postgres reached only by this app. Access control is enforced in `src/data`, with no RLS policies. The database adds a second barrier through three roles (app, migrations and read-only), which the roles script sets up after the migrations, not the schema (see [MIGRATIONS.md](MIGRATIONS.md)). Supabase is a host only: its client libraries, Auth, Storage, Realtime and Data API stay out of the code.
- Extensions live in the `extensions` schema, created by the first custom migration. Reference them schema-qualified (`extensions.gin_trgm_ops`) so no query depends on `search_path`.

## Connections

- `src/data/db/client.ts` is the only client: `postgres(env.DATABASE_URL, { prepare: false })` passed to `drizzle({ client, schema })`.
  - `DATABASE_URL` is Supabase's transaction pooler, which rejects prepared statements. That is why `prepare: false` is set.
- `DATABASE_URL_DIRECT` is the session pooler (IPv4, port 5432), for drizzle-kit and backups only. App code imports `env.DATABASE_URL` alone.
- The client is the only module-level state in `src/data`.

## Columns

- **IDs:** UUIDv7 generated in the app, `uuid('id').primaryKey().$defaultFn(() => uuidv7())`, with `uuidv7` from the `uuid` package. Better Auth's tables, the account's `user` included, keep the `text` id its CLI generates, and the same generator fills it (`advanced.database.generateId: () => uuidv7()`). A column that references a Better Auth table is `text`, such as `text('user_id')`, never `uuid`.
- **Timestamps:** `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`, stored in UTC.
- **Names:** snake_case column names declared explicitly; camelCase TypeScript keys. Keys to the account holder are `user_id` (skill `auth-identity`).
- **Derived columns** (`content_format`, totals, `search_text`): each comes from one pure function in `src/domain`, and every write path that changes an input calls it.
- **References, never URLs:** files are referenced through `media_objects.id` and videos through `videos.id`. URLs are generated at read time.

## Queries

- **Owner-scoped:** every read or write of a profile's data filters by the session's user in SQL. A profile's rows join through `profiles.user_id = userId`. The filter sits in the query itself, so a missed check elsewhere still returns nothing.
- **DTOs out:** select the columns the caller needs and return a DTO; raw rows stay inside `src/data`.
- **Catalog scope:** catalog reads take the scope (`standard` | `child`) as an argument and apply RN-04 in the `WHERE` clause.
- **Search:** normalize the term with the same `normalizeSearchText` that writes `courses.search_text`, escape `%` and `_`, then use `ilike`, which the GIN trigram index serves.
- **Lists:** paginate (24 per page, RF-CAT-08) with a stable order that ends in `id`.

## Writes

- **Transactions:** a multi-statement change runs in `db.transaction(async (tx) => ...)`, with every statement on `tx`.
  - A thrown error rolls back; `tx.rollback()` aborts on purpose.
  - E-mail, storage and HTTP calls happen after the commit, inside `after()` when the response should not wait for them.
- **Idempotent by constraint:** enrollment and lesson completion upsert on their unique keys with `onConflictDoNothing({ target: [...] })` or `onConflictDoUpdate`. A double click or a retry then changes nothing (RNF-DAD-02).
- **Read-then-write:** when a write depends on a read, such as course completion recalculated from lesson progress (RN-03), read with `.for('update')` inside the same transaction.
- **Deletion:** courses, modules and lessons are archived (`archived_at`); personal data is deleted for real (RN-15).

## Schema changes

Follow [MIGRATIONS.md](MIGRATIONS.md) for every schema change. Each migration expands or contracts, and each runs against the code already in production.

## Tests

- Data functions run against a real Postgres 17: the CI service container, or Docker locally. Drizzle is never mocked.
- The tests that hit the database run in their own Vitest project with `fileParallelism: false`, which applies per project. The domain and lint projects use no database and may run alongside it.
- That project's `globalSetup` runs part 1 of the roles script (with the container's superuser), the migrations and part 2, the same scripts as production. They are tested on every run, and the migrations run once per run.
- The tests use their own database in the same container, apart from the development one. Its URL is fixed in the test config with the container's fictitious credentials, and is the same in CI, so there is no test env file.
- The code under test connects as the app role, so the refusals are real. Cleanup between files uses the migrations role, because the app role cannot delete audit rows. Each file truncates the `app` tables it uses, the rate-limit table included.
- Each test uses its own simulated IP, from a helper over the ranges reserved for documentation (RFC 5737), which are valid in `inet`. Rate-limit and lockout tests control the IP on purpose.
- Authorization tests follow RBAC.md (owner, another user, anonymous). Add a child profile wherever the catalog scope applies.
- Seed and fixture data are fictitious (RNF-QUA-02).

## Version traps

- Schema-scoped tables use `app.table('name', ...)`. The call form `pgSchema('app')('name', ...)` is from old releases.
- Relational queries use `relations()` with `db.query.<table>.findMany({ with })`. `defineRelations` belongs to 1.0.
- drizzle-kit 0.31 writes flat `drizzle/NNNN_name.sql` files plus `drizzle/meta/`. Folder-per-migration layouts in the docs belong to 1.0.
- `drizzle-kit push` targets a throwaway local database only. Shared databases change through committed migrations.
