"use client";

import { answerOf, authClient } from "./auth-client";
import { FormError, SubmitButton } from "./fields";
import { errorMessage, texts } from "./texts";
import { useAuthForm } from "./use-auth-form";

// Signs out over Better Auth's HTTP, which deletes this device's session and
// clears its cookie (A2.8), and then goes to the sign-in page.
async function signOut() {
  const { error } = await answerOf(authClient.signOut());
  if (!error) window.location.replace("/entrar");
  return error;
}

// "Sair", on the account's page.
export function SignOutButton() {
  const form = useAuthForm(signOut);
  return (
    <form onSubmit={form.submit} className="flex flex-col gap-2">
      <FormError message={form.error && errorMessage(form.error)} />
      <SubmitButton
        label={texts.account.signOut}
        busyLabel={texts.account.signingOut}
        busy={form.busy || form.done}
        enabled={form.canSubmit && !form.done}
      />
    </form>
  );
}
