-- Chat interno: conversa por obra, direta (1:1) e grupo avulso.
--
-- Chaves em text, como todo o resto do schema — uma FK uuid contra Usuario.id
-- (text) não fecha. Ver o que aconteceu com a 001-funcoes.sql.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais).

begin;

create type public."TipoConversa" as enum ('obra', 'direta', 'grupo');

create table public."Conversa" (
  id text primary key default (gen_random_uuid())::text,
  tipo public."TipoConversa" not null,
  -- Só o grupo avulso guarda título. Em obra e direta o título de exibição é
  -- derivado em lib/chat.ts (nome da obra / nome do outro participante), para
  -- não haver nome duplicado que possa divergir da origem.
  titulo text,
  "obraId" text references public."Obra"(id) on delete cascade,
  "criadaPorId" text not null references public."Usuario"(id) on delete restrict,
  "criadaEm" timestamptz not null default now(),

  -- Cada tipo tem exatamente os campos que fazem sentido para ele. Sem isto dá
  -- para gravar um grupo sem nome (que a lista não sabe rotular) ou uma direta
  -- pendurada numa obra.
  constraint "Conversa_tipo_check" check (
    (tipo = 'obra'   and "obraId" is not null and titulo is null)
    or
    (tipo = 'grupo'  and "obraId" is null and titulo is not null)
    or
    (tipo = 'direta' and "obraId" is null and titulo is null)
  )
);

-- Uma obra tem no máximo uma conversa. Parcial porque só vale para tipo 'obra'.
create unique index "Conversa_obraId_key"
  on public."Conversa" ("obraId") where tipo = 'obra';

create table public."ParticipanteConversa" (
  id text primary key default (gen_random_uuid())::text,
  "conversaId" text not null references public."Conversa"(id) on delete cascade,
  "usuarioId" text not null references public."Usuario"(id) on delete cascade,
  "entrouEm" timestamptz not null default now(),
  -- Base do não lido e do sino: as mensagens da conversa criadas depois desta
  -- marca, de outro autor, são as não lidas. Não existe tabela de notificação.
  "ultimaLeituraEm" timestamptz
);

create unique index "ParticipanteConversa_conversaId_usuarioId_key"
  on public."ParticipanteConversa" ("conversaId", "usuarioId");

-- O sino varre as conversas do usuário; a lista de participantes varre a
-- conversa. Os dois sentidos são consultados.
create index "ParticipanteConversa_usuarioId_idx"
  on public."ParticipanteConversa" ("usuarioId");

create table public."Mensagem" (
  id text primary key default (gen_random_uuid())::text,
  "conversaId" text not null references public."Conversa"(id) on delete cascade,
  -- restrict e não cascade: apagar um usuário não pode furar o histórico, que
  -- é a razão de existir do módulo.
  "autorId" text not null references public."Usuario"(id) on delete restrict,
  -- null quando a mensagem é só anexo.
  corpo text,
  "criadaEm" timestamptz not null default now(),
  -- Soft delete: a linha fica, o card vira "mensagem removida", e sobra o
  -- registro de quem removeu e quando. Só admin remove.
  "removidaEm" timestamptz,
  "removidaPorId" text references public."Usuario"(id) on delete set null,

  constraint "Mensagem_removida_check" check (
    ("removidaEm" is null and "removidaPorId" is null)
    or
    ("removidaEm" is not null and "removidaPorId" is not null)
  )
);

-- A query mais quente do módulo: as últimas mensagens de uma conversa.
create index "Mensagem_conversaId_criadaEm_idx"
  on public."Mensagem" ("conversaId", "criadaEm" desc);

create table public."AnexoMensagem" (
  id text primary key default (gen_random_uuid())::text,
  "mensagemId" text not null references public."Mensagem"(id) on delete cascade,
  "nomeArquivo" text not null,
  caminho text not null,
  "tipoMime" text,
  tamanho integer,
  "criadoEm" timestamptz not null default now()
);

-- Nomes de coluna iguais aos de AnexoChamado de propósito: é o mesmo desenho,
-- só muda o bucket ('chat' em vez de 'pos-venda'). Fica de fora o
-- enviadoPorId de AnexoChamado — aqui quem enviou é o autor da mensagem, e
-- duplicar o dado só cria chance de divergir.
create index "AnexoMensagem_mensagemId_idx"
  on public."AnexoMensagem" ("mensagemId");

-- Baseline de segurança: RLS ligada e nenhuma policy, como as demais tabelas.
-- Nega anon e authenticated; a aplicação passa pela service role, que ignora
-- RLS. Importa mais aqui do que no resto do schema, porque o chat é o que
-- coloca a anon key no navegador (Realtime).
alter table public."Conversa"             enable row level security;
alter table public."ParticipanteConversa" enable row level security;
alter table public."Mensagem"             enable row level security;
alter table public."AnexoMensagem"        enable row level security;

commit;
