---
name: relatorio-sessao
description: Gera o relatório desta sessão do projeto para colar na sessão acompanhada.
disable-model-invocation: true
---

Write the closing report of this project session, for the companion session (sessão acompanhada) that coordinates the DG Formação journey from the harness repo. The report is that session's only window into this one, so every line must be a fact you can point to.

## Steps

1. **Gather facts.** Collect them from this conversation, `git log --oneline` on the current branch, and `gh` for the issues and PRs this session touched (`--json` with only the fields you need). Done when you have the session's commits, issues and PRs, and the output of each verification command you ran.
2. **Fill the template** below. Write in Brazilian Portuguese, one line per field. A value you did not observe is written as `não medido`, and a field that does not apply as `não se aplica`. Done when no field is left blank.
3. **Output** the report as a single fenced `markdown` block and nothing after it. Leave the quota line for the user, who reads it from `/quota`.

## Template

```markdown
## Relatório de sessão · DG Formação
- **Sessão:** <número do prompt de abertura> · <data> · <fase do playbook> · <fatia R0–R5> · <spec/ticket #>
- **Objetivo:** <uma frase, como no prompt de abertura>
- **Resultado:** concluído | parcial | bloqueado: <uma linha>
- **Portão:** <G1–G4 ou merge>: aberto | pendente (<o que falta>)
- **Artefatos:** issues <#…> · PRs <#… (estado, CI)> · commits <sha assunto> · arquivos-chave
- **Evidência:** <comando → última linha da saída>, um por verificação
- **Decisões:** <decisão · quem decidiu · onde ficou registrada>
- **ASSUMPTION / NEEDS-DECISION:** <um por linha, com o ticket> ou nenhum
- **Reviews:** <total> findings (fix <n> · accept <n> · reject <n>); bugs de correção: <lista ou nenhum>
- **Modelo:** Sonnet | Opus | escalada para Opus (<motivo>)
- **Verificações do R0:** <item "Unverified" da skill → resultado> ou nenhuma
- **Atritos do harness:** <hook, skill, playbook ou template que atrapalhou ou faltou, com ponteiro> ou nenhum
- **Cota:** janela de 5 h <antes → depois> · semana <antes → depois> (preencher com /quota)
- **Próximo passo sugerido:** <uma linha>
```
