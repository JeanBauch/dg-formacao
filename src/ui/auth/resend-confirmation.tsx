"use client";

import { answerOf, authClient } from "./auth-client";
import { FormError, SubmitButton } from "./fields";
import { errorMessage, texts } from "./texts";
import { useAuthForm } from "./use-auth-form";

// Asks Better Auth for another confirmation link, for the e-mail of the
// session's own account, which Better Auth checks (A3.3). The link leads to the
// home page, like the sign-up's.
async function resend(email: string) {
  const { error } = await answerOf(authClient.sendVerificationEmail({ email }));
  return error;
}

// "Enviar outro link de confirmação", on the account's page while the e-mail
// is not confirmed. The status line says when the link went.
export function ResendConfirmation({ email }: { email: string }) {
  const form = useAuthForm(() => resend(email));
  return (
    <form onSubmit={form.submit} className="flex flex-col gap-2">
      <p role="status">{form.done ? texts.account.resent : ""}</p>
      <FormError message={form.error && errorMessage(form.error)} />
      <SubmitButton
        label={texts.account.resend}
        busyLabel={texts.account.resending}
        busy={form.busy}
        enabled={form.canSubmit}
      />
    </form>
  );
}
