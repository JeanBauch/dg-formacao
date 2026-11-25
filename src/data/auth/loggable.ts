import "server-only";

// What a failure may say in a log: its name and the database's error code.
// Never its message, which for a failed query carries the values it sent: the
// name, the e-mail and the full IP among them (RNF-OBS-01, RNF-SEG-15).
export function loggable(error: unknown) {
  if (!(error instanceof Error)) return "unknown error";
  const { code } = (error.cause ?? error) as { code?: unknown };
  return typeof code === "string" ? `${error.name} (${code})` : error.name;
}

// Prints a line of Better Auth's logger (its `logger.log`). Better Auth hands
// the error it caught to the logger whole, as in "Failed to delete session from
// database" with the failed query and its token, so each error, the message
// included, is printed as `loggable` keeps it. Any other value that comes with
// the message is left out, as it could carry the request's data (RNF-OBS-01).
export function printAuthLog(
  level: "debug" | "info" | "warn" | "error",
  message: unknown,
  ...values: unknown[]
) {
  const text = typeof message === "string" ? message : loggable(message);
  const errors = values.filter((value) => value instanceof Error);
  const line = [`${level.toUpperCase()} [Better Auth]: ${text}`]
    .concat(errors.map(loggable))
    .join(": ");
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
