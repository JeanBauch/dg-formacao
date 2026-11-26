"use client";

import { answerOf, authClient } from "./auth-client";
import { errorMessage } from "./texts";
import { useAuthForm } from "./use-auth-form";

// Signs out over Better Auth's HTTP, which deletes this device's session and
// clears its cookie (A2.8), and then goes to the sign-in page.
async function signOut() {
  const { error } = await answerOf(authClient.signOut());
  if (!error) window.location.replace("/entrar");
  return error;
}

// The ViewModel of "Sair". Once signed out, it stays busy while the browser
// leaves for the sign-in page.
export function useSignOut() {
  const form = useAuthForm(signOut);
  return {
    error: form.error && errorMessage(form.error),
    busy: form.busy || form.done,
    canSubmit: form.canSubmit && !form.done,
    submit: form.submit,
  };
}
