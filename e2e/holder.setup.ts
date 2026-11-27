import { seedHolder } from "../src/test/seed-accounts";
import { baseUrl } from "./support/environment";
import { signInThroughTheForm } from "./support/forms";
import { holderState } from "./support/holder-state";
import { expect, test as setup } from "./support/test";

// The suite signs in once per role and reuses the state, which keeps it well
// under the rate limits (seam 5): the seed's holder signs in through the
// sign-in page with "Lembrar de mim", and the tests that need a signed-in
// holder start from that browser state.
setup(
  "the seed's holder signs in through the sign-in page",
  async ({ page }) => {
    await page.goto("/entrar");

    await signInThroughTheForm(page, seedHolder, { rememberMe: true });

    await expect(page).toHaveURL(`${baseUrl}/conta`);
    await page.context().storageState({ path: holderState });
  },
);
