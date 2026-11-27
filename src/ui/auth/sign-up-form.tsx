"use client";

import {
  CheckboxField,
  FormError,
  PasswordField,
  SubmitButton,
  TextField,
} from "./fields";
import { texts } from "./texts";
import { useSignUp } from "./use-sign-up";

// The sign-up form: full name, e-mail, password with its strength, the adult
// declaration and the acceptance of the Terms of Use and the Privacy Policy
// (A2.1). The two checkboxes are required, and the server refuses a sign-up
// without them with the message their field shows (A2.3).
export function SignUpForm() {
  const signUp = useSignUp();
  return (
    <form onSubmit={signUp.submit} className="flex flex-col gap-4">
      <TextField
        label={texts.signUp.name}
        name="name"
        autoComplete="name"
        error={signUp.errorOf("name")}
      />
      <TextField
        label={texts.signUp.email}
        name="email"
        type="email"
        autoComplete="email"
        error={signUp.errorOf("email")}
      />
      <PasswordField
        label={texts.signUp.password}
        autoComplete="new-password"
        hint={signUp.strength}
        onInput={signUp.typePassword}
        error={signUp.errorOf("password")}
      />
      <CheckboxField
        label={texts.signUp.adultDeclaration}
        name="adultDeclaration"
        required
        error={signUp.errorOf("adultDeclaration")}
      />
      <CheckboxField
        label={texts.signUp.acceptance}
        name="acceptance"
        required
        error={signUp.errorOf("acceptance")}
      />
      <FormError message={signUp.formError} />
      <SubmitButton
        label={texts.signUp.submit}
        busyLabel={texts.signUp.submitting}
        busy={signUp.busy}
        enabled={signUp.canSubmit}
      />
    </form>
  );
}
