import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deferredMailer } from "./deferred";
import type { Email } from "./index";

// The adapter of local and CI only, which the configuration refuses anywhere
// else (A1.6): it sends nothing out, and leaves each message in a folder that
// the E2E and the developer read.

// Where the messages are left, from the server's working directory. The build's
// file tracing would list the messages already there among the deployment files,
// so next.config.ts leaves this folder out of every route's trace: a rename
// changes both.
export const mailboxDirectory = ".mailbox";

// One message a file. It is written under another name first, so a reader of the
// mailbox never sees half a message.
async function leaveInMailbox(email: Email) {
  await mkdir(mailboxDirectory, { recursive: true });
  const file = join(mailboxDirectory, `${Date.now()}-${randomUUID()}.json`);
  await writeFile(`${file}.partial`, JSON.stringify(email, null, 2));
  await rename(`${file}.partial`, file);
}

export const fileMailer = deferredMailer(leaveInMailbox);
