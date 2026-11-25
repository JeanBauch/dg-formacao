import type { Email } from "@/infra/mailer";
import { createFakeMailer } from "@/infra/mailer/fake";

// Seam 1: the e-mail goes through the in-process adapter, which the database
// tests put in place of the application's `@/infra/mailer` (environment.ts):
//
//   vi.mock("@/infra/mailer", () => import("@/test/mailer"));
//
// A test file imports `fakeMailer` to read what was sent and to hold or fail
// the sends, and the setup resets it before each test.
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
