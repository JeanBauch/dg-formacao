import "server-only";
import { recordSecurityEvent } from "@/data/audit";
import { clientOf } from "./client";
import { loggable } from "./loggable";

// Where Better Auth's router serves its routes.
export const authBasePath = "/api/auth";

// The endpoints of Better Auth 1.7.15 and its admin plugin that the R0 does not
// use, which its router answers with 404 (A4.17). The routes the R0 uses stay
// on: sign-up, sign-in, sign-out and the session read; the request and
// completion of a password reset, with the e-mail's link; and sending and
// confirming the e-mail verification. The list names every other endpoint, so
// one that an upgrade adds answers until someone decides where it goes, and the
// test that walks the endpoints breaks.
//
// A disabled path is checked only by the HTTP router: the server still calls
// the admin plugin's endpoints, behind the staff gate (U11).
const unusedRoutes = [
  // Social sign-in and the accounts it links, post-MVP.
  "/sign-in/social",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/account-info",
  "/refresh-token",
  "/get-access-token",
  // The account's own changes: its data, password, e-mail and sessions.
  "/update-user",
  "/update-session",
  "/change-email",
  "/change-password",
  "/verify-password",
  "/delete-user",
  "/delete-user/callback",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  // The admin plugin, impersonation included (A4.12).
  "/admin/set-role",
  "/admin/get-user",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/unban-user",
  "/admin/ban-user",
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/has-permission",
  // Better Auth's own pages.
  "/ok",
  "/error",
];

// The paths Better Auth's router answers with 404. With the public sign-up
// closed, the sign-up joins them (A2.20).
export function disabledPaths({ signUpEnabled }: { signUpEnabled: boolean }) {
  return signUpEnabled ? unusedRoutes : [...unusedRoutes, "/sign-up/email"];
}

// The social sign-in's return (`/callback/:id`), the one unused endpoint with a
// parameter. A disabled path names one path exactly, so this one is refused by
// its prefix, here, and like a disabled path only over HTTP.
function isSocialCallback(route: string) {
  return route.startsWith("/callback/");
}

const notFound = () => new Response("Not Found", { status: 404 });

// The route of a request as Better Auth names it: its path without the base
// path.
function routeOf(request: Request) {
  const { pathname } = new URL(request.url);
  return pathname.startsWith(`${authBasePath}/`)
    ? pathname.slice(authBasePath.length)
    : pathname;
}

// Whether a response is the rate limit's refusal, which Better Auth's router
// answers with 429 and the seconds to wait.
function blockedByRateLimit(response: Response) {
  return response.status === 429 && response.headers.has("x-retry-after");
}

type Handler = (request: Request) => Promise<Response>;

// What this module needs of a Better Auth instance: its HTTP handler, and the
// logger of its context.
type BetterAuthHttp = {
  handler: Handler;
  $context: Promise<{ logger: { error(message: string): void } }>;
};

type LogError = (message: string) => Promise<void>;

// Records a request the rate limit refused: a rate_limited row with the route
// and the client as the request sent itself, and no account, since nothing of
// the request was read (A5.1, A5.2).
async function recordRateLimited(request: Request, logError: LogError) {
  try {
    await recordSecurityEvent({
      event: "rate_limited",
      userId: null,
      route: routeOf(request),
      ...clientOf(request.headers),
    });
  } catch (error) {
    // The request stays refused: a refusal the log missed is still a refusal.
    // Only the failure's name and code reach the log, as the failed query's
    // values hold the full IP and the user agent (RNF-SEG-15).
    await logError(
      `Rate limit refusal failed recording its security event: ${loggable(error)}`,
    );
  }
}

// Better Auth's HTTP handler as the app serves it (seam 1): only the routes the
// R0 uses answer (A4.17), and the rate limit's refusals, which its router
// answers before any hook runs, are recorded here.
export function servedOverHttp({ handler, $context }: BetterAuthHttp): Handler {
  const logError: LogError = async (message) => {
    (await $context).logger.error(message);
  };
  return async (request) => {
    if (isSocialCallback(routeOf(request))) return notFound();
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      // An unexpected failure, a database one among them, leaves Better Auth's
      // router before the router logs it whole (`onAPIError.throw`): its
      // message holds the failed query's values, such as the e-mail, the name,
      // the password hash or a token. Only its name and code reach the log, and
      // the answer is the one the router gives it (RNF-OBS-01).
      await logError(`An auth request failed: ${loggable(error)}`);
      return new Response(null, {
        status: 500,
        statusText: "Internal Server Error",
      });
    }
    if (blockedByRateLimit(response))
      await recordRateLimited(request, logError);
    return response;
  };
}
