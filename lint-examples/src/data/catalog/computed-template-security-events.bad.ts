import * as schema from "@/data/db/schema";

// The table as a computed member of the schema, its key written as a template.
export const reads = schema[`securityEvents`].name;
