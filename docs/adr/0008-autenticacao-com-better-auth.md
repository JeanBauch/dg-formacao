---
status: Aceito
data: 2026-11-17
origem: docs/requisitos/requisitos.md, seção 9.9
substitui: 0003
---

# Autenticação com Better Auth

A [ADR-0003](0003-autenticacao-gerenciada.md) previa autenticação gerenciada. Os requisitos pedem dados de conta no Brasil (RPV-12), MFA para a equipe no pós-MVP (RF-AUT-08), rate limit (RNF-SEG-03), verificação de e-mail, reset de senha, suspensão de aluno (RF-ADM-11) e sessão em cookie httpOnly (RNF-SEG-09), com orçamento próximo de zero. Decidimos pelo Better Auth como biblioteca na própria aplicação (opção A): contas e sessões ficam no nosso Postgres em São Paulo, sem mais um operador e sem custo.

## Opções consideradas

| Opção                                                           | Observação                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Better Auth como biblioteca na própria aplicação (escolhida) | Contas e sessões no nosso Postgres em São Paulo, sem mais um operador. Suspensão e papéis (plugin `admin`) e rate limit no MVP; TOTP (plugin `twoFactor`) e login social no pós-MVP, sem trocar de biblioteca. Sem custo |
| B. Supabase Auth                                                | Acopla a identidade ao Supabase, contra a ADR-0009                                                                                                                                                                       |
| C. Better Auth gerenciado pelo Neon                             | 2FA não encontrado na documentação; exige o Neon                                                                                                                                                                         |
| D. Clerk                                                        | Dados nos EUA e custo por usuário ativo                                                                                                                                                                                  |

## Consequências

- As correções de segurança ficam conosco: versões fixadas, Renovate e acompanhamento dos avisos. Em 2026 saíram correções de bypass do cache de sessão e de lockout do 2FA.
- Os nomes das tabelas do Better Auth diferem dos do documento: `user` é a Conta, e `account` é a Identidade de login. O glossário registra o mapeamento, para que ninguém confunda os dois.
- O rate limit guarda os contadores no banco, porque o padrão em memória não serve em funções serverless.
- "Lembrar de mim" (RF-AUT-03) é uma sessão com expiração mais longa; "Sair de todos os dispositivos" (RF-AUT-12) revoga as sessões da conta.
- O `proxy.ts` só faz a checagem otimista do cookie e redireciona; a autorização acontece na camada de dados (seção 9.12.3).
- Cadastro, login, recuperação de senha e verificação de e-mail passam pelo cliente HTTP do Better Auth (`/api/auth/*`). Chamadas `auth.api` feitas no servidor não passam pelo rate limit, então uma Server Action que chamasse `auth.api` para login ficaria sem proteção contra força bruta.
- O cache de sessão em cookie do Better Auth fica desligado: assim, suspensão de conta e sessões revogadas valem já na próxima requisição.
