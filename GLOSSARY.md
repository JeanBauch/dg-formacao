# DG Formação

Plataforma web gratuita de cursos e estudos da Igreja Batista Água Viva de Sorocaba (IBAV), com perfis por família e todo o conteúdo revisado antes de publicar. Este glossário fixa o vocabulário de issues, specs, ADRs e da interface. Quando o conceito tem um nome no código, ele aparece em _No código_. Termos que dependem de uma decisão pendente trazem o ID do DP (seção 12 dos requisitos).

## Linguagem

### Conta e acesso

**Conta**:
Registro do titular adulto: e-mail, senha, nome e telefone. Responde legalmente pelos perfis.
_No código_: `user` (tabela do Better Auth); as chaves que apontam para ela se chamam `user_id`.
_Evitar_: usuário, cadastro

**Titular**:
O adulto dono da conta. Sem qualificação, "titular" é sempre este; para o sentido da LGPD (a pessoa a quem os dados se referem), escreva "titular dos dados".
_Evitar_: dono da conta, pai, mãe, usuário

**Responsável**:
O titular agindo como responsável legal por um perfil infantil da conta, como na declaração do responsável e no acompanhamento pelo responsável.
_Evitar_: tutor, guardião

**Identidade de login**:
Forma de entrar numa conta: e-mail e senha no MVP, Google no pós-MVP.
_No código_: `account` (tabela do Better Auth). No código, _account_ é sempre isto, nunca a Conta.
_Evitar_: conta, credencial

**Sessão**:
Login ativo de uma conta num dispositivo. Uma conta pode ter várias.
_No código_: `session` (tabela do Better Auth).

**Papel**:
Atribuição de equipe guardada na conta: Instrutor ou Admin. Uma conta pode ter os dois.
_No código_: `role` do plugin `admin`, com os valores `instructor` e `admin`; uma conta sem papel de equipe tem o valor padrão `user`.

**Visitante**:
Quem navega sem sessão. Não é um papel guardado.

**Aluno**:
Quem estuda por um perfil. Não é um papel guardado: matrículas e progresso pertencem ao perfil, não à conta.
_Evitar_: estudante, usuário

**Instrutor**:
Papel de equipe que cria cursos, edita os cursos de que é editor e os envia para revisão.
_No código_: `instructor`.
_Evitar_: professor

**Admin**:
Papel de equipe que revisa, publica e arquiva cursos e gerencia a equipe, a taxonomia e as contas de alunos.
_No código_: `admin`.
_Evitar_: administrador, moderador

**Conta de equipe**:
Conta com ao menos um papel. Nasce só por convite e nunca tem perfil infantil.
_Evitar_: conta de staff, conta admin

**Permissão**:
Chave no formato `recurso:ação` (por exemplo, `course:publish`) concedida a um papel.
_No código_: `capability`, decidida pela função `can()`.
_Evitar_: capacidade, direito

**Convite**:
Criação de uma conta de equipe pelo admin, já com o papel definido.

**Suspensão**:
Bloqueio de uma conta pelo admin, que também encerra as sessões dela.
_No código_: `ban` (plugin `admin`).
_Evitar_: banimento, bloqueio

**Ação sensível**:
Ação de equipe que exige login recente: convidar ou suspender conta, mudar papel, aprovar ou arquivar curso.

**Aceite**:
Ato de aceitar os Termos de Uso e a Política de Privacidade, registrado com a versão e a data de cada documento e sem IP. Acontece no cadastro e, na conta de equipe, ao definir a senha do convite. Pendente: o texto e a base legal, DP-04.
_No código_: `consents`.

**Declaração de maioridade**:
Declaração do titular, no cadastro, de ter 18 anos ou mais. Registra a responsabilidade do titular, mas não verifica a idade. Não é a declaração do responsável, que é de outro momento (criar o primeiro perfil infantil). Pendente: DP-04.
_No código_: `consents`.

### Perfis

**Perfil**:
Identidade de uso dentro da conta. Guarda nome, avatar, tipo, matrículas e progresso.
_No código_: `profiles`.

**Perfil do titular**:
O perfil padrão criado junto com a conta, com o nome do cadastro. Toda conta tem um.
_No código_: `profiles.is_primary`.
_Evitar_: perfil principal

**Perfil padrão**:
Perfil que vê o catálogo completo.
_No código_: `kind = standard`.

**Perfil infantil**:
Perfil que o titular marca como infantil; só vê cursos de públicos-alvo permitidos para crianças. Pendente: o limite de idade (`child_profile_max_age`), DP-02.
_No código_: `kind = child`.

**Perfil ativo**:
Perfil escolhido em "Quem está assistindo?", guardado no servidor junto da sessão do dispositivo.
_No código_: `session_profiles`.

**PIN do titular**:
Código de 4 a 6 dígitos que o titular define e que é pedido ao sair de um perfil infantil para um perfil padrão.
_No código_: `account_pins`.
_Evitar_: senha do perfil

**Declaração do responsável**:
Aceite em que o titular declara ser responsável legal e autoriza o uso, registrado com texto e versão ao criar o primeiro perfil infantil. Pendente: forma do consentimento e verificação adicional, DP-05.
_No código_: `consents`.
_Evitar_: autorização parental

**Escopo do catálogo**:
Uma das duas variantes do catálogo, `standard` ou `child`, conforme o tipo do perfil ativo. Visitantes usam `standard`.

### Catálogo

**Catálogo**:
O conjunto dos cursos publicados, com busca, filtros e ordenação.

**Curso**:
Unidade publicável do catálogo, feita de módulos, aulas e materiais. Pendente: o nome na interface ("formação" como termo genérico), DP-07.
_No código_: `courses`.

**Formato**:
Classificação derivada do curso: só vídeo, só leitura ou misto. Pendente: os rótulos na interface (Curso, Estudo e Conteúdo Misto), DP-07.
_No código_: `content_format` (`video`, `reading`, `mixed`).

**Currículo**:
A estrutura de um curso: seus módulos e aulas, em ordem.
_Evitar_: grade, ementa

**Módulo**:
Agrupador ordenado de aulas dentro de um curso.
_No código_: `modules`.

**Aula**:
Unidade de conteúdo: vídeo ou leitura (PDF).
_No código_: `lessons`, com `type` `video` ou `reading`.

**Vídeo**:
Registro de um vídeo num provedor (YouTube no MVP), usado por aulas e trailers.
_No código_: `videos`, com `provider` e `external_id`.

**Trailer**:
Vídeo público de apresentação do curso.
_No código_: `courses.trailer_video_id`.

**Material complementar**:
Arquivo para download associado a uma aula ou ao curso. Não conta para o formato.
_No código_: `attachments`.
_Evitar_: anexo

**Arquivo de mídia**:
Arquivo guardado no storage (capa, foto, PDF, áudio), sempre referenciado por chave, nunca por URL.
_No código_: `media_objects`.

**Autor**:
Pessoa ou grupo exibido como responsável pelo curso (nome, bio, foto). Pode não ter conta.
_No código_: `authors`.

**Editor do curso**:
Conta de equipe ligada a um curso, que pode editá-lo: quem o criou e quem o admin ligar.
_No código_: `course_editors`.
_Evitar_: instrutor dono, dono do curso

**Categoria**:
Classificação temática de lista fechada, usada nos filtros do catálogo. Pendente: a lista oficial, DP-19.
_No código_: `categories`.
_Evitar_: assunto, tema

**Público-alvo**:
Faixa etária à qual o curso se destina; um curso pode ter vários. Pendente: as faixas de idade (DP-06) e quais públicos são permitidos para perfil infantil (`allowed_for_child`, DP-03).
_No código_: `audiences`.
_Evitar_: faixa etária, idade

**Nível**:
Grau de profundidade do curso: Iniciante, Intermediário, Avançado ou Todos os níveis.
_No código_: `courses.level`.

**Busca sem resultado**:
Termo buscado que não encontrou nenhum curso, contado por dia e sem vínculo com o perfil.
_No código_: `search_misses`.

**Tag / pílula**:
Marcador de conteúdo de vocabulário fechado. Futuro.
_No código_: `tags`.

**Trilha**:
Vitrine editorial da home ("Estudo Teológico", "Apoio para PGs" e outras). Não é categoria nem entidade do modelo no MVP. Pendente: DP-18.

### Fluxo editorial

**Backoffice**:
Área da equipe para criar, revisar e publicar cursos e gerenciar a equipe.
_Evitar_: painel admin, CMS

**Fluxo editorial**:
O caminho de um curso do rascunho à publicação, sempre com a revisão do admin.

**Estado do curso**:
Rascunho, Em revisão, Publicado ou Arquivado. Curso publicado não é editado: volta a rascunho para correção.
_No código_: `courses.status` (`draft`, `in_review`, `published`, `archived`).

**Envio para revisão**:
Ato do editor do curso que leva um rascunho completo ao estado Em revisão.

**Revisão**:
Registro de um envio e da decisão do admin: Aprovar (publica) ou Manter em rascunho. "Aprovação" é só a decisão de aprovar, não a revisão inteira.
_No código_: `course_reviews`.
_Evitar_: parecer, avaliação

**Pré-visualização**:
Visão somente leitura do curso, como o aluno o vê, sem criar matrícula nem progresso.
_Evitar_: preview

**Importação por planilha**:
Carga de cursos a partir de um arquivo CSV.
_Evitar_: upload em massa

### Aprendizagem

**Matrícula**:
Relação entre um perfil e um curso, com status, datas e a última aula acessada.
_No código_: `enrollments`.
_Evitar_: inscrição

**Progresso**:
Conjunto das aulas concluídas por um perfil. O percentual é derivado.
_No código_: `lesson_progress`.

**Salvos**:
Lista de cursos guardados por um perfil para ver depois, independente da matrícula. Pós-MVP.
_No código_: `saved_courses`.
_Evitar_: favoritos

### Registros e operação

**Registro de auditoria**:
Registro de cada ação de equipe no backoffice: quem, o quê, quando, antes e depois.
_No código_: `audit_log`.
_Evitar_: log, histórico

**Registro de segurança**:
Registro de eventos de autenticação, bloqueios e recusas de autorização, com IP, para investigar incidentes e ataques. É o único lugar que guarda o IP.
_No código_: `security_events`.
_Evitar_: log, log de acesso

**Teto diário**:
Número máximo de linhas novas que o registro de segurança ganha num dia UTC, configurável de 1 a 2.000, com padrão 1.000. Acima dele, o evento que criaria uma linha nova conta numa linha de transbordo, e o primeiro do dia avisa a equipe. Os eventos que exigem credencial válida ou sessão ficam fora dele. É aproximado: eventos simultâneos na borda podem passar dele por poucas linhas.
_No código_: `SECURITY_EVENTS_DAILY_CAP`.
_Evitar_: limite, cota

**Linha de transbordo**:
Linha do registro de segurança que só conta os eventos que criariam uma linha nova acima do teto diário: uma por evento e hora, sem IP, user agent nem detalhes. A falha de login e o pedido de redefinição contra conta de equipe têm a sua, com a conta.
_No código_: `overflowRow`, com a chave começando por `overflow:`.
_Evitar_: excedente, linha de overflow

**Cota gratuita**:
Limite de uso de um plano gratuito de provedor, por dia ou por mês.

**Gatilho de upgrade**:
Nível de uso de uma cota que dispara a troca de plano ou de provedor.

**Relatório de capacidade**:
Job diário que mede o uso de cada cota gratuita e abre issues quando ela se aproxima do teto.

### Pendentes

**Membro**:
Rótulo do protótipo ("Membro & Aluno IBAV", "Área de Membros") sem conceito definido. Não existe no MVP. Pendente: DP-17.

**Encarregado**:
Pessoa designada para tratar dos dados pessoais (DPO) e atender os titulares dos dados. Pendente: a designação, DP-10.
_Evitar_: DPO (só entre parênteses)
