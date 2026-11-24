import { securityEvents } from "@/data/db/schema";

// The audit module, which writes the security log and purges it.
export const written = securityEvents.name;
export const purge = `delete from app.security_events where first_at < $1`;
