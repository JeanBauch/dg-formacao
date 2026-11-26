import { closedSignUpUrl } from "./support/environment";
import { expect, test } from "./support/test";

// Seam 5: the second production server of the same build, started with
// SIGNUP_ENABLED=false. The build was made with the sign-up open, so the page
// says it is closed only if it reads the switch as the running server has it.
test.use({ baseURL: closedSignUpUrl });

test("with the public sign-up closed, the sign-up page says it is not open yet (A2.20)", async ({
  page,
}) => {
  await page.goto("/cadastro");

  await expect(
    page.getByText("O cadastro ainda não está aberto.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(
    0,
  );
});
