import { testBaseUrl } from "./base-url";
import { cookiesOf } from "./cookies";
import { nextTestIp } from "./ip";

// A fictitious holder, Maria Fictícia, who signs up over HTTP with this e-mail
// and password, from an IP of the sign-up's own, as the sign-up form sends it.
// The sign-up signs them in: it gives the id of the user it created and the
// cookies its answer sets, the ones the browser would send back. A sign-up
// that Better Auth refuses fails the test. Auth is loaded here, not at the
// top, because it loads the session gate, which loads the request helper in
// place of `next/headers`.
export async function signUp(email: string, password: string) {
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
        email,
        password,
        adultDeclaration: true,
        acceptance: true,
      }),
    }),
  );
  if (!response.ok) {
    throw new Error(`The sign-up failed with ${response.status}`);
  }
  const { user } = (await response.json()) as { user: { id: string } };
  return { userId: user.id, cookie: cookiesOf(response) };
}
