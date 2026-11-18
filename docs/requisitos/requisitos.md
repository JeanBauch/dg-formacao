# DG Formação (Plataforma de Cursos Evangélicos) — Requisitos v2.4

Versão 2.4 · 18/11/2026 · Rascunho para validação · Evolui a v2.3 com as decisões da descoberta (F1) e do desenho do sistema (F4): ADRs em `docs/adr/`, glossário em `GLOSSARY.md` e o que a v2.3 deixou como proposto. O caminho deste documento é fixo (`docs/requisitos/requisitos.md`); a versão fica aqui no cabeçalho

## 1. Controle do documento

### 1.1 Decisões incorporadas

| ID | Decisão | Impacto |
| --- | --- | --- |
| D-01 | Plataforma gratuita; pode mudar em até 24 meses | MVP sem pagamento. O modelo já traz `access_policy` por curso (valor inicial `free`), sem implementar cobrança |
| D-02 | Professores são equipes internas (5 a 10) | Backoffice enxuto. Mantém fluxo de revisão e auditoria |
| D-03 | Plataforma evangélica com público infantil; conteúdo controlado e revisado | Revisão editorial obrigatória antes de publicar; regras de menores (seção 7) |
| D-04 | Faixa etária autodeclarada não é controle confiável | A faixa etária não é usada como controle de acesso. A restrição vem do perfil infantil, definido pelo responsável (RN-04, ADR-004) |
| D-05 | Curso só é publicado após avaliação interna e com todas as aulas prontas; no futuro, liberação fragmentada | MVP exige lançamento integral; o modelo suporta liberação por aula (RN-05) |
| D-06 | Telefone é dado importante | Vinculado à conta, com finalidades declaradas (RN-12) |
| D-07 | Métricas, logs, observabilidade e demais requisitos não funcionais são essenciais no MVP | Seção 8 faz parte do escopo do MVP |
| D-08 | Catálogo com busca parcial por título; filtros por categoria, formato e faixa etária; ordenação por recentes e populares; tags no futuro | RF-CAT |
| D-09 | YouTube no início, com migração futura para Mux ou Bunny Stream | Vídeo abstraído por provedor (RN-09) |
| D-10 | Orçamento de infraestrutura próximo de zero no MVP: planos gratuitos, com upgrade guiado por métricas de capacidade (17/11/2026) | ADR-007, seção 8.9 (RNF-CAP) e seção 9.13 |
| D-11 | Perda máxima de dados (RPO) de 24 h aceita no MVP, com cópia do banco antes de cada migration (17/11/2026) | RNF-DIS-05 |
| D-12 | Público inicial real: centenas de usuários, abaixo de 500 (17/11/2026) | P-01 revisada; metas da seção 8 recalibradas sem cortar funcionalidades |
| ADR-001 | Aceito: backoffice próprio mínimo (C) com carga inicial por planilha (D) | Seção 9.2 |
| ADR-002 | Aceito: PDFs em object storage com URL assinada (Cloudflare R2 na v2.3) | Seções 9.2 e 9.12 |
| ADR-003 | Substituído na v2.3 pela ADR-008: Better Auth na própria aplicação, no lugar de autenticação gerenciada | Seção 9.9 |
| ADR-004 | Aceito: conta do titular com perfis | Seção 9.3 |
| ADR-005 | Aceito na v2.4: busca e filtros no próprio Postgres, sem `unaccent` | Seção 9.4 |
| ADR-006 | Aceito na v2.3: Next.js 16.4 com renderização híbrida por rota | Seção 9.7 |
| ADR-007 | Aceito: hospedagem e dados em planos gratuitos | Seção 9.8 |
| ADR-008 | Aceito: autenticação com Better Auth | Seção 9.9 |
| ADR-009 | Aceito: portabilidade e gatilhos de escala | Seção 9.10 |
| ADR-010 | Aceito: CSP sem nonce, com defesas contra XSS reforçadas (DP-27) | Seção 9.11 |

### 1.2 Alertas novos desta versão

**Novos na v2.3:**

1. **ECA Digital regulamentado (seção 7.1).** Segundo resumos de escritórios de advocacia (o texto do decreto ainda não foi lido), o Decreto 12.880/2026 regulamentou a Lei 15.211/2025. Ele veda a mera autodeclaração como verificação de idade e dispensa a aferição de idade em serviços com controle editorial que oferecem conta infantil com conteúdo adequado e supervisão parental com sistema de bloqueio. Sem o PIN do titular (RF-PRF-11) não há bloqueio, por isso o PIN entra no MVP (DP-13, decidido em 17/11/2026). O enquadramento na dispensa ainda precisa ser confirmado pelo jurídico.
2. **Planos gratuitos têm teto rígido (seção 9.13).** Quando uma cota estoura, a Vercel Hobby em geral suspende o recurso por 30 dias, e o Supabase Free dá um único período de carência antes de restringir o projeto. Acompanhar a capacidade dos provedores passa a ser requisito (RNF-CAP).
3. **CSP com nonce é incompatível com o shell estático** do Next.js 16.4: na prática, exige desligar `cacheComponents` e `partialPrefetching`, o que obriga todas as páginas a renderizar a cada visita (issue #89754 do Next.js, aberta). A ADR-010 adota CSP sem nonce, com defesas contra XSS reforçadas (RNF-SEG-12).
4. **O Google aposentou o resultado rico de cursos** (Course Info) em junho de 2025. A RF-CUR-06 mantém os dados estruturados, sem prometer resultado rico.
5. **Carga revisada (P-01):** de 10 mil contas e 500 simultâneos para cerca de 1.000 contas e 50 simultâneos. Nenhuma funcionalidade saiu do MVP; mudaram as metas e a forma de atendê-las (seção 1.5).

**Da v2.2, ainda válidos:**

1. **Menores e ECA Digital (seção 7.1).** A Lei 15.211/2025 está em vigor desde 17/03/2026 e, segundo a cobertura disponível, exige que contas de até 16 anos em serviços de acesso provável por menores estejam vinculadas a um responsável legal. Isso afeta a decisão de que a criança cria a própria conta. A solução adotada é a ADR-004 (conta do responsável com perfis).
2. **Convicção religiosa é dado pessoal sensível (seção 7.2).** Cadastro e histórico de estudo numa plataforma evangélica podem revelar a crença do usuário. Sem recomendações por preferência o risco diminui, mas não desaparece (seção 7.2).
3. **Perfil infantil definido pelo responsável (RN-04).** A autodeclaração de idade deixa de ser usada para restringir conteúdo.
4. **Nomenclatura.** “Curso” é ao mesmo tempo a entidade e um rótulo de formato (curso, estudo, misto). Ver glossário e decisão DP-07.
5. **O escopo do MVP cresceu** (conformidade, observabilidade, backoffice, fluxo editorial). Ver riscos (seção 11) e corte do roadmap (seção 10).

### 1.3 Alterações da v2.1

A v2.1 corta recomendações, curadoria dinâmica da home e exclusão self-service, e simplifica perfis e o fluxo editorial. Os IDs não foram renumerados: os removidos constam abaixo e os reescritos mantêm o número.

| Mudança | Requisitos afetados |
| --- | --- |
| Sem recomendações nem personalização por preferências | Removidos: RF-PRF-07, RN-06 e RPV-02 (a parte de publicidade e rastreadores de terceiros foi para a RPV-08). Ajustados: RF-PRF-04, RF-PRF-10, RPV-06, glossário, eventos de analytics, modelo de dados e API |
| Home definida no código | RF-HOM-01 a 07 reescritos. Saem do MVP as tabelas `home_sections` e `home_section_items` e a permissão `home:curate` (substituída por `course:review`) |
| Sem exclusão self-service | Removido: RF-PRF-08 (agora RF-PRF-12, pós-MVP). Reescritos: RF-AUT-09 e RN-15, com atendimento manual pelo encarregado |
| Perfis simplificados (ADR-004 aceita) | Reescritos: RF-PRF-02, 03, 05 e 09, RPV-01, RPV-04 e RN-04. Novo: RF-PRF-11 (PIN, pós-MVP). `profiles.kind` substitui faixa etária e restrição por perfil |
| Fluxo editorial simples | Reescritos: RF-ADM-04, 05 e 07, RN-01, RN-02 e RN-05. Novo: RF-ADM-16. Saem os estados `aprovado` e `suspenso` e o checklist |
| Seção 7.2 reenquadrada | “Convicção religiosa” virou “Privacidade e segurança dos dados”. O risco de a crença ser inferida pelo histórico de estudo ficou em uma frase e na RPV-07; os demais requisitos valem por causa de menores e operadores, não das preferências |

### 1.4 Alterações da v2.2

A v2.2 cruza o documento com o protótipo do repositório `ibav-sorocaba` (9 páginas HTML estáticas). O resultado completo está na seção 13. Os IDs continuam sem renumeração.

| Mudança | Requisitos afetados |
| --- | --- |
| Validação cruzada com o protótipo | Nova seção 13: matriz de telas, 28 achados, telas a criar e componentes a ocultar no MVP |
| Requisitos novos | RF-AUT-13, RF-PRF-13 a 15, RF-APR-11 e 12, RF-PRG-08, RF-HOM-08 e 09, RF-ADM-17, RF-INS-01 a 08, RN-16 a 18, RPV-15, RNF-SEG-09 e RNF-UX-05 |
| Requisitos reescritos | RF-AUT-01, 03, 06 e 11; RF-PRF-06; RF-CAT-01 a 08; RF-CUR-01 a 10 (a aula de preview, antes RF-CUR-07, passou a RF-CUR-08, e o “Salvar”, antes RF-CUR-08, a RF-CUR-10); RF-APR-01 a 05; RF-PRG-01 a 03; RF-HOM-01 e 02; RF-ADM-02; RN-08 |
| Modelo de dados | `authors`, `course_authors` e `course_editors` no lugar de `course_instructors`; `courses.level`, `trailer_video_id`, `learning_outcomes` e `prerequisites`; futuros `lesson_notes` e `certificates` |
| Decisões pendentes | DP-15 a DP-22 novas; DP-06 e DP-07 ajustadas |
| Arquitetura | ADR-006 (proposta): front-end e renderização |

### 1.5 Alterações da v2.3

A v2.3 transforma a arquitetura da seção 9 em desenho do sistema, com a stack, os provedores, as regras de portabilidade e o acompanhamento de capacidade, e recalibra as metas para o público real (D-12) com orçamento próximo de zero (D-10). Os IDs continuam sem renumeração.

| Mudança | Requisitos afetados | Status |
| --- | --- | --- |
| Desenho do sistema do MVP | Seção 9: visão geral e stack (9.1), ADR-006 a 010 (9.7 a 9.11), desenho técnico (9.12), capacidade e gatilhos de upgrade (9.13) | ADR-006 a 010 aceitas em 17/11/2026 |
| Orçamento próximo de zero | D-10, P-07, ADR-007, nova seção 8.9 (RNF-CAP-01 a 06), riscos | Aceito |
| Metas recalibradas | P-01, RNF-PER-04 a 07, RNF-DIS-01, 04, 05 e 06, RNF-OBS-01, 02, 04 a 08, RNF-SEG-02, 03, 05, 06 e 08, RNF-QUA-02 a 04 | Aceito (RPO de 24 h em D-11) |
| Autenticação | ADR-003 substituída pela ADR-008 (Better Auth); glossário com os nomes de tabela do Better Auth | Aceito |
| “API-first” vira “casos de uso primeiro” | P-03, RF-HOM-05 e 06, seção 9.6 | Aceito |
| Permissões mapeadas no código | Seção 4; modelo de dados (saem `permissions` e `role_permissions`) | Aceito na v2.4 (18/11/2026) |
| Refinamentos técnicos | RF-AUT-01, RF-CUR-06, RF-APR-01, 02 e 05, RF-ADM-03, 12 e 14, RN-02, RN-05, RN-10, RPV-12, RPV-15, RNF-DAD-01, 03 e 04, modelo de dados v3 | Aceito na v2.4 (18/11/2026), com ajustes (seção 1.6) |
| Decisões pendentes | DP-09, 13, 14, 21 e 23 a 27 decididas em 17/11/2026; DP-11 com nova recomendação | — |
| Segurança como prioridade do MVP (DP-27) | Novas RNF-SEG-10 a 14; seção 9.12.12 (repositório público e cadeia de suprimentos); ADR-010 reavaliada | Aceito |
| MFA das contas de equipe adiado por custo | RF-AUT-08, RNF-SEG-01, ADR-008, seção 9.12.3 (proteções no lugar), modelo de dados, riscos | Aceito |
| Vídeo com provedor guardado (DP-23) | RN-09; modelo de dados (nova tabela `videos`, usada por aulas e trailers); seção 9.12.5 | Aceito |
| Roadmap | Nova seção 10.4: fatias de entrega R0 a R5, com as verificações do R0 | Aceito na v2.4 (18/11/2026) |

### 1.6 Alterações da v2.4

A v2.4 registra a descoberta (F1) e o desenho do sistema (F4) feitos no repositório. O vocabulário passa a viver no `GLOSSARY.md`, na raiz, e cada ADR num arquivo de `docs/adr/` (0001 a 0010). Em caso de divergência, valem o glossário e as ADRs. Os itens propostos da v2.3 foram decididos, e nenhuma decisão nova pediu ADR, porque todas são fáceis de reverter. Os IDs continuam sem renumeração.

| Mudança | Requisitos afetados | Status |
| --- | --- | --- |
| Glossário e ADRs fora deste documento | Seção 3 (fonte passa a ser o `GLOSSARY.md`), seção 9 (ADRs em `docs/adr/`); caminho fixo `docs/requisitos/requisitos.md` | Aceito |
| ADR-005 aceita, com dois ajustes: sem a extensão `unaccent` (a normalização é da aplicação) e `search_text` recalculado quando muda o título ou o nome de um autor | Seção 9.4, RNF-DAD-03, RNF-DAD-04, modelo de dados | Aceito |
| Papéis e permissões: só Instrutor e Admin são papéis guardados; Visitante e Aluno não; mapa de permissões no código | Seção 4, glossário | Aceito |
| Conta de equipe não tem perfil infantil: a permissão é da conta, não do perfil | Seção 4, RF-AUT-08, RF-PRF-02 | Aceito |
| Respostas de recusa: 404 para o que está fora do alcance, 403 para ação negada sobre recurso visível | Seção 4 | Aceito |
| Ajustes dos refinamentos: RN-02 exige 1 autor (não 1 instrutor); a duração do vídeo fica só em `videos`; a aula aponta para o vídeo por `lessons.video_id` (sai `lesson_videos`) | RN-02, RN-10, modelo de dados | Aceito |
| IP fora da sessão, com o rate limit mantido: um gancho do Better Auth esvazia o IP da sessão. A opção `disableIpTracking` desligaria também o rate limit | Modelo de dados (`sessions`), seção 9.12.3, 10.4 (verificação 3), skill `auth-identity` (CONFIG.md) | Aceito |
| Registro de segurança com IP, para investigar incidentes e ataques, retido por 6 meses | Nova RNF-SEG-15, modelo de dados (`security_events`), seções 9.12.3, 9.12.6 e 9.12.8, RPV-11, DP-11, 10.4 (R0) | Aceito; retenção a confirmar pelo jurídico (DP-11) |
| Fronteiras de módulo: `identity` vira `auth`; cada tabela tem um módulo dono, o único que escreve nela; um módulo importa outro só pela interface pública dele | Seções 9.1, 9.12.1 e 10.4 (R0) | Aceito |
| Validação na entrada: quem recebe a entrada valida com o schema de `src/domain`; o caso de uso recebe a entrada já validada; lint de tipos contra `any` | Seções 9.6, 9.12.1 e 10.4 (R0) | Aceito |
| Vocabulário: Titular e Responsável separados; "editor do curso" no lugar de "instrutor dono" | Seção 3, RN-01, RF-ADM-01, RF-ADM-07, glossário | Aceito |

## 2. Visão, escopo e premissas

### 2.1 Visão

**Nome:** DG Formação, em que DG vem de Discipulando Gerações. O identificador técnico é `dg-formacao`, sem acentos, porque GitHub, npm e Vercel só aceitam letras ASCII. Ele vale para o repositório, o pacote, o projeto na Vercel, o projeto no Supabase e a pasta local.

Plataforma web gratuita de cursos e estudos da Igreja Batista Água Viva de Sorocaba (IBAV), de uma única igreja (sem multi-tenant) e aberta a membros e à comunidade, com portal do aluno, consumo de conteúdo em vídeo e leitura e descoberta no estilo Netflix (seções de destaque definidas no código). Atende todas as faixas etárias, incluindo crianças, com supervisão do responsável.

### 2.2 Objetivos do MVP

1. Publicar conteúdo curado com um fluxo editorial seguro.
2. Permitir que o aluno descubra, assista, leia, acompanhe progresso e conclua.
3. Medir o uso e operar a plataforma com visibilidade (métricas, logs, alertas).
4. Nascer em conformidade com LGPD e ECA Digital, validada pelo jurídico.

**KPIs de produto:** ativação (cadastros que iniciam uma aula em 24 h), taxa de conclusão de cursos, retenção D7 e D30, aulas concluídas por perfil ativo por semana, buscas sem resultado e taxa de erro de vídeo. As metas numéricas serão fixadas após 4 semanas de baseline.

### 2.3 Fora do escopo do MVP

Pagamentos, certificados, avaliações e comentários, quizzes, notificações push, app nativo, streaming próprio, tags/pílulas, liberação fragmentada de aulas, progresso gradual, “Salvos”, login social, recomendações e personalização por preferências, curadoria dinâmica da home, exclusão de conta pelo próprio usuário e comunicação dentro do fluxo editorial (parte disso está prevista no modelo, ver seção 10).

### 2.4 Premissas

| ID | Premissa |
| --- | --- |
| P-01 | Carga de referência: cerca de 1.000 contas e 50 usuários simultâneos no pico (revisada na v2.3; o público inicial é de centenas de usuários, D-12). O crescimento é tratado pelos gatilhos de upgrade (seção 9.13), não por superdimensionamento |
| P-02 | Idioma único: pt-BR, com textos externalizados para futura tradução |
| P-03 | Equipe pequena (um desenvolvedor): monólito modular, casos de uso primeiro (seção 9.6) e serviços gerenciados |
| P-04 | Vídeos no YouTube em canal institucional da plataforma, não nos canais pessoais dos professores |
| P-05 | Todo curso passa por revisão interna antes de publicar |
| P-06 | Acesso por navegador web responsivo (celular, tablet, desktop) |
| P-07 | Orçamento de infraestrutura do MVP próximo de zero: só o domínio (cerca de R$ 40/ano). Gasto novo entra por gatilho de capacidade (D-10) |

## 3. Glossário

Desde a v2.4, o glossário vive no `GLOSSARY.md`, na raiz do repositório, com o nome usado no código e os termos pendentes de DP. Em caso de divergência, vale o `GLOSSARY.md`. A tabela abaixo é a da v2.3, corrigida só onde a v2.4 mudou um termo.

| Termo | Definição |
| --- | --- |
| Conta | Registro do titular adulto (e-mail, senha, nome, telefone). Responde legalmente pelos perfis. No Better Auth, a tabela se chama `user` |
| Identidade de login | Forma de entrar na conta: e-mail e senha no MVP, Google no pós-MVP. No documento é `auth_identities`; no Better Auth, a tabela se chama `account` (não confundir com Conta) |
| Perfil ativo | Perfil escolhido em “Quem está assistindo?”, guardado no servidor junto da sessão do dispositivo e conferido a cada requisição |
| Escopo do catálogo | `standard` ou `child`: as duas variantes do catálogo guardadas em cache. Perfil infantil usa `child` (RN-04) |
| Cota gratuita | Limite de uso de um plano gratuito de provedor, por dia ou por mês (seção 9.13) |
| Gatilho de upgrade | Nível de uso de uma cota que dispara a troca de plano ou de provedor (seção 9.13) |
| Perfil | Identidade de uso dentro da conta (titular, filhos, etc.). Guarda nome, avatar, tipo (padrão ou infantil), matrículas e progresso |
| Titular | Adulto dono da conta. Para o sentido da LGPD, “titular dos dados” |
| Responsável | O titular agindo como responsável legal por um perfil infantil da conta |
| Editor do curso | Conta de equipe ligada ao curso, que pode editá-lo (`course_editors`). Substitui “instrutor dono” |
| Curso (entidade) | Unidade publicável do catálogo: módulos, aulas e materiais |
| Formato | Classificação derivada do curso: **Curso** (só vídeo), **Estudo** (só leitura) ou **Misto** |
| Módulo | Agrupador ordenado de aulas dentro de um curso |
| Aula | Unidade de conteúdo: vídeo ou leitura (PDF) |
| Material complementar | Arquivo para download associado à aula ou ao curso. Não conta para o formato |
| Categoria (assunto) | Classificação temática de lista fechada, usada nos filtros do catálogo |
| Público-alvo | Faixa etária à qual o curso se destina (infantil, jovens, jovens+, adultos, seniors). Um curso pode ter vários |
| Tag / pílula | Marcador de conteúdo de vocabulário fechado. Futuro |
| Matrícula | Relação perfil↔curso que guarda status, datas e última aula acessada |
| Progresso | Conjunto de aulas concluídas por perfil. O percentual é derivado |
| Autor | Pessoa ou grupo exibido como responsável pelo curso (nome, bio, foto). Pode não ter conta na plataforma |
| Trilha | Vitrine editorial da home (“Estudo Teológico”, “Apoio para PGs” e outras). Não é categoria nem entidade do modelo no MVP (DP-18) |
| Nível | Grau de profundidade do curso: Iniciante, Intermediário, Avançado ou Todos os níveis |

## 4. Papéis e permissões (RBAC)

Papéis guardados: **Instrutor** e **Admin**, na Conta. Uma conta com ao menos um deles é uma **conta de equipe**, criada só por convite do admin, e pode acumular os dois. **Visitante** (sem sessão) e **Aluno** (quem estuda por um perfil) aparecem na tabela abaixo, mas não são papéis guardados; no código, a conta sem papel de equipe tem o valor padrão `user` do plugin `admin`. As permissões são chaves (`course:create`, `course:update:own`, `course:publish`, `course:review`, `taxonomy:manage`, `user:manage`) verificadas no servidor. O papel de cada conta fica no banco, e o mapa de papel para permissões fica no código, numa função pura `can(ator, permissão, recurso)` testada como matriz (aceito na v2.4). Com papéis fixos, tabelas de permissões não se pagam no MVP; elas voltam por uma migration de expansão se o admin precisar criar papéis.

**Conta de equipe não tem perfil infantil** (v2.4). A permissão é da conta, não do perfil: uma criança num perfil infantil, na sessão de um instrutor, alcançaria o backoffice. Por isso uma conta com papel de equipe não cria perfil infantil, e uma conta que já tem perfil infantil não recebe papel. Quem é da equipe e tem filhos usa duas contas, com e-mails diferentes (RF-AUT-08 e RF-PRF-02).

| Capacidade | Visitante | Aluno | Instrutor | Admin |
| --- | --- | --- | --- | --- |
| Ver home pública, catálogo e página do curso | Sim | Sim | Sim | Sim |
| Assistir aulas e ler materiais | Não | Sim | Sim (pré-visualização) | Sim |
| Gerenciar conta e perfis | Não | Sim | Sim | Sim |
| Criar e editar cursos próprios (rascunho) | Não | Não | Sim | Sim |
| Enviar curso para revisão | Não | Não | Sim | Sim |
| Aprovar, manter em rascunho e arquivar | Não | Não | Não | Sim |
| Editar curso de outro instrutor | Não | Não | Não | Sim |
| Gerenciar categorias, públicos e tags | Não | Não | Não | Sim |
| Gerenciar equipe, papéis e alunos | Não | Não | Não | Sim |
| Ver métricas | Não | Não | Dos seus cursos | Todas |
| Ver audit log | Não | Não | Não | Sim |

**Respostas de recusa** (v2.4). Quem não deve saber que um recurso existe recebe “não encontrado”; quem o vê, mas não pode agir sobre ele, recebe “proibido”.

| Situação | Resposta |
| --- | --- |
| Sem sessão numa área privada ou em `/media/{id}` | Redireciona para o login (página) ou 401 (rota) |
| Recurso fora do alcance da conta ou do perfil: curso fora do escopo do catálogo, em rascunho ou arquivado sem matrícula; perfil, matrícula ou arquivo de outra conta; curso de outro instrutor no backoffice; backoffice aberto por conta sem papel | 404 |
| Recurso visível, mas ação não permitida (por exemplo, o instrutor pedindo para aprovar o próprio curso) | 403 |
| Sessão de equipe com mais de 12 h ou ação sensível sem login recente (seção 9.12.3) | Pede novo login (`reauth`) |

Numa Server Action, a recusa volta como resultado (`not_found` ou `forbidden`), sem alterar dados; numa rota, como 401, 403 ou 404. As recusas vindas de sessão autenticada, por posse ou por permissão de equipe, vão para o registro de segurança (RNF-SEG-15); um 404 de visitante anônimo não vai.

## 5. Requisitos funcionais

Prioridades: **MVP**, **Pós-MVP** (até cerca de 6 meses) e **Futuro** (até 24 meses). Os requisitos de perfis dependem da ADR-004 (aceita).

### 5.1 Conta e autenticação (RF-AUT)

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-AUT-01 | Cadastro do titular com nome completo, e-mail e senha (mínimo de 8 caracteres, com indicador de força), mais declaração de ter 18 anos ou mais e aceite de Termos e Política de Privacidade (versão e data registradas). O protótipo não tem a declaração de maioridade. A declaração registra a responsabilidade do titular, mas não conta como verificação de idade (alerta 1.2): a proteção dos menores vem do perfil infantil (RN-04) e do PIN (DP-13). Validar com o jurídico (DP-04) | MVP |
| RF-AUT-02 | Verificação de e-mail por link com expiração. Obrigatória antes de criar perfil infantil e para recuperar senha | MVP |
| RF-AUT-03 | Login por e-mail e senha, com mostrar senha e “Lembrar de mim” (sessão prolongada), sessão com expiração e logout | MVP |
| RF-AUT-04 | Esqueci minha senha: link de uso único, expiração curta (30 min), resposta idêntica exista ou não a conta, com rate limit | MVP |
| RF-AUT-05 | Política mínima de senha e bloqueio progressivo por tentativas falhas | MVP |
| RF-AUT-06 | Conteúdo didático exige login; home, catálogo, página do curso e páginas institucionais são públicos. As rotas de aula e de conta são protegidas no servidor (no protótipo nenhuma rota é protegida) | MVP |
| RF-AUT-07 | Após o login, retornar ao conteúdo originalmente solicitado | MVP |
| RF-AUT-08 | Contas de equipe criadas por convite do admin. O MFA (TOTP) para contas de equipe saiu do MVP na v2.3 por custo de implementação; no lugar, valem as proteções da seção 9.12.3 (senha mais forte, sessão curta e confirmação de senha em ações sensíveis). O convite cria sempre uma conta nova, e conta de equipe não tem perfil infantil (seção 4, v2.4) | MVP (convite); Pós-MVP (MFA) |
| RF-AUT-09 | Exclusão de conta e de perfis a pedido do titular, atendida manualmente pelo encarregado dentro do prazo legal; sem fluxo self-service no MVP (RN-15) | MVP |
| RF-AUT-10 | Exportação de dados do titular. No MVP, atendimento manual pelo canal do encarregado | Pós-MVP (automatizar) |
| RF-AUT-11 | Login social (Google primeiro, depois outros), com vínculo de identidade somente por e-mail verificado. O botão “Continuar com Google” do protótipo fica oculto no MVP | Pós-MVP |
| RF-AUT-12 | “Sair de todos os dispositivos” | Pós-MVP |
| RF-AUT-13 | Telas de “Esqueci minha senha” (pedido por e-mail), “Redefinir senha” (via link) e “Confirmar e-mail”, mais estados de erro de login e de sessão expirada. Nenhuma existe no protótipo: o link “Esqueci minha senha” aponta para uma âncora vazia | MVP |

### 5.2 Perfis e responsável (RF-PRF)

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-PRF-01 | Ao criar a conta, o sistema cria o perfil do titular (tipo padrão), com o nome do cadastro | MVP |
| RF-PRF-02 | Na tela “Perfis”, o titular cria perfis adicionais informando só o nome, o avatar (de um conjunto fixo) e se o perfil é **infantil** (interruptor). Perfil infantil é para menores até o limite legal de idade (parâmetro `child_profile_max_age`; 16, a confirmar em DP-02). Limite de perfis por conta configurável (sugestão: 5). Conta de equipe não cria perfil infantil (seção 4, v2.4) | MVP |
| RF-PRF-03 | Seleção do perfil ativo: tela “Quem está assistindo?” após o login quando há mais de um perfil, e troca de perfil pelo menu a qualquer momento. O último perfil é lembrado no dispositivo. Matrículas, progresso e “Meus cursos” são sempre do perfil ativo | MVP |
| RF-PRF-04 | Edição de perfil: nome, avatar e tipo (padrão ou infantil) | MVP |
| RF-PRF-05 | Acompanhamento pelo responsável: na tela “Perfis”, o titular abre a visão somente leitura de “Meus cursos” de cada perfil infantil (em andamento e concluídos, com progresso). Perfis infantis não têm login próprio nem interação social | MVP |
| RF-PRF-06 | Telefone/WhatsApp pertence à conta: opcional no cadastro; campo obrigatório na tela “Dados pessoais”, como no protótipo, sem bloquear o consumo de conteúdo; obrigatório antes de criar o primeiro perfil infantil; formato E.164 validado. Verificação por código (OTP) conforme DP-05 | MVP (verificação a definir) |
| RF-PRF-09 | Restrição de conteúdo em perfil infantil: o servidor mostra só cursos com público-alvo permitido para crianças (RN-04); o titular não configura isso no MVP | MVP |
| RF-PRF-10 | Novos campos de perfil entram como colunas tipadas na tabela de perfis, sem blob genérico | Futuro |
| RF-PRF-11 | PIN do titular (4 a 6 dígitos, guardado como hash, com bloqueio temporário após 5 tentativas erradas) para sair de um perfil infantil e abrir um perfil padrão. Definido pelo titular ao criar o primeiro perfil infantil; redefinido com a senha da conta (DP-13) | MVP (antes pós-MVP; decidido em 17/11/2026) |
| RF-PRF-12 | Exclusão de perfil e de conta pelo próprio titular (no MVP, por pedido manual, ver RF-AUT-09) | Pós-MVP |
| RF-PRF-13 | Tela “Perfil e conta”: dados pessoais (nome, e-mail, telefone), gestão de perfis (criar, editar, trocar), acompanhamento do responsável e sair da conta. Saem do protótipo: preferências de conteúdo, faixa etária, certificados, foto por upload e o rótulo “Membro” | MVP |
| RF-PRF-14 | Avatar do perfil de um conjunto fixo no MVP. O upload de foto do titular fica para depois (o protótipo oferece “Alterar foto de perfil”) | Pós-MVP |
| RF-PRF-15 | Preferências de comunicação (e-mail com novas aulas e lembretes de estudo): desligadas por padrão, com consentimento específico (RN-12). O protótipo vem com a opção ligada | Pós-MVP |

### 5.3 Catálogo e descoberta (RF-CAT)

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-CAT-01 | Catálogo público (“Catálogo de Cursos & Estudos”) com apenas cursos publicados. Card: capa, selo de formato (Curso, Estudo ou Conteúdo Misto), duração, título, autor, categoria, público-alvo e, para perfil logado com matrícula, barra de progresso (“68% concluído”) | MVP |
| RF-CAT-02 | Busca por texto sobre título e nome do autor, parcial, sem diferenciar maiúsculas nem acentos (“oracao” encontra “Oração”), mínimo de 2 caracteres, com debounce. O texto do campo no protótipo (“título, instrutor, livro ou tema”) deve ser ajustado: livro e tema dependem das tags (futuro) | MVP |
| RF-CAT-03 | Filtro por categoria: chips de seleção única, com “Todas” (6 categorias oficiais, DP-19) | MVP |
| RF-CAT-04 | Filtro por formato: “Todos os formatos”, “Cursos em Vídeo”, “Estudos Escritos” e “Conteúdo Misto” (seleção única, RN-08) | MVP |
| RF-CAT-05 | Filtro por faixa etária (público-alvo N:N): seleção única com “Todas”; o curso aparece se tiver o público escolhido. O componente não existe no protótipo | MVP |
| RF-CAT-06 | Ordenação em lista suspensa: “Mais recentes” (padrão, pela data de publicação) e “Mais populares” (RN-07) | MVP |
| RF-CAT-07 | Os filtros se combinam: AND entre filtros de tipos diferentes; busca, filtros e ordenação funcionam juntos | MVP |
| RF-CAT-08 | Estado do catálogo na URL (compartilhável), contagem de resultados (“8 formações encontradas”), estado vazio com a ação “limpar filtros” e paginação ou “carregar mais” acima de 24 resultados. URL e estado vazio não existem no protótipo | MVP |
| RF-CAT-09 | Perfis infantis recebem o catálogo já restrito pelo servidor (RN-04), sem possibilidade de remover a restrição pelo cliente | MVP |
| RF-CAT-10 | Registrar buscas sem resultado para análise | MVP |
| RF-CAT-11 | Categorias por seed (lista fechada). Tela para o admin adicionar e remover | Pós-MVP |
| RF-CAT-12 | Filtro por tags/pílulas, com vocabulário fechado e limite por curso (RN-14), e busca por livro bíblico e tema | Futuro |

### 5.4 Página do curso (RF-CUR)

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-CUR-01 | Página pública do curso: breadcrumb (Catálogo / categoria / curso), título, sinopse, capa, autor(es), categoria, público-alvo, formato, nível, nº de aulas, duração e “Acesso gratuito” | MVP |
| RF-CUR-02 | Totais derivados: duração (horas e minutos), nº de módulos, de aulas, de vídeos, de leituras e de materiais para download (RN-10) | MVP |
| RF-CUR-03 | Campos editoriais: seção “Sobre o curso” (chamada e descrição), “O que você vai aprender” (lista de itens com título e texto curto) e pré-requisitos | MVP |
| RF-CUR-04 | Currículo em módulos expansíveis, com título, resumo curto, tipo e duração de cada aula. O visitante vê o currículo e abrir a aula exige login: o cadeado vale só para visitante, e o aluno logado tem todas as aulas abertas | MVP |
| RF-CUR-05 | CTA principal conforme o estado: Visitante “Entrar para assistir”; Aluno “Começar o curso”, “Continuar” ou “Rever”, com barra de progresso quando matriculado. O botão “Fazer inscrição gratuita” da lateral executa a mesma ação | MVP |
| RF-CUR-06 | SEO: slug estável, título e descrição de página próprios por curso (o protótipo repete o mesmo título), Open Graph e dados estruturados (BreadcrumbList e Organization; o JSON-LD de Course pode ficar, mas o Google não exibe resultado rico de curso desde junho de 2025); renderização no servidor | MVP |
| RF-CUR-07 | Bloco “Sobre o autor” (nome, bio, foto) e “Este curso inclui” gerado a partir dos dados (horas de vídeo, nº de PDFs e áudios, acesso em celular, tablet e computador). O item de certificado só aparece se o recurso existir (DP-15) | MVP |
| RF-CUR-08 | Trailer opcional do curso: vídeo promocional público, carregado só após o clique (YouTube no MVP). A “Aula 01 grátis” do protótipo fica para o pós-MVP (DP-20) | MVP (trailer) e Pós-MVP (aula grátis) |
| RF-CUR-09 | “Copiar link” do curso e canal “Fale com a equipe pedagógica” (RF-INS-05) | MVP |
| RF-CUR-10 | Botão “Salvar” (assistir mais tarde) | Pós-MVP |

### 5.5 Aprendizagem (RF-APR)

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-APR-01 | Aula em vídeo: embed do YouTube pelo domínio sem cookies, carregado sob demanda, responsivo. A miniatura com play vem do nosso storage (RPV-15), não de `i.ytimg.com`, e nenhuma conexão com o YouTube é feita antes do clique: o domínio sem cookies ainda grava localStorage e IndexedDB quando o iframe carrega. A página da aula usa a interface `VideoPlayer` (eventos `progress`, `ended` e `error`); o adaptador do YouTube usa a IFrame API, e Mux ou Bunny entram como outro adaptador (RN-09). No MVP valem os controles nativos do player (velocidade, legendas, qualidade, tela cheia). A barra própria do protótipo (±10 s, “HD 1080p”) é referência para a fase Bunny ou Mux e não deve ser prometida | MVP |
| RF-APR-02 | Aula de leitura: PDF exibido na página com visualizador baseado em pdf.js (no iOS Safari, PDF em iframe mostra só a primeira página), botões “abrir em nova aba” e “baixar” (fallback para celular) | MVP |
| RF-APR-03 | Navegação livre: barra superior (“Voltar ao curso”, título, “Módulo 1 • Aula 2 de 9”, progresso geral), botões Anterior e Próxima, e lateral recolhível com módulos (“Recolher todos”) e o estado de cada aula (concluída, atual, pendente), sem bloqueio sequencial | MVP |
| RF-APR-04 | Marcar e desmarcar a aula como concluída manualmente (o protótipo tem dois botões iguais; basta um por aula) | MVP |
| RF-APR-05 | Materiais complementares da aula (título, tipo, tamanho): PDF e áudio MP3 (“Modo Podcast”), baixados por URL assinada. Limites sugeridos: PDF até 20 MB e áudio até 50 MB. O contador da aba reflete todos os itens. O link é a rota estável `/media/{id}`, que confere sessão e acesso e redireciona para uma URL assinada nova a cada pedido; o player e o visualizador tentam de novo uma vez ao receber 403, para que leituras longas e o avanço no áudio sobrevivam à expiração da URL | MVP |
| RF-APR-06 | Retomar na última aula acessada (“Continuar”) | MVP |
| RF-APR-07 | Erro de vídeo indisponível: mensagem amigável, evento `video_playback_error` e alerta à equipe | MVP |
| RF-APR-08 | Acessibilidade do player e do leitor: operação por teclado, legendas quando existirem | MVP |
| RF-APR-09 | Concluir automaticamente ao fim do vídeo (sinalizador desligado por padrão) | Pós-MVP |
| RF-APR-10 | Progresso gradual: salvar a posição em segundos a cada 15–30 s, na pausa e na saída | Pós-MVP (schema e endpoint prontos) |
| RF-APR-11 | Layout da aula de leitura: visualizador de PDF com a mesma barra superior, lateral e botão de concluir. O protótipo não tem essa tela | MVP (tela a criar) |
| RF-APR-12 | Aba “Anotações & Dúvidas”: anotações privadas por aula e por perfil, com salvamento automático. No MVP a aba fica oculta e as dúvidas seguem pelo canal da equipe (RF-INS-05) | Pós-MVP |

### 5.6 Progresso e Meus cursos (RF-PRG)

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-PRG-01 | A matrícula é criada, de forma idempotente, quando o aluno clica em “Começar o curso” ou “Fazer inscrição gratuita”, ou ao abrir a primeira aula | MVP |
| RF-PRG-02 | Barra de progresso do curso (concluídas ÷ publicadas), por perfil, exibida na página do curso, no player, em “Meus cursos”, nos cards do catálogo e nos cards de “Continue assistindo”. Persistida | MVP |
| RF-PRG-03 | Tela “Meus cursos” (inexistente no protótipo; o link do rodapé está sem destino), com abas “Em andamento” e “Concluídos”, ordenadas por último acesso, no perfil ativo. Atende também o “Histórico de cursos” e o contador “Cursos concluídos” da tela de perfil | MVP |
| RF-PRG-04 | O curso passa a concluído quando todas as aulas publicadas estão concluídas (RN-03) | MVP |
| RF-PRG-05 | Seção “Continue assistindo” na home logada, levando direto à aula de retomada | MVP |
| RF-PRG-06 | “Salvos” (assistir mais tarde) como entidade própria, independente da matrícula | Pós-MVP |
| RF-PRG-07 | Aviso “Nova aula disponível” em cursos concluídos que receberam conteúdo | Futuro |
| RF-PRG-08 | Link “Meus cursos” no cabeçalho do aluno logado (hoje o cabeçalho só tem Início, Quem Somos, Nossa Fé e Catálogo) | MVP |

### 5.7 Home e curadoria (RF-HOM)

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-HOM-01 | Home pública com os blocos do protótipo: carrossel “Cursos em destaque”, vitrine “Descubra sua trilha”, curso em destaque, “Mais populares” (ranking) e “Explore por categoria”, com layout, ordem e conteúdo definidos no código. Não há tela nem API para o admin gerenciar a home no MVP | MVP |
| RF-HOM-02 | Home logada: acrescenta a seção “Continue assistindo” (por perfil ativo) às seções definidas no código; o bloco e a variante logada ainda não existem no protótipo | MVP |
| RF-HOM-03 | Cada seção é definida no código por um critério (mais recentes, mais populares, por categoria ou lista fixa de slugs em arquivo de configuração versionado). Mudar a home exige deploy | MVP |
| RF-HOM-04 | A home respeita a restrição do perfil infantil (RN-04) | MVP |
| RF-HOM-05 | O caso de uso `getHome(escopo)` devolve as seções em formato estável (título, tipo, lista de cursos), independente de onde a configuração vem; a origem passa para o banco no futuro sem alterar o front. A rota HTTP `GET /api/home` só existe quando houver cliente externo (seção 9.6) | MVP |
| RF-HOM-06 | Cache da home pública com Cache Components (`'use cache'` com tags), invalidado ao publicar, despublicar ou arquivar um curso e pelo job diário de popularidade, não a cada deploy (seção 9.12) | MVP |
| RF-HOM-07 | Curadoria dinâmica pelo admin: seções e itens como dados, tela, reordenação e agendamento | Pós-MVP |
| RF-HOM-08 | Selos editoriais dos cards da home (“Em Destaque”, “Novo”, “Seleção da Equipe”) vêm da configuração no código; “Novo” pode ser calculado (curso publicado há menos de 30 dias). O selo “Recomendado” do protótipo é trocado, porque não há recomendação | MVP |
| RF-HOM-09 | Contadores e promessas de marketing (“Mais de 30 cursos”, “+1.400 membros ativos”, “HD 1080p”) só aparecem se forem calculados a partir dos dados ou comprovados; caso contrário, saem | MVP |

### 5.8 Backoffice e fluxo editorial (RF-ADM)

Implementa a ADR-001: backoffice próprio mínimo (C) e carga inicial por planilha (D).

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-ADM-01 | Lista de cursos com filtros por status e editor do curso | MVP |
| RF-ADM-02 | Formulário do curso: título, sinopse, descrição, capa, trailer (opcional), nível, categorias (uma principal), públicos-alvo, autores, “o que você vai aprender” e pré-requisitos | MVP |
| RF-ADM-03 | Editor de currículo: módulos e aulas, reordenação por arrastar, tipo da aula, URL do YouTube (o sistema extrai e valida o ID), duração do vídeo ou tempo estimado de leitura (`estimated_minutes`), miniatura da aula de vídeo (enviada pela equipe; na falta dela, a capa do curso) e upload do PDF e dos materiais direto do navegador para o storage, por URL assinada de envio | MVP |
| RF-ADM-04 | Estados do curso e transições (RN-01): o instrutor envia para aprovação; o admin aprova ou mantém em rascunho | MVP |
| RF-ADM-05 | Revisão simples: o admin abre a pré-visualização somente leitura e decide entre Aprovar (publica) e Manter em rascunho. Sem checklist, comentários ou edição na plataforma; o motivo é combinado fora dela. Ficam registrados o revisor, a decisão e a data. O instrutor não publica o próprio curso | MVP |
| RF-ADM-06 | Validações de publicação (RN-02) | MVP |
| RF-ADM-07 | Pré-visualização somente leitura, como o aluno vê, sem criar matrícula nem progresso e sem ações de edição; disponível ao editor do curso e, durante a revisão, ao admin | MVP |
| RF-ADM-08 | Carga inicial por planilha/CSV validada: cria cursos, módulos e aulas como rascunho e devolve relatório de erros por linha | MVP |
| RF-ADM-09 | Arquivar em vez de excluir aulas, módulos e cursos | MVP |
| RF-ADM-10 | Audit log das ações do backoffice (quem, o quê, quando, antes e depois) | MVP |
| RF-ADM-11 | Gestão da equipe (convites e papéis) e consulta e suspensão de contas de alunos | MVP |
| RF-ADM-12 | Painel de métricas básico: cadastros, matrículas, conclusões, cursos mais acessados e erros de vídeo, calculado por views SQL e pelo resumo diário de analytics no próprio Postgres, sem ferramenta externa | MVP |
| RF-ADM-13 | Job de verificação de disponibilidade dos vídeos publicados (ex.: endpoint oEmbed), com alerta | Pós-MVP |
| RF-ADM-14 | Autopreenchimento da duração do vídeo pela API do YouTube (com Mux, pelo webhook `video.asset.ready`, DP-23) | Pós-MVP |
| RF-ADM-15 | Telas de gestão de categorias, públicos-alvo e tags | Pós-MVP |
| RF-ADM-16 | Evolução do fluxo editorial: checklist, comentários e parecer na plataforma, notificações ao instrutor, vários revisores e edição de curso publicado por versão | Futuro |
| RF-ADM-17 | Cadastro de autores (nome de exibição, bio e foto), independente das contas de equipe, para autores coletivos como “Família IBAV” e casais, que não têm conta | MVP |

### 5.9 Páginas institucionais, legais e rodapé (RF-INS)

O protótipo tem duas páginas institucionais e vários links de rodapé que os requisitos anteriores não cobriam.

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RF-INS-01 | Página “Quem Somos”: história, missão e visão, seis princípios, localização com endereço, horários de culto e link para o Google Maps. Conteúdo estático versionado no código | MVP |
| RF-INS-02 | Página “Nossa Fé”: oito doutrinas em acordeão com referências bíblicas e versículos-guia. Os links “Declaração de Fé”, “Confissão de Fé”, “Declaração Doutrinária” e “Visão Doutrinária” apontam para ela | MVP |
| RF-INS-03 | Cabeçalho único (Início, Quem Somos, Nossa Fé, Catálogo; visitante: Entrar e Criar conta; logado: perfil ativo, Meu perfil, Meus cursos e Sair; menu mobile) e rodapé único, no lugar das cinco variantes do protótipo, com navegação, endereço, Termos de Uso, Política de Privacidade e Fale Conosco | MVP |
| RF-INS-04 | Páginas “Termos de Uso” e “Política de Privacidade”, versionadas (RPV-05 e RPV-07), linkadas no cadastro e no rodapé. No protótipo todos esses links estão sem destino | MVP |
| RF-INS-05 | Canal de contato (“Fale Conosco”, “Suporte ao Aluno”, “equipe pastoral” e “equipe pedagógica”): no MVP, um único e-mail ou WhatsApp institucional ou formulário externo, sem fórum nem tíquetes (DP-16 e DP-22) | MVP |
| RF-INS-06 | Páginas “Dúvidas Frequentes” (linkada no cadastro) e “Sobre o Ministério” | Pós-MVP |
| RF-INS-07 | Páginas de erro: 404, acesso negado e manutenção | MVP |
| RF-INS-08 | “Área de Membros” (link do rodapé sem definição) | Futuro (DP-17) |

## 6. Regras de negócio

| ID | Regra |
| --- | --- |
| RN-01 | **Ciclo de vida do curso:** `rascunho` → `em revisão` → `publicado` → `arquivado`. O editor do curso o envia para aprovação quando ele cumpre a RN-02. Na revisão, o admin só abre a pré-visualização somente leitura e escolhe **Aprovar** (publica) ou **Manter em rascunho** (volta a `rascunho`, sem comentários na plataforma; o motivo é combinado fora dela). Em curso `publicado`, **Manter em rascunho** retira o curso do ar para correções. `arquivado` some do catálogo, da home e da busca; quem já está matriculado mantém acesso em “Meus cursos”, com aviso. Só o admin aprova, mantém em rascunho e arquiva. Cada envio gera um registro de revisão (revisor, decisão e data) |
| RN-02 | **Pré-requisitos para enviar para aprovação:** título, sinopse, descrição, capa, ao menos 1 categoria (uma principal), ao menos 1 público-alvo, ao menos 1 autor (RN-18; na v2.3, “instrutor”), ao menos 1 módulo e 1 aula, e todas as aulas completas (vídeo com provedor, ID e duração; leitura com PDF anexado e tempo estimado de leitura, `estimated_minutes`). A publicação exige ainda a aprovação do admin (RN-01) |
| RN-03 | **Conclusão:** o status fica materializado na matrícula. Ao marcar uma aula, se todas as aulas publicadas estiverem concluídas, o curso vira concluído e grava `completed_at` (e `first_completed_at` na primeira vez). Ao desmarcar uma aula de um curso concluído, ele volta a em andamento. O status só é recalculado por ação do aluno, nunca por edição do curso (RN-05) |
| RN-04 | **Perfil infantil e acesso:** (a) ao criar o perfil, o titular define se ele é infantil; (b) perfil infantil é para menores até a idade limite legal (`child_profile_max_age`; 16, a confirmar em DP-02); (c) perfil infantil só vê cursos com ao menos um público-alvo marcado como permitido para crianças (`allowed_for_child`; inicialmente Infantil e Jovens); (d) perfil padrão vê o catálogo completo; (e) o filtro de faixa etária do catálogo (RF-CAT-05) é só um filtro de busca; (f) nenhuma idade autodeclarada é usada para restringir conteúdo. Pendente de validação (DP-02 e DP-03) |
| RN-05 | **Disponibilização:** o curso tem `release_mode` `full` (MVP) ou `incremental` (futuro). No MVP, é publicado com todas as aulas. A aula tem `status` e `published_at` próprios, então liberar aulas depois não exige mudar o schema. Curso `publicado` é bloqueado para edição: para alterar, o admin o devolve a `rascunho`, o instrutor edita e reenvia para aprovação (edição por versão, sem tirar o curso do ar, fica para o futuro; DP-14). Aulas e módulos nunca são apagados, só arquivados. Nova aula não reabre matrículas concluídas (`on_new_lesson = keep_completed`); matrículas em andamento passam a refletir o novo total. A correção de textos sem despublicar foi avaliada na v2.3 e fica para depois do MVP (DP-14) |
| RN-07 | **Popularidade:** número de novas matrículas nos últimos 30 dias, calculado por job diário e gravado em `course_stats`; desempate pela data de publicação. A ordenação nunca agrega ao vivo |
| RN-08 | **Formato (derivado):** Curso se todas as aulas são de vídeo, Estudo se todas são de leitura, Conteúdo Misto nos demais casos (rótulos do protótipo: Curso, Estudo e Conteúdo Misto). Materiais complementares não contam. Recalculado ao alterar o currículo e gravado em coluna indexada |
| RN-09 | **Vídeo por provedor:** todo vídeo, de aula ou trailer, é um registro em `videos` com `provider` (`youtube` no MVP, depois `mux` ou `bunny`) e `external_id`; aulas e cursos apontam para esse registro, nunca para uma URL. A URL de embed é gerada pelo adaptador do provedor. IDs de aula, matrícula e progresso não dependem do provedor, então a migração é um script que troca `provider` e `external_id` em `videos`, vídeo a vídeo, sem tocar no resto. Vídeos do YouTube ficam em canal institucional (decidido em 17/11/2026, DP-23) |
| RN-10 | **Totais derivados** (duração, nº de vídeos, de leituras e de materiais) são calculados a partir das aulas publicadas e guardados na publicação. Nunca são digitados. A duração de uma aula de vídeo é a do seu vídeo (`videos.duration_seconds`), e a de uma aula de leitura é o seu `estimated_minutes`; uma única função pura calcula as duas (v2.4) |
| RN-11 | **Progresso:** a fonte da verdade é `lesson_progress` por perfil. Percentual = aulas concluídas ÷ aulas publicadas (versão ponderada por duração: futuro) |
| RN-12 | **Telefone:** pertence à conta. Finalidades: segurança e recuperação da conta, verificação do responsável e comunicações operacionais. Uso em marketing exige consentimento específico e separado. Nunca é exibido a terceiros e é mascarado em telas e logs |
| RN-13 | **Categorias:** lista fechada; cada curso tem de 1 a 3 (limite configurável), uma delas principal |
| RN-14 | **Tags/pílulas (futuro):** vocabulário fechado, criado só pelo admin, N:N com o curso, com limite máximo por curso (sugestão: 5) validado no servidor |
| RN-15 | **Exclusão:** não há exclusão self-service no MVP. O titular pede a exclusão da conta ou de perfis ao encarregado (direito do titular, LGPD art. 18) e a equipe a executa dentro do prazo legal, removendo perfis, progresso e matrículas. Dados agregados e anonimizados de analytics permanecem |
| RN-16 | Nível: vocabulário fechado (Iniciante, Intermediário, Avançado e Todos os níveis), obrigatório no curso e exibido nos cards e na página do curso |
| RN-17 | Público-alvo exibido: quando o curso tem todos os públicos, o rótulo é “Todas as idades”. Os rótulos seguem o protótipo (Jovens, Adultos, 60+) mais Infantil e Jovens+ (DP-06). “Todos os níveis” é nível, não público |
| RN-18 | Autor e conta: o autor exibido no curso (ex.: “Pr. Marcos Vieira”, “Ana e Paulo Mendes”, “Família IBAV”) é um cadastro próprio e pode não ter conta. Quem edita o curso é uma conta de equipe ligada a ele (RBAC) |

## 7. Dados pessoais, menores e dados sensíveis

Esta seção organiza requisitos de conformidade e não é parecer jurídico. A validação com o jurídico e o encarregado (DPO) é pré-requisito para fechar as telas de conta e perfil.

### 7.1 Menores e ECA Digital

Pelo que está publicado em fontes jurídicas e na imprensa, a Lei 15.211/2025 (ECA Digital) está em vigor desde 17/03/2026 e é fiscalizada pela ANPD. Pontos relevantes: aplica-se a serviços de tecnologia de acesso provável por crianças e adolescentes; contas de até 16 anos devem estar vinculadas à conta de um responsável legal, com ferramentas de supervisão; a autodeclaração de idade é vedada como mecanismo para impedir o acesso de menores a conteúdo impróprio; dados coletados para verificar idade só podem servir a essa finalidade; há restrições a publicidade e a perfilamento voltados a menores. Atualização da v2.3: segundo resumos de escritórios de advocacia, o Decreto 12.880/2026 regulamentou a lei. Ele veda a mera autodeclaração como verificação de idade e dispensa a aferição de idade em serviços com controle editorial que oferecem conta infantil com conteúdo adequado e supervisão parental com sistema de bloqueio. Com o PIN do titular, que entra no MVP (RF-PRF-11, DP-13), a plataforma passa a ter esse sistema de bloqueio. O texto do decreto e as orientações da ANPD precisam ser lidos e confirmados pelo jurídico antes do lançamento.

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RPV-01 | Contas são só de adultos. Menores usam perfis infantis vinculados ao titular (ADR-004): o titular cria e edita os perfis e acompanha o progresso deles | MVP |
| RPV-03 | Perfis infantis sem interação social, mensagens ou conteúdo gerado por usuários | MVP |
| RPV-04 | Consentimento do responsável, de forma simples: ao criar o primeiro perfil infantil, o titular marca uma declaração de que é o responsável legal e autoriza o uso. O sistema registra texto, versão, data e conta. Verificação adicional (OTP por telefone ou outra) conforme DP-05 | MVP |
| RPV-05 | Política de privacidade com versão em linguagem simples para o responsável e para crianças | MVP |
| RPV-06 | Minimização: coletar na conta só e-mail, senha, nome e telefone (finalidades da RN-12) e, no perfil, nome, avatar e tipo (padrão ou infantil) | MVP |

### 7.2 Privacidade e segurança dos dados

A LGPD classifica convicção religiosa como dado pessoal sensível (art. 5º, II), com hipóteses legais mais restritas (art. 11). Como não há recomendações nem personalização por preferência, o risco principal é o histórico de estudo e a matrícula numa plataforma evangélica, que ainda podem permitir inferir a crença. Os requisitos abaixo valem também por causa dos menores e dos operadores contratados e ficam sujeitos à análise do jurídico. O protótipo reforça o ponto: o perfil exibe “Membro & Aluno IBAV” e o rodapé cita “Área de Membros”, o que indicaria vínculo religioso explícito (DP-17).

| ID | Requisito | Prioridade |
| --- | --- | --- |
| RPV-07 | Definir com o jurídico a base legal do tratamento e o texto do aceite no cadastro, considerando que o histórico de estudo pode indicar convicção religiosa | MVP |
| RPV-08 | Sem publicidade nem SDKs de rastreamento de terceiros, e nenhum compartilhamento de dados de uso além dos operadores contratados. O embed do YouTube só carrega após o clique (RF-APR-01) | MVP |
| RPV-09 | Analytics first-party com identificadores pseudonimizados; nenhum e-mail, telefone ou nome em eventos e logs | MVP |
| RPV-10 | Criptografia em trânsito e em repouso. O acesso do admin a dados de alunos é restrito por permissão e registrado no audit log | MVP |
| RPV-11 | Relatório de Impacto à Proteção de Dados (RIPD) elaborado antes do lançamento e encarregado (DPO) designado, com canal publicado. O RIPD inclui o registro de segurança, que guarda IP (RNF-SEG-15) | MVP |
| RPV-12 | Operadores (autenticação, e-mail, SMS, hospedagem) com contrato de tratamento de dados; preferência por região Brasil e avaliação de transferência internacional (art. 33) quando não houver. Os operadores e regiões do desenho da v2.3 estão na seção 9.12.10; os backups do banco ficam fora do Brasil, criptografados antes do envio, e entram na avaliação | MVP |
| RPV-13 | Retenção: política de contas inativas (sugestão: aviso e anonimização após 24 meses sem acesso, a validar) e exclusão a pedido (RF-AUT-09) | MVP |
| RPV-14 | Cookies: apenas essenciais por padrão; qualquer cookie não essencial exige consentimento prévio | MVP |
| RPV-15 | Nenhuma página carrega fontes, ícones, imagens ou scripts de terceiros: tudo é servido pelo próprio domínio ou pela CDN contratada. O protótipo hoje usa Google Fonts, Material Symbols e 15 imagens do googleusercontent.com. Única exceção: o player do YouTube e a sua IFrame API, carregados só depois do clique (RPV-08) | MVP |

## 8. Requisitos não funcionais

Todos os itens desta seção fazem parte do MVP, conforme a decisão D-07. Os valores numéricos são metas iniciais, calibradas após o teste de carga e o baseline.

### 8.1 Desempenho e escalabilidade

| ID | Requisito |
| --- | --- |
| RNF-PER-01 | API de leitura com p95 ≤ 300 ms e p99 ≤ 1 s, medidos no servidor |
| RNF-PER-02 | Catálogo e busca com p95 ≤ 500 ms |
| RNF-PER-03 | Web vitals (p75, 4G): LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 |
| RNF-PER-04 | Capacidade de 150 usuários simultâneos (3× a P-01) sem degradação, comprovada por teste de carga (k6) no staging antes do lançamento. O teste consome cota dos planos gratuitos: rodar uma vez, com o relatório de capacidade (RNF-CAP) acompanhando |
| RNF-PER-05 | Aplicação sem estado na memória do processo (sessão, rate limit e contadores no banco; cache de dados no cache do Next), com escala horizontal pela hospedagem e conexões ao banco pelo pooler em modo transação |
| RNF-PER-06 | CDN da hospedagem para assets e páginas públicas (shell estático), com cache por tags invalidado ao publicar, despublicar ou arquivar um curso (seção 9.12.2); capas e imagens servidas pelo storage num subdomínio próprio |
| RNF-PER-07 | Imagens otimizadas (AVIF e WebP) em tamanhos responsivos, geradas uma vez no upload e servidas do storage, sem consumir a cota de otimização de imagens da hospedagem |
| RNF-PER-08 | Escritas de progresso idempotentes e com rate limit |

### 8.2 Disponibilidade e resiliência

| ID | Requisito |
| --- | --- |
| RNF-DIS-01 | SLO de disponibilidade de 99,5% por mês (cerca de 3 h 36 min de indisponibilidade), como meta medida pelo monitoramento de disponibilidade (RNF-OBS-07). Os planos gratuitos não têm SLA contratual: uma queda do provedor não gera compensação |
| RNF-DIS-02 | Degradação graciosa: se o analytics ou a seção “Continue assistindo” falharem, a home e o player continuam funcionando |
| RNF-DIS-03 | Timeouts, retries com backoff e idempotência nas integrações (e-mail, SMS, storage) |
| RNF-DIS-04 | Health check (`/api/health`, com consulta ao banco) e deploy atômico da hospedagem com rollback instantâneo. Migrations compatíveis com a versão anterior do código (expandir antes, contrair depois), aplicadas antes do deploy |
| RNF-DIS-05 | Backup lógico do banco (`pg_dump`) toda noite e antes de cada migration, criptografado antes do envio e guardado fora do provedor do banco por 30 dias. RPO ≤ 24 h (D-11) e RTO ≤ 4 h, com teste de restauração trimestral num Postgres limpo, que serve também de ensaio de migração (ADR-009). A recuperação ponto-no-tempo volta por gatilho (seção 9.13) |
| RNF-DIS-06 | Arquivos imutáveis no storage: cada envio grava uma chave nova, nada é sobrescrito, e a remoção é só por arquivamento, com limpeza de arquivos órfãos após 30 dias. O versionamento nativo do R2 não foi confirmado; o original de cada PDF e áudio também fica com a equipe de conteúdo |

### 8.3 Observabilidade (logs, métricas, traces e alertas)

| ID | Requisito |
| --- | --- |
| RNF-OBS-01 | **Logs estruturados (JSON)** com nível, `request_id` ou `trace_id`, versão do release e identificador pseudonimizado do perfil. É proibido registrar e-mail, telefone, nome, senha, tokens e corpos de requisição com dados pessoais. Centralizados e pesquisáveis no Axiom, com 30 dias de retenção (limite do plano gratuito; o arquivamento por 90 dias sai do MVP, DP-11) |
| RNF-OBS-02 | **Métricas RED** (taxa, erros e duração) por endpoint e **métricas USE** da infraestrutura: CPU, memória, conexões e latência do banco, filas e jobs. No MVP: RED por rota a partir dos traces no Axiom e métricas do banco pelo painel do Supabase; os painéis USE completos vêm depois do baseline |
| RNF-OBS-03 | **Métricas técnicas de negócio:** sucesso de login, e-mails de verificação e reset enviados e entregues, matrículas criadas, aulas concluídas por minuto e erros de vídeo por curso |
| RNF-OBS-04 | **Tracing distribuído** (OpenTelemetry pelo `instrumentation.ts`, exportado por OTLP ao Axiom) em requisições e consultas ao banco, com amostragem, correlacionado aos logs |
| RNF-OBS-05 | **Rastreamento de erros** no front e no back (Sentry, região UE), com release associada e remoção automática de dados pessoais |
| RNF-OBS-06 | **Alertas**, em duas etapas. No dia 1: site fora do ar, falha ou atraso de job (backup, job diário, relatório de capacidade), falha de entrega de e-mail, erro novo no Sentry e capacidade dos provedores (RNF-CAP). Depois de 4 semanas de baseline: alertas por consumo do orçamento de erro (taxa de 5xx e latência p95); antes disso, com pouco tráfego, eles viram ruído. Cada alerta tem responsável, canal e runbook |
| RNF-OBS-07 | **Monitoramento sintético:** disponibilidade a cada 3 min (home e `/api/health`, pelo Better Stack) e fluxos críticos completos com Playwright no GitHub Actions a cada 6 h e após cada deploy: home, login, abrir curso e marcar aula concluída em produção, com uma conta sintética excluída das métricas, e recuperação de senha no staging. Uma queda total aparece em até 3 min; um defeito só num fluxo pode levar até 6 h para aparecer |
| RNF-OBS-08 | **Dashboards:** saúde do serviço e jobs (Axiom), funil de produto (painel do admin, RF-ADM-12), vídeo, e capacidade e custo (relatório de capacidade, RNF-CAP) |
| RNF-OBS-09 | **Runbooks** para os incidentes mais prováveis (banco lento, falha de e-mail, provedor de autenticação fora, vídeo quebrado, deploy com erro) e post-mortem sem culpados para incidentes relevantes |
| RNF-OBS-10 | **Audit log** append-only para ações do backoffice e para acessos do admin a dados de alunos |

### 8.4 Analytics de produto

Coleta first-party, sem SDK de publicidade, com eventos de schema versionado e identificador pseudonimizado (RPV-09). Eventos críticos são gravados no servidor e visualizações, no cliente. O texto do termo de busca é guardado apenas quando a busca não retorna resultado, sem vínculo ao perfil.

| Evento | Propriedades principais |
| --- | --- |
| `signup_completed` | método de cadastro |
| `email_verified` | — |
| `profile_created` | tipo (padrão ou infantil) |
| `catalog_viewed` | filtros usados, ordenação e nº de resultados |
| `search_performed` | tamanho do termo e se houve resultado |
| `course_viewed` | curso e origem (home, busca, link) |
| `enrollment_created` | curso |
| `lesson_started` | curso, aula e tipo |
| `lesson_completed` e `lesson_uncompleted` | curso e aula |
| `course_completed` | curso e dias desde a matrícula |
| `video_playback_error` | curso, aula e provedor |
| `home_section_clicked` | seção e posição |
| `password_reset_requested` | — |

### 8.5 Segurança

| ID | Requisito |
| --- | --- |
| RNF-SEG-01 | OWASP ASVS nível 1 como base e nível 2 para autenticação e backoffice, exceto o MFA, que fica para o pós-MVP (RF-AUT-08) |
| RNF-SEG-02 | TLS 1.2 ou superior com HSTS, cabeçalhos de segurança e CSP, e proteção contra CSRF, XSS e injeção. No MVP, CSP sem nonce com as demais diretivas restritas (ADR-010), mais as defesas da RNF-SEG-12 |
| RNF-SEG-03 | Rate limiting em login, reset, cadastro, busca e escrita de progresso: o do Better Auth com armazenamento no banco e, nas demais rotas, contador no banco. Nunca em memória, que não vale entre instâncias |
| RNF-SEG-04 | Upload validado por tipo real, tamanho e nome; URLs assinadas com TTL curto (5 a 15 min) |
| RNF-SEG-05 | Segredos nas variáveis de ambiente cifradas da hospedagem e nos secrets do GitHub Actions, com cópia mestra num gerenciador de senhas do responsável técnico (DP-26); nunca no repositório. Menor privilégio no banco (papel da aplicação sem DDL, papel separado para migrations, papel só de leitura para o relatório de capacidade) e no storage (uma chave por bucket; a do bucket de backups não lê os buckets de conteúdo) |
| RNF-SEG-06 | Varredura de dependências (`pnpm audit` e Renovate) e de segredos (gitleaks) no CI, com atualização regular. Versões do Better Auth fixadas e atualizadas a cada correção de segurança |
| RNF-SEG-07 | Autorização verificada no servidor em toda rota (papéis e posse do perfil): um titular nunca acessa perfis de outra conta |
| RNF-SEG-08 | Revisão de segurança antes do lançamento: checklist do OWASP ASVS (RNF-SEG-01), revisão de segurança do código, varredura OWASP ZAP baseline no CI e testes de autorização com três usuários (dono, outro usuário do mesmo papel e anônimo). O teste de invasão feito por terceiro volta quando houver orçamento ou dados mais sensíveis (por exemplo, pagamentos) |
| RNF-SEG-09 | Sessão por cookie httpOnly, Secure e SameSite; nenhum token em localStorage. O protótipo usa localStorage (ibav:session) só para simular o login |
| RNF-SEG-10 | **Contas técnicas e credenciais** (DP-27). Vale só para as contas do desenvolvedor nos provedores (GitHub, Vercel, Supabase, Cloudflare, Resend, Sentry, Axiom, Better Stack), não para os usuários da plataforma. Verificação em duas etapas ativada nas configurações de cada provedor, sem código nem custo (o GitHub já a exige de quem publica código); códigos de recuperação no gerenciador de senhas; tokens de API com o menor escopo possível, um por uso e com validade quando o provedor permitir; runbook de rotação de segredos |
| RNF-SEG-11 | **Cabeçalhos de segurança** em todas as respostas, verificados por teste automatizado: HSTS (2 anos, `includeSubDomains`; `preload` depois que o domínio estabilizar), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` negando câmera, microfone e geolocalização, e `Cross-Origin-Opener-Policy: same-origin` |
| RNF-SEG-12 | **Defesas contra XSS além da CSP:** `dangerouslySetInnerHTML` proibido (erro de lint); textos ricos (descrição do curso, “O que você vai aprender”) em Markdown restrito, renderizado por componentes React, sem HTML cru; links aceitos só com `https:` ou caminho relativo; nenhum script de terceiros (RPV-15) |
| RNF-SEG-13 | **Código e repositório público** (DP-24): ruleset na `main` (PR obrigatório, CI verde, sem force push); varredura de segredos com bloqueio no push, mais gitleaks no CI; CodeQL em todo PR; Dependabot; relato privado de vulnerabilidades (`SECURITY.md`). Workflows com `permissions` mínimas, actions fixadas por SHA e sem `pull_request_target`. Logs e resumos de job nunca imprimem dados pessoais nem segredos, e issues e PRs não descrevem vulnerabilidades ainda abertas |
| RNF-SEG-14 | **Dados:** conexões ao banco só com TLS; dados reais de produção nunca vão para desenvolvimento, CI ou staging (RNF-QUA-02), nem para cópias locais fora do runbook de restauração; as chaves de cifra (backups, HMAC do analytics, segredo do Better Auth) são separadas entre si e ficam fora do banco e do repositório |
| RNF-SEG-15 | **Registro de segurança** (v2.4). Uma tabela própria no Postgres (`security_events`) guarda, para investigar incidentes e ataques: login com sucesso e com falha, pedido e conclusão de reset de senha, bloqueio por rate limit (uma vez por janela de contagem, para que um ataque não esgote a cota do banco), bloqueio do PIN, login de conta de equipe e recusas de autorização vindas de sessão autenticada (seção 4). Cada linha tem horário, evento, conta (se houver), IP completo e user agent. O IP completo permite bloquear um atacante no firewall da Vercel ou da Cloudflare; um hash só permitiria correlacionar. É o único lugar que guarda o IP: a sessão, os logs da aplicação e a interface não o têm. Ninguém o lê pela interface; numa investigação, o responsável técnico consulta por SQL, com um papel só de leitura. Retenção de 6 meses, apagada pelo job diário, a confirmar pelo jurídico (DP-11); os eventos de uma conta excluída seguem o mesmo prazo. Entra no RIPD (RPV-11) |

### 8.6 Acessibilidade e usabilidade

| ID | Requisito |
| --- | --- |
| RNF-UX-01 | WCAG 2.1 nível AA |
| RNF-UX-02 | Duas últimas versões de Chrome, Edge, Firefox e Safari, mais iOS Safari e Chrome Android; layout responsivo a partir de 360 px |
| RNF-UX-03 | pt-BR com textos externalizados |
| RNF-UX-04 | Linguagem simples nas telas de responsável e de criança; mensagens de erro acolhedoras e acionáveis |
| RNF-UX-05 | Design system único, baseado nos tokens do docs/DESIGN.md, no lugar de uma configuração do Tailwind por página (hoje as cores primárias e as superfícies mudam de tela para tela), com cabeçalho e rodapé únicos |

### 8.7 Qualidade e entrega

| ID | Requisito |
| --- | --- |
| RNF-QUA-01 | CI/CD com testes automatizados: unitários nas regras (progresso, conclusão, formato, restrição do perfil infantil), de integração nos fluxos críticos e E2E dos 5 fluxos principais (cadastro, login, catálogo, assistir e concluir, publicar curso) |
| RNF-QUA-02 | Ambientes dev (Postgres local em container), staging (segundo projeto do Supabase Free, usado pelos previews da Vercel) e produção; staging só com dados fictícios, nunca dados reais de menores |
| RNF-QUA-03 | Migrações de banco versionadas (SQL gerado pelo drizzle-kit), compatíveis com a versão anterior do código e precedidas de backup; reverter é uma nova migration ou a restauração do backup. Feature flags como configuração no código (variáveis de ambiente) para recursos desligados |
| RNF-QUA-04 | Deploy automatizado com rollback: o GitHub Actions faz backup, aplica as migrations e só então publica em produção. A configuração dos provedores fica documentada em runbook, com `.env.example` completo; infraestrutura como código fica fora do MVP |
| RNF-QUA-05 | Documentação mínima: README, ADRs, runbooks e dicionário de dados |

### 8.8 Dados

| ID | Requisito |
| --- | --- |
| RNF-DAD-01 | UUIDs (v7, gerados na aplicação) como chaves e horários em UTC; exclusão lógica onde houver histórico (aulas e cursos) e remoção física para dados pessoais (RN-15) |
| RNF-DAD-02 | Operações de matrícula e conclusão transacionais e idempotentes |
| RNF-DAD-03 | Índices para os filtros do catálogo, para a busca (trigram sobre a coluna `courses.search_text`, em minúsculas e sem acentos, normalizada pela aplicação e recalculada sempre que muda o título do curso ou o nome de um autor ligado a ele; ADR-005) e para as consultas de “Meus cursos” |
| RNF-DAD-04 | O banco é um Postgres comum: tabelas da aplicação no schema `app`, só a extensão padrão `pg_trgm` (o `unaccent` saiu na v2.4, porque a normalização da busca é da aplicação; ADR-005) e nenhum recurso específico do Supabase (Auth, Storage, RLS, Realtime, Edge Functions, Data API), para que trocar de provedor seja dump e restauração (ADR-009) |
| RNF-DAD-05 | Analytics no próprio Postgres: eventos brutos guardados por 90 dias e resumo diário mantido, para caber na cota do banco (seção 9.13) |

### 8.9 Capacidade dos provedores e custos (RNF-CAP)

Os planos gratuitos param o serviço quando uma cota estoura (alerta 1.2). Estes requisitos garantem que o upgrade aconteça antes do teto, com tempo para decidir. O desenho está na seção 9.13.

| ID | Requisito |
| --- | --- |
| RNF-CAP-01 | **Inventário de cotas** versionado no repositório (`ops/capacity.json`): para cada provedor e métrica, o limite do plano atual, a unidade, a janela (dia, mês do ciclo ou últimos 30 dias), o nível de aviso (70%) e o crítico (90%), como é medida e qual é o upgrade. Trocar de plano é atualizar esse arquivo |
| RNF-CAP-02 | **Relatório de capacidade diário e automático:** coleta o uso de cada métrica por API ou SQL, calcula o percentual e a projeção para o fim da janela e publica a tabela no resumo do job |
| RNF-CAP-03 | **Alerta antes do teto:** métrica acima de 70%, ou com projeção acima de 100% no fim da janela, abre ou atualiza uma issue com o rótulo `capacity` no GitHub. Acima de 90%, a issue vira crítica e o upgrade é feito no mesmo dia. A issue fecha sozinha quando a métrica volta abaixo do aviso |
| RNF-CAP-04 | **O relatório vigia também a operação:** idade do último backup (crítico acima de 26 h) e a própria execução, por heartbeat no Better Stack. Se o job parar de rodar, o alerta chega do mesmo jeito |
| RNF-CAP-05 | **Revisão mensal:** no dia 1 de cada mês, uma issue traz o relatório do mês e a lista das métricas sem API, conferidas à mão no painel do provedor |
| RNF-CAP-06 | **Runbook por gatilho de upgrade**, com o passo a passo, o custo e o efeito esperado (seção 9.13) |

## 9. Arquitetura e decisões

### 9.1 Visão geral

Monólito modular num único app Next.js, com casos de uso primeiro (seção 9.6) e serviços gerenciados em planos gratuitos (ADR-007). Não há microsserviços nem API REST separada: a carga de referência (P-01) e a equipe (um desenvolvedor) não justificam. A v2.2 separava “Web” e “API”; manter os dois dobraria o trabalho sem ganho no MVP.

```
Navegador ──► Vercel Hobby (CDN + funções em gru1, São Paulo)
               └─ Next.js 16.4, um único deploy
                   ├─ (public)  home, catálogo, curso, institucionais → shell estático + 'use cache'
                   ├─ (app)     aula, Meus cursos, perfis → sob demanda, pelo perfil ativo
                   ├─ (admin)   backoffice
                   ├─ api/      auth, /media/{id}, health, jobs (só o que não é React)
                   └─ módulos: auth · catalog · learning · editorial · home · analytics · audit
                        │
   Supabase Free (São Paulo): só Postgres 17, schema app, pelo pooler ◄── Better Auth (tabelas no mesmo banco)
   Cloudflare R2: capas e imagens (públicas), PDFs e MP3 (URL assinada), backups do banco (criptografados)
   Resend: e-mail transacional · YouTube: vídeo, só depois do clique (Mux por gatilho, DP-23)
   Sentry: erros · Axiom: logs e traces (OTLP) · Better Stack: disponibilidade e heartbeats
   GitHub Actions: CI, backup → migrations → deploy, backup noturno, fluxos sintéticos, relatório de capacidade
```

**Stack**

| Camada | Escolha | Observação |
| --- | --- | --- |
| Framework | Next.js 16.4 (App Router, Cache Components, React Compiler, `partialPrefetching`), TypeScript estrito, pnpm | ADR-006 |
| Interface | Tailwind CSS v4 (`@theme` com os tokens do DESIGN.md), shadcn/ui com Radix (escolhido em 17/11/2026: os modelos conhecem muito mais código shadcn com Radix, então erram menos), lucide, `next/font` (Epilogue e Plus Jakarta Sans servidas pelo próprio domínio), Embla nos carrosséis, dnd-kit no editor de currículo | Tema único (RNF-UX-05) e nenhum terceiro no front (RPV-15) |
| Validação e textos | Zod 4; next-intl com um único locale (pt-BR) | P-02 e RNF-UX-03 |
| Banco | Postgres 17 no Supabase Free (São Paulo), usado só como Postgres | ADR-007 e RNF-DAD-04 |
| ORM e migrations | Drizzle ORM 0.45.x fixado e drizzle-kit (migrations em SQL versionado) | A versão 1.0 ainda é RC, com mudanças incompatíveis |
| Autenticação | Better Auth (plugin `admin`; rate limit no banco). O plugin `twoFactor` entra no pós-MVP | ADR-008 |
| Arquivos | Cloudflare R2 pela API S3 | ADR-002; sem custo de saída de dados |
| E-mail | Resend + React Email | Plano gratuito: 100 por dia e 3.000 por mês |
| Vídeo | YouTube (domínio sem cookies, só depois do clique) atrás da interface `VideoPlayer`, com o provedor guardado em cada vídeo | D-09 e DP-23; Mux por gatilho (seção 9.13) |
| PDF | pdf.js (react-pdf) | RF-APR-02 |
| Observabilidade | OpenTelemetry (`@vercel/otel`) para o Axiom; Sentry (região UE); Better Stack | Seção 9.12.8 |
| Testes | Vitest, Playwright + axe, k6 | RNF-QUA-01 e RNF-PER-04 |
| CI/CD e jobs | GitHub Actions; Vercel (deploy e um cron diário) | Seção 9.12.9 |

### 9.2 ADRs aceitos

Desde a v2.4, cada ADR vive num arquivo de `docs/adr/` (`0001-…` a `0010-…`), com status e o ponteiro para a seção deste documento de onde veio. Em caso de divergência, vale o arquivo.

| ADR | Decisão | Consequências para esta versão |
| --- | --- | --- |
| ADR-001 | Backoffice próprio mínimo (C) com carga inicial por planilha (D) | Quatro telas mínimas (lista, formulário do curso, editor de currículo, pré-visualização com aprovação) e um importador CSV. O fluxo editorial inclui revisão e aprovação (RF-ADM-04 e 05). Categorias por seed |
| ADR-002 | PDFs e materiais em object storage com URL assinada, metadados no banco | `source = storage` ou `external_url`; o Drive só como contingência. TTL curto e visualizador com fallback para celular. Na v2.3: Cloudflare R2, com acesso pela rota estável `/media/{id}` (RF-APR-05) |
| ADR-003 | Autenticação gerenciada. **Substituída na v2.3 pela ADR-008** (Better Auth na própria aplicação) | Continuam valendo: papéis no banco e e-mail transacional com SPF, DKIM e DMARC. O MFA para admin passou para o pós-MVP (RF-AUT-08). OTP por telefone depende do provedor de SMS (DP-05) |
| ADR-004 | Aceita em 05/11/2026 | Seção 9.3 |
| ADR-005 | Aceita na v2.4 (18/11/2026) | Seção 9.4 |
| ADR-006 a 010 | Aceitas na v2.3 (17/11/2026) | Seções 9.7 a 9.11 |

### 9.3 ADR-004 (aceita): identidade em conta e perfis

**Status:** Aceito pelo produto em 05/11/2026; limite de idade e consentimento pendentes de validação jurídica (DP-02 e DP-05).

**Contexto.** Crianças usarão a plataforma e, segundo as fontes consultadas, o ECA Digital exige que contas de até 16 anos estejam vinculadas a um responsável legal. Progresso e tipo de perfil (padrão ou infantil) são atributos da pessoa que assiste, não do titular da conta.

| Opção | Complexidade | Principal risco |
| --- | --- | --- |
| A. Uma conta por pessoa, inclusive a criança (cadastro autônomo) | Baixa | Conflita com o vínculo ao responsável; difícil de supervisionar; faixa etária autodeclarada pela própria criança |
| B. Conta do titular adulto com perfis (recomendada) | Média | Muda o modelo: matrículas e progresso por `profile_id`; o menor não tem login próprio |
| C. Contas individuais de menores vinculadas à conta do responsável | Alta | Dois logins, convites e painel de supervisão; mais aderente ao texto literal, porém pesado para o MVP |

**Decisão:** B. Tudo o que é do aluno (matrícula, progresso, salvos) é chaveado por `profile_id` desde já, o que mantém aberta a evolução para C sem migrar dados.

**Consequências.** O acompanhamento pelo responsável e a classificação confiável do perfil como infantil (definida por ele) vêm quase de graça, e a experiência “Quem está assistindo?” combina com o estilo Netflix. Em troca, há mais telas (gestão de perfis) e a autenticação passa a identificar o titular, não o aluno.

**Escopo no MVP.** Perfil = nome + avatar de um conjunto fixo + interruptor “Perfil infantil”. Até 5 perfis por conta, sem login próprio e sem exclusão pelo titular. O limite de idade do perfil infantil é o parâmetro `child_profile_max_age` (16, a confirmar em DP-02). Sem PIN, uma criança pode trocar para o perfil do titular. A v2.2 deixava o PIN no pós-MVP; na v2.3 ele entra no MVP, porque é o “sistema de bloqueio” que o Decreto 12.880/2026 pede para dispensar a aferição de idade (alerta 1.2, DP-13).

### 9.4 ADR-005 (aceita): busca e filtros no próprio Postgres

**Status:** Aceito na v2.4 (18/11/2026), com dois ajustes na implementação.

| Opção | Complexidade | Observação |
| --- | --- | --- |
| A. Postgres com `pg_trgm`, `unaccent` e índices | Baixa | Sem nova infraestrutura; relevância básica, suficiente para um catálogo pequeno |
| B. Motor dedicado (Meilisearch, Typesense ou OpenSearch) | Média | Melhor relevância e tolerância a erros de digitação; mais um serviço para operar |

**Decisão:** A no MVP. Reavaliar quando tags e pílulas entrarem, quando o catálogo passar de alguns milhares de cursos ou quando a taxa de buscas sem resultado indicar problema.

**Implementação (v2.4).** A coluna `courses.search_text` guarda título e nomes dos autores em minúsculas e sem acentos, com índice GIN trigram (`pg_trgm`). Uma única função da aplicação normaliza o texto para gravar a coluna e normaliza o termo digitado na consulta. O banco nunca chama `unaccent()`, que não é IMMUTABLE e não entraria num índice, por isso a extensão `unaccent` não é usada. O `search_text` é recalculado em toda escrita que muda o título do curso ou o nome de um autor ligado a ele, não só na publicação: o cadastro de autores não é bloqueado pela RN-05, e um autor renomeado não pode sumir da busca. Sem tolerância a erro de digitação no MVP (a RF-CAT-02 não pede); `search_misses` mede as buscas sem resultado.

### 9.5 Modelo de dados v3

A v3 mantém o modelo lógico da v2 e acrescenta o que o desenho técnico pede. Todas as tabelas ficam no schema `app` (RNF-DAD-04). O Better Auth é dono das tabelas de identidade: os nomes físicos seguem o Better Auth e o mapeamento para os nomes do documento está no glossário. Os nomes de colunas abaixo são lógicos; os do Better Auth são confirmados no R0 (seção 10.4). Fisicamente, e no código, as chaves que apontam para a Conta se chamam `user_id` (`userId`), o nome do Better Auth; a palavra *account* no código sempre significa a Identidade de login. A skill `auth-identity` do projeto registra esse mapeamento.

```
-- Identidade (Better Auth; nomes físicos no glossário)
accounts(id, name, email, email_verified, phone_e164, phone_verified_at, roles, banned,
         created_at, deleted_at)                                 -- Better Auth: user (+ plugin admin)
                                                                 -- roles: instrutor e/ou admin; permissões no código (seção 4)
auth_identities(id, account_id, provider, provider_user_id, password_hash NULL)   -- Better Auth: account
sessions(id, account_id, token, expires_at, ip_address, user_agent)   -- Better Auth: session. ip_address fica vazio: um gancho
                                                                  -- do Better Auth o remove ao criar a sessão (v2.4). O rate limit
                                                                  -- lê o IP da requisição, não da sessão; o IP só vai para
                                                                  -- security_events (RNF-SEG-15)
session_profiles(session_id, profile_id, updated_at)              -- perfil ativo da sessão; só o caso de uso setActiveProfile
                                                                  -- escreve aqui (PIN ao sair de perfil infantil); apaga junto com a sessão
verifications(id, identifier, value, expires_at)                  -- Better Auth: verification (e-mail e reset)
rate_limits(key, count, last_request)                             -- rate limit do Better Auth no banco (RNF-SEG-03)
account_pins(account_id, pin_hash, failed_attempts, locked_until) -- PIN do titular (RF-PRF-11, DP-13)
profiles(id, account_id, display_name, avatar_key, kind[standard|child], is_primary, created_at, deleted_at)
consents(account_id, profile_id NULL, document, version, accepted_at, ip_hash)   -- inclui a declaração do responsável (RPV-04)

-- Taxonomia
categories(id, slug, name, position, is_active)
audiences(id, key, name, min_age, max_age, allowed_for_child, position)
tags(id, slug, name, is_active)                         -- futuro

-- Catálogo
courses(id, slug, title, synopsis, description, cover_key, trailer_video_id NULL,   -- → videos (RN-09)
        level[beginner|intermediate|advanced|all], language, learning_outcomes jsonb, prerequisites,
        status[draft|in_review|published|archived],
        release_mode[full|incremental], access_policy[free], on_new_lesson[keep_completed],
        content_format[video|reading|mixed], total_duration_seconds, lesson_count,
        video_count, reading_count, attachment_count,        -- derivados (RN-08, RN-10)
        search_text,                                         -- título + autores, sem acentos; recalculado quando
                                                             -- muda o título ou o nome de um autor (ADR-005)
        published_at, updated_at, archived_at)
authors(id, display_name, bio, photo_key, account_id NULL)   -- autor exibido; pode não ter conta (RN-18)
course_authors(course_id, author_id, position)
course_editors(course_id, account_id)                     -- quem edita o curso (RBAC own)
course_categories(course_id, category_id, is_primary)
course_audiences(course_id, audience_id)
course_tags(course_id, tag_id)                          -- futuro
course_reviews(id, course_id, submitted_by, submitted_at, reviewer_id, decision[approved|kept_draft], decided_at)
                                                        -- uma linha por envio; checklist e comentários entram depois como colunas
course_stats(course_id, enrollments_30d, enrollments_total, completions_total, updated_at)
modules(id, course_id, title, description, position, archived_at)
lessons(id, module_id, type[video|reading], title, summary, position,
        video_id NULL,                                       -- → videos, só em aula de vídeo, como o trailer (v2.4)
        estimated_minutes NULL, thumbnail_key NULL,          -- leitura (RN-02) e miniatura própria (RF-APR-01)
        status, published_at, is_preview, archived_at)       -- sem duration_seconds: a duração vem do vídeo
                                                             -- ou de estimated_minutes (RN-10, v2.4)
videos(id, provider[youtube|mux|bunny], external_id, duration_seconds, status[ok|unavailable],
       last_checked_at NULL, created_at)                    -- todo vídeo, de aula ou trailer (RN-09)
lesson_documents(lesson_id, source[storage|external_url], storage_key, external_url, mime, size_bytes, pages)
attachments(id, lesson_id NULL, course_id NULL, title, storage_key, mime, size_bytes, position)

-- Aprendizagem (sempre por perfil)
enrollments(id, profile_id, course_id, status[in_progress|completed], started_at, completed_at,
            first_completed_at, last_lesson_id, last_accessed_at)     -- unique(profile_id, course_id)
lesson_progress(id, profile_id, lesson_id, status, completed_at, position_seconds NULL, updated_at)
                                                                      -- unique(profile_id, lesson_id)
saved_courses(profile_id, course_id, created_at)        -- pós-MVP

-- Arquivos (chaves, nunca URLs: ADR-009)
media_objects(id, bucket[public|private], storage_key, mime, size_bytes, sha256, variants jsonb NULL,
              created_by, created_at, archived_at)             -- variants: AVIF e WebP por largura (RNF-PER-07)

-- Operação
audit_log(id, actor_account_id, action, entity, entity_id, diff jsonb, at)
analytics_events(id, name, schema_version, profile_hash, course_id NULL, lesson_id NULL, props jsonb, at)
                                                        -- brutos por 90 dias; profile_hash = HMAC do profile_id (RPV-09)
analytics_daily(day, name, course_id NULL, count)       -- resumo diário, mantido (RNF-DAD-05)
search_misses(day, term_normalized, count)              -- buscas sem resultado, sem vínculo ao perfil (RF-CAT-10)
job_runs(job, started_at, finished_at, status, details jsonb)   -- job diário, backups, relatório de capacidade
security_events(id, at, event, account_id NULL, ip, user_agent, details jsonb)
                                                        -- registro de segurança, único lugar com IP; 6 meses
                                                        -- (RNF-SEG-15, retenção a confirmar na DP-11)

-- Pós-MVP: MFA das contas de equipe (plugin twoFactor do Better Auth)
two_factors(account_id, secret, backup_codes)           -- guardados cifrados; accounts ganha two_factor_enabled

-- Futuro: anotações por aula e certificados
lesson_notes(profile_id, lesson_id, body, updated_at)
certificates(id, enrollment_id, issued_at, code)

-- Futuro: curadoria dinâmica da home (hoje no código, RF-HOM-07)
home_sections(id, title, kind, config jsonb, position, is_active, starts_at NULL, ends_at NULL)
home_section_items(section_id, course_id, position)
```

**Índices principais:** `courses(status, published_at)`, `courses(content_format)`, `course_categories(category_id)`, `course_audiences(audience_id)`, GIN trigram em `courses.search_text`, `enrollments(profile_id, status, last_accessed_at)`, `analytics_events(at)` (limpeza dos 90 dias) e `security_events(at)` (limpeza dos 6 meses).

**Saem do MVP:** `roles`, `permissions` e `role_permissions` (seção 4) e `accounts.auth_subject` (o ID da conta é o do Better Auth). **Saem na v2.4:** `lesson_videos` (a aula aponta para o vídeo por `lessons.video_id`, como o trailer) e `lessons.duration_seconds` (a duração da aula vem de uma única função, RN-10). As referências a arquivos (`cover_key`, `photo_key`, `storage_key`, `thumbnail_key`) apontam para `media_objects`.

### 9.6 Contrato: casos de uso primeiro

Na v2.3, “API-first” vira **casos de uso primeiro**. A interface do sistema são funções de caso de uso no servidor (camada `src/data`, seção 9.12.1), chamadas por Server Components e Server Actions. Cada uma lê a sessão, autoriza (incluindo a posse do perfil), confere as regras de negócio e só então acessa o banco. A entrada chega já validada (v2.4): quem a recebe (a Server Action, a Route Handler ou o Server Component que lê `searchParams`) a valida com o schema Zod do módulo, em `src/domain/<módulo>/`, e o caso de uso recebe o tipo inferido do schema. Uma Route Handler responde 400 a uma entrada inválida; um parâmetro inválido na URL do catálogo cai no valor padrão, sem erro. As regras de lint com checagem de tipos `no-unsafe-argument` e `no-unsafe-assignment` impedem que um `any` (o resultado de `request.json()`, por exemplo) chegue ao caso de uso sem validação. Uma rota HTTP só existe quando quem chama não é o React: o Better Auth, o navegador num `sendBeacon`, provedores externos, agendadores e o monitoramento. Quando houver app ou cliente externo, os mesmos casos de uso ganham rotas sem reescrita.

**Casos de uso**

| Caso de uso | Chamado por | Substitui (v2.2) | Fase |
| --- | --- | --- | --- |
| `getHome(escopo, perfil?)` | Server Component da home | `GET /home` | MVP |
| `searchCatalog({ q, category, format, audience, sort, page }, escopo)` | Server Component do catálogo, com o estado na URL | `GET /courses` | MVP |
| `getCourse(slug, escopo)` | Página do curso | `GET /courses/{slug}` | MVP |
| `enroll(perfil, curso)` | Server Action, idempotente | `POST /enrollments` | MVP |
| `setLessonCompletion(perfil, aula, concluída)` | Server Action, idempotente | `POST` e `DELETE /lessons/{id}/complete` | MVP |
| `listMyCourses(perfil, status)` | Server Component | `GET /me/courses` | MVP |
| `createProfile`, `updateProfile`, `setActiveProfile`, `verifyPin` | Server Actions | `/me/profiles` | MVP |
| `admin.*`: cursos, currículo, revisão, importação CSV, autores, equipe | Server Actions do backoffice | `/admin/...` | MVP |

**Rotas HTTP**

| Rota | Para quê | Fase |
| --- | --- | --- |
| `/api/auth/*` | Better Auth: cadastro, login, verificação de e-mail e reset de senha (2FA no pós-MVP) | MVP |
| `GET /media/{id}` | Confere sessão e acesso e redireciona para uma URL assinada nova (RF-APR-05) | MVP |
| `GET /api/health` | Health check com consulta ao banco, usado pelo Better Stack | MVP |
| `POST /api/events` | Eventos de visualização enviados pelo navegador (`sendBeacon`), com rate limit (seção 8.4) | MVP |
| `/api/jobs/{name}` | Jobs idempotentes, chamados pelo Vercel Cron ou pelo GitHub Actions com `Authorization: Bearer CRON_SECRET` | MVP |
| `PUT /api/lessons/{id}/progress` | Posição em segundos, enviada por `sendBeacon` no `pagehide` (Server Action não atende beacon) | Pós-MVP |
| `POST /api/webhooks/mux` | `video.asset.ready`, para a duração automática | Futuro (DP-23) |

### 9.7 ADR-006 (aceita): front-end e renderização

**Status:** Aceito na v2.3 (17/11/2026), com Next.js 16.4 (DP-21).

**Contexto.** O protótipo é um site multipágina estático (Vite 8 e Tailwind 3), com uma configuração de tema por página, cabeçalho em partial e sessão simulada em `localStorage`. Os requisitos pedem SEO nas páginas públicas (RF-CUR-06), rotas protegidas (RF-AUT-06), sessão por cookie (RNF-SEG-09) e API-first.

| Opção | Complexidade | Principal risco |
| --- | --- | --- |
| A. Manter o Vite multipágina e consumir a API no navegador | Baixa | SEO fraco nas páginas de curso, guarda de rota só no cliente, token no navegador |
| B. Framework com renderização no servidor (Astro, Next, Nuxt ou SvelteKit), reaproveitando o HTML e o Tailwind do protótipo | Média | Migrar as 9 páginas e consolidar o tema |
| C. Híbrido dentro de um framework: páginas públicas e institucionais pré-renderizadas; áreas logadas (aula, perfil, Meus cursos) renderizadas sob demanda | Média | Duas formas de renderizar para manter |

**Decisão:** C, que é B com a renderização escolhida por rota, em Next.js 16.4 com Cache Components, React Compiler e `partialPrefetching`. As páginas públicas têm shell estático e as partes que dependem do perfil ficam em `<Suspense>`; as áreas logadas renderizam sob demanda. O Next.js é também o padrão do harness de desenvolvimento usado no projeto.

**Consequências.** Cabeçalho e rodapé viram componentes, o tema único (RNF-UX-05) vira pré-requisito, e o HTML do protótipo passa a ser referência visual, não código de produção. O código do protótipo (Vite 8, Tailwind 3, sessão em `localStorage`) não é reaproveitado.

### 9.8 ADR-007 (aceita): hospedagem e dados em planos gratuitos

**Status:** Aceito em 17/11/2026 (D-10 e D-11).

**Contexto.** O público inicial é de centenas de usuários (D-12) e o orçamento do MVP é próximo de zero (P-07), sem cortar funcionalidades. A primeira proposta, com Vercel Pro e Neon pago, custava cerca de US$ 40–80 por mês. Esse custo vinha das metas da v2.2 (10 mil contas, RPO de 1 h, banco sempre ligado), não das funcionalidades.

| Opção | Custo mensal | Principal risco |
| --- | --- | --- |
| A. Planos gratuitos gerenciados: Vercel Hobby, Supabase Free (só Postgres), Cloudflare R2, Resend, Sentry, Axiom e Better Stack | ~R$ 0 + domínio | Cotas rígidas, termos do Hobby (“uso pessoal ou não comercial”), banco sem backup e sem SLA |
| B. VPS no Brasil (Hostinger KVM 2, São Paulo) com Coolify: Next em Docker, Postgres e WAL-G para o R2 | ~R$ 35–70 | Operação do servidor por um único desenvolvedor; deploy sem garantia de zero downtime |
| C. Planos pagos: Vercel Pro + Neon ou Supabase Pro | ~US$ 40–80 ou mais | Acima do orçamento do MVP |

**Descartadas:** Neon Free (o teto de 100 CU-h por mês suspende o banco até o mês seguinte, e o desligamento por inatividade não pode ser desativado), Oracle Always Free (cotas cortadas e instâncias desativadas em 2026) e Netlify ou Cloudflare via OpenNext (suporte a Cache Components não confirmado).

**Decisão:** A, com B como plano de saída (ADR-009).

**Consequências.**
- A capacidade dos provedores é acompanhada todos os dias (RNF-CAP, seção 9.13).
- O backup do banco é nosso (RNF-DIS-05), porque o Supabase Free não tem nenhum.
- O uso do Hobby pela igreja (plataforma gratuita, sem anúncios nem doações) foi liberado pelo responsável (DP-25). Se a Vercel contestar, a saída é a Vercel Pro (US$ 20 por mês) ou a opção B.
- As regiões são fixadas na criação e não mudam depois: funções em gru1 e banco em São Paulo. Com o banco fora do Brasil, cada consulta ganharia cerca de 120 ms.
- A cota de tráfego de saída do Supabase é da organização: produção e staging somam.
- O Supabase Free pausa projetos sem requisições por 7 dias. O health check de produção a cada 3 min e o relatório de capacidade, que consulta os dois bancos todo dia, evitam a pausa.

### 9.9 ADR-008 (aceita): autenticação com Better Auth

**Status:** Aceito em 17/11/2026. Substitui a ADR-003.

**Contexto.** A ADR-003 previa autenticação gerenciada. Os requisitos pedem dados de conta no Brasil (RPV-12), MFA para a equipe no pós-MVP (RF-AUT-08), rate limit (RNF-SEG-03), verificação de e-mail, reset de senha, suspensão de aluno (RF-ADM-11) e sessão em cookie httpOnly (RNF-SEG-09), com orçamento próximo de zero.

| Opção | Observação |
| --- | --- |
| A. Better Auth como biblioteca na própria aplicação | Contas e sessões no nosso Postgres em São Paulo, sem mais um operador. Suspensão e papéis (plugin `admin`) e rate limit no MVP; TOTP (plugin `twoFactor`) e login social no pós-MVP, sem trocar de biblioteca. Sem custo |
| B. Supabase Auth | Acopla a identidade ao Supabase, contra a ADR-009 |
| C. Better Auth gerenciado pelo Neon | 2FA não encontrado na documentação; exige o Neon |
| D. Clerk | Dados nos EUA e custo por usuário ativo |

**Decisão:** A.

**Consequências.**
- As correções de segurança ficam conosco: versões fixadas, Renovate e acompanhamento dos avisos. Em 2026 saíram correções de bypass do cache de sessão e de lockout do 2FA.
- Os nomes das tabelas do Better Auth diferem dos do documento (`user` é a Conta; `account` é a Identidade de login). O glossário registra o mapeamento, para que ninguém confunda os dois.
- Rate limit com armazenamento no banco: o padrão em memória não serve em funções serverless.
- “Lembrar de mim” (RF-AUT-03) é uma sessão com expiração mais longa; “Sair de todos os dispositivos” (RF-AUT-12) revoga as sessões da conta.
- O `proxy.ts` só faz a checagem otimista do cookie e redireciona; a autorização acontece na camada de dados (seção 9.12.3).
- Cadastro, login, recuperação de senha e verificação de e-mail passam pelo cliente HTTP do Better Auth (`/api/auth/*`). Chamadas `auth.api` feitas no servidor não passam pelo rate limit, então uma Server Action que chamasse `auth.api` para login ficaria sem proteção contra força bruta.
- O cache de sessão em cookie do Better Auth fica desligado: assim, suspensão de conta e sessões revogadas valem já na próxima requisição.

### 9.10 ADR-009 (aceita): portabilidade e gatilhos de escala

**Status:** Aceito em 17/11/2026.

**Contexto.** Os planos gratuitos têm teto (alerta 1.2) e a plataforma pode crescer. Há três tipos de mudança: upgrade de plano no mesmo provedor (sem código), troca de provedor com a mesma arquitetura (adaptadores e variáveis de ambiente) e mudança de topologia, como várias instâncias em servidor próprio (infraestrutura nova). As regras abaixo mantêm as duas primeiras simples.

**Decisão.** Desde o primeiro commit:

1. **Provedores atrás de interfaces** em `src/infra/<capacidade>/`: `storage`, `mailer`, `video`, `telemetry` e `scheduler`. A camada `src/data` chama `src/infra`; `src/domain` não conhece provedor.
2. **Fronteira verificada por lint:** uma regra `no-restricted-imports` só permite `@vercel/*`, `@supabase/*`, `resend`, `@aws-sdk/*` e `@mux/*` dentro de `src/infra/**` e proíbe `next/*` em `src/domain/**`. Ela roda no CI, então um import indevido quebra o PR, e não a migração.
3. **Postgres comum** (RNF-DAD-04): schema `app`; opção “Automatically expose new tables” desmarcada na criação do projeto; extensões criadas pela primeira migration no schema `extensions`, que existe no Supabase e é criado nos demais; `DATABASE_URL` pelo pooler em modo transação (aplicação) e `DATABASE_URL_DIRECT` pelo pooler em modo sessão (migrations e backup); CI com `postgres:17`, a mesma versão principal do Supabase. O registro de migrations aplicadas também fica no schema `app`: o backup só copia `app`, e um banco restaurado precisa saber quais migrations já rodaram.
4. **O banco guarda chaves, não URLs:** arquivos por `media_objects`, servidos por `/media/{id}`; vídeo por `provider` + `external_id` (RN-09). Trocar de storage é copiar os objetos e mudar variáveis de ambiente.
5. **Só APIs públicas do Next:** `'use cache'`, `cacheLife`, `cacheTag`, `updateTag`, `revalidateTag` e `after()`. Sem `'use cache: remote'` e sem o `waitUntil` da Vercel no MVP.
6. **Nenhum estado na memória do processo:** sessão, rate limit e contadores no banco.
7. **Telemetria por OpenTelemetry (OTLP):** trocar o Axiom por outro serviço é mudar variáveis de ambiente.
8. **Configuração validada na inicialização** (`src/env.ts` com Zod) e `.env.example` completo, que serve de inventário do que recriar num novo host. Poucas variáveis `NEXT_PUBLIC_*`, porque elas são fixadas no build.
9. **Prova contínua:** o E2E do CI roda contra `next start` (o modo de servidor próprio), com Postgres em container. `output: 'standalone'` e um Dockerfile ficam no repositório, e a imagem é gerada e testada a cada push na `main`.
10. **DNS fora da hospedagem:** domínio no Registro.br com DNS no Cloudflare. Trocar de host é mudar um registro.
11. **Ensaio de migração:** o teste trimestral de restauração (RNF-DIS-05) restaura o backup num Postgres limpo, o mesmo passo de uma migração de banco.

**Consequências.**
- Upgrade de plano (Vercel Pro, Supabase Pro, Resend pago) não muda código.
- Trocar de provedor mantendo a arquitetura leva cerca de um dia por provedor: novo adaptador, variáveis de ambiente e cópia dos dados.
- Várias instâncias em servidor próprio exigem uma nova ADR: cache handler compartilhado (Redis) com `refreshTags()`, a mesma `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` e o mesmo `deploymentId` em todas as instâncias, e streaming sem buffer no proxy. Na Vercel, a plataforma resolve isso.
- A Adapter API do Next.js, estável desde a 16.2, é o mesmo contrato público usado pela Vercel, o que reduz o acoplamento do framework à plataforma.
- Trocar a Vercel por uma VPS não muda código, mas perde os previews por PR, o rollback instantâneo e a CDN global. Por isso a saída padrão é Vercel Pro antes de VPS, salvo quando o motivo for a perda máxima de dados ou os termos de uso.

### 9.11 ADR-010 (aceita): CSP e defesas contra XSS

**Status:** Aceito em 17/11/2026 (DP-27). A DP-27 definiu que segurança técnica, de código e de dados é prioridade no MVP; esta ADR registra o custo de cada opção de CSP no Next.js 16.4 e a escolha feita.

**Contexto.** A RNF-SEG-02 pede CSP. Pesquisa de 17/11/2026:
- A documentação do Next.js 16.4 diz que a CSP com nonce exige renderizar todas as páginas a cada requisição, desliga a geração estática e é incompatível com o PPR, porque o shell estático não tem acesso ao nonce.
- Com `cacheComponents` ligado (o padrão do harness), ler o nonce no layout raiz quebra o build ou atrasa os scripts. É a issue #89754 do Next.js, aberta e confirmada desde fevereiro de 2026, ainda sem correção.
- Um projeto em Next.js 16.4 que adotou nonce precisou desligar `cacheComponents` e `partialPrefetching` e chamar `connection()` no layout raiz. A alternativa por hashes falhou no navegador: o SRI cobre só os scripts externos, e a página tinha 8 scripts inline de hidratação.
- O SRI do Next.js (`experimental.sri`) continua experimental.

| Opção | Proteção contra XSS | Custo |
| --- | --- | --- |
| A. CSP com nonce, com `cacheComponents` e `partialPrefetching` desligados | Máxima: só executa script com o nonce da requisição | Toda página renderiza na função a cada visita, sem cache de HTML na CDN: mais CPU ativa e invocações no Hobby (seção 9.13) e LCP em risco. Sem `'use cache'`, o cache de dados volta para APIs antigas, e o projeto sai das regras de cache do harness |
| B. CSP sem nonce (`'unsafe-inline'` só em `script-src` e `style-src`), demais diretivas restritas, mais as defesas da RNF-SEG-12 | Alta: a injeção é barrada pelo React e pela RNF-SEG-12. Se um script injetado rodar, ele não carrega código de outros domínios e tem as saídas de dados limitadas pelas diretivas (`connect-src`, `img-src`, `form-action`); o cookie de sessão é httpOnly | Nenhum no desempenho ou nas cotas; mantém a arquitetura |
| C. Hashes (`experimental.sri`) | Não cobre os scripts inline de hidratação | Experimental, e falhou na prática |

**Decisão:** B no MVP. Revisar quando a issue #89754 for resolvida ou o SRI sair do experimental, e migrar para A se a plataforma passar a exibir HTML vindo de usuários ou de terceiros. A política inclui `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://www.youtube.com` (IFrame API, só depois do clique); `style-src 'self' 'unsafe-inline'`; `img-src 'self'` e o subdomínio de mídia; `media-src` e `connect-src` com `'self'`, o endpoint de URLs assinadas do R2 e o do Sentry; `worker-src 'self'` (pdf.js); `frame-src https://www.youtube-nocookie.com`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`. Um teste automatizado confere o cabeçalho em todas as rotas (RNF-SEG-11).

**Consequências.** A CSP sozinha não basta contra XSS: a RNF-SEG-12 (sem `dangerouslySetInnerHTML`, Markdown restrito, links validados, nenhum script de terceiros) passa a ser obrigatória, e a revisão de código a verifica.

### 9.12 Desenho técnico

#### 9.12.1 Módulos e camadas

Os sete módulos (`auth`, `catalog`, `learning`, `editorial`, `home`, `analytics` e `audit`) atravessam as camadas abaixo. Na v2.3, `auth` se chamava `identity`; o nome mudou na v2.4 para bater com `src/data/auth/`, onde a skill `auth-identity` põe a sessão, os perfis e o PIN. Elas seguem o padrão do harness de desenvolvimento, mais a camada de infraestrutura da ADR-009.

| Camada | Pasta | Contém |
| --- | --- | --- |
| Modelo | `src/domain/<módulo>/` | Tipos e regras puras: conclusão (RN-03), formato (RN-08), totais (RN-10), restrição infantil (RN-04), a política `can()` e os schemas Zod de entrada, que o formulário no cliente também usa. Sem `next/*` |
| Dados | `src/data/<módulo>/` | Casos de uso (seção 9.6), consultas Drizzle, checagem de sessão, DTOs, funções `'use cache'` e as tags (num único módulo) |
| Ações | `src/actions/<módulo>/` | Server Actions finas, nesta ordem: sessão, autorização, validação (Zod), caso de uso, tags, resultado mínimo |
| Composição | `src/app/` | Grupos de rota `(public)`, `(app)` e `(admin)`, mais `api/`; Server Components que chamam `src/data` e posicionam o `<Suspense>` |
| Interface | `src/ui/<feature>/` | Componentes e hooks de cliente; nunca importam `src/data` |
| Infraestrutura | `src/infra/<capacidade>/` | Adaptadores de provedor: `storage` (R2), `mailer` (Resend), `video` (YouTube), `telemetry` e `scheduler` |
| Jobs | `src/jobs/` | Jobs idempotentes, chamados por `/api/jobs/{name}` |

**Fronteiras entre módulos** (v2.4):

- Um módulo importa outro só pela interface pública dele (o `index.ts` do módulo, em cada camada), nunca por um arquivo interno. Ficam de fora o que é compartilhado: `src/data/db` e `src/data/tags.ts`.
- A regra é verificada pelo mesmo `no-restricted-imports` da ADR-009, que roda no CI.
- Os imports entre módulos não formam ciclo.
- Cada tabela tem um módulo dono, o único que escreve nela. Ler por `JOIN` continua livre: “Meus cursos”, por exemplo, junta matrículas e cursos numa consulta só.

| Módulo | Escreve em |
| --- | --- |
| `auth` | Tabelas do Better Auth, `session_profiles`, `account_pins`, `profiles` e `consents` |
| `editorial` | `courses`, `modules`, `lessons`, `videos`, `lesson_documents`, `attachments`, `authors`, as tabelas `course_*` (exceto `course_stats`) e `media_objects` |
| `catalog` | Taxonomia (`categories`, `audiences`, `tags`); no mais, só lê |
| `learning` | `enrollments`, `lesson_progress` e `saved_courses` |
| `analytics` | `analytics_events`, `analytics_daily`, `search_misses` e `course_stats` |
| `audit` | `audit_log` e `security_events` |
| `home` | Nada no MVP |

#### 9.12.2 Renderização e cache

- **Páginas públicas** (home, catálogo, curso, institucionais): shell estático, com os dados em funções `'use cache'` que declaram `cacheLife` e tags (`catalog`, `course:<id>`, `home` e `popular`).
- **Partes por perfil** nas páginas públicas (progresso nos cards, CTA do curso, “Continue assistindo”): folhas em `<Suspense>` com altura reservada e uma única consulta `progressMap(perfil)` por requisição.
- **Escopo do catálogo:** o cache é por escopo (`standard` ou `child`), nunca por perfil. São só duas variantes, e a restrição da RN-04 continua na consulta do servidor.
- **Invalidação:** aprovação, retorno a rascunho e arquivamento chamam `updateTag` na Server Action; o job diário chama `revalidateTag('popular', 'max')`.
- **Perfil ativo:** guardado no servidor, ligado à sessão do dispositivo (tabela `session_profiles`), e conferido a cada requisição contra a conta da sessão (RNF-SEG-07). Um cookie próprio, mesmo assinado, poderia ser copiado e reaproveitado para pular o PIN.
- **Catálogo na URL:** busca, filtros e ordenação vêm da URL (RF-CAT-08), lidos dentro de `<Suspense>`; o resultado de cada combinação também fica em cache.

#### 9.12.3 Autenticação, sessão e perfis

- **Better Auth:** e-mail e senha, verificação de e-mail por link, reset com link de uso único de 30 min (RF-AUT-04), suspensão pelo plugin `admin` e regras de rate limit por rota, guardadas no banco. Cookie httpOnly, Secure e SameSite=Lax.
- **Contas de equipe sem MFA no MVP** (RF-AUT-08). Proteções no lugar, todas de configuração ou de pouco código:
  - senha de no mínimo 12 caracteres para instrutor e admin;
  - sessão de no máximo 12 h, sem “Lembrar de mim”;
  - confirmação da senha antes de ações sensíveis (convidar ou suspender conta, mudar papel, aprovar ou arquivar curso);
  - rate limit e bloqueio progressivo no login (RF-AUT-05);
  - audit log de toda ação do backoffice (RF-ADM-10).

  O MFA entra depois pelo plugin `twoFactor`, com uma migration e as telas de cadastro do autenticador.
- **`proxy.ts`:** só a checagem otimista do cookie e o redirecionamento para o login, guardando a URL pedida (RF-AUT-07). Não consulta o banco.
- **Autorização:** negar por padrão, com checagem em toda função de `src/data`, Server Action e rota. As consultas são filtradas pela posse (o perfil pertence à conta da sessão), para que uma checagem esquecida não vaze dados de outra conta. As respostas de recusa (404, 403 ou novo login) seguem a tabela da seção 4.
- **IP do cliente** (v2.4): o rate limit do Better Auth lê o IP da requisição (`x-forwarded-for`) e guarda os contadores em `rate_limits`, cujas linhas vencidas ele mesmo apaga. A opção `advanced.ipAddress.disableIpTracking` desligaria também o rate limit, por isso fica desligada. Um gancho `databaseHooks.session.create.before` esvazia o IP antes de gravar a sessão. O IP completo vai só para o registro de segurança (RNF-SEG-15).
- **PIN do titular** (RF-PRF-11): guardado como hash e pedido ao sair de um perfil infantil para um perfil padrão. Com 5 tentativas erradas, bloqueia a troca por 15 minutos.

#### 9.12.4 Mídia: capas, PDFs e áudios

- **Três buckets no R2:** `public` (capas, fotos de autores e miniaturas, servidos por um subdomínio próprio pela CDN da Cloudflare); `private` (PDFs e MP3, só por URL assinada); `backups` (dumps do banco criptografados, com chave de acesso própria e regra de ciclo de vida de 30 dias).
- **Envio:** o navegador pede uma URL assinada de envio a uma Server Action, que autoriza e registra o arquivo como pendente em `media_objects`, e envia direto ao R2. Os arquivos não passam pela função da Vercel, que aceita no máximo 4,5 MB no corpo da requisição. Depois do envio, o servidor confere o tipo real (pelos primeiros bytes), o tamanho e o hash antes de anexar (RNF-SEG-04).
- **Imagens:** ao anexar, o servidor gera as variantes AVIF e WebP em três larguras e grava no bucket público. O `next/image` usa um loader que aponta para elas, sem a otimização da hospedagem (RNF-PER-07).
- **Leitura:** `/media/{id}` confere a sessão, o escopo do perfil ativo (RN-04) e o estado do curso, e redireciona para uma URL assinada de 10 min (RNF-SEG-04).
- **Imutabilidade:** ver RNF-DIS-06.

#### 9.12.5 Vídeo

- **Interface `VideoPlayer`:** carregar, tocar e os eventos `progress`, `ended` e `error`. A página da aula não conhece o provedor.
- **Adaptador do YouTube:** fachada com a miniatura própria (`lessons.thumbnail_key` ou a capa do curso). No clique, carrega o iframe de `youtube-nocookie.com` com a IFrame API (`enablejsapi=1`, `rel=0`). Erros viram o evento `video_playback_error` e o alerta da RF-APR-07.
- **Riscos aceitos no MVP (D-09):** anúncios em canais fora do programa de parceiros do YouTube, vídeos não listados que podem ser vistos fora da plataforma por quem tiver o link, e o armazenamento local do YouTube depois do clique. Mitigações: vídeos não listados no canal institucional (P-04) e conteúdo infantil marcado como “feito para crianças”. YouTube decidido para o MVP em 17/11/2026 (DP-23).
- **Preparação para trocar de provedor** (pedido da DP-23):
  - Todo vídeo é um registro em `videos` com `provider` e `external_id` (RN-09); nenhuma tabela guarda URL do YouTube, e o trailer usa o mesmo registro.
  - O backoffice recebe a URL do YouTube, extrai o ID e grava `provider = youtube`; a URL de embed é sempre gerada pelo adaptador.
  - O adaptador é escolhido pelo `provider` de cada vídeo, então os dois provedores podem conviver durante a migração.
  - Uma suíte de testes de contrato da interface `VideoPlayer` (carregar, eventos `progress`, `ended` e `error`) roda contra o adaptador do YouTube; o adaptador do Mux terá de passar na mesma suíte.
  - O SDK de cada provedor só pode ser importado em `src/infra/video` (regra de lint da ADR-009).
- **Mux, quando vier:** adaptador com o player do Mux, envio direto pelo backoffice e webhook para a duração. O schema não muda (RN-09); a migração troca `provider` e `external_id` vídeo a vídeo.

#### 9.12.6 Jobs agendados

| Job | Agendado por | Quando | O que faz |
| --- | --- | --- | --- |
| Diário (`/api/jobs/daily`) | Vercel Cron (o Hobby permite uma execução por dia) | De madrugada | Popularidade (RN-07, `course_stats`), resumo diário de analytics, limpeza dos eventos brutos com mais de 90 dias, limpeza do registro de segurança com mais de 6 meses (RNF-SEG-15), limpeza de arquivos órfãos (RNF-DIS-06) e `revalidateTag('popular', 'max')` |
| Backup do banco | GitHub Actions | Toda noite e antes de cada migration | Seção 9.12.11 |
| Relatório de capacidade | GitHub Actions | Todo dia, de manhã | Seção 9.13 |
| Fluxos sintéticos | GitHub Actions | A cada 6 h e depois de cada deploy | RNF-OBS-07 |
| Revisões periódicas | GitHub Actions | Dia 1 de cada mês e a cada trimestre | Issue da revisão mensal (RNF-CAP-05) e lembrete do teste de restauração (RNF-DIS-05) |

Cada job grava uma linha em `job_runs` e pinga um heartbeat no Better Stack. Os agendamentos do GitHub podem atrasar e, em repositórios públicos, são desligados depois de 60 dias sem atividade; o heartbeat avisa nos dois casos.

#### 9.12.7 E-mail

- **Resend + React Email**, atrás da interface `mailer`, com domínio configurado com SPF, DKIM e DMARC.
- **Só e-mails transacionais no MVP:** verificação, reset de senha, convite de equipe e avisos de segurança. O conteúdo leva o mínimo de dados pessoais, porque os metadados ficam nos EUA.
- **Limite do plano gratuito:** 100 por dia e 3.000 por mês. Acima disso, a API responde 429 e o e-mail não sai: o caso de uso registra a falha, pede ao usuário para reenviar mais tarde e alerta a equipe.
- **Lançamento:** um anúncio na igreja pode gerar mais de 100 cadastros num dia. Antes do anúncio, contratar o plano pago do Resend no mês do lançamento ou ligar o Amazon SES como segundo adaptador (seção 9.13).

#### 9.12.8 Observabilidade

- **Erros:** Sentry no front e no back, com a organização criada na região UE (a escolha não muda depois), release igual ao commit e remoção de dados pessoais.
- **Logs e traces:** OpenTelemetry pelo `instrumentation.ts` com `@vercel/otel`, exportando por OTLP para o Axiom (30 dias). Os logs da Vercel Hobby duram só 1 h e o plano não tem log drains, por isso a aplicação envia os logs diretamente. Um logger JSON próprio, em `src/infra/telemetry`, remove e-mail, telefone, nome e tokens (RNF-OBS-01).
- **Disponibilidade:** Better Stack, com monitores da home e de `/api/health` a cada 3 min, um heartbeat por job e uma página de status.
- **Analytics de produto:** `analytics_events` no próprio Postgres, com o perfil pseudonimizado por HMAC (RPV-09), resumo diário e o painel do admin (RF-ADM-12).
- **Registro de segurança** (v2.4): `security_events` no próprio Postgres, com o IP completo, consultado por SQL numa investigação (RNF-SEG-15). Os logs do Axiom não levam IP.

#### 9.12.9 Ambientes, CI e deploy

| Ambiente | Banco | Aplicação | Dados |
| --- | --- | --- | --- |
| Desenvolvimento | Postgres 17 local em container | `next dev` | Seed fictício |
| CI | Postgres 17 como service container | `next build` e `next start` | Seed fictício, recriado a cada execução |
| Staging | Segundo projeto do Supabase Free | Previews da Vercel, um por PR | Fictícios (RNF-QUA-02) |
| Produção | Supabase Free (São Paulo) | Vercel, funções em gru1 | Reais |

- **Em cada PR:** formatação, lint (com a fronteira da ADR-009 e a proibição de `dangerouslySetInnerHTML`), typecheck, testes unitários, build, E2E contra `next start`, teste dos cabeçalhos de segurança, OWASP ZAP baseline contra o mesmo servidor, CodeQL, gitleaks e `pnpm audit`. As migrations do PR são aplicadas ao staging; como só expandem o schema, não quebram os outros previews.
- **Em push na `main`:** backup, migrations (`drizzle-kit migrate` com `DATABASE_URL_DIRECT`), deploy de produção pelo Vercel CLI e fluxos sintéticos, nessa ordem. Em paralelo, a imagem Docker standalone é gerada e passa por um smoke test (ADR-009). O deploy automático da integração com o Git fica só para os previews, para garantir que a migration rode antes do código novo.

#### 9.12.10 Operadores, regiões e dados pessoais (RPV-12)

| Operador | Região | Dados pessoais | Observação |
| --- | --- | --- | --- |
| Vercel | Funções em gru1 (São Paulo); CDN global | Requisições em trânsito; logs de 1 h | Verificar o contrato de tratamento de dados no plano Hobby |
| Supabase | São Paulo | Todos os dados da plataforma | Sem backup no plano gratuito (RNF-DIS-05) |
| Cloudflare R2 | Sem região no Brasil | Backups do banco, criptografados antes do envio; PDFs e áudios não são dados pessoais | Transferência internacional a avaliar pelo jurídico, mesmo com os dados cifrados |
| Resend | EUA (metadados) | E-mail do destinatário | Conteúdo mínimo nos e-mails |
| Sentry | UE | Erros, com remoção de dados pessoais | Região fixada na criação da organização |
| Axiom | A confirmar na criação da conta | Logs sem dados pessoais (RNF-OBS-01) | — |
| Better Stack | — | Nenhum: só verifica URLs públicas | — |
| GitHub | EUA | Código; backups em trânsito, já cifrados | — |
| YouTube | — | IP e dados do navegador, só depois do clique | RPV-08 |

#### 9.12.11 Backup e recuperação

- **Backup:** um workflow do GitHub Actions roda `pg_dump --schema=app --no-owner --no-acl --format=custom` pelo pooler em modo sessão. A conexão direta do Supabase é só IPv6, e os runners do GitHub só têm IPv4. O arquivo é criptografado com a chave pública `age`; a chave privada fica fora do GitHub e dos provedores, no gerenciador de senhas do responsável técnico (DP-26). O envio vai para o bucket `backups`, que apaga arquivos com mais de 30 dias.
- **Antes de cada migration:** o pipeline de deploy roda o mesmo backup. Se ele falhar, nem a migration nem o deploy acontecem.
- **Cota:** cada dump conta no tráfego de saída do Supabase; o relatório de capacidade soma o tamanho dos dumps do mês.
- **Restauração** (runbook, RTO ≤ 4 h): criar um projeto novo ou um Postgres limpo, rodar a primeira migration (que cria o schema `extensions` e as extensões), `pg_restore --no-owner --no-acl`, apontar as variáveis de ambiente da Vercel para o novo banco e publicar de novo. O teste trimestral segue o mesmo runbook e registra o tempo gasto.

#### 9.12.12 Repositório e cadeia de suprimentos (DP-24)

Pelo critério da DP-24, o repositório é **público**, porque o privado no GitHub Free perde recursos que o projeto usa:

| Recurso | Público (GitHub Free) | Privado (GitHub Free) |
| --- | --- | --- |
| Ruleset na `main` (PR obrigatório, CI verde antes do merge) | Sim | Não; exige plano pago |
| Varredura de segredos com bloqueio no push | Sim | Não; exige GitHub Secret Protection, pago por committer |
| Varredura de código (CodeQL) | Sim | Não; exige GitHub Code Security, pago por committer |
| Minutos de Actions nos runners padrão | Ilimitados | 2.000 por mês |
| Dependabot | Sim | Sim |

O ruleset é o que impede, no servidor, um push direto na `main` ou um merge com CI vermelho; o fluxo de tickets do harness depende dele. As salvaguardas do repositório público estão na RNF-SEG-13. A regra de base é que a segurança nunca depende do código ser secreto: segredos ficam fora do repositório, e os dados ficam fora dos logs, das issues e do seed.

### 9.13 Capacidade dos provedores e gatilhos de upgrade

Os planos gratuitos param o serviço quando uma cota estoura: na Vercel Hobby, em geral, o recurso fica parado até completar 30 dias; no Supabase Free, há um único período de carência e depois o projeto é restringido. Por isso o upgrade precisa acontecer antes do teto, guiado pelos números abaixo (RNF-CAP).

**Inventário de cotas** (a base do `ops/capacity.json`, RNF-CAP-01)

| Provedor | Métrica | Cota gratuita | Como o relatório mede |
| --- | --- | --- | --- |
| Vercel Hobby | CPU ativa das funções | 4 h por mês | `vercel billing usage --json`, com token (confirmar no Hobby no R0) |
| Vercel Hobby | Invocações de função | 1 milhão por mês | Idem |
| Vercel Hobby | Transferência de dados da CDN | 100 GB por mês | Idem |
| Vercel Hobby | Requisições na CDN | 1 milhão por mês | Idem |
| Vercel Hobby | Transformações de imagem | 5.000 por mês | Idem; deve ficar perto de zero (RNF-PER-07) |
| Supabase Free | Tamanho do banco, por projeto | 500 MB | SQL: `pg_database_size()` e as maiores tabelas, com papel só de leitura |
| Supabase Free | Tráfego de saída da organização (produção + staging) | 5 GB por mês | Sem API conhecida: painel do Supabase na revisão mensal. O relatório soma o tamanho dos dumps do mês como estimativa parcial |
| Cloudflare R2 | Armazenamento | 10 GB-mês | API GraphQL de analytics (`r2StorageAdaptiveGroups`) |
| Cloudflare R2 | Operações classe A e classe B | 1 milhão e 10 milhões por mês | API GraphQL de analytics (`r2OperationsAdaptiveGroups`) |
| Resend | E-mails por dia e por mês | 100 e 3.000 | `GET /usage` |
| Sentry | Erros | Cerca de 5 mil por mês | API `stats_v2` da organização |
| GitHub Actions | Minutos | Ilimitados nos runners padrão em repositório público (DP-24); 2.000 por mês se ficar privado | Não se aplica com o repositório público; se ficar privado, API de uso de billing da conta |
| Axiom | Ingestão | 500 GB por mês, com 30 dias de retenção | Painel, na revisão mensal (a folga é muito grande) |
| Better Stack | Monitores e heartbeats | 10 e 10 | Contagem fixa no inventário |

**Como o relatório funciona** (RNF-CAP-02 a 05)

1. Um workflow diário do GitHub Actions roda `scripts/capacity-report.mjs`, em Node, com os tokens de leitura de cada provedor nos secrets do repositório. As permissões mínimas de cada token são confirmadas no R0.
2. Para cada métrica do inventário, o script lê o uso e calcula o percentual da cota. Nas janelas de calendário (mês do ciclo, dia), calcula também a projeção linear para o fim da janela. Na Vercel Hobby, que não tem ciclo de cobrança, a janela é dos últimos 30 dias e vale o percentual atual.
3. Publica a tabela no resumo do job e grava o resultado em `job_runs`.
4. Abre ou atualiza a issue `capacity: <provedor> <métrica>` quando o uso passa de 70% ou a projeção passa de 100%; marca a issue como crítica acima de 90%; fecha a issue quando o uso volta abaixo de 70%.
5. Confere a idade do último backup (crítico acima de 26 h) e, no fim, pinga o heartbeat do Better Stack. Se o workflow deixar de rodar, o Better Stack alerta.
6. No dia 1 de cada mês, abre a issue da revisão mensal com o relatório do mês e o checklist das métricas sem API (tráfego de saída do Supabase, Axiom, renovação do domínio).

Para ver a capacidade a qualquer momento: a lista de issues com o rótulo `capacity` mostra o que está acima do aviso, e o resumo da última execução do workflow mostra a tabela completa.

**Estimativa de uso com o público do MVP** (a confirmar no baseline)

| Recurso | Estimativa | Cota | Folga |
| --- | --- | --- | --- |
| Banco | 50–150 MB no primeiro ano, a maior parte em eventos de analytics (90 dias) | 500 MB | Grande |
| E-mails | 5–20 por dia no uso normal | 100 por dia | Grande, exceto no lançamento |
| R2 | 1–3 GB (PDFs, MP3, imagens e 30 dias de backups) | 10 GB | Grande |
| GitHub Actions | Cerca de 1.200 min por mês (PRs, fluxos sintéticos, backups, relatório e deploys) | Ilimitado em repositório público (2.000 min se privado) | Sem limite (média, se privado) |
| CPU ativa na Vercel | Medir nas 4 primeiras semanas: o shell estático e o cache tiram a maior parte do tráfego das funções | 4 h | Desconhecida |

**Gatilhos de upgrade.** Quando o aviso (70%) dispara, prepare o upgrade; no crítico (90%) ou com projeção acima de 100%, execute.

| Sinal | Ação | Custo |
| --- | --- | --- |
| Cota da Vercel (CPU ativa, invocações, transferência, requisições) | Vercel Pro, pelo painel (Settings → Billing); pode exigir criar um time | US$ 20 por mês por assento |
| A Vercel contestar o uso no Hobby (DP-25) | Vercel Pro, ou a opção B da ADR-007 | US$ 20 ou R$ 35–70 por mês |
| Tamanho do banco | Supabase Pro, ou migrar o banco (ADR-009). O upgrade de plano não troca a máquina: passar de Nano para Micro é um passo separado, com reinício de menos de 2 min | US$ 25 por mês |
| Tráfego de saída do Supabase | Revisar consultas e cache; depois, Supabase Pro | US$ 25 por mês |
| Perda máxima de 24 h deixar de ser aceitável (por exemplo, com pagamentos) | VPS com WAL-G (opção B) ou Supabase Pro com PITR | R$ 35–70 ou cerca de US$ 125 por mês |
| E-mails (ou um lançamento marcado) | Plano pago do Resend ou Amazon SES | Cerca de US$ 20 por mês (confirmar), ou centavos no SES |
| Latência p95 acima de 300 ms de forma sustentada | Revisar cache e consultas; depois, máquina maior no Supabase | A partir do Supabase Pro |
| Minutos do GitHub Actions (só se o repositório ficar privado, DP-24) | Reduzir a frequência dos fluxos sintéticos | R$ 0 |
| Erros no Sentry | Corrigir os erros mais frequentes e ajustar a amostragem | R$ 0 |
| Problemas do YouTube (anúncios em conteúdo infantil, links vazando, necessidade de player próprio) | Mux (DP-23) | Perto de zero nessa escala |

**Runbooks** (RNF-CAP-06), em `docs/runbooks/`: upgrade para a Vercel Pro, upgrade para o Supabase Pro (plano e máquina), migração do banco (dump, restauração e troca de variáveis), e-mail no lançamento e restauração de backup.

## 10. Roadmap evolutivo

### 10.1 MVP

Conta com verificação de e-mail e reset de senha; perfis do titular e infantis, com acompanhamento pelo responsável; home com seções definidas no código e “Continue assistindo”; catálogo com busca, filtros e ordenação; página do curso; player do YouTube sob demanda e leitura em PDF; conclusão manual, progresso, “Meus cursos” e retomada; backoffice mínimo com pré-visualização, aprovação e importação por planilha; RBAC; consentimento, privacidade, RIPD e encarregado; PIN do titular para sair de perfil infantil; observabilidade completa; analytics first-party; CI/CD, staging e backups; acompanhamento da capacidade dos provedores (RNF-CAP).

### 10.2 Pós-MVP e futuro

**Pós-MVP:** MFA (TOTP) para contas de equipe, login social, curadoria dinâmica da home, certificados de conclusão, anotações por aula, avisos por e-mail (com consentimento), aula de pré-visualização gratuita, upload de foto do titular, exclusão de conta e perfis pelo próprio usuário, evolução do fluxo editorial (checklist, comentários, notificações), OTP por telefone (conforme DP-05), “Salvos”, conclusão automática ao fim do vídeo, progresso gradual, verificação de vídeos e duração pela API, telas de categorias, públicos e tags, tags e pílulas com filtro, agendamento da home, exportação automática de dados e “sair de todos os dispositivos”.

**Futuro (até 24 meses):** Bunny ou Mux e depois pipeline próprio de vídeo (transcrição, conversão, streaming); liberação fragmentada de aulas; monetização com proteção de conteúdo; certificados, avaliações e quizzes; contas individuais de menores (ADR-004, opção C) se exigido; app ou PWA; busca dedicada (ADR-005).

### 10.3 O que o modelo já prepara

| Evolução | Preparação já presente no modelo |
| --- | --- |
| Login social | `auth_identities` separada de `accounts` |
| Progresso gradual | `lesson_progress.position_seconds` (nullable) e endpoint `PUT` definido |
| Salvos | `saved_courses` por perfil, independente de `enrollments` |
| Tags e pílulas | `tags` e `course_tags`, com limite validado no servidor (RN-14) |
| Filtro por faixa etária | `audiences` com idade mínima e máxima e `course_audiences` N:N (já no MVP) |
| Mux ou Bunny | Tabela `videos` com `provider` e `external_id`, usada por aulas e trailers (RN-09); interface `VideoPlayer` com testes de contrato (seção 9.12.5) |
| Liberação fragmentada | `courses.release_mode`, `lessons.status` e `published_at`, `on_new_lesson` (RN-05) |
| Monetização | `courses.access_policy` (hoje `free`); a matrícula vira o ponto de verificação de acesso |
| Aula de pré-visualização | `lessons.is_preview` |
| Contas individuais de menores | Tudo o que é do aluno está chaveado por `profile_id` |
| Novos campos de perfil | Colunas tipadas em `profiles` |
| Curadoria dinâmica da home | O caso de uso `getHome` já devolve o formato final; basta trocar a origem do código para home\_sections e home\_section\_items |
| Evolução do fluxo editorial | course\_reviews tem uma linha por envio; checklist, comentários e revisores entram como colunas ou tabelas filhas |
| Certificados | enrollments.first\_completed\_at já registra a conclusão; faltam a tabela certificates e o nome completo legal no cadastro |
| Anotações por aula | Tabela lesson\_notes por perfil e aula; a aba já existe no protótipo e fica oculta no MVP |
| Troca de provedor ou de plano | Interfaces em `src/infra`, Postgres comum e chaves em vez de URLs (ADR-009) |
| Mais tráfego | Inventário de cotas e gatilhos de upgrade (seção 9.13) |

### 10.4 Fatias de entrega

Aceitas na v2.4 (18/11/2026). Cada fatia vira uma especificação no harness de desenvolvimento e entrega algo utilizável. A operação (backup, monitoramento e capacidade) entra na primeira fatia, porque os planos gratuitos não perdoam descuido.

| Fatia | Conteúdo |
| --- | --- |
| R0 Esqueleto e operação | Template do harness; Next.js, Drizzle, Supabase (schema `app`) e Better Auth (cadastro, verificação de e-mail, reset de senha, convite de equipe); registro de segurança (RNF-SEG-15); pipeline backup → migrations → deploy; Sentry, Axiom e Better Stack; backup noturno; relatório de capacidade; regras de lint de fronteiras (provedores da ADR-009 e interface pública dos módulos, seção 9.12.1) e de tipos (`no-unsafe-argument` e `no-unsafe-assignment`, seção 9.6); Dockerfile standalone |
| R1 Vitrine | Design system com os tokens do DESIGN.md, home, catálogo, página do curso, páginas institucionais, carga por CSV, SEO e CSP |
| R2 Aprender | Matrícula, aula em vídeo (miniatura + `VideoPlayer`), aula em PDF (pdf.js), materiais por `/media/{id}`, conclusão, progresso, Meus cursos e “Continue assistindo” |
| R3 Família | Perfis, “Quem está assistindo?”, perfil infantil e escopo do catálogo, PIN do titular, acompanhamento do responsável e consentimentos |
| R4 Backoffice | Formulários, editor de currículo, envio direto ao R2 com variantes de imagem, revisão, equipe, autores e métricas |
| R5 Lançamento | Teste de carga (150 simultâneos), revisão de segurança com OWASP ZAP, RIPD, runbooks e plano de e-mail para o lançamento |

**Verificações do R0.** Estes pontos do desenho dependem de fatos que só se confirmam ao criar as contas. Cada um vira um item do R0, e uma resposta negativa volta para este documento:

1. A região gru1 está disponível para funções no plano Hobby.
2. São Paulo está disponível no Supabase Free, e a opção “Automatically expose new tables” pode ser desmarcada na criação.
3. As tabelas do Better Auth funcionam no schema `app`; o plugin `admin` aceita mais de um papel por conta; o gancho `databaseHooks.session.create.before` deixa a sessão sem IP, e o rate limit continua ativo atrás da Vercel, lendo o IP do cliente no `x-forwarded-for` (v2.4).
4. `vercel billing usage --json` funciona no Hobby com um token e mostra as métricas do inventário.
5. As consultas GraphQL do R2 devolvem armazenamento e operações por bucket.
6. O repositório público tem ativos: ruleset da `main` (PR obrigatório e CI verde), varredura de segredos com bloqueio no push, CodeQL, Dependabot e relato privado de vulnerabilidades (RNF-SEG-13).
7. Backup e restauração funcionam de ponta a ponta, do Supabase para um Postgres limpo.
8. Os ganchos do Better Auth capturam, para o registro de segurança, o login com falha e o bloqueio por rate limit (429), com o IP do cliente (RNF-SEG-15, v2.4).

## 11. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Regulamentação do ECA Digital ainda em detalhamento | Retrabalho nas telas de conta e perfil | Validar com o jurídico antes de construir; política parametrizada (ADR-004) |
| Tratamento de dado sensível (convicção religiosa) | Sanção e perda de confiança | Base legal definida, minimização, RIPD, sem terceiros de rastreamento |
| Vídeo do YouTube removido, privado ou alterado | Aula quebrada | Canal institucional, evento de erro, verificação periódica (pós-MVP) |
| YouTube como terceiro (cookies, sugestões ao final) | Exposição de dados e distração | Embed sem cookies, sob demanda, sem relacionados de outros canais; migração prevista (RN-09) |
| Escopo do MVP maior que o planejado | Atraso | Entrega em fatias, corte claro do pós-MVP, observabilidade apoiada em serviços gerenciados |
| Dependência do provedor de autenticação | Migração difícil, risco de região e custo | Resolvido na v2.3: Better Auth na própria aplicação, com os dados no nosso banco (ADR-008). Resta o risco de biblioteca (linha abaixo) |
| Falha de segurança no Better Auth | Acesso indevido a contas | Versões fixadas, Renovate, acompanhamento dos avisos de segurança e testes de autorização (RNF-SEG-08) |
| Cota de plano gratuito estourada | Vercel: recurso parado por até 30 dias. Supabase: projeto restrito depois da carência única | Relatório de capacidade diário com alerta em 70% e projeção; upgrade antes do teto (seção 9.13) |
| Vercel contesta o uso pela igreja no Hobby (termos “uso pessoal ou não comercial”) | Troca de plano às pressas | Risco aceito (DP-25); Vercel Pro ou a opção B prontas, sem mudança de código (ADR-007 e 009) |
| Supabase Free sem backup e sem SLA | Perda de até 24 h de dados; queda sem compensação | Backup próprio toda noite e antes de cada migration, restauração testada a cada trimestre, meta de 99,5% medida |
| Pico de cadastros no lançamento | O limite de 100 e-mails por dia bloqueia verificações e resets | Plano pago do Resend no mês do lançamento ou Amazon SES; anunciar em ondas (seção 9.12.7) |
| Um único mantenedor | Plataforma parada ou contas perdidas se a pessoa sair | Contas técnicas do desenvolvedor com verificação em duas etapas e códigos de recuperação guardados (RNF-SEG-10); transferência futura para contas da igreja (DP-26); runbooks; desenho documentado |
| Código em repositório público (DP-24) | Arquitetura visível e risco de vazar segredo ou dado em commit, log ou issue | Nenhum segredo no repositório (bloqueio no push e gitleaks), logs dos workflows sem dados, falhas de segurança relatadas em privado (RNF-SEG-13). A segurança não depende do código ser secreto |
| Jobs agendados do GitHub atrasam ou param | Backup ou relatório de capacidade sem rodar | Heartbeat no Better Stack para cada job (RNF-CAP-04) |
| Backups do banco fora do Brasil | Transferência internacional de dados pessoais, inclusive de crianças | Criptografia antes do envio com a chave fora do provedor; avaliação no RIPD (RPV-11 e 12) |
| Carga manual de conteúdo por poucos professores | Gargalo editorial | Importador CSV e formulário minimalista |
| Perfil infantil configurado errado pelo responsável | Conteúdo restritivo demais ou inadequado | Restrição aplicada no servidor (RN-04); curadoria de todo o catálogo |
| Acesso indevido de admin a dados de alunos | Vazamento | Permissões mínimas, audit log e as proteções das contas de equipe (seção 9.12.3); MFA no pós-MVP |
| Senha de conta de equipe roubada (sem MFA no MVP) | Alteração ou publicação indevida de conteúdo e acesso a dados de alunos | Senha de 12+ caracteres, sessão curta, confirmação de senha em ações sensíveis, rate limit e audit log (seção 9.12.3); MFA como primeira melhoria de segurança do pós-MVP |
| Criança troca para o perfil do titular (sem PIN) | Acesso a conteúdo fora do público infantil | Todo o catálogo passa por revisão; PIN do titular no MVP (DP-13) |
| Curso publicado precisa de correção | O curso sai do ar até ser reaprovado | Agrupar correções; correção editorial e edição por versão ficam para depois (DP-14) |
| Protótipo promete o que o MVP não terá (certificados, recomendações, anotações, login com Google, “HD 1080p”) | Expectativa frustrada e retrabalho de interface | Matriz de rastreabilidade (seção 13); ajustar ou ocultar os componentes antes de implementar |
| Terceiros no front (Google Fonts, imagens do googleusercontent.com) | Exposição do IP de crianças e visitantes a terceiros; imagens que podem sumir | Hospedar fontes e imagens no próprio domínio (RPV-15) |

## 12. Decisões pendentes

| ID | Decisão | Padrão sugerido | Responsável |
| --- | --- | --- | --- |
| DP-01 | Modelo de identidade | Decidido em 05/11/2026: conta com perfis (ADR-004). Contas individuais vinculadas ficam como evolução, se o jurídico exigir | Produto |
| DP-02 | Idade limite do perfil infantil. As fontes consultadas divergem entre “até 16 anos” e “menos de 16 anos”; definir o valor de `child_profile_max_age` e confirmar que o titular tem 18 anos ou mais | 16 (a confirmar) | Jurídico |
| DP-03 | Quais públicos-alvo são permitidos para perfil infantil (`allowed_for_child`) | Infantil e Jovens | Produto e curadoria de conteúdo |
| DP-04 | Base legal do tratamento e texto do aceite no cadastro (RPV-07) | Consentimento do responsável no cadastro | Jurídico e encarregado |
| DP-05 | Consentimento do responsável (RPV-04), telefone obrigatório ao criar perfil infantil e verificação por OTP; provedor de SMS ou WhatsApp | Declaração com registro no MVP; OTP no pós-MVP, salvo exigência | Jurídico e Tecnologia |
| DP-06 | Faixas de idade dos públicos-alvo | Infantil 4–11; Jovens 12–17; Jovens+ 18–29; Adultos 30–59; 60+ (rótulo do protótipo para Seniors) | Produto e conteúdo |
| DP-07 | Nomenclatura: entidade “Curso” versus formato “Curso, Estudo, Misto” | Resolvida pelo protótipo para o MVP: formatos Curso, Estudo e Conteúdo Misto; “formações” como termo genérico | Produto e UX |
| DP-08 | Acesso de matriculados a cursos arquivados (RN-01) | Mantém acesso | Produto |
| DP-09 | Região e provedores (autenticação, banco, storage, e-mail) | Decidido em 17/11/2026: Vercel com funções em gru1, Supabase São Paulo (só Postgres), Cloudflare R2, Resend e Better Auth na aplicação (ADR-007 e 008) | Tecnologia |
| DP-10 | Encarregado (DPO) designado e RIPD elaborado | Antes do lançamento | Direção e jurídico |
| DP-11 | Retenção de contas inativas e de logs | 24 meses para contas inativas; logs por 30 dias (limite do plano gratuito do Axiom; o arquivamento por 90 dias sai do MVP). Registro de segurança, com IP (RNF-SEG-15, v2.4): 6 meses, o prazo de guarda de registros de acesso do Marco Civil da Internet (art. 15); confirmar se o artigo, que trata de provedor com fins econômicos, se aplica à igreja, e se os eventos de uma conta excluída podem seguir até o fim do prazo | Jurídico e Tecnologia |
| DP-12 | Metas numéricas dos KPIs | Após 4 semanas de baseline | Produto |
| DP-13 | PIN do titular para sair do perfil infantil (RF-PRF-11). Sem PIN, a criança pode trocar para o perfil do titular | Decidido em 17/11/2026: PIN no MVP. É o sistema de bloqueio que o Decreto 12.880/2026 pede para dispensar a aferição de idade (alerta 1.2); o jurídico confirma o enquadramento | Produto e jurídico |
| DP-14 | Edição de curso publicado (RN-05) | Decidido em 17/11/2026: nada muda no MVP. O curso publicado segue bloqueado (o admin devolve a rascunho, o instrutor edita e reenvia). A correção editorial de textos sem despublicar fica para depois | Produto e conteúdo |
| DP-15 | Certificados de conclusão (aparecem em 3 pontos do protótipo) | Pós-MVP; remover do protótipo no MVP | Produto e liderança |
| DP-16 | Anotações por aula e canal de dúvidas | Anotações no pós-MVP; dúvidas por e-mail ou WhatsApp institucional, sem fórum | Produto |
| DP-17 | Conceito de “membro” (“Membro & Aluno IBAV”, “Área de Membros”) | Não existe no MVP; remover o rótulo | Produto, liderança e jurídico |
| DP-18 | O que é uma “trilha” (5 no protótipo) em relação às 6 categorias | Vitrine editorial na home, sem entidade no modelo | Produto |
| DP-19 | Lista oficial de categorias (6 no catálogo e na home, 7 no perfil, com “Teologia & Doutrina”) | As 6 do catálogo; confirmar a sétima | Produto e conteúdo |
| DP-20 | Aula 1 grátis e prévia pública do curso | Trailer público no MVP; aula grátis no pós-MVP | Produto |
| DP-21 | Front-end: manter o site estático (Vite) ou migrar para framework com renderização no servidor (ADR-006) | Decidido em 17/11/2026: Next.js 16.4 com renderização híbrida por rota | Tecnologia |
| DP-22 | Canal oficial de contato (e-mail ou WhatsApp) e quem responde (RF-INS-05) | Um único canal institucional | Igreja e Tecnologia |
| DP-23 | Vídeo no MVP: YouTube (D-09) ou Mux. No plano por uso do Mux (sem mensalidade, crédito mensal de US$ 20 e 100 mil minutos assistidos grátis por mês), o custo nessa escala fica perto de zero e acabam os anúncios, os links não listados que dispensam o login e o armazenamento do YouTube no navegador. Em troca, exige cartão cadastrado e um fluxo de envio no backoffice | Decidido em 17/11/2026: YouTube no MVP, com o provedor guardado em cada vídeo (tabela `videos`, RN-09) e a interface `VideoPlayer` com testes de contrato, para que a troca seja um adaptador novo e um script de dados (seção 9.12.5). Gatilhos da troca na seção 9.13 | Produto e Tecnologia |
| DP-24 | Visibilidade do repositório do código (público ou privado) | Critério decidido em 17/11/2026: privado se tudo o que o projeto precisa couber no plano gratuito; público se o privado gratuito limitar recursos. Aplicando o critério (seção 9.12.12): o privado no GitHub Free não tem rulesets (PR obrigatório e CI verde antes do merge), varredura de segredos com bloqueio no push nem varredura de código (CodeQL), e tem 2.000 minutos de Actions por mês. Resultado: **público**, com as salvaguardas da RNF-SEG-13. Volta a ser privado se o projeto passar a ter um plano pago do GitHub | Tecnologia |
| DP-25 | Uso do Vercel Hobby pela igreja, cujos termos dizem “uso pessoal ou não comercial” | Decidido em 17/11/2026: uso do plano gratuito liberado pelo responsável. Se a Vercel contestar, Vercel Pro (US$ 20 por mês) ou a opção B da ADR-007 | Tecnologia |
| DP-26 | Titularidade das contas dos provedores e do domínio | Decidido em 17/11/2026: os recursos técnicos usam a conta do desenvolvedor, criada para o projeto, com verificação em duas etapas ativada nos provedores (RNF-SEG-10). As contas institucionais da igreja entram depois, no momento que a igreja definir, e não são dependência do MVP; a transferência terá runbook próprio | Igreja e Tecnologia |
| DP-27 | Segurança no MVP e forma da CSP (ADR-010) | Decidido em 17/11/2026: segurança técnica, de código e de dados é prioridade no MVP (RNF-SEG-10 a 14). CSP sem nonce, porque o nonce exigiria desligar o `cacheComponents` no Next.js 16.4, com as defesas da RNF-SEG-12; revisar quando a issue #89754 do Next.js for resolvida | Tecnologia |

## 13. Validação cruzada com o protótipo (ibav-sorocaba)

### 13.1 Escopo e método

Foi analisado o repositório `ibav-sorocaba` (arquivo .zip enviado): 9 páginas HTML estáticas em Vite 8 e Tailwind 3, exportadas do Google Stitch, com 2 commits, sem backend e sem rota protegida. O login é simulado em `localStorage` (`ibav:session`) e há 49 links `href="#"` sem destino. Cada tela foi lida (HTML, scripts inline e README) e cruzada com os requisitos da v2.1. Limite da análise: o protótipo é visual, então o comportamento além do que os scripts mostram foi inferido pelos componentes.

### 13.2 Matriz de rastreabilidade: tela para requisitos

| Tela | O que o protótipo mostra | Requisitos | Situação |
| --- | --- | --- | --- |
| `index.html` (Home) | Carrossel “Cursos em destaque” (5 cards com selos), vitrine “Descubra sua trilha” (5), curso em destaque, “Mais populares” (ranking 1 a 4), “Explore por categoria” (6), rodapé mínimo | RF-HOM-01 a 06 e 08, RN-07 | Coberta em parte. Faltam “Continue assistindo” e a variante logada; as trilhas não tinham requisito (DP-18) |
| `cursos.html` (Catálogo) | Busca, 4 opções de formato, 6 categorias mais “Todas”, ordenação, contagem, 8 cards com progresso, rodapé completo | RF-CAT-01 a 10 | Coberta com divergências (VC-05 e VC-06). Faltam faixa etária, estado vazio e URL |
| `curso.html` (Detalhe) | Breadcrumb, trailer, autor, nível, público, dois CTAs, “Sobre”, 4 aprendizados, 3 módulos com 9 aulas, bio do autor, “Este curso inclui”, copiar link, contato | RF-CUR-01 a 10, RN-10 | Coberta; traz itens fora do MVP (certificado, aula grátis) |
| `assistir.html` (Player) | Barra superior, player com controles próprios, anterior, próxima e concluir, abas Sobre, Materiais e Anotações, lateral com módulos | RF-APR-01 a 06, 11 e 12, RF-PRG-02 | Coberta em parte. Player próprio, anotações e MP3 divergem; falta a aula de leitura |
| `login.html` | E-mail, senha, mostrar senha, “Lembrar de mim”, “Esqueci minha senha”, Google | RF-AUT-03, 04, 11 e 13 | Coberta; o Google é pós-MVP e faltam as telas de recuperação |
| `cadastro.html` | Nome completo, e-mail, senha com medidor de força, aceite de termos | RF-AUT-01 e 05 | Coberta; falta a declaração de maioridade |
| `perfil.html` | Dados pessoais, foto, faixa etária, preferências, e-mails de novidades, certificados, histórico, sair | RF-PRF-04, 06 e 13 a 15 | Diverge da v2.1 (VC-01, 02, 20 e 21); falta a gestão de perfis (ADR-004) |
| `quem-somos.html` e `nossa-fe.html` | História, missão e visão, princípios, localização e horários; oito doutrinas e versículos | RF-INS-01 e 02 | Sem requisito até a v2.1; agora coberta |
| Cabeçalho e rodapés | Cabeçalho único com menu mobile e sessão simulada; cinco rodapés diferentes | RF-INS-03, RF-AUT-06 | Cabeçalho coberto; rodapé a unificar |

### 13.3 Achados

| ID | Achado no protótipo | Conflito ou lacuna | Tratamento nesta versão |
| --- | --- | --- | --- |
| VC-01 | `perfil.html`: pílulas de “Preferências de conteúdo” (7 temas) com o texto “receber recomendações na página inicial”, e faixa etária adulta (18–24 a 60+) | Contradiz a decisão da v2.1 (sem recomendações nem personalização) | Mantida a v2.1: sai do protótipo (RF-PRF-13) |
| VC-02 | Certificados em 3 pontos: `curso.html` (“Certificado digital de conclusão IBAV”) e `perfil.html` (3 certificados, “Acessar Certificados”, item no menu) | Certificado estava fora do escopo | Pós-MVP; textos saem do protótipo no MVP (DP-15) |
| VC-03 | `curso.html`: “Trailer & Aula 01 Grátis”, selo “Gratuita” na aula 1 e cadeado nas aulas 4 a 9 | Conflita com “conteúdo didático exige login” e com preview como futuro | Trailer opcional no MVP, aula grátis no pós-MVP; cadeado só para visitante (RF-CUR-04, 08; DP-20) |
| VC-04 | `login.html`: botão “Continuar com Google” (o cadastro não tem) | Login social era pós-MVP | Botão oculto no MVP (RF-AUT-11) |
| VC-05 | `cursos.html`: o campo pede “título, instrutor, livro ou tema” e o script busca em todo o texto do card | O requisito era só título | Título e autor (RF-CAT-02); livro e tema com as tags, no futuro |
| VC-06 | `cursos.html`: categoria e formato de seleção única; sem filtro de faixa etária, estado vazio, paginação ou URL | RF-CAT pedia múltipla seleção e faixa etária | Seleção única no MVP e novo componente de faixa etária (RF-CAT-03 a 08) |
| VC-07 | Rótulos “Curso”, “Estudo” e “Conteúdo Misto”; contador “N formações” | DP-07 estava pendente | Adotados (RN-08); “formações” como termo genérico |
| VC-08 | Públicos: Jovens, Adultos, 60+, “Todas as idades” (home) e “Todos os níveis” (card de Família). Nenhum “Infantil” | O público infantil (D-03) não aparece; “Todos os níveis” é nível, não público | RN-16 e RN-17; DP-06 ajustada |
| VC-09 | Nível (Iniciante, Intermediário) nos cards da home e no detalhe | Nível era opcional | Campo fechado e obrigatório (RN-16) |
| VC-10 | `curso.html`: dois CTAs, “Começar o curso” e “Fazer inscrição gratuita” | A v2.1 tinha matrícula implícita | Os dois criam a matrícula (RF-CUR-05, RF-PRG-01) |
| VC-11 | `assistir.html`: player próprio (±10 s, 1x, legendas, “HD 1080p”, tela cheia) e “Prévia em 4K HDR” no detalhe | Incompatível com o embed do YouTube; promete qualidade | Controles nativos no MVP; promessas removidas (RF-APR-01) |
| VC-12 | `assistir.html`: aba “Anotações & Dúvidas” (anotações privadas por aula e “Dúvida teológica? Envie para nossa equipe pastoral”) | Não estava nos requisitos | Anotações no pós-MVP (RF-APR-12); dúvidas pelo canal de contato (RF-INS-05, DP-16) |
| VC-13 | Materiais em PDF e em áudio MP3 (22,4 MB, “Modo Podcast”); a aba mostra o contador 1 e lista 2 itens | Só havia PDF | PDF e MP3 com limites (RF-APR-05); contador derivado |
| VC-14 | Não existe tela de aula de leitura, embora “Estudos Escritos” seja um formato do catálogo | Lacuna crítica para Estudo e Conteúdo Misto | RF-APR-11 (tela a criar) |
| VC-15 | Não existe “Meus cursos” (link do rodapé sem destino); os cards do catálogo já exibem progresso (“68% concluído”) | RF-PRG-03 sem tela | RF-PRG-03 e 08, RF-CAT-01 |
| VC-16 | A home não tem “Continue assistindo” nem variante logada. Os selos do carrossel incluem “Recomendado” | RF-HOM-02 sem componente; “Recomendado” sugere personalização que não existe | RF-HOM-02 e 08; trocar o selo |
| VC-17 | Home: 5 “trilhas” (Estudo Teológico, Estudo Temático, Apoio para Ministérios, Apoio para PGs, Material Institucional) e 6 categorias; “Explorar trilha” leva ao catálogo sem filtro | Trilha não existe no modelo e não coincide com categoria | Vitrine editorial sem entidade (RF-HOM-01, DP-18) |
| VC-18 | Categorias: 6 no catálogo e na home, 7 no perfil (“Teologia & Doutrina”) | Lista fechada inconsistente | DP-19 |
| VC-19 | Autores em texto livre: “Pr. André & Equipe”, “Ana e Paulo Mendes”, “Família IBAV”; bio e foto no detalhe | Autores coletivos ou sem conta não cabem em `course_instructors` por conta | Entidade `authors` (RN-18, RF-ADM-17) |
| VC-20 | `perfil.html`: foto por upload, telefone obrigatório, e-mail editável, “Membro & Aluno IBAV, desde março de 2024” e “criptografia ponta a ponta” | Foto de criança, conceito de “membro” (dado sensível) e promessa de segurança imprecisa | Avatar fixo (RF-PRF-14); DP-17; texto alinhado à RPV-10 |
| VC-21 | `perfil.html`: “Novidades e lembretes de estudo” por e-mail, já ligado | Consentimento pré-marcado não vale e exige e-mail em massa | Pós-MVP, desligado por padrão (RF-PRF-15) |
| VC-22 | `perfil.html` não tem gestão de perfis, troca de perfil nem acompanhamento do responsável; o cabeçalho não tem seletor de perfil | ADR-004 sem tela | RF-PRF-03, 05 e 13 |
| VC-23 | `cadastro.html` sem declaração de maioridade; `login.html` com “Lembrar de mim”; “Esqueci minha senha” sem tela | RF-AUT-01 e 04 só em parte | RF-AUT-01, 03 e 13 |
| VC-24 | Nenhuma rota protegida; sessão em `localStorage`; 49 links `href="#"` | RF-AUT-06 e 07 não valem no protótipo | RF-AUT-06, RNF-SEG-09 |
| VC-25 | Terceiros no front: Google Fonts (43 referências), 15 imagens em `lh3.googleusercontent.com` e Material Symbols | Expõe o IP de crianças e visitantes a terceiros (RPV-08) e as imagens podem sumir | RPV-15 |
| VC-26 | Páginas Quem Somos e Nossa Fé; 5 rodapés diferentes; “Termos & Privacidade”, “Fale Conosco” e “Dúvidas Frequentes” sem página | Não havia requisitos | RF-INS-01 a 08 |
| VC-27 | Uma configuração de tema do Tailwind por página (cores primárias e superfícies diferentes) e páginas estáticas | Sem design system único e sem renderização no servidor para SEO | RNF-UX-05, ADR-006 |
| VC-28 | “+1.400 membros ativos”, “Mais de 30 cursos” (o protótipo tem 8), “HD 1080p”, “4K HDR” | Números e promessas que podem ser falsos ou envelhecer | RF-HOM-09 |

### 13.4 Telas a criar no protótipo

1. “Meus cursos”, com abas Em andamento e Concluídos (RF-PRG-03).
2. Perfis: “Quem está assistindo?”, criar perfil infantil, acompanhamento do responsável e seletor de perfil no cabeçalho (RF-PRF-02, 03 e 05).
3. Aula de leitura com visualizador de PDF (RF-APR-11).
4. Recuperar senha, redefinir senha e confirmar e-mail (RF-AUT-13).
5. Termos de Uso, Política de Privacidade e contato (RF-INS-04 e 05).
6. Páginas de erro: 404, acesso negado e manutenção (RF-INS-07).
7. Home logada, com “Continue assistindo” (RF-HOM-02).
8. Catálogo: filtro de faixa etária, estado vazio e paginação (RF-CAT-05 e 08).
9. Backoffice: lista de cursos, formulário do curso, editor de currículo, pré-visualização com Aprovar e Manter em rascunho, importação por planilha e cadastro de autores (RF-ADM-01 a 08 e 17).

### 13.5 Componentes a ocultar ou remover no MVP

Preferências de conteúdo e faixa etária do perfil (VC-01), certificados (VC-02), aula 1 grátis (VC-03), botão do Google (VC-04), controles próprios do player e as promessas “HD 1080p” e “4K HDR” (VC-11), aba de anotações (VC-12), upload de foto e rótulo “Membro” (VC-20), e-mails de novidades ligados por padrão (VC-21) e o selo “Recomendado” (VC-16).

### 13.6 Dados de exemplo inconsistentes

O protótipo não deve servir de fonte de dados para o seed. As inconsistências encontradas:

- O autor de “Fundamentos da Fé” é Pr. André Campos na home e Pr. Marcos Vieira no catálogo e no detalhe.
- Os títulos das aulas diferem entre `curso.html` e `assistir.html` (por exemplo, a aula 5 é “A Obra da Cruz e Justificação” no detalhe e “Oração como relacionamento” no player, e “Boas-vindas e visão geral” se repete no início de cada módulo do player).
- A aula 2 tem 23 min no detalhe e 24:10 no player.
- A aba “Materiais complementares” mostra o contador 1 e lista 2 arquivos.
- A soma dos módulos de `curso.html` (69, 96 e 95 min) bate com as 4h 20min do curso, e o progresso de 22% do player bate com 2 de 9 aulas. Os dois confirmam as regras RN-10 e RN-11 de totais e progresso derivados.

## 14. Fontes da v2.3

Cotas, preços e comportamentos dos provedores foram pesquisados em 17/11/2026 e mudam com frequência. Confirme na criação das contas (seção 10.4) e sempre que um gatilho disparar.

- **Next.js:** [self-hosting (cache entre instâncias, `after`, streaming)](https://nextjs.org/docs/app/guides/self-hosting) · [OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) · [Adapter API estável na 16.2](https://www.nextjs.org/blog/nextjs-across-platforms) · [CSP na 16.4](https://unpkg.com/next@16.4.0/dist/docs/01-app/02-guides/content-security-policy.md) · [issue #89754: nonce e `cacheComponents`](https://github.com/vercel/next.js/issues/89754) · [projeto em 16.4 que desligou `cacheComponents` para usar nonce](https://github.com/thecodeblock-hendrik/word-on-the-water/pull/7)
- **GitHub (DP-24):** [rulesets: disponibilidade por plano](https://docs.github.com/en/enterprise-server@3.17/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) · [varredura de segredos](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning) · [varredura de código](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning) · [Secret Protection e Code Security](https://github.blog/changelog/2025-03-04-introducing-github-secret-protection-and-github-code-security/) · [ruleset em privado gratuito recusado (relato de 2026)](https://idirbenslama.github.io/Ophamin/free_tier_limits/)
- **Vercel:** [plano Hobby (cotas, pausa de 30 dias, upgrade)](https://vercel.com/docs/plans/hobby) · [uso e notificações](https://vercel.com/docs/pricing/manage-and-optimize-usage) · [`vercel billing usage`](https://vercel.com/docs/cli/usage) · [limites](https://vercel.com/docs/limits) · [região das funções](https://vercel.com/docs/functions/configuring-functions/region) · [termos](https://vercel.com/terms)
- **Supabase:** [tabelas não expostas automaticamente](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) · [billing por organização](https://supabase.com/docs/guides/platform/org-based-billing) · [tráfego de saída](https://www.supabase.com/docs/guides/platform/manage-your-usage/egress) · [carência e restrição no plano gratuito](https://supabase.com/docs/guides/platform/billing-faq) · [IPv4 e IPv6 (pooler em modo sessão)](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP) · [compute e downtime no upgrade](https://supabase.com/docs/guides/platform/compute-and-disk) · [Management API](https://supabase.com/docs/reference/api/introduction) · [Postgres 17 como padrão](https://supabase.com/changelog/35851-forthcoming-postgres-17-release-notes) · [limites do plano gratuito (guia 2026)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- **Saída do Supabase:** [Neon: migrar do Supabase](https://neon.com/docs/import/migrate-from-supabase) · [Prisma: migrar do Supabase](https://www.prisma.io/docs/guides/switch-to-prisma-postgres/from-supabase)
- **Neon (descartado no plano gratuito):** [limites do plano gratuito](https://neon.com/faqs/free-plan-limits-and-quotas) · [scale to zero](https://neon.com/docs/introduction/scale-to-zero)
- **Cloudflare R2:** [métricas e GraphQL](https://developers.cloudflare.com/r2/platform/metrics-analytics/) · [preços](https://developers.cloudflare.com/r2/pricing/)
- **Resend:** [`GET /usage`](https://resend.com/docs/api-reference/usage/retrieve-usage.md) · [cotas e limites](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- **Sentry:** [`stats_v2`](https://docs.sentry.io/api/organizations/retrieve-event-counts-for-an-organization-v2) · **GitHub:** [uso de billing](https://docs.github.com/en/rest/billing/usage)
- **Better Auth:** [rate limit](https://www.better-auth.com/docs/concepts/rate-limit) · [plugin admin](https://better-auth.com/docs/plugins/admin)
- **Mux:** [preços](https://www.mux.com/docs/pricing/overview.md)
- **Opção B e descartes:** [Coolify: rolling updates](https://coolify.io/docs/applications/deployments/rolling-updates) · [preços de VPS no Brasil](https://horadecodar.com.br/valor-vps/) · [Oracle Always Free 2026](https://infoq.com/news/2026/07/oracle-cloud-free-tier-limits/) · [Netlify: planos por créditos](https://www.netlify.com/changelog/netlify-pricing-update-introducing-credit-based-plans/)
- **Observabilidade:** [Axiom: plano gratuito](https://agentdeals.dev/vendor/axiom) · [Better Stack: plano gratuito](https://costbench.com/software/log-management/better-stack/free-plan/)
- **ECA Digital e SEO:** [Trench Rossi](https://www.trenchrossi.com/en/legal-alerts/brazil-regulates-the-children-and-adolescents-online-safety-act-digital-eca) · [Chambers](https://chambers.com/articles/eca-digital-é-regulamentado-e-anpd-publica-orientações-sobre-verificação-etária) · [ANPD](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/eca-digital-english) · [Google: simplificação dos resultados (jun/2025)](https://developers.google.com/search/blog/2025/06/simplifying-search-results)
- **Vídeo e PDF:** [YouTube sem cookies (Stefan Judis)](https://www.stefanjudis.com/blog/the-lie-of-youtubes-privacy-enhanced-embed-mode) · [anúncios em canais não monetizados](https://subscribr.ai/youtube-strategy/youtube-ads-on-non-monetized-channels-policy) · [PDF no iOS (WebKit 253671)](https://onbugs.webkit.org/show_bug.cgi?id=253671)

## 15. Fontes da v2.4

Consultadas em 18/11/2026.

- **Better Auth 1.7.15 (código-fonte):** [rate limiter: sem IP e com `disableIpTracking`, o limite não se aplica](https://github.com/better-auth/better-auth/blob/v1.7.15/packages/better-auth/src/api/rate-limiter/index.ts) · [`getIP`: devolve `null` com `disableIpTracking`](https://github.com/better-auth/better-auth/blob/v1.7.15/packages/core/src/utils/ip.ts) · [`createSession`: grava o IP pelo gancho `create.before`](https://github.com/better-auth/better-auth/blob/v1.7.15/packages/better-auth/src/db/internal-adapter.ts) · [opções `advanced.ipAddress`](https://github.com/better-auth/better-auth/blob/v1.7.15/docs/content/docs/reference/options.mdx)
- **Marco Civil da Internet:** [Lei 12.965/2014, art. 15 (guarda de registros de acesso a aplicações por 6 meses)](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm)
