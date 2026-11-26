import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { linkOf } from "../src/test/mailer";
import { baseUrl } from "./support/environment";
import { messagesTo } from "./support/mailbox";

// Seam 5, against the production server with the file adapter. It is the first
// proof of U6 as well: the adapter writes a message only inside after(), so a
// message in the mailbox shows that after() ran from Better Auth's e-mail
// callback, in a real Route Handler.
test("an account created over HTTP gets its confirmation link in the file mailbox, and opening it confirms the e-mail", async ({
  page,
}) => {
  const email = `titular-e2e-${randomUUID()}@example.com`;
  // The account's session, as the server reads it from the browser's cookie.
  const session = async () =>
    (await page.request.get("/api/auth/get-session")).json();

  const signUp = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseUrl, "x-forwarded-for": "192.0.2.20" },
    data: {
      name: "Titular de Teste",
      email,
      password: "senha-de-teste-1",
      adultDeclaration: true,
      acceptance: true,
    },
  });

  expect(signUp.status()).toBe(200);
  await expect.poll(() => messagesTo(email)).toHaveLength(1);
  expect(await session()).toMatchObject({
    user: { email, emailVerified: false },
  });

  const [confirmation] = await messagesTo(email);
  await page.goto(linkOf(confirmation));

  // A link Better Auth refuses leads here with an `error` parameter.
  await expect(page).toHaveURL(`${baseUrl}/`);
  expect(await session()).toMatchObject({
    user: { email, emailVerified: true },
  });
});
