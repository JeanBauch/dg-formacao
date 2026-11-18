---
status: Aceito
data: 2026-11-17
origem: docs/requisitos/requisitos.md, seção 9.11 (DP-27)
---

# CSP sem nonce, com defesas contra XSS reforçadas

A RNF-SEG-02 pede CSP, e a DP-27 pôs segurança técnica, de código e de dados como prioridade do MVP. No Next.js 16.4, a CSP com nonce exige renderizar todas as páginas a cada requisição e é incompatível com o shell estático. Decidimos por uma CSP sem nonce (opção B), com as demais diretivas restritas e as defesas da RNF-SEG-12, porque ela mantém a arquitetura sem custo de desempenho nem de cota. Revisar quando a issue #89754 do Next.js for resolvida ou o SRI sair do experimental, e migrar para a opção A se a plataforma passar a exibir HTML vindo de usuários ou de terceiros.

## Contexto (pesquisa de 17/11/2026)

- A documentação do Next.js 16.4 diz que a CSP com nonce exige renderizar todas as páginas a cada requisição, desliga a geração estática e é incompatível com o PPR, porque o shell estático não tem acesso ao nonce.
- Com `cacheComponents` ligado (o padrão do harness), ler o nonce no layout raiz quebra o build ou atrasa os scripts. É a issue #89754 do Next.js, aberta e confirmada desde fevereiro de 2026, ainda sem correção.
- Um projeto em Next.js 16.4 que adotou nonce precisou desligar `cacheComponents` e `partialPrefetching` e chamar `connection()` no layout raiz. A alternativa por hashes falhou no navegador: o SRI cobre só os scripts externos, e a página tinha 8 scripts inline de hidratação.
- O SRI do Next.js (`experimental.sri`) continua experimental.

## Opções consideradas

| Opção                                                                                                                                        | Proteção contra XSS                                                                                                                                                                                                                                        | Custo                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. CSP com nonce, com `cacheComponents` e `partialPrefetching` desligados                                                                    | Máxima: só executa script com o nonce da requisição                                                                                                                                                                                                        | Toda página renderiza na função a cada visita, sem cache de HTML na CDN: mais CPU ativa e invocações no Hobby e LCP em risco. Sem `'use cache'`, o cache de dados volta para APIs antigas, e o projeto sai das regras de cache do harness |
| B. CSP sem nonce (`'unsafe-inline'` só em `script-src` e `style-src`), demais diretivas restritas, mais as defesas da RNF-SEG-12 (escolhida) | Alta: a injeção é barrada pelo React e pela RNF-SEG-12. Se um script injetado rodar, ele não carrega código de outros domínios e tem as saídas de dados limitadas pelas diretivas (`connect-src`, `img-src`, `form-action`); o cookie de sessão é httpOnly | Nenhum no desempenho ou nas cotas; mantém a arquitetura                                                                                                                                                                                   |
| C. Hashes (`experimental.sri`)                                                                                                               | Não cobre os scripts inline de hidratação                                                                                                                                                                                                                  | Experimental, e falhou na prática                                                                                                                                                                                                         |

## Política

`default-src 'self'`; `script-src 'self' 'unsafe-inline' https://www.youtube.com` (IFrame API, só depois do clique); `style-src 'self' 'unsafe-inline'`; `img-src 'self'` e o subdomínio de mídia; `media-src` e `connect-src` com `'self'`, o endpoint de URLs assinadas do R2 e o do Sentry; `worker-src 'self'` (pdf.js); `frame-src https://www.youtube-nocookie.com`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`. Um teste automatizado confere o cabeçalho em todas as rotas (RNF-SEG-11).

## Consequências

A CSP sozinha não basta contra XSS: a RNF-SEG-12 (sem `dangerouslySetInnerHTML`, Markdown restrito, links validados, nenhum script de terceiros) passa a ser obrigatória, e a revisão de código a verifica.
