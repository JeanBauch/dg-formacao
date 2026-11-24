import * as schema from "@/data/db/schema";

// The table destructured from the schema by a computed key.
const { ["securityEvents"]: table } = schema;

export const reads = table.name;
