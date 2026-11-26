import { databaseDownUrl } from "./support/environment";
import { holderState } from "./support/holder-state";
import { expect, test } from "./support/test";

// Seam 5: the third production server of the same build, whose database is out
// of reach. The seed's holder's cookie gets past its edge, which reads no
// database, and its session gate then fails to read the session, as when the
// database drops a connection while a private page renders.
test.use({ baseURL: databaseDownUrl, storageState: holderState });

test("a private page whose session cannot be read says so in Portuguese, and tries again on request", async ({
  page,
}) => {
  await page.goto("/conta");

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Não foi possível abrir esta página");
  await expect(page.getByRole("main")).toContainText(
    "Algo deu errado do nosso lado. Tente de novo em alguns instantes.",
  );

  // Trying again asks the server for the page anew. The database is still out
  // of reach, so the page says the same.
  const refetch = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/conta" &&
      request.headers()["rsc"] === "1",
  );
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await refetch;
  await expect(heading).toHaveText("Não foi possível abrir esta página");
});
