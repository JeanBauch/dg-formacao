import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentAccount } from "@/data/auth";
import { signInPath } from "@/domain/auth";
import { AccountDetails } from "@/ui/auth/account-details";
import { ResendConfirmation } from "@/ui/auth/resend-confirmation";
import { SignOutButton } from "@/ui/auth/sign-out-button";
import { texts } from "@/ui/auth/texts";

export const metadata: Metadata = { title: texts.account.title };

// The account's page (/conta), the R0's minimal private page: the title is in
// the static shell, and the account streams in once the session gate has read
// the session.
export default function AccountPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">{texts.account.title}</h1>
      <Suspense fallback={<p className="min-h-24">{texts.account.loading}</p>}>
        <Account />
      </Suspense>
    </>
  );
}

// A cookie the edge let through can still be one of a session that is no
// longer valid: the gate gives no account, and the page goes to the sign-in.
async function Account() {
  const account = await currentAccount();
  if (account === null) redirect(signInPath("/conta"));
  return (
    <>
      <AccountDetails account={account} />
      {!account.emailVerified && <ResendConfirmation email={account.email} />}
      <SignOutButton />
    </>
  );
}
