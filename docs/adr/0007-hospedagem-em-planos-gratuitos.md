---
status: Aceito
data: 2026-11-17
origem: docs/requisitos/requisitos.md, seção 9.8 (D-10 e D-11)
---

# Hospedagem e dados em planos gratuitos

O público inicial é de centenas de usuários (D-12), e o orçamento do MVP é próximo de zero (P-07), sem cortar funcionalidades. A primeira proposta, com Vercel Pro e Neon pago, custava cerca de US$ 40–80 por mês, mas esse custo vinha das metas da v2.2 (10 mil contas, RPO de 1 h, banco sempre ligado), não das funcionalidades. Decidimos pelos planos gratuitos gerenciados (opção A), com a VPS (opção B) como plano de saída ([ADR-0009](0009-portabilidade-e-gatilhos-de-escala.md)).

## Opções consideradas

| Opção                                                                                                                                       | Custo mensal       | Principal risco                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| A. Planos gratuitos gerenciados: Vercel Hobby, Supabase Free (só Postgres), Cloudflare R2, Resend, Sentry, Axiom e Better Stack (escolhida) | ~R$ 0 + domínio    | Cotas rígidas, termos do Hobby ("uso pessoal ou não comercial"), banco sem backup e sem SLA |
| B. VPS no Brasil (Hostinger KVM 2, São Paulo) com Coolify: Next em Docker, Postgres e WAL-G para o R2                                       | ~R$ 35–70          | Operação do servidor por um único desenvolvedor; deploy sem garantia de zero downtime       |
| C. Planos pagos: Vercel Pro + Neon ou Supabase Pro                                                                                          | ~US$ 40–80 ou mais | Acima do orçamento do MVP                                                                   |

**Descartadas:** Neon Free (o teto de 100 CU-h por mês suspende o banco até o mês seguinte, e o desligamento por inatividade não pode ser desativado), Oracle Always Free (cotas cortadas e instâncias desativadas em 2026) e Netlify ou Cloudflare via OpenNext (suporte a Cache Components não confirmado).

## Consequências

- A capacidade dos provedores é acompanhada todos os dias (RNF-CAP e seção 9.13).
- O backup do banco é nosso (RNF-DIS-05), porque o Supabase Free não tem nenhum.
- O uso do Hobby pela igreja (plataforma gratuita, sem anúncios nem doações) foi liberado pelo responsável (DP-25). Se a Vercel contestar, a saída é a Vercel Pro (US$ 20 por mês) ou a opção B.
- As regiões são fixadas na criação e não mudam depois: funções em gru1 e banco em São Paulo. Com o banco fora do Brasil, cada consulta ganharia cerca de 120 ms.
- A cota de tráfego de saída do Supabase é da organização: produção e staging somam.
- O Supabase Free pausa projetos sem requisições por 7 dias. O health check de produção a cada 3 min e o relatório de capacidade, que consulta os dois bancos todo dia, evitam a pausa.
