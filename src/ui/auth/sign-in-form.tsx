"use client";

import {
  CheckboxField,
  FormError,
  PasswordField,
  SubmitButton,
  TextField,
} from "./fields";
import { texts } from "./texts";
import { useSignIn } from "./use-sign-in";

// The sign-in form: e-mail, password with "Mostrar senha", and "Lembrar de
// mim", which starts unchecked. A refusal is about the form as a whole, as it
// never says which of the e-mail and the password is wrong (A2.10).
export function SignInForm() {
  const { error, busy, canSubmit, submit } = useSignIn();
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        label={texts.signIn.email}
        name="email"
        type="email"
        autoComplete="email"
      />
      <PasswordField
        label={texts.signIn.password}
        autoComplete="current-password"
      />
      <CheckboxField label={texts.signIn.rememberMe} name="rememberMe" />
      <FormError message={error} />
      <SubmitButton
        label={texts.signIn.submit}
        busyLabel={texts.signIn.submitting}
        busy={busy}
        enabled={canSubmit}
      />
    </form>
  );
}
