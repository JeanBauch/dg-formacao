import { deferredMailer } from "./deferred";

// The adapter of Resend (ADR-007), over its REST API. The real send, from the
// verified domain, is proven in spec B (B1 and B4).
const sendEmailUrl = "https://api.resend.com/emails";

// A refused send. Its code is the status Resend answered with, such as 429 at
// the plan's limit (section 9.12.7): the log shows the name and the code only.
// The answer's body stays out, as it could name the recipient (RNF-OBS-01).
class ResendSendError extends Error {
  name = "ResendSendError";
  code: string;

  constructor(status: number) {
    super(`Resend refused the send with status ${status}`);
    this.code = String(status);
  }
}

export function resendMailer({
  apiKey,
  from,
}: {
  apiKey: string;
  from: string;
}) {
  return deferredMailer(async ({ to, subject, text }) => {
    const response = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) throw new ResendSendError(response.status);
  });
}
