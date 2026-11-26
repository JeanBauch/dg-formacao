import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@/data/auth";
import { signInPath } from "@/domain/auth";
import { ResendConfirmation } from "@/ui/auth/resend-confirmation";
import { SignOutButton } from "@/ui/auth/sign-out-button";
import { texts } from "@/ui/auth/texts";
import { UserDetails } from "@/ui/auth/user-details";

export const metadata: Metadata = { title: texts.user.title };

// The user's page (/conta), the R0's minimal private page: the title is in the
// static shell, and the user streams in once the session gate has read the
// session.
export default function UserPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">{texts.user.title}</h1>
      <Suspense fallback={<p className="min-h-24">{texts.user.loading}</p>}>
        <CurrentUser />
      </Suspense>
    </>
  );
}

// A cookie the edge let through can still be one of a session that is no
// longer valid: the gate gives no user, and the page goes to the sign-in.
async function CurrentUser() {
  const user = await currentUser();
  if (user === null) redirect(signInPath("/conta"));
  return (
    <>
      <UserDetails user={user} />
      {!user.emailVerified && <ResendConfirmation email={user.email} />}
      <SignOutButton />
    </>
  );
}
