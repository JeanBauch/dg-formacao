// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("the server refuses to start when a required variable is missing", async () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("SIGNUP_ENABLED", "true");
  vi.stubEnv("MAILER_ADAPTER", "file");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("VERCEL", "");
  const { register } = await import("./instrumentation");

  await expect(register()).rejects.toThrow(/DATABASE_URL/);
});

test("the server starts with a valid configuration", async () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("SIGNUP_ENABLED", "false");
  vi.stubEnv("MAILER_ADAPTER", "file");
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://dg_app:dg_app@localhost:5432/dg_formacao",
  );
  vi.stubEnv("VERCEL", "");
  const { register } = await import("./instrumentation");

  await expect(register()).resolves.toBeUndefined();
});
