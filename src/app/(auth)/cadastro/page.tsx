import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/env";
import { SignUpForm } from "@/ui/auth/sign-up-form";
import { texts } from "@/ui/auth/texts";

export const metadata: Metadata = { title: texts.signUp.title };

// The sign-up page (/cadastro). The title is in the static shell; the form, or
// the notice that the sign-up is closed, streams in.
export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">{texts.signUp.title}</h1>
      <Suspense fallback={<p className="min-h-96">{texts.signUp.loading}</p>}>
        <SignUpOrClosed />
      </Suspense>
      <p>
        {texts.signUp.signInPrompt}{" "}
        <Link href="/entrar" className="underline">
          {texts.signUp.signInLink}
        </Link>
      </p>
    </>
  );
}

// The public sign-up switch as the running server has it, read for each
// request, never baked into the build: the page then agrees with Better Auth's
// sign-up route, which the same switch turns off (A2.20).
async function SignUpOrClosed() {
  await connection();
  return env.SIGNUP_ENABLED ? <SignUpForm /> : <p>{texts.signUp.closed}</p>;
}
