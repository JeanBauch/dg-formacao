// The telemetry interface (ADR-009, item 1): how the application tells the team
// something happened. The Sentry adapter comes with spec B (B4); until then the
// console one is the only adapter.

// What a warning may carry: a name, and a closed context of short values. Never
// an e-mail, a name, a phone number or a token (RNF-OBS-01).
export type Telemetry = {
  warn(name: string, context: Record<string, string | number>): void;
};

export const consoleTelemetry: Telemetry = {
  warn(name, context) {
    console.warn(JSON.stringify({ level: "warn", name, context }));
  },
};
