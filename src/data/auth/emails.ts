import "server-only";
import { type Email, mailer } from "@/infra/mailer";
import { loggable, printAuthLog } from "./loggable";

// How long each link lasts: the seconds Better Auth gives its token, and the
// words the message says them in, kept together so a message never names a
// time its link does not have (A3.10).
export const verificationLink = { seconds: 60 * 60, text: "1 hora" };
export const passwordResetLink = { seconds: 60 * 30, text: "30 minutos" };

// What Better Auth hands a callback of e-mail: the account and the link.
type LinkRequest = { user: { email: string }; url: string };

// Starts the send and does not wait for it: the response never depends on how
// long an e-mail takes, or on whether it leaves (A3.7, A3.9). A send that fails
// goes to the log as an error, with the failure's name and code only, as its
// message could carry the recipient (RNF-OBS-01). The server's adapter holds
// the work in after() until it ends, so the request can finish first.
function startSending(kind: string, email: Email) {
  void (async () => {
    try {
      await mailer.send(email);
    } catch (error) {
      printAuthLog(
        "error",
        `Sending the ${kind} e-mail failed: ${loggable(error)}`,
      );
    }
  })();
}

// Better Auth's `emailVerification.sendVerificationEmail`: the message carries
// the link and its time, and nothing else of the holder (A3.10).
export async function sendVerificationEmail({ user, url }: LinkRequest) {
  startSending("verification", {
    to: user.email,
    subject: "Confirme o seu e-mail",
    text: `Abra o link para confirmar o seu e-mail. O link vale por ${verificationLink.text}.\n\n${url}\n`,
  });
}

// Better Auth's `emailAndPassword.sendResetPassword`, with the same content
// rule as the confirmation.
export async function sendPasswordResetEmail({ user, url }: LinkRequest) {
  startSending("password reset", {
    to: user.email,
    subject: "Redefina a sua senha",
    text: `Abra o link para criar uma nova senha. O link vale por ${passwordResetLink.text}.\n\n${url}\n`,
  });
}
