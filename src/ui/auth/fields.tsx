"use client";

import { useId, useState } from "react";
import { texts } from "./texts";

// The fields of the sign-up, the sign-in and the user's page, functional and
// with no theme of their own until the design system of R1. Each field has its
// label, shows the focus, and links its error to itself: the error is the
// field's description, and the field is marked invalid while it has one (WCAG
// 2.1 AA).

const inputClass =
  "rounded border border-current bg-transparent px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2";
const checkboxClass = "focus-visible:outline-2 focus-visible:outline-offset-2";
const errorClass = "text-sm text-red-700 dark:text-red-400";

// The ids a field is described by, or none.
function describedBy(...ids: (string | false)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

type TextFieldProps = {
  label: string;
  name: string;
  type?: "text" | "email";
  autoComplete: string;
  error?: string | null;
};

export function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  error,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(!!error && errorId)}
        className={inputClass}
      />
      {error && (
        <p id={errorId} className={errorClass}>
          {error}
        </p>
      )}
    </div>
  );
}

type PasswordFieldProps = {
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string | null;
  // A text about the password as it is typed, read along with the field.
  hint?: string;
  onInput?: (password: string) => void;
};

// A password field, with "Mostrar senha" to read what was typed.
export function PasswordField({
  label,
  autoComplete,
  error,
  hint,
  onInput,
}: PasswordFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name="password"
        type={shown ? "text" : "password"}
        required
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          hint !== undefined && hintId,
          !!error && errorId,
        )}
        onChange={(event) => onInput?.(event.target.value)}
        className={inputClass}
      />
      {hint !== undefined && (
        <p id={hintId} aria-live="polite" className="text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={errorClass}>
          {error}
        </p>
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={shown}
          onChange={(event) => setShown(event.target.checked)}
          className={checkboxClass}
        />
        {texts.password.show}
      </label>
    </div>
  );
}

type CheckboxFieldProps = {
  label: string;
  name: string;
  // Required for the form to go on, though only the server refuses it, with
  // its own message.
  required?: boolean;
  error?: string | null;
};

export function CheckboxField({
  label,
  name,
  required,
  error,
}: CheckboxFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          type="checkbox"
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(!!error && errorId)}
          className={checkboxClass}
        />
        <label htmlFor={id}>{label}</label>
      </div>
      {error && (
        <p id={errorId} className={errorClass}>
          {error}
        </p>
      )}
    </div>
  );
}

type SubmitButtonProps = {
  label: string;
  busyLabel: string;
  busy: boolean;
  enabled: boolean;
};

export function SubmitButton({
  label,
  busyLabel,
  busy,
  enabled,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={!enabled}
      className="self-start rounded border border-current px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
    >
      {busy ? busyLabel : label}
    </button>
  );
}

// A message about the whole form, read out as soon as it appears.
export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className={errorClass}>
      {message}
    </p>
  ) : null;
}
