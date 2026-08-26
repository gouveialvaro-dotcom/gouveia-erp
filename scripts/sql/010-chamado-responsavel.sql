-- Direcionamento de chamado a um responsável.
--
-- Antes desta mudança o aviso de "chamado novo" era distribuído em lista, para
-- todo usuário marcado com Usuario.notificaPosVenda em /administracao. Ninguém
-- era dono do chamado: o aviso chegava para vários e não obrigava ninguém.
--
-- Agora o chamado nasce com dono, e o destinatário do aviso passa a ser
-- derivado do próprio chamado (o responsável, mais os admins ativos onde faz
-- sentido). O flag deixa de governar qualquer envio.
--
-- Levantamento feito antes de aplicar (base de produção, 26/08/2026):
--   - "responsavelId" já era text NOT NULL com FK para Usuario — nada a migrar;
--   - "criadoPorId" já existia e estava preenchido nos 8 chamados da base, então
--     o backfill de "quem abriu" previsto no escopo não foi necessário.
--
-- Rodar no SQL Editor do Supabase e depois regerar src/lib/database.types.ts.

-- 1. Novos tipos de aviso.
--
-- Fora de transação de propósito: ALTER TYPE ... ADD VALUE só fica utilizável
-- depois do commit, então misturar com o resto convida a erro na primeira
-- gravação. Os valores antigos permanecem — "chamado_novo" deixa de ser
-- emitido, mas há registros históricos apontando para ele.

alter type "TipoNotificacaoPosVenda" add value if not exists 'chamado_direcionado';
alter type "TipoNotificacaoPosVenda" add value if not exists 'responsavel_alterado';
alter type "TipoNotificacaoPosVenda" add value if not exists 'chamado_sem_movimento';

-- 2. Índice do filtro "Meus chamados" e da varredura de chamados parados, que
-- sempre entram por (dono, estágio).

create index if not exists "Chamado_responsavelId_estagio_idx"
  on public."Chamado" ("responsavelId", estagio);

-- 3. Prazo do destaque de "sem movimento", ajustável sem deploy.
--
-- Fica em ParametroGeral, e não cravado no código, porque é o tipo de número
-- que a operação quer calibrar depois de ver o quadro por algumas semanas.

alter table public."ParametroGeral"
  add column if not exists "diasSemMovimentoChamado" integer not null default 2;

-- 4. Usuario.notificaPosVenda está APOSENTADO.
--
-- A coluna continua no banco de propósito: derrubá-la é irreversível e não
-- devolve nada em troca, enquanto mantê-la deixa o caminho de volta barato caso
-- a distribuição em lista precise voltar. Nenhuma consulta do app a lê mais, e
-- o controle saiu de /administracao.

comment on column public."Usuario"."notificaPosVenda" is
  'INATIVA desde 010-chamado-responsavel.sql. O destinatário do aviso de pós-venda passou a ser derivado do chamado (responsável + admins ativos). Mantida sem DROP por ser reversível.';
