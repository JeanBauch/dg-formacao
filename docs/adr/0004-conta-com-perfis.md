---
status: Aceito
data: 2026-11-05
origem: docs/requisitos/requisitos.md, seção 9.3
pendente: limite de idade e consentimento dependem de validação jurídica (DP-02 e DP-05)
---

# Identidade em conta e perfis

Crianças usarão a plataforma e, segundo as fontes consultadas, o ECA Digital exige que contas de até 16 anos estejam vinculadas a um responsável legal. Progresso e tipo de perfil (padrão ou infantil) são atributos da pessoa que assiste, não do titular da conta. Decidimos pela conta do titular adulto com perfis (opção B): tudo o que é do aluno (matrícula, progresso, salvos) é chaveado por `profile_id` desde já, o que mantém aberta a evolução para a opção C sem migrar dados.

## Opções consideradas

| Opção                                                              | Complexidade | Principal risco                                                                                                  |
| ------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| A. Uma conta por pessoa, inclusive a criança (cadastro autônomo)   | Baixa        | Conflita com o vínculo ao responsável; difícil de supervisionar; faixa etária autodeclarada pela própria criança |
| B. Conta do titular adulto com perfis (escolhida)                  | Média        | Muda o modelo: matrículas e progresso por `profile_id`; o menor não tem login próprio                            |
| C. Contas individuais de menores vinculadas à conta do responsável | Alta         | Dois logins, convites e painel de supervisão; mais aderente ao texto literal, porém pesado para o MVP            |

## Consequências

O acompanhamento pelo responsável e a classificação confiável do perfil como infantil, definida por ele, vêm quase de graça, e a experiência "Quem está assistindo?" combina com o estilo Netflix. Em troca, há mais telas (gestão de perfis), e a autenticação passa a identificar o titular, não o aluno.

## Escopo no MVP

- Perfil = nome, avatar de um conjunto fixo e o interruptor "Perfil infantil".
- Até 5 perfis por conta, sem login próprio e sem exclusão pelo titular.
- O limite de idade do perfil infantil é o parâmetro `child_profile_max_age` (16, a confirmar em DP-02).
- O PIN do titular entra no MVP: é o "sistema de bloqueio" que o Decreto 12.880/2026 pede para dispensar a aferição de idade (DP-13). Sem ele, uma criança poderia trocar para o perfil do titular.
