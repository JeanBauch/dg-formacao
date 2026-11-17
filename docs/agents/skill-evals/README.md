# Avaliações das skills do projeto

Cada arquivo `<skill>.json` traz cenários no formato do guia da Anthropic: o pedido (`query`) e os comportamentos esperados (`expected_behavior`). Os cenários miram o que um agente erra sem a skill: decisões do projeto, versões fixadas e armadilhas de segurança.

Ficam fora de `.claude/skills/` de propósito, para nunca entrarem no contexto do implementer.

## Como rodar (a partir do R0, quando existir código)

1. Para cada cenário, rode o implementer (Sonnet, o modelo que usa as skills) duas vezes, cada uma numa worktree limpa: uma **sem** a skill (tirada do pré-carregamento) e outra **com** ela.
2. Marque cada item de `expected_behavior` como cumprido ou não, lendo o diff e os testes.
3. Registre o placar abaixo. Uma skill só fica se melhorar o placar. Um item que nunca falha, nem sem a skill, aponta uma regra que o modelo já segue sozinho: corte-a da skill.
4. Quando uma regra mudar, ajuste primeiro o cenário e depois a skill.

A skill `skill-creator` automatiza esse ciclo de linha de base e comparação, se preferir.

## Placar

| Skill         | Data | Sem a skill | Com a skill | Observações |
| ------------- | ---- | ----------- | ----------- | ----------- |
| data-layer    |      |             |             |             |
| auth-identity |      |             |             |             |
