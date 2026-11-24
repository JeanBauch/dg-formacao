import "server-only";
import type { GenericEndpointContext, User } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { consents, profiles, user } from "@/data/db/schema";
import { db } from "@/data/db/client";
import { missingSignUpDeclaration, signUpConsents } from "@/domain/auth";

// What the sign-up answers when a declaration is missing: a code the form maps
// to its field, and a message that says what to do (A2.3).
const refusals = {
  adultDeclaration: {
    code: "ADULT_DECLARATION_REQUIRED",
    message: "Confirme que você tem 18 anos ou mais para criar a conta.",
  },
  acceptance: {
    code: "ACCEPTANCE_REQUIRED",
    message:
      "Aceite os Termos de Uso e a Política de Privacidade para criar a conta.",
  },
};

// Runs as Better Auth's `hooks.before`: a sign-up without the adult
// declaration or the acceptance is refused before anything is written.
export const refuseIncompleteSignUp = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-up/email") return;
  const missing = missingSignUpDeclaration(ctx.body);
  if (missing) throw APIError.from("BAD_REQUEST", refusals[missing]);
});

// What a failure may say in a log: its name and the database's error code.
// Never its message, which for a failed query carries the values written, the
// name and the e-mail among them (RNF-OBS-01).
function loggable(error: unknown) {
  if (!(error instanceof Error)) return "unknown error";
  const { code } = (error.cause ?? error) as { code?: unknown };
  return typeof code === "string" ? `${error.name} (${code})` : error.name;
}

// Runs as Better Auth's `databaseHooks.user.create.after`, in the sign-up
// request: every account is born with the holder's profile (RF-PRF-01) and the
// consents the sign-up gave, one per document.
export async function recordHolder(
  newUser: User,
  context: GenericEndpointContext | null,
) {
  try {
    const given = signUpConsents(context?.body);
    await db.transaction(async (tx) => {
      await tx.insert(profiles).values({
        userId: newUser.id,
        name: newUser.name,
        kind: "standard",
        isPrimary: true,
      });
      await tx
        .insert(consents)
        .values(given.map((consent) => ({ userId: newUser.id, ...consent })));
    });
  } catch (error) {
    // The account committed before this hook ran (A2.12), so it would be left
    // without its holder's profile and its consents: delete it, and the
    // database deletes its login identity and session with it (A2.13). The
    // cleanup of A2.14 covers a process that dies before this point.
    await db.delete(user).where(eq(user.id, newUser.id));
    // The sign-up already set the cookie of that session; the error answer
    // carries the response headers, so the cookie goes too.
    context?.responseHeaders?.delete("set-cookie");
    context?.context.logger.error(
      `Sign-up failed recording the holder's profile and consents; the new account was deleted: ${loggable(error)}`,
    );
    throw APIError.from("INTERNAL_SERVER_ERROR", {
      code: "SIGN_UP_FAILED",
      message: "Não foi possível criar a conta. Tente de novo.",
    });
  }
}
