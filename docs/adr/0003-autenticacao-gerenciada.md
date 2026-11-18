---
status: Substituído pela 0008
origem: docs/requisitos/requisitos.md, seção 9.2
---

# Autenticação gerenciada

A ADR-003 previa a autenticação num provedor gerenciado. Ela foi substituída na v2.3 pela [ADR-0008](0008-autenticacao-com-better-auth.md), que põe o Better Auth na própria aplicação.

## O que continua valendo

- Os papéis ficam no banco.
- O e-mail transacional sai com SPF, DKIM e DMARC.
- O MFA para contas de equipe passou para o pós-MVP (RF-AUT-08).
- O OTP por telefone depende do provedor de SMS (DP-05).
