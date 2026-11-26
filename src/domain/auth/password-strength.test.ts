import { describe, expect, test } from "vitest";
import { passwordStrength } from "@/domain/auth";

// Seam 3: the strength the sign-up form shows while the person types (A2.4).
// Below the 8 characters of RF-AUT-01 the password is too short, as the
// sign-up refuses it; above, each kind of character it mixes (lower case,
// upper case, digits, others) and a length of 12 or more count one point:
// up to 2 is weak, 3 is medium and 4 or more is strong.
describe("the strength of a password (A2.4)", () => {
  test.each([
    ["", "tooShort"],
    ["Ab1!xyz", "tooShort"],
    ["abcdefgh", "weak"],
    ["abcdefg1", "weak"],
    ["aaaaaaaaaaaaaaaa", "weak"],
    ["Abcdefg1", "medium"],
    ["abcdefghijk1", "medium"],
    ["Abcdefg1!", "strong"],
    ["ação-de-graças-7", "strong"],
  ])("of %j is %s", (password, expected) => {
    expect(passwordStrength(password)).toBe(expected);
  });
});
