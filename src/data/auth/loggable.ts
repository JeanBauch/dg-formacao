import "server-only";

// What a failure may say in a log: its name and the database's error code.
// Never its message, which for a failed query carries the values it sent: the
// name, the e-mail and the full IP among them (RNF-OBS-01, RNF-SEG-15).
export function loggable(error: unknown) {
  if (!(error instanceof Error)) return "unknown error";
  const { code } = (error.cause ?? error) as { code?: unknown };
  return typeof code === "string" ? `${error.name} (${code})` : error.name;
}
