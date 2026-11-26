import {
  holderPasswordMinLength,
  type PasswordStrength,
  signUpNameMaxLength,
} from "@/domain/auth";
import type { AuthError } from "./auth-client";

// The texts of the account's screens, in pt-BR, kept apart from the markup
// (RNF-UX-01, 03 and 04).
export const texts = {
  signIn: {
    title: "Entrar",
    email: "E-mail",
    password: "Senha",
    rememberMe: "Lembrar de mim",
    submit: "Entrar",
    submitting: "Entrando…",
    noAccount: "Ainda não tem conta?",
    signUpLink: "Criar conta",
  },
  signUp: {
    title: "Criar conta",
    name: "Nome completo",
    email: "E-mail",
    password: "Senha",
    adultDeclaration: "Declaro que tenho 18 anos ou mais.",
    acceptance:
      "Li e aceito os Termos de Uso e a Política de Privacidade (versão provisória).",
    submit: "Criar conta",
    submitting: "Criando a conta…",
    loading: "Carregando o formulário…",
    closed:
      "O cadastro ainda não está aberto. Volte em breve: avisaremos quando abrir.",
    hasAccount: "Já tem conta?",
    signInLink: "Entrar",
  },
  password: {
    show: "Mostrar senha",
    strength: {
      tooShort: `Força da senha: muito curta. Use pelo menos ${holderPasswordMinLength} caracteres.`,
      weak: "Força da senha: fraca. Misture letras maiúsculas e minúsculas, números e símbolos.",
      medium:
        "Força da senha: média. Uma senha mais longa ou com símbolos fica mais forte.",
      strong: "Força da senha: forte.",
    } satisfies Record<PasswordStrength, string>,
  },
  account: {
    title: "Sua conta",
    loading: "Carregando a sua conta…",
    name: "Nome",
    email: "E-mail",
    verification: "Situação do e-mail",
    verified: "Confirmado",
    notVerified: "Ainda não confirmado",
    resend: "Enviar outro link de confirmação",
    resending: "Enviando…",
    resent:
      "Enviamos um novo link de confirmação. Confira a sua caixa de entrada.",
    signOut: "Sair",
    signingOut: "Saindo…",
  },
} as const;

// What each refusal the screens can meet says, by the code the server answers
// with. Better Auth's own codes come with an English text, which the screens
// never show (ASSUMPTION 8 of #11).
const refusals: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD:
    "E-mail ou senha incorretos. Confira os dois e tente de novo.",
  INVALID_EMAIL: "Informe um e-mail válido, como nome@exemplo.com.",
  PASSWORD_TOO_SHORT: `Use uma senha de pelo menos ${holderPasswordMinLength} caracteres.`,
  PASSWORD_TOO_LONG: "Use uma senha de até 128 caracteres.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Já existe uma conta com este e-mail. Entre com ele ou use outro e-mail.",
  NAME_REQUIRED: "Informe o seu nome para criar a conta.",
  NAME_TOO_LONG: `Use um nome de até ${signUpNameMaxLength} caracteres.`,
  ADULT_DECLARATION_REQUIRED:
    "Confirme que você tem 18 anos ou mais para criar a conta.",
  ACCEPTANCE_REQUIRED:
    "Aceite os Termos de Uso e a Política de Privacidade para criar a conta.",
  EMAIL_ALREADY_VERIFIED: "O seu e-mail já está confirmado.",
};

const tooManyRequests =
  "Muitas tentativas seguidas. Espere um minuto e tente de novo.";

// Whatever else failed: the server's error, or a request that never reached
// it, as when the network drops.
const unexpected =
  "Não foi possível concluir agora. Confira a sua conexão e tente de novo.";

// The message a screen shows for a failed call of the auth client.
export function errorMessage({ code, status }: AuthError) {
  if (code !== undefined && code in refusals) return refusals[code];
  if (status === 429) return tooManyRequests;
  return unexpected;
}
