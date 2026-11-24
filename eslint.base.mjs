import { dirname } from "node:path";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// ADR-009, item 2: provider SDKs live only in the infrastructure layer. These
// are anchored regexes: a bare `group` name uses gitignore semantics and would
// also match a local file or folder called `resend`.
const providerPackages = {
  regex: "^(@vercel/|@supabase/|@aws-sdk/|@mux/|resend(/|$))",
  message:
    "Provider SDKs are allowed only in src/infra/**; call the infra interface instead (ADR-009).",
};

// ADR-009, item 2: the domain layer is pure and knows no framework.
const nextImports = {
  regex: "^next(/|$)",
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
// not modules, so they are never matched, and neither are folders that merely
// share a module's name outside the module layers (src/ui/catalog). The index
// is the public interface and passes. Both the alias and the relative form are
// caught.
function internalImportPattern(other) {
  const layers = moduleLayers.join("|");
  return {
    regex: `^(@/(${layers})/|(\\.\\./)+((${layers})/)?)${other}/(?!index(\\.[a-z]+)?$).+`,
    message: `Import "${other}" through its public interface (the module index), not an internal file (section 9.12.1).`,
  };
}

// A5.6: only the audit module writes the security log (registro de segurança),
// the only place with the client's IP (RNF-SEG-15), and nothing reads it but
// the purge. One file of the audit module writes it, the schema defines it, and
// tests read it; the purge's ticket adds the purge's own file to these.
const securityEventsWriter = "src/data/audit/security-events.ts";
const securityEventsMessage =
  "Only the audit module writes the security log, and nothing reads it but the purge: record events through the audit module's public interface (A5.6).";
const securityEventsReads = [
  // The table object, imported or re-exported...
  "ImportSpecifier[imported.name='securityEvents']",
  "ExportSpecifier[local.name='securityEvents']",
  // ...or taken by its name from the schema or the relational queries, as a
  // member or by destructuring...
  "MemberExpression[property.name='securityEvents']",
  "ObjectPattern > Property[key.name='securityEvents']",
  // ...or by the same name as a computed key, in a string or a template.
  "Literal[value='securityEvents']",
  "TemplateElement[value.raw='securityEvents']",
  // The table's name in raw SQL, as a template or as a string.
  "TemplateElement[value.raw=/security_events/]",
  "Literal[value=/security_events/]",
].map((selector) => ({ selector, message: securityEventsMessage }));

// `no-restricted-imports` replaces its options in each matching config block, so
// every block lists the complete set that applies to its files.
function restrictImports(...patterns) {
  return { "no-restricted-imports": ["error", { patterns }] };
}

// The rules every file in the repository follows. The root config adds the
// ignores; the lint example test points `tsconfig` at its own type configuration.
//
// That test lints some examples more than once in one process, which is not a
// single run. Under CI=true typescript-eslint would infer a single CLI run and
// take a second parse of the same file for an autofix pass, typing it alone,
// with no imports and no lib, so imported names and even `Promise` would
// become error types.
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
          ? {
              project: tsconfig,
              tsconfigRootDir: dirname(tsconfig),
              disallowAutomaticSingleRunInference: true,
            }
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
      files: ["src/**/*.{ts,tsx,mts,js,jsx,mjs}"],
      ignores: [
        securityEventsWriter,
        "src/data/db/schema/**",
        "src/**/*.test.{ts,tsx,mts,js,jsx,mjs}",
        "src/test/**",
      ],
      rules: { "no-restricted-syntax": ["error", ...securityEventsReads] },
    },
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
          ...modules
            .filter((other) => other !== module)
            .map(internalImportPattern),
        ),
      })),
    ),
  ];
}
