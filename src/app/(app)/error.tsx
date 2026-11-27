"use client";

import { texts } from "@/ui/auth/texts";

// The private area's error page. A private page that fails to render, as when
// the database drops a connection while the session gate reads the session,
// is replaced by this, inside the area's layout. It says what happened in
// pt-BR and tries again on request: `retry` asks the server for the page anew
// and renders it again. The server has already logged the error.
export default function PrivateAreaError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{texts.privateAreaError.title}</h1>
      <p role="alert">{texts.privateAreaError.message}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="self-start rounded border border-current px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {texts.privateAreaError.retry}
      </button>
    </>
  );
}
