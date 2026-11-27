"use client";

import { returnPath } from "@/domain/auth";
import { answerOf, authClient } from "./auth-client";
import { errorMessage } from "./texts";
import { useAuthForm } from "./use-auth-form";

// The path the sign-in returns to: the page's `retorno`, when it is a path of
// the app, or the user's page (A2.9, A2.9a).
function requestedReturn() {
  return returnPath(new URLSearchParams(window.location.search).get("retorno"));
}

// Signs in over Better Auth's HTTP, with the form's e-mail, password and
// "Lembrar de mim". The return goes to Better Auth as the sign-in's callback
// too, which it refuses unless it is a path of the app (A2.9a). Once signed
// in, the browser loads the return path anew, so every part of the page reads
// the new session, and the sign-in page leaves the history.
async function signIn(form: FormData) {
  const destination = requestedReturn();
  const { error } = await answerOf(
    authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      rememberMe: form.get("rememberMe") === "on",
      callbackURL: destination,
    }),
  );
  if (!error) window.location.replace(destination);
  return error;
}

// The ViewModel of the sign-in form. Once signed in, it stays busy while the
// browser leaves for the return path.
export function useSignIn() {
  const form = useAuthForm(signIn);
  return {
    error: form.error && errorMessage(form.error),
    busy: form.busy || form.done,
    canSubmit: form.canSubmit && !form.done,
    submit: form.submit,
  };
}
