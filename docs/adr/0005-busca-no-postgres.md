---
status: Aceito
data: 2026-11-18
origem: docs/requisitos/requisitos.md, seção 9.4 (aceita na v2.4)
---

# Busca e filtros no próprio Postgres

O catálogo é pequeno, e o orçamento do MVP é próximo de zero (D-10). A busca por título e autor e os filtros do catálogo rodam no próprio Postgres, com `pg_trgm` e índices, sem um motor de busca dedicado. Reavaliar quando tags e pílulas entrarem, quando o catálogo passar de alguns milhares de cursos ou quando a taxa de buscas sem resultado indicar problema.

## Opções consideradas

| Opção                                                    | Complexidade | Observação                                                                       |
| -------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| A. Postgres com `pg_trgm` e índices (escolhida)          | Baixa        | Sem nova infraestrutura; relevância básica, suficiente para um catálogo pequeno  |
| B. Motor dedicado (Meilisearch, Typesense ou OpenSearch) | Média        | Melhor relevância e tolerância a erros de digitação; mais um serviço para operar |

## Implementação

- A coluna `courses.search_text` guarda o título e os nomes dos autores em minúsculas e sem acentos, com índice GIN trigram.
- Uma única função da aplicação normaliza o texto, tanto para gravar a coluna quanto para normalizar o termo buscado. O banco nunca chama `unaccent()`, que não é IMMUTABLE e não entraria num índice. Por isso a extensão `unaccent` não é usada (ajuste da v2.4).
- O `search_text` é recalculado em toda escrita que muda o título do curso ou o nome de um autor ligado a ele, não só na publicação. O cadastro de autores não é bloqueado pela publicação (RN-05), e um autor renomeado não pode sumir da busca (ajuste da v2.4).
- Sem tolerância a erro de digitação no MVP, porque a RF-CAT-02 não pede. As buscas sem resultado ficam em `search_misses` e medem o gatilho de reavaliação.
