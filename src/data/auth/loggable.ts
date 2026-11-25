import "server-only";

// The database's error code of a failure: that of its innermost cause with
// one. A failed query wraps the driver's error, which has the code, and Better
// Auth can wrap the failed query in turn. The walk stops after a few causes,
// so a chain that loops back cannot hold the log.
function databaseCode(error: Error) {
  let code: string | undefined;
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object"; depth += 1) {
    const { code: own, cause } = (current ?? {}) as {
      code?: unknown;
      cause?: unknown;
    };
    if (typeof own === "string") code = own;
    current = cause;
  }
  return code;
}

// What a failure may say in a log: its name and the database's error code.
// Never its message, which for a failed query carries the values it sent: the
// name, the e-mail and the full IP among them (RNF-OBS-01, RNF-SEG-15).
export function loggable(error: unknown) {
  if (!(error instanceof Error)) return "unknown error";
  const code = databaseCode(error);
  return code === undefined ? error.name : `${error.name} (${code})`;
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
