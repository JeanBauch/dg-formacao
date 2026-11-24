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

// What a sign-up gives beyond the user's fields, two checkboxes that count only
// when checked: the adult declaration (DP-02) and the acceptance of the Terms
// of Use and the Privacy Policy (DP-04).
const signUpConsentFields = z.object({
  adultDeclaration: z.literal(true),
  acceptance: z.literal(true),
});

export const signUpNameMaxLength = 100;

// The name of the user and of the holder's profile: not blank, and at most
// `signUpNameMaxLength` characters as sent, which is what is stored.
const signUpName = z
  .string()
  .refine((name) => name.trim() !== "")
  .max(signUpNameMaxLength);

// The fields of a sign-up request this project validates, in the order its
// refusals are reported. A sign-up carries no image: Better Auth would store
// the client's URL in the user, and no third-party image is shown (RNF-SEG-12).
const signUpRequest = z.object({
  name: signUpName,
  image: z.never().optional(),
  ...signUpConsentFields.shape,
});

export type SignUpRefusal =
  | "nameRequired"
  | "nameTooLong"
  | "imageNotAccepted"
  | "adultDeclarationRequired"
  | "acceptanceRequired";

// Why a sign-up request is refused before anything is written: its first
// invalid field, or null when it may go on.
export function signUpRefusal(request: unknown): SignUpRefusal | null {
  const result = signUpRequest.safeParse(request);
  if (result.success) return null;
  const [{ path, code }] = result.error.issues;
  if (path[0] === "image") return "imageNotAccepted";
  if (path[0] === "adultDeclaration") return "adultDeclarationRequired";
  if (path[0] === "acceptance") return "acceptanceRequired";
  // The name, or a request that is not an object at all.
  return code === "too_big" ? "nameTooLong" : "nameRequired";
}

// The consents a sign-up request records, one per document, each in its
// current version. Throws when the request lacks the adult declaration or the
// acceptance, so no consent is ever recorded that was not given.
export function signUpConsents(request: unknown) {
  signUpConsentFields.parse(request);
  return consentDocuments.map((document) => ({
    document,
    version: consentDocumentVersions[document],
  }));
}
