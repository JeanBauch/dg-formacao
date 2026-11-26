import { describe, expect, test } from "vitest";
import { returnPath, signInPath } from "@/domain/auth";

// Seam 3: the sign-in a private page leads to keeps the path it was asked for,
// in `retorno` (A2.9).
describe("the sign-in that keeps the requested path (A2.9)", () => {
  test.each([
    ["/conta", "/entrar?retorno=/conta"],
    ["/conta?aba=dados&x=1", "/entrar?retorno=/conta%3Faba%3Ddados%26x%3D1"],
  ])("for %s is %s", (requested, expected) => {
    expect(signInPath(requested)).toBe(expected);
  });
});

// Seam 3: the return after the sign-in accepts only a path of the app (A2.9a,
// OWASP Unvalidated Redirects and Forwards Cheat Sheet). Any other value leads
// to the account's page.
describe("the return after the sign-in (A2.9a)", () => {
  test.each([
    ["/conta", "/conta"],
    ["/conta?aba=dados", "/conta?aba=dados"],
  ])("keeps the internal path %s", (requested, expected) => {
    expect(returnPath(requested)).toBe(expected);
  });

  test.each([
    // The spec's own cases: a path that starts with // or with /\ is read by the
    // browser as another site.
    ["//exemplo.com", "starts with //"],
    ["/\\exemplo.com", "starts with /\\"],
    // Not a path at all.
    ["https://exemplo.com/conta", "is an absolute address"],
    ["conta", "does not start with /"],
    ["", "is empty"],
    // The browser drops a tab or a line break from an address, which turns
    // this into //exemplo.com.
    ["/\t/exemplo.com", "carries a control character"],
    // Better Auth refuses these as the sign-in's callback, so the sign-in would
    // fail instead of returning.
    ["/%2Fexemplo.com", "carries an encoded /"],
    ["/%5Cexemplo.com", "carries an encoded \\"],
    ["/conta\\exemplo", "carries a \\"],
  ])("leads %s to the account's page, as it %s", (requested) => {
    expect(returnPath(requested)).toBe("/conta");
  });

  test("leads to the account's page when there is no return", () => {
    expect(returnPath(null)).toBe("/conta");
    expect(returnPath(undefined)).toBe("/conta");
  });
});
