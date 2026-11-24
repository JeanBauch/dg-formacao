// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { envVariableNames, parseEnv } from "./env";

// A1.7: the inventory is .env.example, the only versioned environment file.
const inventoryPath = resolve(import.meta.dirname, "../../../.env.example");

function parseInventory(text: string) {
  const entries = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator === -1) {
        throw new Error(`Malformed inventory line (no "="): ${line}`);
      }
      return [line.slice(0, separator), line.slice(separator + 1)] as const;
    });
  return Object.fromEntries(entries);
}

function readInventory() {
  return parseInventory(readFileSync(inventoryPath, "utf8"));
}

describe("the inventory parser", () => {
  test("reads KEY=value lines and skips comments and blank lines", () => {
    expect(parseInventory("# note\n\nA=1\r\nB=\nC=x=y\n")).toEqual({
      A: "1",
      B: "",
      C: "x=y",
    });
  });

  test("rejects a line without an equals sign instead of truncating its name", () => {
    expect(() => parseInventory("FOO\n")).toThrow(/FOO/);
  });
});

describe("the environment inventory (A1.7)", () => {
  test("every variable of the schema is in the inventory, and every item of the inventory is in the schema", () => {
    expect(Object.keys(readInventory()).sort()).toEqual(
      [...envVariableNames].sort(),
    );
  });

  test("the inventory holds only local, fictitious values and is itself a valid local configuration", () => {
    const inventory = readInventory();

    // A1.7: every value is empty or a fictitious local one, and no secret
    // variable has a value. A variable absent from this list is unknown, so it
    // fails until a ticket that adds it says what its local value may be.
    const allowedLocalValue: Record<string, (value: string) => boolean> = {
      APP_ENV: (value) => value === "local",
      SIGNUP_ENABLED: (value) => value === "true",
      MAILER_ADAPTER: (value) => value === "file",
      SECURITY_EVENTS_DAILY_CAP: (value) => value === "1000",
      VERCEL: (value) => value === "",
      DATABASE_URL: (value) =>
        ["localhost", "127.0.0.1"].includes(new URL(value).hostname),
    };
    for (const [name, value] of Object.entries(inventory)) {
      expect(
        allowedLocalValue[name]?.(value),
        `${name} must be a known variable with a local or fictitious value`,
      ).toBe(true);
    }

    expect(parseEnv(inventory)).toMatchObject({
      APP_ENV: "local",
      SIGNUP_ENABLED: true,
      MAILER_ADAPTER: "file",
      SECURITY_EVENTS_DAILY_CAP: 1000,
    });
  });
});
