// The public interface of the auth module's domain.
export {
  consentDocuments,
  signUpConsents,
  signUpNameMaxLength,
  signUpRefusal,
} from "./sign-up";
export type { ConsentDocument, SignUpRefusal } from "./sign-up";
