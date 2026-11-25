import { format } from "node:util";
import { vi } from "vitest";

// What `run` returns, and everything printed to the console while it ran, as
// one text: Better Auth's logger, its router and the app's own logs print
// there. Nothing reaches the terminal meanwhile.
export async function printedDuring<T>(run: () => Promise<T>) {
  const printed: string[] = [];
  const spies = (["error", "warn", "info", "log"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args) => {
      printed.push(format(...args));
    }),
  );
  try {
    return { result: await run(), printed: printed.join("\n") };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}
