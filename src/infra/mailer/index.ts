// The mailer interface (ADR-009, item 1): how the application sends a
// transactional e-mail (section 9.12.7). The adapters of the server, the file
// one and Resend's, come with their own ticket and hold the send with after();
// the in-process adapter of the tests is in ./fake.

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

class MailerNotConfiguredError extends Error {
  name = "MailerNotConfiguredError";
}

// The mailer the application uses until the server's adapters exist: it sends
// nothing, and every send fails, so the failure is logged where the e-mail was
// asked for and no message is lost without a trace.
export const mailer: Mailer = {
  async send() {
    throw new MailerNotConfiguredError("No mailer adapter is configured");
  },
};
