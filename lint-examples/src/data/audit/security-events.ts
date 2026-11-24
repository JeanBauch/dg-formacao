import { securityEvents } from "@/data/db/schema";

// The one file of the audit module that writes the security log.
export const written = securityEvents.name;
export const insert = `insert into app.security_events (event) values ($1)`;
