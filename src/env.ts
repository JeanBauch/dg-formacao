import { parseEnv } from "@/domain/config/env";

// The validated configuration, parsed once when the module first loads. The
// rest of the app reads this object, never process.env (ADR-009, item 8).
export const env = parseEnv(process.env);
