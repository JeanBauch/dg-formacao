import { after } from "next/server";
import type { Email, Mailer } from "./index";

// A mailer of the server: the delivery of each message is held in after(), which
// runs it once the response has been sent and keeps the server's function alive
// until it ends. after() works only inside Next.js, in the scope of a request;
// outside one it throws, and the send fails with that.
export function deferredMailer(
  deliver: (email: Email) => Promise<void>,
): Mailer {
  return {
    send(email) {
      return new Promise<void>((resolve, reject) => {
        after(() => deliver(email).then(resolve, reject));
      });
    },
  };
}
