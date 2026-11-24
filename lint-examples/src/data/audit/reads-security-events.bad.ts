import { securityEvents } from "@/data/db/schema";

// A use case of the audit module, besides the one file that writes the
// security log, that reads it.
export const reads = securityEvents.name;
