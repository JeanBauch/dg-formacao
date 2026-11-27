import type { Page } from "@playwright/test";
import { expect } from "./test";

type Credentials = { email: string; password: string };

// Waits until React has made the page's form work: its button stays disabled
// until then, as a form sent before that would go nowhere.
export async function formReady(page: Page, button: string) {
  const submit = page.getByRole("button", { name: button });
  await expect(submit).toBeEnabled();
  return submit;
}

export type SignUpForm = Credentials & {
  name: string;
  adultDeclaration: boolean;
  acceptance: boolean;
};

// Fills the sign-up page the browser is on, as a person does, and answers its
// button, which sends it.
export async function fillSignUpForm(page: Page, form: SignUpForm) {
  const submit = await formReady(page, "Criar conta");
  await page.getByLabel("Nome completo").fill(form.name);
  await page.getByLabel("E-mail").fill(form.email);
  await page.getByLabel("Senha", { exact: true }).fill(form.password);
  await page
    .getByLabel("Declaro que tenho 18 anos ou mais.")
    .setChecked(form.adultDeclaration);
  await page
    .getByLabel("Li e aceito os Termos de Uso e a Política de Privacidade")
    .setChecked(form.acceptance);
  return submit;
}

// Signs in through the sign-in page the browser is on, as a person does.
// "Lembrar de mim" starts unchecked, as the page shows it.
export async function signInThroughTheForm(
  page: Page,
  { email, password }: Credentials,
  { rememberMe = false } = {},
) {
  const submit = await formReady(page, "Entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Lembrar de mim").setChecked(rememberMe);
  await submit.click();
}
