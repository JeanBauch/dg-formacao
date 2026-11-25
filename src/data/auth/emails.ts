import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  sendVerificationEmailFn,
} from "better-auth/api";
import { type Email, mailer } from "@/infra/mailer";
import { loggable, printLog } from "./loggable";

// How long each link lasts: the seconds Better Auth gives its token, and the
// words the message says them in, kept together so a message never names a
// time its link does not have (A3.10).
export const verificationLinkLifetime = { seconds: 60 * 60, text: "1 hora" };
export const passwordResetLinkLifetime = {
  seconds: 60 * 30,
  text: "30 minutos",
};

// What Better Auth hands a callback of e-mail: the account and the link.
type LinkEmailData = { user: { email: string }; url: string };

// Starts the send and does not wait for it: the response never depends on how
// long an e-mail takes, or on whether it leaves (A3.7, A3.9). A send that fails
// goes to the log as an error, with the failure's name and code only, as its
// message could carry the recipient (RNF-OBS-01). The server's adapter holds
// the work in after() until it ends, so the request can finish first.
function startSending(kind: "verification" | "password reset", email: Email) {
  void (async () => {
    try {
      await mailer.send(email);
    } catch (error) {
      printLog(
        "error",
        "Mailer",
        `Sending the ${kind} e-mail failed: ${loggable(error)}`,
      );
    }
  })();
}

// Better Auth's `emailVerification.sendVerificationEmail`: the message carries
// the link and its time, and nothing else of the holder (A3.10).
export async function sendVerificationEmail({ user, url }: LinkEmailData) {
  startSending("verification", {
    to: user.email,
    subject: "Confirme o seu e-mail",
    text: `Abra o link para confirmar o seu e-mail. O link vale por ${verificationLinkLifetime.text}.\n\n${url}\n`,
  });
}

// Sends the confirmation of a sign-up once the sign-up has ended well (A3.1):
// its user committed, its holder's profile and consents written, its session
// created. Better Auth's own send on sign-up (`sendOnSignUp`, left off) starts
// inside the user's transaction, before all of that, so a sign-up that then
// failed would send a link to an account that no longer exists. This
// after-hook makes the same link with Better Auth's own function for sending
// a confirmation, the one a request for another confirmation uses.
export const signUpConfirmation = {
  id: "sign-up-confirmation",
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/sign-up/email",
        handler: createAuthMiddleware(async (ctx) => {
          const signedUp = ctx.context.newSession;
          // A sign-up whose holder's profile fails has created its session
          // already, and answers an error (A2.13).
          if (!signedUp || ctx.context.returned instanceof APIError) return;
          await sendVerificationEmailFn(ctx, signedUp.user);
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

// Better Auth's `emailAndPassword.sendResetPassword`, with the same content
// rule as the confirmation.
export async function sendPasswordResetEmail({ user, url }: LinkEmailData) {
  startSending("password reset", {
    to: user.email,
    subject: "Redefina a sua senha",
    text: `Abra o link para criar uma nova senha. O link vale por ${passwordResetLinkLifetime.text}.\n\n${url}\n`,
  });
}
