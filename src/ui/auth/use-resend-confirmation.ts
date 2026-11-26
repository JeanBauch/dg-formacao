"use client";

import { answerOf, authClient } from "./auth-client";
import { errorMessage, texts } from "./texts";
import { useAuthForm } from "./use-auth-form";

// Asks Better Auth for another confirmation link, for the e-mail of the
// session's own user, which Better Auth checks (A3.3). The link leads to the
// home page, like the sign-up's.
async function resend(email: string) {
  const { error } = await answerOf(authClient.sendVerificationEmail({ email }));
  return error;
}

// The ViewModel of "Enviar outro link de confirmação": the status says when a
// link went, and is empty while the next request is pending, so each link sent
// is announced.
export function useResendConfirmation(email: string) {
  const form = useAuthForm(() => resend(email));
  return {
    status: form.done ? texts.user.resent : "",
    error: form.error && errorMessage(form.error),
    busy: form.busy,
    canSubmit: form.canSubmit,
    submit: form.submit,
  };
}
