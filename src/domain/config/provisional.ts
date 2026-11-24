// The provisional values of the R0 (DP-02 and DP-04), in one place. The R0
// builds the mechanism with them and receives no real user until the legal
// answers arrive (SIGNUP_ENABLED stays false in production until then).
// Changing a value changes this file or a text, never a migration.

// The version each document is accepted in at sign-up: the Terms of Use and the
// Privacy Policy (DP-04) and the adult declaration (DP-02), all provisional.
export const consentDocumentVersions = {
  terms_of_use: "2026-11-provisoria",
  privacy_policy: "2026-11-provisoria",
  adult_declaration: "2026-11-provisoria",
} as const;
