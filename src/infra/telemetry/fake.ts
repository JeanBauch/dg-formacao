import type { Telemetry } from "./index";

// The in-process adapter for the tests: it keeps each warning it receives.
export function createFakeTelemetry() {
  const warnings: { name: string; context: Record<string, string | number> }[] =
    [];
  const telemetry: Telemetry = {
    warn(name, context) {
      warnings.push({ name, context });
    },
  };
  return { telemetry, warnings };
}
