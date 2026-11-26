import { randomUUID } from "node:crypto";
import { baseUrl } from "./support/environment";
import { fillSignUpForm, formReady, type SignUpForm } from "./support/forms";
import { messagesTo } from "./support/mailbox";
import { expect, test } from "./support/test";

// Seam 5, against the production server with the file adapter: the sign-up
// page, from a browser whose requests carry an IP of the test's own. Each
// holder is new, with an e-mail of a domain reserved for documentation.
function newHolder(): SignUpForm {
  return {
    name: "Titular de Teste",
    email: `titular-e2e-${randomUUID()}@example.com`,
    password: "senha-de-teste-1",
    adultDeclaration: true,
    acceptance: true,
  };
}

const refusals = [
  {
    missing: "the adult declaration",
    form: { adultDeclaration: false },
    field: "Declaro que tenho 18 anos ou mais.",
    message: "Confirme que você tem 18 anos ou mais para criar a conta.",
  },
  {
    missing: "the acceptance",
    form: { acceptance: false },
    field: "Li e aceito os Termos de Uso e a Política de Privacidade",
    message:
      "Aceite os Termos de Uso e a Política de Privacidade para criar a conta.",
  },
];

for (const { missing, form, field, message } of refusals) {
  test(`a sign-up without ${missing} is refused with what to do, linked to its field (A2.3)`, async ({
    page,
  }) => {
    await page.goto("/cadastro");
    const submit = await fillSignUpForm(page, { ...newHolder(), ...form });

    await submit.click();

    const checkbox = page.getByLabel(field);
    await expect(checkbox).toHaveAccessibleDescription(message);
    await expect(checkbox).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(`${baseUrl}/cadastro`);
  });
}

test("the sign-up form shows the password's strength while the person types (A2.4)", async ({
  page,
}) => {
  await page.goto("/cadastro");
  await formReady(page, "Criar conta");
  const password = page.getByLabel("Senha", { exact: true });

  await password.pressSequentially("abc");
  await expect(password).toHaveAccessibleDescription(
    "Força da senha: muito curta. Use pelo menos 8 caracteres.",
  );
  await password.pressSequentially("defgh");
  await expect(password).toHaveAccessibleDescription(/^Força da senha: fraca/);
  await password.pressSequentially("A1!");
  await expect(password).toHaveAccessibleDescription("Força da senha: forte.");
});

test("a holder who signs up through the form lands on their account, and asks there for another confirmation link (A3.3)", async ({
  page,
}) => {
  const holder = newHolder();
  await page.goto("/cadastro");
  const submit = await fillSignUpForm(page, holder);
  await submit.click();
  await expect(page).toHaveURL(`${baseUrl}/conta`);
  await expect(page.getByText("Ainda não confirmado")).toBeVisible();
  // The sign-up's own confirmation.
  await expect.poll(() => messagesTo(holder.email)).toHaveLength(1);

  await page
    .getByRole("button", { name: "Enviar outro link de confirmação" })
    .click();

  await expect(page.getByRole("status")).toHaveText(
    "Enviamos um novo link de confirmação. Confira a sua caixa de entrada.",
  );
  await expect.poll(() => messagesTo(holder.email)).toHaveLength(2);
});
