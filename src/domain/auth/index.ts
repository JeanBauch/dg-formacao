// The public interface of the auth module's domain.
export { holderPasswordMinLength, passwordStrength } from "./password-strength";
export type { PasswordStrength } from "./password-strength";
export { defaultReturnPath, returnPath, signInPath } from "./return-path";
export { rolesOf } from "./roles";
export {
  consentDocuments,
  signUpConsents,
  signUpNameMaxLength,
  signUpRefusal,
} from "./sign-up";
export type { ConsentDocument, SignUpRefusal } from "./sign-up";
