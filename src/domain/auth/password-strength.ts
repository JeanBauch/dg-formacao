// The shortest password a holder may choose (RF-AUT-01), counted as
// Better Auth counts it: in UTF-16 code units, the string's length.
export const holderPasswordMinLength = 8;

// The shortest password a staff account may have (RF-AUT-08), counted the
// same way: the MVP's protection in place of MFA.
export const staffPasswordMinLength = 12;

export type PasswordStrength = "tooShort" | "weak" | "medium" | "strong";

// The kinds of character a password can mix, each worth a point.
const characterKinds = [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{N}]/u];

// The strength the sign-up form shows while the person types (A2.4). A password
// the sign-up would refuse for its length is too short. Above that, each kind
// of character it mixes counts a point, and so does a length of 12 or more:
// up to 2 points is weak, 3 is medium, 4 or more is strong.
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < holderPasswordMinLength) return "tooShort";
  const points =
    characterKinds.filter((kind) => kind.test(password)).length +
    (password.length >= 12 ? 1 : 0);
  if (points <= 2) return "weak";
  return points === 3 ? "medium" : "strong";
}
