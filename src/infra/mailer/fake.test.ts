import { expect, test } from "vitest";
import { createFakeMailer } from "./fake";

const email = (to: string) => ({ to, subject: "Assunto", text: "Texto" });

test("a send held before a second hold still ends on release, and is captured", async () => {
  const fake = createFakeMailer();
  fake.hold();
  void fake.mailer.send(email("primeiro@example.com"));
  fake.hold();
  void fake.mailer.send(email("segundo@example.com"));

  await fake.release();

  expect(fake.inFlight).toBe(0);
  expect(fake.sent.map(({ to }) => to)).toEqual([
    "primeiro@example.com",
    "segundo@example.com",
  ]);
});
