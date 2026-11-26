import { env } from "@/env";
import { fileMailer } from "./file";
import { resendMailer } from "./resend";

// The mailer interface (ADR-009, item 1): how the application sends a
// transactional e-mail (section 9.12.7). Its two adapters of the server, the
// file one and Resend's, hold the send with after() (./deferred); the
// in-process adapter of the tests is in ./fake.

// What a message carries: its recipient, a subject and a text. Nothing else
// about the holder goes in it (A3.10).
export type Email = { to: string; subject: string; text: string };

export type Mailer = {
  // The promise settles when the send is over, and rejects when it fails, as
  // when the provider's limit is reached. The caller never waits for it: a
  // request does not wait for an e-mail to leave (A3.7), and whoever starts a
  // send handles its failure (A3.9).
  send(email: Email): Promise<void>;
};

// The application's mailer, the adapter the validated configuration chooses. It
// refuses the file one outside local and ci, so staging and production send
// through Resend, and it refuses Resend without its key and sender.
export const mailer: Mailer =
  env.MAILER_ADAPTER === "file"
    ? fileMailer
    : resendMailer({ apiKey: env.RESEND_API_KEY!, from: env.MAILER_FROM! });
