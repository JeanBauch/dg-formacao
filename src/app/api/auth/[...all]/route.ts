import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/data/auth";

// Better Auth over HTTP (skill auth-identity, "Auth flows go over HTTP"). Every
// request goes to the app's own handler, which answers only the routes the R0
// uses, refuses what another site sends and records the rate limit's refusals.
export const { GET, POST } = toNextJsHandler(auth);
