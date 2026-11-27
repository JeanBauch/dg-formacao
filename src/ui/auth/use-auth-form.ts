"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import { useHydrated } from "../use-hydrated";
import type { AuthError } from "./auth-client";

type FormState =
  | { status: "idle" }
  | { status: "failed"; error: AuthError }
  | { status: "done" };

// The ViewModel of a form whose action is a call of the auth client: `send`
// makes the call with the form's data and answers its error, or null once it
// went well. While a call is pending, and before React runs the page in the
// browser, the form cannot be sent again.
//
// While a call is pending, the form shows neither the last call's error nor
// its success. A screen reader announces an alert when it appears and a status
// when its text changes, so the next answer is announced too, even when it is
// the same as the last (WCAG 2.1 AA).
//
// The form is sent from its submit event, not as a form action, which React
// would follow by clearing the fields: after a refusal, the person corrects
// what they typed instead of typing it all again.
export function useAuthForm(
  send: (form: FormData) => Promise<AuthError | null>,
) {
  const hydrated = useHydrated();
  const [state, dispatch, isPending] = useActionState(
    async (_previous: FormState, form: FormData): Promise<FormState> => {
      const error = await send(form);
      return error ? { status: "failed", error } : { status: "done" };
    },
    { status: "idle" },
  );
  return {
    error: state.status === "failed" && !isPending ? state.error : null,
    done: state.status === "done" && !isPending,
    busy: isPending,
    canSubmit: hydrated && !isPending,
    submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      startTransition(() => dispatch(form));
    },
  };
}
