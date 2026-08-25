-- Gestão da fila de atendimento por WhatsApp (fase 2).
--
-- A fase 1 trouxe a conversa para dentro do ERP. Esta fase resolve o controle
-- da operação: arquivar sem apagar, buscar no histórico, saber de quem é cada
-- conversa e conter o risco do envio ativo.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais — ver
-- README.md) e depois regerar src/lib/database.types.ts.

begin;

-- --------------------------------------------------------------------------
-- 1. Arquivar conversa
-- --------------------------------------------------------------------------
-- Arquivar NÃO apaga. O motivo de a página existir é preservar o registro do
-- que foi combinado com o cliente; some da lista padrão e continua na busca.

alter table public."ConversaWhatsapp"
  add column "arquivadaEm" timestamptz,
  add column "arquivadaPorId" text references public."Usuario"(id) on delete set null;

-- A lista padrão só mostra conversa ativa e ordena por última mensagem. O
-- índice parcial serve exatamente essa consulta, que é a mais frequente da
-- tela.
create index "ConversaWhatsapp_ativas_idx"
  on public."ConversaWhatsapp" ("ultimaMensagemEm" desc)
  where "arquivadaEm" is null;

-- --------------------------------------------------------------------------
-- 2. Ocultar mensagem (higiene da base)
-- --------------------------------------------------------------------------
-- Para tirar da vista teste técnico e mensagem de número interno. Também não
-- apaga: sai da conversa e continua no banco, com quem ocultou registrado.

alter table public."MensagemWhatsapp"
  add column "ocultaEm" timestamptz,
  add column "ocultaPorId" text references public."Usuario"(id) on delete set null;

-- --------------------------------------------------------------------------
-- 3. Busca no histórico
-- --------------------------------------------------------------------------
-- Coluna gerada em vez de índice sobre expressão: assim o PostgREST consegue
-- filtrar pela coluna direto (.textSearch), sem função no meio.
--
-- Dicionário "portuguese" e não "simple" porque a busca é sobre conversa
-- escrita à mão: quem procura "inversor" precisa achar "inversores", e o
-- radicalizador resolve isso sem gambiarra de LIKE.
--
-- Sem unaccent de propósito: a extensão não é IMMUTABLE e não pode entrar em
-- coluna gerada. Se acento virar problema na prática, o caminho é uma função
-- wrapper marcada como immutable — não vale o risco agora.
alter table public."MensagemWhatsapp"
  add column busca tsvector
  generated always as (to_tsvector('portuguese', coalesce(conteudo, ''))) stored;

create index "MensagemWhatsapp_busca_idx"
  on public."MensagemWhatsapp" using gin (busca);

-- --------------------------------------------------------------------------
-- 4. Aviso de conversa parada sem dono
-- --------------------------------------------------------------------------
-- Reaproveita NotificacaoPosVenda em vez de criar uma segunda caixa de avisos:
-- o sino da topbar é um só, e duas fontes significariam duas implementações de
-- leitura e de deduplicação para manter em paralelo.

alter type public."TipoNotificacaoPosVenda" add value if not exists 'conversa_sem_dono';
alter type public."TipoNotificacaoPosVenda" add value if not exists 'conversa_atribuida';

-- O aviso de conversa não tem chamado associado.
alter table public."NotificacaoPosVenda" alter column "chamadoId" drop not null;

alter table public."NotificacaoPosVenda"
  add column "conversaId" text references public."ConversaWhatsapp"(id) on delete cascade;

-- Sem os dois nulos possíveis a dedup ainda funcionaria; com eles, não. Em
-- índice unique comum o Postgres trata cada NULL como distinto, então o aviso
-- de conversa (chamadoId nulo) duplicaria a cada verificação — justo o caso
-- novo. NULLS NOT DISTINCT (Postgres 15+) faz o nulo comparar como valor.
drop index if exists public."NotificacaoPosVenda_dedupe_key";

create unique index "NotificacaoPosVenda_dedupe_key"
  on public."NotificacaoPosVenda"
  ("usuarioId", "chamadoId", "conversaId", tipo, referencia)
  nulls not distinct;

-- Quem recebe o aviso de conversa sem dono é todo mundo com escrita em
-- posVenda — diverge do resto do módulo, onde o destinatário é escolhido um a
-- um por notificaPosVenda, e é intencional: a fila parada é problema do time,
-- não de um responsável nomeado. Esta coluna é a válvula de escape do admin,
-- para o canal não virar um aviso que ninguém consegue silenciar.
alter table public."Usuario"
  add column "notificaWhatsappSemDono" boolean not null default true;

-- --------------------------------------------------------------------------
-- 5. Horário comercial e teto de envio ativo
-- --------------------------------------------------------------------------
-- Horário comercial não existia no sistema e é o que dá sentido a "2 horas
-- úteis". Fica em ParametroGeral, como fonte única — nunca fixo no código.

alter table public."ParametroGeral"
  add column "horaInicioComercial" time not null default '08:00',
  add column "horaFimComercial" time not null default '17:00',
  -- ISO-8601: 1 = segunda … 7 = domingo. Segunda a sexta.
  add column "diasSemanaComercial" integer[] not null default '{1,2,3,4,5}',
  -- Teto diário de conversas iniciadas do zero. A conexão é por API não
  -- oficial sobre o número corporativo, e disparo para quem não escreveu é o
  -- comportamento que mais leva ao bloqueio permanente pela Meta. É parâmetro,
  -- e não constante, para poder ser afrouxado depois de ver o número aguentar.
  add column "tetoDiarioConversasNovas" integer not null default 20;

commit;
