import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/ui/auth/sign-in-form";
import { texts } from "@/ui/auth/texts";

export const metadata: Metadata = { title: texts.signIn.title };

// The sign-in page (/entrar). It is static: the form reads its `retorno` only
// when it is sent.
export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">{texts.signIn.title}</h1>
      <SignInForm />
      <p>
        {texts.signIn.signUpPrompt}{" "}
        <Link href="/cadastro" className="underline">
          {texts.signIn.signUpLink}
        </Link>
      </p>
    </>
  );
}
