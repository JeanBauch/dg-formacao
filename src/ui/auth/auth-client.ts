import { createAuthClient } from "better-auth/client";

// Better Auth's client in the browser: every sign-up, sign-in, sign-out and
// session read of the screens goes over its HTTP routes, the path with the
// rate limit and the origin checks (ADR-008, skill auth-identity). It calls the
// page's own origin. Its redirect plugin is off: each screen says itself where
// it goes next.
export const authClient = createAuthClient({
  disableDefaultFetchPlugins: true,
});

// What a call of the client answers when it fails: the server's code and
// status, or a status of 0 for a request that never got an answer.
export type AuthError = { code?: string; status: number };

const unanswered = { data: null, error: { status: 0 } satisfies AuthError };

// The answer of a call of the client. The client answers a refusal with an
// error result, but rejects when the request never reached the server (no
// network, a server restarting): that becomes an error result too, so each
// screen handles both alike, with a message.
export function answerOf<Answer>(call: Promise<Answer>) {
  return call.catch(() => unanswered);
}
