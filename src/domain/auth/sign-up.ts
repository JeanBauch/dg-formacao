import { z } from "zod";
import { consentDocumentVersions } from "@/domain/config/provisional";

// The documents a consent row records in the R0. The guardian declaration
// joins in R3 as a fourth value, without a contract migration.
export const consentDocuments = [
  "terms_of_use",
  "privacy_policy",
  "adult_declaration",
] as const;

export type ConsentDocument = (typeof consentDocuments)[number];

// What a sign-up declares beyond the account fields: the adult declaration
// (DP-02) and the acceptance of the Terms of Use and the Privacy Policy (DP-04).
const signUpDeclarations = z.object({
  adultDeclaration: z.literal(true),
  acceptance: z.literal(true),
});

type SignUpDeclaration = keyof typeof signUpDeclarations.shape;

// The first declaration a sign-up request lacks, or null when it gives both.
export function missingSignUpDeclaration(
  request: unknown,
): SignUpDeclaration | null {
  const result = signUpDeclarations.safeParse(request);
  if (result.success) return null;
  const [field] = result.error.issues[0].path;
  return field === "acceptance" ? "acceptance" : "adultDeclaration";
}

// The consents a sign-up request records, one per document, each in its
// current version. Throws when the request lacks the adult declaration or the
// acceptance, so no consent is ever recorded that was not given.
export function signUpConsents(request: unknown) {
  signUpDeclarations.parse(request);
  return consentDocuments.map((document) => ({
    document,
    version: consentDocumentVersions[document],
  }));
}
