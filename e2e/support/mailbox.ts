import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Email } from "../../src/infra/mailer";
import { mailboxDirectory } from "../../src/infra/mailer/file";

// The messages the server's file adapter has left in its mailbox for this
// recipient. A mailbox that does not exist yet holds none.
export async function messagesTo(address: string): Promise<Email[]> {
  const files = await readdir(mailboxDirectory).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  const messages = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const text = await readFile(join(mailboxDirectory, file), "utf8");
        return JSON.parse(text) as Email;
      }),
  );
  return messages.filter(({ to }) => to === address);
}
