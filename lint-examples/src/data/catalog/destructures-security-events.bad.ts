import * as schema from "@/data/db/schema";

// The table destructured from the schema, under another name.
const { securityEvents: table } = schema;

export const reads = table.name;
