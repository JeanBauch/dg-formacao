// @vitest-environment node
import { describe, expect, test } from "vitest";
import { parseEnv } from "./env";

// Seam 3: pure domain functions. The source is a plain object, never process.env.
const localEnv = {
  APP_ENV: "local",
  SIGNUP_ENABLED: "true",
  DATABASE_URL: "postgresql://fake_user:fake_pass@localhost:5432/fake_db",
  MAILER_ADAPTER: "file",
};

const stagingEnv = {
  APP_ENV: "staging",
  SIGNUP_ENABLED: "true",
  DATABASE_URL:
    "postgresql://fake_user:fake_pass@db.example.test:6543/fake_db?sslmode=require",
  MAILER_ADAPTER: "resend",
};

describe("a valid configuration", () => {
  test("a local source parses into typed values", () => {
    expect(parseEnv(localEnv)).toEqual({
      APP_ENV: "local",
      SIGNUP_ENABLED: true,
      DATABASE_URL: "postgresql://fake_user:fake_pass@localhost:5432/fake_db",
      MAILER_ADAPTER: "file",
    });
  });

  test("a staging source with TLS and the Resend adapter parses", () => {
    expect(parseEnv(stagingEnv)).toMatchObject({
      APP_ENV: "staging",
      MAILER_ADAPTER: "resend",
    });
  });
});

function isInvalid(source: Record<string, string | undefined>) {
  return () => parseEnv(source);
}

describe("the application environment (A1.6)", () => {
  test.each(["local", "ci", "staging", "production"])(
    "%s is accepted",
    (appEnv) => {
      expect(parseEnv({ ...stagingEnv, APP_ENV: appEnv }).APP_ENV).toBe(appEnv);
    },
  );

  test.each(["", "development", "test", "Production", " local", "prod"])(
    "the value %j is rejected",
    (appEnv) => {
      expect(isInvalid({ ...localEnv, APP_ENV: appEnv })).toThrow(/APP_ENV/);
    },
  );

  test.each(["local", "ci"])(
    "%s with the VERCEL variable defined is rejected",
    (appEnv) => {
      expect(isInvalid({ ...localEnv, APP_ENV: appEnv, VERCEL: "1" })).toThrow(
        /VERCEL/,
      );
    },
  );

  test.each(["staging", "production"])(
    "%s with the VERCEL variable defined is accepted",
    (appEnv) => {
      const source = { ...stagingEnv, APP_ENV: appEnv, VERCEL: "1" };

      expect(parseEnv(source).APP_ENV).toBe(appEnv);
    },
  );

  test.each(["staging", "production"])(
    "%s with a database URL that does not require TLS is rejected",
    (appEnv) => {
      const withoutTls = {
        ...stagingEnv,
        APP_ENV: appEnv,
        DATABASE_URL:
          "postgresql://fake_user:fake_pass@db.example.test/fake_db",
      };
      const withWeakTls = {
        ...withoutTls,
        DATABASE_URL: `${withoutTls.DATABASE_URL}?sslmode=disable`,
      };

      expect(isInvalid(withoutTls)).toThrow(/DATABASE_URL/);
      expect(isInvalid(withWeakTls)).toThrow(/DATABASE_URL/);
    },
  );

  test("a malformed database URL is reported by name in a hosted environment", () => {
    expect(
      isInvalid({ ...stagingEnv, DATABASE_URL: "not-a-url-at-all" }),
    ).toThrow(/DATABASE_URL/);
  });

  test.each(["require", "verify-ca", "verify-full"])(
    "staging with sslmode=%s is accepted",
    (sslmode) => {
      const source = {
        ...stagingEnv,
        DATABASE_URL: `postgresql://fake_user:fake_pass@db.example.test/fake_db?sslmode=${sslmode}`,
      };

      expect(parseEnv(source).APP_ENV).toBe("staging");
    },
  );

  test.each(["local", "ci"])(
    "%s accepts a database URL without TLS",
    (appEnv) => {
      expect(parseEnv({ ...localEnv, APP_ENV: appEnv }).APP_ENV).toBe(appEnv);
    },
  );

  test.each(["staging", "production"])(
    "the file mail adapter is rejected in %s",
    (appEnv) => {
      expect(
        isInvalid({ ...stagingEnv, APP_ENV: appEnv, MAILER_ADAPTER: "file" }),
      ).toThrow(/MAILER_ADAPTER/);
    },
  );

  test.each(["local", "ci"])(
    "the file mail adapter is accepted in %s",
    (appEnv) => {
      expect(
        parseEnv({ ...localEnv, APP_ENV: appEnv, MAILER_ADAPTER: "file" })
          .MAILER_ADAPTER,
      ).toBe("file");
    },
  );
});

describe("the public sign-up switch (A1.13)", () => {
  test.each([
    ["true", true],
    ["false", false],
  ])("%s becomes the boolean %s", (value, expected) => {
    expect(
      parseEnv({ ...localEnv, SIGNUP_ENABLED: value }).SIGNUP_ENABLED,
    ).toBe(expected);
  });

  test.each(["", "TRUE", "False", "1", "0", "yes", " true", "true "])(
    "the value %j fails",
    (value) => {
      expect(isInvalid({ ...localEnv, SIGNUP_ENABLED: value })).toThrow(
        /SIGNUP_ENABLED/,
      );
    },
  );
});

function messageOf(source: Record<string, string | undefined>) {
  try {
    parseEnv(source);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the configuration to be invalid");
}

describe("a missing required variable (A1.5)", () => {
  test.each(["APP_ENV", "SIGNUP_ENABLED", "DATABASE_URL", "MAILER_ADAPTER"])(
    "without %s the message names it and prints no value",
    (name) => {
      const source: Record<string, string | undefined> = { ...localEnv };
      delete source[name];

      const message = messageOf(source);

      expect(message).toContain(name);
      for (const [other, value] of Object.entries(localEnv)) {
        if (other !== name) expect(message).not.toContain(value);
      }
    },
  );

  test("every missing variable is named in the same message, one per line", () => {
    const lines = messageOf({}).split("\n");

    expect(lines[0]).toBe("Invalid environment configuration:");
    expect(lines.slice(1).map((line) => line.split(":")[0])).toEqual([
      "- APP_ENV",
      "- SIGNUP_ENABLED",
      "- DATABASE_URL",
      "- MAILER_ADAPTER",
    ]);
  });

  test("an invalid value is reported by name, never printed", () => {
    const message = messageOf({
      ...localEnv,
      APP_ENV: "banana-env",
      DATABASE_URL: "not-a-url-with-secret-token",
    });

    expect(message).toContain("APP_ENV");
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("banana-env");
    expect(message).not.toContain("secret-token");
  });
});
