// @vitest-environment node
import { resolve } from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import { describe, expect, test, vi } from "vitest";
import { baseConfig } from "../../eslint.base.mjs";

// Every test runs type-aware ESLint, which is slow on a cold CI runner.
vi.setConfig({ testTimeout: 30_000 });

// Seam 4: ESLint over example files. The examples live in lint-examples/ so the
// repository lint, typecheck and build never read them; only this test does,
// with the type configuration of lint-examples/tsconfig.json.
const examplesDir = resolve(import.meta.dirname, "../../lint-examples");

const eslint = new ESLint({
  cwd: examplesDir,
  overrideConfigFile: true,
  overrideConfig: baseConfig({
    tsconfig: resolve(examplesDir, "tsconfig.json"),
  }),
});

async function lintExample(path: string) {
  const [result] = await eslint.lintFiles([path]);
  return result.messages.map((message) => ({
    ruleId: message.ruleId,
    severity: message.severity,
  }));
}

async function lintErrorTexts(path: string) {
  const [result] = await eslint.lintFiles([path]);
  return result.messages.map((message) => message.message);
}

describe("provider SDKs stay in the infrastructure layer (A6.1)", () => {
  test("importing a provider package outside src/infra is an error", async () => {
    const messages = await lintExample("src/data/auth/provider-import.bad.ts");

    expect(messages).toEqual(
      Array(6).fill({ ruleId: "no-restricted-imports", severity: 2 }),
    );
  });

  test("a local file or folder named like a provider package passes", async () => {
    const messages = await lintExample("src/data/auth/local-resend.good.ts");

    expect(messages).toEqual([]);
  });

  test("the same imports inside src/infra pass", async () => {
    const messages = await lintExample(
      "src/infra/mailer/provider-import.good.ts",
    );

    expect(messages).toEqual([]);
  });
});

describe("the domain layer does not know Next.js (A6.2)", () => {
  test("importing next/* in src/domain is an error", async () => {
    const messages = await lintExample("src/domain/catalog/next-import.bad.ts");

    expect(messages).toEqual([
      { ruleId: "no-restricted-imports", severity: 2 },
    ]);
  });

  test("a local file or folder named next passes", async () => {
    const messages = await lintExample("src/domain/catalog/local-next.good.ts");

    expect(messages).toEqual([]);
  });

  test("a module file in src/domain keeps the ban and the module rule together", async () => {
    const texts = await lintErrorTexts(
      "src/domain/auth/next-and-internal.bad.ts",
    );

    expect(texts).toEqual([
      expect.stringContaining("src/domain/** is pure"),
      expect.stringContaining("public interface"),
    ]);
  });

  test("a pure domain file passes", async () => {
    const messages = await lintExample("src/domain/catalog/pure.good.ts");

    expect(messages).toEqual([]);
  });
});

describe("a module imports another only through its public interface (A6.3)", () => {
  test("importing an internal file of another module is an error", async () => {
    const messages = await lintExample("src/data/auth/internal-import.bad.ts");

    expect(messages).toEqual(
      Array(2).fill({ ruleId: "no-restricted-imports", severity: 2 }),
    );
  });

  test("the same rule holds in the actions layer", async () => {
    const messages = await lintExample(
      "src/actions/auth/internal-import.bad.ts",
    );

    expect(messages).toEqual([
      { ruleId: "no-restricted-imports", severity: 2 },
    ]);
  });

  test("a relative import of another module from the actions layer is an error", async () => {
    const messages = await lintExample(
      "src/actions/auth/relative-internal-import.bad.ts",
    );

    expect(messages).toEqual([
      { ruleId: "no-restricted-imports", severity: 2 },
    ]);
  });

  test("a folder named like a module outside the module layers passes", async () => {
    const messages = await lintExample(
      "src/data/auth/ui-folder-import.good.ts",
    );

    expect(messages).toEqual([]);
  });

  test("the explicit index of a module passes in the relative and alias forms", async () => {
    const messages = await lintExample("src/data/auth/index-import.good.ts");

    expect(messages).toEqual([]);
  });

  test("a module imports its own internal files", async () => {
    const messages = await lintExample("src/data/auth/own-internal.good.ts");

    expect(messages).toEqual([]);
  });

  test("the public interface, the database client and the cache tags pass", async () => {
    const messages = await lintExample("src/data/auth/public-import.good.ts");

    expect(messages).toEqual([]);
  });
});

describe("modules do not import each other in a cycle (A6.4)", () => {
  test.each(["src/data/analytics/index.ts", "src/data/home/index.ts"])(
    "%s is an error when it closes a cycle through the other module",
    async (path) => {
      const messages = await lintExample(path);

      expect(messages).toEqual([{ ruleId: "import/no-cycle", severity: 2 }]);
    },
  );

  test("a one-way dependency between modules passes", async () => {
    const messages = await lintExample("src/data/editorial/index.ts");

    expect(messages).toEqual([]);
  });
});

describe("untyped input does not reach a use case without validation (A6.5)", () => {
  test("a request body passed straight to a use case is no-unsafe-argument", async () => {
    const messages = await lintExample(
      "src/app/api/courses/unsafe-argument.bad.ts",
    );

    expect(messages).toEqual([
      { ruleId: "@typescript-eslint/no-unsafe-argument", severity: 2 },
    ]);
  });

  test("a request body assigned to a typed variable is no-unsafe-assignment", async () => {
    const messages = await lintExample(
      "src/app/api/courses/unsafe-assignment.bad.ts",
    );

    expect(messages).toEqual([
      { ruleId: "@typescript-eslint/no-unsafe-assignment", severity: 2 },
    ]);
  });

  test("the body validated by the schema passes", async () => {
    const messages = await lintExample("src/app/api/courses/validated.good.ts");

    expect(messages).toEqual([]);
  });
});

describe("raw HTML is forbidden (A6.6)", () => {
  test("dangerouslySetInnerHTML is react/no-danger", async () => {
    const messages = await lintExample("src/ui/course/raw-html.bad.tsx");

    expect(messages).toEqual([{ ruleId: "react/no-danger", severity: 2 }]);
  });

  test("text rendered by React passes", async () => {
    const messages = await lintExample("src/ui/course/text.good.tsx");

    expect(messages).toEqual([]);
  });
});

describe("the examples stay out of the repository checks (A6.7)", () => {
  const repoRoot = resolve(import.meta.dirname, "../..");
  const repoEslint = new ESLint({ cwd: repoRoot });

  test("the repository lint ignores the example files", async () => {
    const ignored = await repoEslint.isPathIgnored(
      resolve(examplesDir, "src/data/auth/provider-import.bad.ts"),
    );

    expect(ignored).toBe(true);
  });

  test("the repository typecheck and build do not read the example files", () => {
    const tsconfigPath = resolve(repoRoot, "tsconfig.json");
    const config: unknown = ts.readConfigFile(
      tsconfigPath,
      ts.sys.readFile,
    ).config;
    const { fileNames } = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      repoRoot,
    );

    expect(fileNames.length).toBeGreaterThan(0);
    expect(fileNames.filter((name) => name.includes("lint-examples"))).toEqual(
      [],
    );
  });

  test("the new rules apply to the real code", async () => {
    const [providerImport] = await repoEslint.lintText(
      `import type { Resend } from "resend";
export type Client = Resend;
`,
      { filePath: resolve(repoRoot, "src/app/page.tsx") },
    );
    const [untypedArgument] = await repoEslint.lintText(
      `declare function runUseCase(input: string): void;
runUseCase(JSON.parse("1"));
`,
      { filePath: resolve(repoRoot, "src/app/page.tsx") },
    );

    expect(providerImport.messages.map((m) => m.ruleId)).toEqual([
      "no-restricted-imports",
    ]);
    expect(untypedArgument.messages.map((m) => m.ruleId)).toEqual([
      "@typescript-eslint/no-unsafe-argument",
    ]);
  });
});
