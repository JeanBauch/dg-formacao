import { randomUUID } from "node:crypto";
import { testBaseUrl } from "./base-url";
import { nextTestIp } from "./ip";

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

// A holder with a session: a fictitious holder signs up over HTTP, which
// signs them in, and the cookies the answer sets are the ones the browser
// would send back. Auth is loaded here, not at the top, because it loads the
// session gate, which loads this module in place of `next/headers`.
export async function signedInHolder() {
  const { auth } = await import("@/data/auth");
  const response = await auth.handler(
    new Request(`${testBaseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": nextTestIp(),
      },
      body: JSON.stringify({
        name: "Maria Fictícia",
        email: `titular-${randomUUID()}@example.com`,
        password: "senha-de-teste-1",
        adultDeclaration: true,
        acceptance: true,
      }),
    }),
  );
  if (!response.ok) {
    throw new Error(`The holder's sign-up failed with ${response.status}`);
  }
  const { user } = (await response.json()) as { user: { id: string } };
  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
  return { userId: user.id, cookie };
}
