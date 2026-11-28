import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import { seedHolder } from "../src/test/seed-accounts";
import { baseUrl } from "./support/environment";
import { signInThroughTheForm } from "./support/forms";
import { holdRequests } from "./support/hold";
import { expect, test } from "./support/test";

// Seam 5, against the production server: the sign-in page, with the seed's
// holder, from a browser whose requests carry an IP of the test's own. Each
// test signs in by itself, as signing in is what it tests, and ends only the
// session it created.

test("a visitor who asks for the user's page is taken to the sign-in, and returns to the page once signed in (A2.9)", async ({
  page,
}) => {
  await page.goto("/conta");
  await expect(page).toHaveURL(`${baseUrl}/entrar?retorno=/conta`);

  await signInThroughTheForm(page, seedHolder);

  await expect(page).toHaveURL(`${baseUrl}/conta`);
  await expect(page.getByText(seedHolder.email)).toBeVisible();
});

test("a return to another site leads to the user's page once signed in (A2.9a)", async ({
  page,
}) => {
  await page.goto("/entrar?retorno=//exemplo.com");

  await signInThroughTheForm(page, seedHolder);

  await expect(page).toHaveURL(`${baseUrl}/conta`);
});

test("a wrong e-mail or password is refused with a message that names neither, announced again on each attempt", async ({
  page,
}) => {
  await page.goto("/entrar");
  const refusal =
    "E-mail ou senha incorretos. Confira os dois e tente de novo.";

  await signInThroughTheForm(page, {
    email: `ninguem-${randomUUID()}@example.com`,
    password: "senha-errada-1",
  });

  // The form's own alert: Next's route announcer is an alert too.
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toHaveText(refusal);
  await expect(page).toHaveURL(`${baseUrl}/entrar`);

  // A screen reader announces an alert when it appears, so the alert leaves
  // while the next attempt is pending and comes back with its answer, the
  // same refusal included. The request is held until the test has seen it go.
  const release = await holdRequests(page, "**/api/auth/sign-in/email");

  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(alert).toHaveCount(0);
  release();
  await expect(alert).toHaveText(refusal);
});

// The server's answers to a sign-in of a locked account (A2.16) and of a staff
// user whose right password has fewer than 12 characters (A4.11), which seam 1
// proves, stand in here for the server: the seed has no staff user, and
// locking the seed's holder would lock it for the other tests.
const refusedSignIns = [
  {
    refused: "a locked account",
    status: 429,
    code: "ACCOUNT_LOCKED",
    message:
      "Muitas tentativas; tente de novo em alguns minutos ou redefina a senha.",
  },
  {
    refused: "a staff password of fewer than 12 characters",
    status: 403,
    code: "STAFF_PASSWORD_TOO_SHORT",
    message:
      'Defina uma senha nova, com pelo menos 12 caracteres, em "Esqueci minha senha".',
  },
];

for (const { refused, status, code, message } of refusedSignIns) {
  test(`a sign-in refused for ${refused} says what to do, in the server's words`, async ({
    page,
  }) => {
    await page.route("**/api/auth/sign-in/email", (route) =>
      route.fulfill({ status, json: { code, message } }),
    );
    await page.goto("/entrar");

    await signInThroughTheForm(page, {
      email: `equipe-${randomUUID()}@example.com`,
      password: "senha-11-ch",
    });

    // The form's own alert: Next's route announcer is an alert too.
    await expect(page.locator("form").getByRole("alert")).toHaveText(message);
    await expect(page).toHaveURL(`${baseUrl}/entrar`);
  });
}

// The holder's session, as the server reads it from the browser's cookie.
async function sessionOf(page: Page) {
  const response = await page.request.get("/api/auth/get-session");
  return (await response.json()) as { user: { email: string } } | null;
}

test("a holder who signs out on the user's page has no session left, and the page then leads to the sign-in", async ({
  page,
}) => {
  await page.goto("/entrar");
  await signInThroughTheForm(page, seedHolder);
  await expect(page).toHaveURL(`${baseUrl}/conta`);

  await page.getByRole("button", { name: "Sair" }).click();

  await expect(page).toHaveURL(`${baseUrl}/entrar`);
  expect(await sessionOf(page)).toBeNull();
  await page.goto("/conta");
  await expect(page).toHaveURL(`${baseUrl}/entrar?retorno=/conta`);
});

// Better Auth's session cookie, without the prefix it takes only under https.
const sessionCookie = "better-auth.session_token";

// The browser's session cookie. Without it, the test fails naming the cookie
// it looked for and the ones the browser has.
async function sessionCookieOf(context: BrowserContext) {
  const cookies = await context.cookies();
  expect(
    cookies.map(({ name }) => name),
    `the browser keeps Better Auth's session cookie, ${sessionCookie}`,
  ).toContain(sessionCookie);
  return cookies.find(({ name }) => name === sessionCookie)!;
}

test("a holder who signs in without 'Lembrar de mim' keeps a cookie that ends when the browser closes, once the private page has read the session", async ({
  page,
  context,
}) => {
  await page.goto("/entrar");
  const sessionRead = page.waitForResponse(`${baseUrl}/api/auth/get-session`);

  await signInThroughTheForm(page, seedHolder, { rememberMe: false });

  await expect(page).toHaveURL(`${baseUrl}/conta`);
  expect((await sessionRead).status()).toBe(200);
  const cookie = await sessionCookieOf(context);
  // Playwright's expiry of a cookie that ends with the browser's session.
  expect(cookie.expires).toBe(-1);
});

test("a holder who signs in with 'Lembrar de mim' keeps a cookie for 7 days", async ({
  page,
  context,
}) => {
  await page.goto("/entrar");

  await signInThroughTheForm(page, seedHolder, { rememberMe: true });

  await expect(page).toHaveURL(`${baseUrl}/conta`);
  const cookie = await sessionCookieOf(context);
  const sevenDays = 7 * 24 * 60 * 60;
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(sevenDays - 60);
});
