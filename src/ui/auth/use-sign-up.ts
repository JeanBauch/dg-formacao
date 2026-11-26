"use client";

import { useState } from "react";
import { defaultReturnPath, passwordStrength } from "@/domain/auth";
import { answerOf, authClient } from "./auth-client";
import { errorMessage, texts } from "./texts";
import { useAuthForm } from "./use-auth-form";

type SignUpField =
  "name" | "email" | "password" | "adultDeclaration" | "acceptance";

// The field each refusal of the sign-up is about, by the code the server
// answers with. A refusal of no field is about the form as a whole.
const fieldOfRefusal: Partial<Record<string, SignUpField>> = {
  NAME_REQUIRED: "name",
  NAME_TOO_LONG: "name",
  INVALID_EMAIL: "email",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "email",
  PASSWORD_TOO_SHORT: "password",
  PASSWORD_TOO_LONG: "password",
  ADULT_DECLARATION_REQUIRED: "adultDeclaration",
  ACCEPTANCE_REQUIRED: "acceptance",
};

// Signs up over Better Auth's HTTP, with the adult declaration and the
// acceptance as the form has them: unchecked, the server refuses the sign-up
// with what to do (A2.3). The sign-up signs the holder in, and the browser
// loads the user's page.
//
// The two checkboxes are no fields of the user, so the client's types do not
// know them: they go in the request's body through its fetch options, which
// the client merges into the body, and the server's before-hook validates them.
async function signUp(form: FormData) {
  const { error } = await answerOf(
    authClient.signUp.email({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      fetchOptions: {
        body: {
          adultDeclaration: form.get("adultDeclaration") === "on",
          acceptance: form.get("acceptance") === "on",
        },
      },
    }),
  );
  if (!error) window.location.replace(defaultReturnPath);
  return error;
}

// The ViewModel of the sign-up form: each refusal goes to its field, and the
// password's strength follows what the person types (A2.4), saying nothing
// while the field is empty.
export function useSignUp() {
  const form = useAuthForm(signUp);
  const [password, setPassword] = useState("");
  const message = form.error && errorMessage(form.error);
  const field = form.error?.code && fieldOfRefusal[form.error.code];
  return {
    errorOf: (name: SignUpField) => (field === name ? message : null),
    formError: field ? null : message,
    strength:
      password === ""
        ? ""
        : texts.password.strength[passwordStrength(password)],
    typePassword: setPassword,
    busy: form.busy || form.done,
    canSubmit: form.canSubmit && !form.done,
    submit: form.submit,
  };
}
