import type { Sql } from "postgres";

// The type of each column of a table, as Postgres writes it (`text`, `inet`,
// `character varying(256)`), by column name. The table is named as in SQL,
// such as app."user".
export async function columnTypes(sql: Sql, table: string) {
  const columns = await sql<{ name: string; type: string }[]>`
    select attname as name, format_type(atttypid, atttypmod) as type
    from pg_attribute
    where attrelid = ${table}::regclass and attnum > 0 and not attisdropped`;
  return Object.fromEntries(columns.map(({ name, type }) => [name, type]));
}
