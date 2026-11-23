// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { envVariableNames, parseEnv } from "./env";

// A1.7: the inventory is .env.example, the only versioned environment file.
const inventoryPath = resolve(import.meta.dirname, "../../../.env.example");

function readInventory() {
  const entries = readFileSync(inventoryPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)] as const;
    });
  return Object.fromEntries(entries);
}

describe("the environment inventory (A1.7)", () => {
  test("every variable of the schema is in the inventory, and every item of the inventory is in the schema", () => {
    expect(Object.keys(readInventory()).sort()).toEqual(
      [...envVariableNames].sort(),
    );
  });

  test("the inventory holds only local, fictitious values and is itself a valid local configuration", () => {
    const inventory = readInventory();

    expect(parseEnv(inventory)).toMatchObject({
      APP_ENV: "local",
      SIGNUP_ENABLED: true,
      MAILER_ADAPTER: "file",
    });
  });
});
