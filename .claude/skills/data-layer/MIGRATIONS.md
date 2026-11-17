# Schema changes

Read when a change edits `src/data/db/schema/` or needs a migration. Every migration is compatible with the code already in production: this is the **expand, then contract** rule.

## Steps

1. **Classify** the change before touching the schema:
   - *Expand* (old code keeps working): new table, new nullable column, new column with a default, new index, new enum value.
   - *Contract* (old code breaks): drop or rename a column or table, `NOT NULL` on an existing column, type change.

   A contract ships in its own later PR, once production code no longer reads the old shape. Renaming a column is therefore an expand PR (add the new column, backfill it, read and write the new one) followed by a contract PR (drop the old one).

   Done when you can name each change as expand or contract.
2. **Edit** the schema files. Done when `pnpm typecheck` passes.
3. **Generate** with the drizzle-kit generate script from `package.json`, giving a `verb-noun` name. Answer drizzle-kit's rename prompts deliberately: a rename answered as "create" becomes a drop plus an add. Done when one new SQL file exists and `drizzle-kit check` passes.
4. **Read** the generated SQL top to bottom. Done when every statement is one you intended, and no statement drops or rewrites data outside a contract PR.
5. **Backfill**, if needed, in a custom migration (`drizzle-kit generate --custom --name=<name>`). Write it to be idempotent, for example `UPDATE ... WHERE new_col IS NULL`. Done when running it twice leaves the same data.
6. **Apply** locally and run the data-layer tests. Done when both pass on a database migrated from scratch.
7. **Record** in the ticket comment which migrations are expand and which are contract.

Applied migrations are immutable: a mistake is fixed with a new migration. CI migrates its service container from scratch, each PR's migrations go to staging, and production migrates in the deploy pipeline right after the backup. Migrations reach shared databases only through that pipeline.

## Config facts

`drizzle.config.ts` is the source of truth. These settings have reasons the file cannot state:

- `schemaFilter: ['app']` keeps drizzle-kit away from Supabase's own schemas.
- `migrations: { schema: 'app' }` keeps the log of applied migrations in `app`. The backup copies only `app` (`pg_dump --schema=app`), so a restored database still knows which migrations ran.
- `dbCredentials.url` is `DATABASE_URL_DIRECT`: drizzle-kit needs a session, not the transaction pooler.

## Extensions

The first migration is custom. It creates the `app` and `extensions` schemas and runs `create extension if not exists pg_trgm with schema extensions`. On a plain Postgres (CI, local, or a restore target) the same file produces the same layout as on Supabase. The search index uses the schema-qualified operator class:

```ts
index('courses_search_text_trgm').using('gin', t.searchText.op('extensions.gin_trgm_ops'))
```

Search text is normalized in the app (`normalizeSearchText`), so queries need no `unaccent()` call.
