"use client";

import { FormError, SubmitButton } from "./fields";
import { texts } from "./texts";
import { useResendConfirmation } from "./use-resend-confirmation";

// "Enviar outro link de confirmação", on the user's page while the e-mail is
// not confirmed. The status line says when the link went.
export function ResendConfirmation({ email }: { email: string }) {
  const resend = useResendConfirmation(email);
  return (
    <form onSubmit={resend.submit} className="flex flex-col gap-2">
      <p role="status">{resend.status}</p>
      <FormError message={resend.error} />
      <SubmitButton
        label={texts.user.resend}
        busyLabel={texts.user.resending}
        busy={resend.busy}
        enabled={resend.canSubmit}
      />
    </form>
  );
}
