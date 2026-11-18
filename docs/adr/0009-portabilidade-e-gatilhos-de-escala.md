---
status: Aceito
data: 2026-11-17
origem: docs/requisitos/requisitos.md, seção 9.10
---

# Portabilidade e gatilhos de escala

Os planos gratuitos têm teto, e a plataforma pode crescer. Há três tipos de mudança: upgrade de plano no mesmo provedor (sem código), troca de provedor com a mesma arquitetura (adaptadores e variáveis de ambiente) e mudança de topologia, como várias instâncias em servidor próprio (infraestrutura nova). Decidimos manter as duas primeiras simples com as regras abaixo, valendo desde o primeiro commit.

## Decisão

1. **Provedores atrás de interfaces** em `src/infra/<capacidade>/`: `storage`, `mailer`, `video`, `telemetry` e `scheduler`. A camada `src/data` chama `src/infra`; `src/domain` não conhece provedor.
2. **Fronteira verificada por lint:** uma regra `no-restricted-imports` só permite `@vercel/*`, `@supabase/*`, `resend`, `@aws-sdk/*` e `@mux/*` dentro de `src/infra/**` e proíbe `next/*` em `src/domain/**`. Ela roda no CI, então um import indevido quebra o PR, e não a migração.
3. **Postgres comum** (RNF-DAD-04):
   - schema `app`, com a opção "Automatically expose new tables" desmarcada na criação do projeto;
   - extensões criadas pela primeira migration no schema `extensions`, que existe no Supabase e é criado nos demais;
   - `DATABASE_URL` pelo pooler em modo transação (aplicação) e `DATABASE_URL_DIRECT` pelo pooler em modo sessão (migrations e backup);
   - CI com `postgres:17`, a mesma versão principal do Supabase;
   - o registro de migrations aplicadas também no schema `app`: o backup só copia `app`, e um banco restaurado precisa saber quais migrations já rodaram.
4. **O banco guarda chaves, não URLs:** arquivos por `media_objects`, servidos por `/media/{id}`; vídeo por `provider` + `external_id` (RN-09). Trocar de storage é copiar os objetos e mudar variáveis de ambiente.
5. **Só APIs públicas do Next:** `'use cache'`, `cacheLife`, `cacheTag`, `updateTag`, `revalidateTag` e `after()`. Sem `'use cache: remote'` e sem o `waitUntil` da Vercel no MVP.
6. **Nenhum estado na memória do processo:** sessão, rate limit e contadores no banco.
7. **Telemetria por OpenTelemetry (OTLP):** trocar o Axiom por outro serviço é mudar variáveis de ambiente.
8. **Configuração validada na inicialização** (`src/env.ts` com Zod) e `.env.example` completo, que serve de inventário do que recriar num novo host. Poucas variáveis `NEXT_PUBLIC_*`, porque elas são fixadas no build.
9. **Prova contínua:** o E2E do CI roda contra `next start` (o modo de servidor próprio), com Postgres em container. `output: 'standalone'` e um Dockerfile ficam no repositório, e a imagem é gerada e testada a cada push na `main`.
10. **DNS fora da hospedagem:** domínio no Registro.br com DNS no Cloudflare. Trocar de host é mudar um registro.
11. **Ensaio de migração:** o teste trimestral de restauração (RNF-DIS-05) restaura o backup num Postgres limpo, o mesmo passo de uma migração de banco.

## Consequências

- Upgrade de plano (Vercel Pro, Supabase Pro, Resend pago) não muda código.
- Trocar de provedor mantendo a arquitetura leva cerca de um dia por provedor: novo adaptador, variáveis de ambiente e cópia dos dados.
- Várias instâncias em servidor próprio exigem uma nova ADR: cache handler compartilhado (Redis) com `refreshTags()`, a mesma `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` e o mesmo `deploymentId` em todas as instâncias, e streaming sem buffer no proxy. Na Vercel, a plataforma resolve isso.
- A Adapter API do Next.js, estável desde a 16.2, é o mesmo contrato público usado pela Vercel, o que reduz o acoplamento do framework à plataforma.
- Trocar a Vercel por uma VPS não muda código, mas perde os previews por PR, o rollback instantâneo e a CDN global. Por isso a saída padrão é a Vercel Pro antes da VPS, salvo quando o motivo for a perda máxima de dados ou os termos de uso.
