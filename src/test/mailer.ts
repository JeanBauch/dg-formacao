import type { Email } from "@/infra/mailer";
import { createFakeMailer } from "@/infra/mailer/fake";
import { nextTestIp } from "./ip";

// Seam 1: the e-mail goes through the in-process adapter, which the database
// tests put in place of the application's `@/infra/mailer` (environment.ts):
//
//   vi.mock("@/infra/mailer", () => import("@/test/mailer"));
//
// A test file imports `fakeMailer` to read what was sent and to hold or fail
// the sends, and the setup resets it before each test. The seed script puts it
// in place of the mailer by its own hooks, and reads the links it captured.
export const fakeMailer = createFakeMailer();

// What `@/infra/mailer` exports under the tests.
export const mailer = fakeMailer.mailer;

// The link in a message: its one URL.
export function linkOf({ text }: Email) {
  const links = text.match(/https?:\/\/\S+/g) ?? [];
  if (links.length !== 1) {
    throw new Error(`Expected one link in the e-mail, found ${links.length}`);
  }
  return links[0];
}

// A link of an e-mail, opened as a webmail opens it: the browser navigates its
// tab to it from another site, which the auth handler lets through (#12). Auth
// is loaded here, not at the top, because it loads the mailer, which this
// module stands in for.
export async function openLink(link: string) {
  const { auth } = await import("@/data/auth");
  return auth.handler(
    new Request(link, {
      headers: {
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        "x-forwarded-for": nextTestIp(),
      },
    }),
  );
}

// The token the app's page receives once a password reset's link is opened:
// Better Auth sends the browser on to the page with it.
export async function resetTokenOf(link: string) {
  const response = await openLink(link);
  const destination = new URL(response.headers.get("location") ?? "");
  return destination.searchParams.get("token") ?? "";
}
