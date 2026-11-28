// The public interface of the auth module's domain.
export {
  holderPasswordMinLength,
  passwordStrength,
  staffPasswordMinLength,
} from "./password-strength";
export type { PasswordStrength } from "./password-strength";
export { defaultReturnPath, returnPath, signInPath } from "./return-path";
export { rolesOf } from "./roles";
export { isSignInLocked, lockStartedBy } from "./sign-in-lockout";
export type { LockMinutes } from "./sign-in-lockout";
export {
  consentDocuments,
  signUpConsents,
  signUpNameMaxLength,
  signUpRefusal,
} from "./sign-up";
export type { ConsentDocument, SignUpRefusal } from "./sign-up";
