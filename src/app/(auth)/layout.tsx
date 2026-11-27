import type { Metadata } from "next";
import type { ReactNode } from "react";

// The sign-in and sign-up pages stay out of the search index (skill seo).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      {children}
    </main>
  );
}
