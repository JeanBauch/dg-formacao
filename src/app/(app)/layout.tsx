import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SessionRenewal } from "@/ui/auth/session-renewal";

// The private area: out of the search index (skill seo). Whoever has no
// session cookie is taken to the sign-in at the edge (src/proxy.ts), and each
// page starts with the session gate of the data layer. Every private page
// reads the session from the browser too, which renews it when due.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      {children}
      <SessionRenewal />
    </main>
  );
}
