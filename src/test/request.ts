import { randomUUID } from "node:crypto";
import { signUp } from "./sign-up";

// Seam 2: of Next.js, only what the session gate reads is swapped, by this
// one helper. A test file puts it in place of `next/headers`:
//
//   vi.mock("next/headers", () => import("@/test/request"));
//
// and then says whose request the code under test serves, with the cookie of a
// real session, created in the test database by Better Auth itself. Nothing of
// Better Auth or of Drizzle is swapped.

let requestHeaders = new Headers();

// Next.js's `headers()`: those of the request the code under test serves.
export async function headers() {
  return requestHeaders;
}

// The request the code under test serves from now on: with this cookie, or
// with none, an anonymous one.
export function serveRequestWith(cookie: string | null) {
  requestHeaders = new Headers(cookie === null ? {} : { cookie });
}

// The password every holder of `signedInHolder` signs up with.
export const holderPassword = "senha-de-teste-1";

// A holder with a session: a fictitious holder signs up over HTTP, with an
// e-mail of a domain reserved for documentation, which signs them in, and the
// cookies the answer sets are the ones the browser would send back.
export async function signedInHolder() {
  const email = `titular-${randomUUID()}@example.com`;
  const { userId, cookie } = await signUp(email, holderPassword);
  return { email, userId, cookie };
}
