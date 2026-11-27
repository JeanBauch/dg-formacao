"use client";

import { FormError, SubmitButton } from "./fields";
import { texts } from "./texts";
import { useSignOut } from "./use-sign-out";

// "Sair", on the user's page.
export function SignOutButton() {
  const signOut = useSignOut();
  return (
    <form onSubmit={signOut.submit} className="flex flex-col gap-2">
      <FormError message={signOut.error} />
      <SubmitButton
        label={texts.user.signOut}
        busyLabel={texts.user.signingOut}
        busy={signOut.busy}
        enabled={signOut.canSubmit}
      />
    </form>
  );
}
