// Where the sign-in leads when the requested return is missing or refused: the
// user's page.
export const defaultReturnPath = "/conta";

// Characters the browser drops from an address or reads in its own way: the
// control characters (a tab or a line break vanishes, so "/\t/x" becomes
// "//x") and the backslash, which it reads as a slash.
const ambiguousCharacter = /[\u0000-\u001f\u007f-\u009f\\]/;

// A slash or a backslash written encoded, which a server or a router may
// decode into a separator.
const encodedSeparator = /%2f|%5c/i;

// An origin no request of the app ever has, to resolve the path against: a
// path that leaves it is not a path of the app.
const ownOrigin = "https://retorno.invalid";

// The sign-in page, keeping in `retorno` the path a private page was asked by
// (A2.9). A slash needs no encoding in a query, so it stays as it is, and the
// address reads as /entrar?retorno=/conta.
export function signInPath(requested: string) {
  const query = new URLSearchParams({ retorno: requested }).toString();
  return `/entrar?${query.replaceAll("%2F", "/")}`;
}

// The path the sign-in returns to, from the one the request asked for (A2.9a):
// only a path of the app, which starts with "/" and not with "//" nor "/\".
// Anything else leads to the user's page. Better Auth refuses the sign-in's
// callback on the same grounds, the encoded separators and any backslash
// among them, so every path kept here is one it accepts.
export function returnPath(requested: string | null | undefined) {
  if (
    !requested ||
    !requested.startsWith("/") ||
    requested.startsWith("//") ||
    ambiguousCharacter.test(requested)
  ) {
    return defaultReturnPath;
  }
  const [path] = requested.split(/[?#]/);
  if (encodedSeparator.test(path)) return defaultReturnPath;
  return new URL(requested, ownOrigin).origin === ownOrigin
    ? requested
    : defaultReturnPath;
}
