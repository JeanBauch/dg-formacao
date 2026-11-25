import type { Email, Mailer } from "./index";

// The in-process adapter for the tests of seams 1 and 2. Unlike the server's
// adapters, it never calls after(): the send is held by the test itself. A
// send ends when it is let to (`release`) and the message is captured then; it
// can also be made to fail, as the provider's limit does.
export function createFakeMailer() {
  // The messages whose send ended well, in order.
  const sent: Email[] = [];
  const attempts: Promise<void>[] = [];
  let inFlight = 0;
  let gate: Promise<void> | null = null;
  let openGate: (() => void) | null = null;
  let failure: Error | null = null;

  const mailer: Mailer = {
    send(email) {
      inFlight += 1;
      const attempt = (async () => {
        try {
          if (gate) await gate;
          if (failure) throw failure;
          sent.push(email);
        } finally {
          inFlight -= 1;
        }
      })();
      attempts.push(attempt);
      return attempt;
    },
  };

  // Resolves once every send started so far has ended, well or not.
  async function settled() {
    await Promise.allSettled(attempts);
  }

  // Lets the held sends end, and resolves when they have.
  async function release() {
    openGate?.();
    gate = null;
    openGate = null;
    await settled();
  }

  return {
    mailer,
    sent,
    // How many sends have started and not ended.
    get inFlight() {
      return inFlight;
    },
    settled,
    // From now on, a send waits for `release`.
    hold() {
      gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
    },
    release,
    // From now on, every send fails with this error.
    failWith(error: Error) {
      failure = error;
    },
    // Back to a mailer that has sent nothing and sends at once.
    async reset() {
      await release();
      sent.length = 0;
      attempts.length = 0;
      failure = null;
    },
  };
}
