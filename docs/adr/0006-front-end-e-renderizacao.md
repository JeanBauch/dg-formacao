---
status: Aceito
data: 2026-11-17
origem: docs/requisitos/requisitos.md, seção 9.7 (DP-21)
---

# Front-end e renderização híbrida por rota

O protótipo é um site multipágina estático (Vite 8 e Tailwind 3), com uma configuração de tema por página, cabeçalho em partial e sessão simulada em `localStorage`. Os requisitos pedem SEO nas páginas públicas (RF-CUR-06), rotas protegidas (RF-AUT-06) e sessão por cookie (RNF-SEG-09). Decidimos pela renderização escolhida por rota (opção C), em Next.js 16.4 com Cache Components, React Compiler e `partialPrefetching`: as páginas públicas têm shell estático, as partes que dependem do perfil ficam em `<Suspense>`, e as áreas logadas renderizam sob demanda. O Next.js é também o padrão do harness de desenvolvimento usado no projeto.

## Opções consideradas

| Opção                                                                                                                                                                 | Complexidade | Principal risco                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| A. Manter o Vite multipágina e consumir a API no navegador                                                                                                            | Baixa        | SEO fraco nas páginas de curso, guarda de rota só no cliente, token no navegador |
| B. Framework com renderização no servidor (Astro, Next, Nuxt ou SvelteKit), reaproveitando o HTML e o Tailwind do protótipo                                           | Média        | Migrar as 9 páginas e consolidar o tema                                          |
| C. Híbrido dentro de um framework: páginas públicas e institucionais pré-renderizadas; áreas logadas (aula, perfil, Meus cursos) renderizadas sob demanda (escolhida) | Média        | Duas formas de renderizar para manter                                            |

## Consequências

- Cabeçalho e rodapé viram componentes, e o tema único (RNF-UX-05) vira pré-requisito.
- O HTML do protótipo passa a ser referência visual, não código de produção. O código do protótipo (Vite 8, Tailwind 3, sessão em `localStorage`) não é reaproveitado.
