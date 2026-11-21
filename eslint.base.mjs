import { dirname } from "node:path";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// ADR-009, item 2: provider SDKs live only in the infrastructure layer.
const providerPackages = {
  group: [
    "@vercel/*",
    "@supabase/*",
    "resend",
    "resend/*",
    "@aws-sdk/*",
    "@mux/*",
  ],
  message:
    "Provider SDKs are allowed only in src/infra/**; call the infra interface instead (ADR-009).",
};

// ADR-009, item 2: the domain layer is pure and knows no framework.
const nextImports = {
  group: ["next", "next/*"],
  message: "src/domain/** is pure: it must not import Next.js (ADR-009).",
};

// Section 9.12.1: the seven modules cut across the domain, data and actions layers.
const modules = [
  "auth",
  "catalog",
  "learning",
  "editorial",
  "home",
  "analytics",
  "audit",
];
const moduleLayers = ["domain", "data", "actions"];

// A module reaches another one only through its public interface, the module
// folder itself (its index.ts). The shared src/data/db and src/data/tags.ts are
// not modules, so they are never matched. Both the alias and the relative form
// are caught.
function internalFilesOf(other) {
  return {
    regex: `^(@/(${moduleLayers.join("|")})/|(\\.\\./)+(.*/)?)${other}/.+`,
    message: `Import "${other}" through its public interface (the module index), not an internal file (section 9.12.1).`,
  };
}

// `no-restricted-imports` replaces its options in each matching config block, so
// every block lists the complete set that applies to its files.
function restrictImports(...patterns) {
  return { "no-restricted-imports": ["error", { patterns }] };
}

// The rules every file in the repository follows. The root config adds the
// ignores; the lint example test points `tsconfig` at its own type configuration.
export function baseConfig({ tsconfig } = {}) {
  return [
    ...nextVitals,
    ...nextTs,
    // Formatting belongs to Prettier; turn off ESLint rules that would fight it.
    prettier,
    // RNF-SEG-12: raw HTML injection is forbidden.
    { rules: { "react/no-danger": "error" } },
    {
      files: ["**/*.{ts,tsx,mts}"],
      languageOptions: {
        parserOptions: tsconfig
          ? { project: tsconfig, tsconfigRootDir: dirname(tsconfig) }
          : { projectService: true },
      },
      // Section 9.6: an `any` (the result of `request.json()`, for one) cannot
      // reach a use case or a typed variable before the schema validates it.
      rules: {
        "@typescript-eslint/no-unsafe-argument": "error",
        "@typescript-eslint/no-unsafe-assignment": "error",
      },
      // The alias `@/*` resolves through the tsconfig that owns the files.
      ...(tsconfig && {
        settings: { "import/resolver": { typescript: { project: tsconfig } } },
      }),
    },
    // Section 9.12.1: imports between modules do not form a cycle.
    { rules: { "import/no-cycle": "error" } },
    {
      files: ["**/*.{ts,tsx,mts,js,jsx,mjs}"],
      ignores: ["src/infra/**"],
      rules: restrictImports(providerPackages),
    },
    {
      files: ["src/domain/**"],
      rules: restrictImports(providerPackages, nextImports),
    },
    ...moduleLayers.flatMap((layer) =>
      modules.map((module) => ({
        files: [`src/${layer}/${module}/**`],
        rules: restrictImports(
          providerPackages,
          ...(layer === "domain" ? [nextImports] : []),
          ...modules.filter((other) => other !== module).map(internalFilesOf),
        ),
      })),
    ),
  ];
}
