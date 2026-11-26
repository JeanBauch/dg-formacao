import { z } from "zod";

// The environments whose database is hosted; local and ci have their own.
export const hostedEnvironments = ["staging", "production"];
const tlsModes = ["require", "verify-ca", "verify-full"];

const envSchema = z
  .object({
    APP_ENV: z.enum(["local", "ci", "staging", "production"]),
    SIGNUP_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    MAILER_ADAPTER: z.enum(["file", "resend"]),
    // The Resend adapter's key and sender, both required when it is chosen (see
    // the check below). Their values are the provider account's, which spec B
    // sets up, so only their presence is checked here.
    RESEND_API_KEY: z.string().optional(),
    MAILER_FROM: z.string().optional(),
    // The security log's daily cap of new rows (A5.14): whole decimal digits,
    // from 1 to 2,000. A larger cap first needs a new budget in RNF-SEG-15.
    SECURITY_EVENTS_DAILY_CAP: z
      .string()
      .default("1000")
      .pipe(
        z
          .string()
          .regex(/^\d+$/, "must be a whole number from 1 to 2000")
          .transform(Number)
          .pipe(z.number().min(1).max(2000)),
      ),
    // Vercel defines it at build and run time; it only exists to refuse local and ci.
    VERCEL: z.string().optional(),
  })
  .check((ctx) => {
    const env = ctx.value;
    const hosted = hostedEnvironments.includes(env.APP_ENV);

    if (!hosted && env.VERCEL) {
      ctx.issues.push({
        code: "custom",
        path: ["VERCEL"],
        message: "must not be set when APP_ENV is local or ci",
        input: env.VERCEL,
      });
    }

    // A malformed URL is already reported by the field itself.
    const urlParses = URL.canParse(env.DATABASE_URL);
    const sslmode = urlParses
      ? new URL(env.DATABASE_URL).searchParams.get("sslmode")
      : null;
    if (hosted && urlParses && !tlsModes.includes(sslmode ?? "")) {
      ctx.issues.push({
        code: "custom",
        path: ["DATABASE_URL"],
        message:
          "must require TLS (sslmode) when APP_ENV is staging or production",
        input: env.DATABASE_URL,
      });
    }

    if (hosted && env.MAILER_ADAPTER === "file") {
      ctx.issues.push({
        code: "custom",
        path: ["MAILER_ADAPTER"],
        message: "the file adapter is allowed only when APP_ENV is local or ci",
        input: env.MAILER_ADAPTER,
      });
    }

    if (env.MAILER_ADAPTER === "resend") {
      for (const name of ["RESEND_API_KEY", "MAILER_FROM"] as const) {
        if (!env[name]) {
          ctx.issues.push({
            code: "custom",
            path: [name],
            message: "is required when MAILER_ADAPTER is resend",
            input: env[name],
          });
        }
      }
    }
  });

// The names the inventory (.env.example) must list.
export const envVariableNames = Object.keys(envSchema.shape);

export type Env = z.output<typeof envSchema>;

// The message lists each invalid variable by name and the reason, which never
// carries the value: a startup log must not leak a secret.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const lines = result.error.issues.map(
    (issue) => `- ${issue.path.join(".")}: ${issue.message}`,
  );
  throw new Error(["Invalid environment configuration:", ...lines].join("\n"));
}
