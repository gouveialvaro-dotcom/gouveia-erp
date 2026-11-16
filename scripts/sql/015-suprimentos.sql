-- Suprimentos — requisição de compra, cotação, aprovação por alçada, pedido de
-- compra e recebimento na obra (Fase 1, sem Conta Azul e sem BI).
--
-- SÓ CRIA OBJETOS NOVOS. Nenhuma tabela, tipo ou função existente é alterada:
-- o vínculo obra → empresa faturada mora em "ObraFaturamento", e não numa coluna
-- nova em "Obra". Rodar este arquivo não muda o comportamento de nenhum módulo
-- que já está no ar.
--
-- Mesmas convenções do resto do schema (ver 012): chave em text com
-- gen_random_uuid()::text, PascalCase nas tabelas, camelCase nas colunas, RLS
-- habilitada e SEM policy — o app fala com o banco só pela service role.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais — ver
-- README.md). Pode ser rodado inteiro de uma vez.

begin;

-- 1. Tipos.

create type public."PapelSuprimentos" as enum
  ('comprador', 'aprovador_gerencia', 'aprovador_diretoria', 'recebedor');

create type public."TipoProdutoSuprimentos" as enum ('material', 'servico', 'locacao');

create type public."UrgenciaRequisicao" as enum ('normal', 'emergencial');

create type public."StatusRequisicao" as enum (
  'pendente',
  'em_cotacao',
  'aguardando_aprovacao',
  'aprovada',
  'recusada',
  'pedido_emitido',
  'concluida',
  'cancelada'
);

create type public."ModalidadeFrete" as enum ('cif', 'fob');

create type public."NivelAlcada" as enum ('comprador', 'gerencia', 'diretoria');

-- "devolvida" volta a requisição para o comprador refazer a cotação;
-- "recusada" encerra a requisição.
create type public."DecisaoAprovacao" as enum ('aprovada', 'devolvida', 'recusada');

create type public."StatusEntregaPedido" as enum
  ('pendente', 'recebido_conforme', 'recebido_inconforme');

create type public."SituacaoRecebimento" as enum ('conforme', 'inconforme');

create type public."TipoNotificacaoSuprimentos" as enum (
  'nova_requisicao',
  'aprovacao_pendente',
  'requisicao_devolvida',
  'requisicao_recusada',
  'requisicao_cancelada',
  'pedido_emitido',
  'recebimento_registrado'
);

-- 2. Configuração.

-- Quem faz o quê dentro do módulo. Fica fora de "PerfilUsuario" de propósito:
-- um perfil novo obrigaria a revisar a matriz de permissões inteira, e aqui a
-- mesma pessoa acumula papéis (a Fábia requisita e aprova).
create table public."PapelUsuarioSuprimentos" (
  id text primary key default (gen_random_uuid())::text,
  "usuarioId" text not null references public."Usuario"(id) on delete cascade,
  papel public."PapelSuprimentos" not null,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null,
  unique ("usuarioId", papel)
);

-- Linha única com os limites de alçada. Editável na tela de configuração, para
-- que mudar o teto do comprador não dependa de deploy.
create table public."ParametroSuprimentos" (
  id text primary key default 'padrao' check (id = 'padrao'),
  -- Até este valor (inclusive) o comprador aprova sozinho.
  "limiteComprador" numeric(14, 2) not null default 500,
  -- Até este valor (inclusive) basta a gerência; acima, gerência + diretoria.
  "limiteGerencia" numeric(14, 2) not null default 3000,
  -- Abaixo disso a requisição segue, mas com alerta ao comprador e ao requisitante.
  "minimoCotacoes" integer not null default 3,
  "atualizadoEm" timestamptz not null default now(),
  "atualizadoPorId" text references public."Usuario"(id) on delete set null,
  constraint "ParametroSuprimentos_limites_check"
    check ("limiteComprador" >= 0 and "limiteGerencia" > "limiteComprador"),
  constraint "ParametroSuprimentos_minimo_check" check ("minimoCotacoes" >= 1)
);

insert into public."ParametroSuprimentos" (id) values ('padrao');

-- 3. Cadastros.

-- CNPJs do grupo que podem ser faturados. Nasce vazio: o cadastro é feito na tela.
create table public."EmpresaGrupo" (
  id text primary key default (gen_random_uuid())::text,
  "razaoSocial" text not null,
  "nomeFantasia" text,
  cnpj text not null unique,
  uf char(2),
  ativo boolean not null default true,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null
);

-- Qual empresa do grupo paga as compras de cada obra. Tabela própria para não
-- alterar "Obra".
create table public."ObraFaturamento" (
  "obraId" text primary key references public."Obra"(id) on delete cascade,
  "empresaId" text not null references public."EmpresaGrupo"(id) on delete restrict,
  "atualizadoEm" timestamptz not null default now(),
  "atualizadoPorId" text references public."Usuario"(id) on delete set null
);

create table public."Fornecedor" (
  id text primary key default (gen_random_uuid())::text,
  "razaoSocial" text not null,
  "nomeFantasia" text,
  -- Opcional: fornecedor pessoa física ou cadastrado às pressas na cotação.
  cnpj text unique,
  -- UF de origem, base do alerta de DIFAL nas cotações.
  uf char(2),
  cidade text,
  vendedor text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean not null default true,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null
);

-- Catálogo de Suprimentos. Separado de "Material" (que é catálogo de CUSTO de
-- orçamento, com custo obrigatório e itens de engenharia), porque aqui entram
-- peças, insumos e locações que nunca vão para uma proposta comercial.
create table public."Produto" (
  id text primary key default (gen_random_uuid())::text,
  numero integer generated by default as identity unique,
  descricao text not null,
  -- Descrição em maiúsculas, sem acento e com espaços colapsados. É a chave de
  -- duplicidade: "Cimento  Poty 50kg" e "CIMENTO POTY 50KG" são o mesmo item.
  "chaveDescricao" text not null unique,
  unidade text not null,
  categoria text,
  tipo public."TipoProdutoSuprimentos" not null default 'material',
  ativo boolean not null default true,
  -- Item importado ou cadastrado às pressas na cotação, que ainda precisa de
  -- conferência de unidade/categoria.
  revisar boolean not null default false,
  observacoes text,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null,
  "atualizadoEm" timestamptz not null default now()
);

-- Código do produto em cada cadastro de origem (hoje, os três CNPJs no Conta
-- Azul). O mesmo código aparece em CNPJs diferentes para produtos diferentes,
-- então a chave é (origem, código) — e é ela que a integração futura vai usar.
create table public."ProdutoCodigoExterno" (
  id text primary key default (gen_random_uuid())::text,
  "produtoId" text not null references public."Produto"(id) on delete cascade,
  origem text not null,
  codigo text not null,
  ean text,
  "criadoEm" timestamptz not null default now(),
  unique (origem, codigo)
);

create index "ProdutoCodigoExterno_produto_idx" on public."ProdutoCodigoExterno" ("produtoId");
create index "ProdutoCodigoExterno_ean_idx" on public."ProdutoCodigoExterno" (ean) where ean is not null;

-- 4. Requisição.

create table public."Requisicao" (
  id text primary key default (gen_random_uuid())::text,
  -- REQ-0001, REQ-0002... O pedido herda o número (PED-0001-A).
  numero integer generated by default as identity unique,
  "requisitanteId" text not null references public."Usuario"(id) on delete restrict,
  -- Centro de custo: sempre uma obra (decisão do escopo).
  "obraId" text not null references public."Obra"(id) on delete restrict,
  "dataSolicitacao" date not null default current_date,
  "prazoDesejado" date not null,
  urgencia public."UrgenciaRequisicao" not null default 'normal',
  observacoes text,
  status public."StatusRequisicao" not null default 'pendente',
  "compradorId" text references public."Usuario"(id) on delete set null,
  -- Preenchidos ao enviar para aprovação, com o total efetivo (itens + frete
  -- + DIFAL de cada fornecedor escolhido).
  "valorTotal" numeric(14, 2),
  "nivelAlcada" public."NivelAlcada",
  -- Conta as idas para aprovação. Uma devolução abre a rodada seguinte, e as
  -- decisões antigas ficam no histórico sem valer para a nova.
  "rodadaAprovacao" integer not null default 0,
  "enviadaAprovacaoEm" timestamptz,
  "canceladaEm" timestamptz,
  "canceladaPorId" text references public."Usuario"(id) on delete set null,
  "motivoCancelamento" text,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now()
);

create index "Requisicao_status_idx" on public."Requisicao" (status);
create index "Requisicao_requisitante_idx" on public."Requisicao" ("requisitanteId");
create index "Requisicao_obra_idx" on public."Requisicao" ("obraId");

create table public."RequisicaoItem" (
  id text primary key default (gen_random_uuid())::text,
  "requisicaoId" text not null references public."Requisicao"(id) on delete cascade,
  ordem integer not null,
  -- Texto livre do requisitante: o canteiro não fica preso ao catálogo.
  descricao text not null,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  unidade text not null,
  especificacao text,
  -- Vínculo ao catálogo, feito pelo comprador durante a cotação.
  "produtoId" text references public."Produto"(id) on delete set null,
  -- Preço escolhido entre as cotações (FK criada depois de "CotacaoItem").
  "cotacaoItemVencedorId" text,
  unique ("requisicaoId", ordem)
);

-- 5. Cotação.

create table public."Cotacao" (
  id text primary key default (gen_random_uuid())::text,
  "requisicaoId" text not null references public."Requisicao"(id) on delete cascade,
  "fornecedorId" text not null references public."Fornecedor"(id) on delete restrict,
  vendedor text,
  -- Copiada do fornecedor no momento da cotação: mudar o cadastro depois não
  -- reescreve a análise de DIFAL de uma compra já feita.
  "ufOrigem" char(2),
  "incideDifal" boolean not null default false,
  "aliquotaDifal" numeric(7, 4),
  -- O comprador calcula e informa; o sistema só soma no total da alçada.
  "valorDifal" numeric(14, 2) not null default 0 check ("valorDifal" >= 0),
  frete public."ModalidadeFrete" not null default 'cif',
  -- FOB com coleta pelo veículo/motorista da própria empresa.
  "coletaPropria" boolean not null default false,
  "valorFrete" numeric(14, 2) not null default 0 check ("valorFrete" >= 0),
  "condicaoPagamento" text not null,
  "prazoEntregaDias" integer check ("prazoEntregaDias" >= 0),
  observacoes text,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null,
  unique ("requisicaoId", "fornecedorId")
);

create table public."CotacaoItem" (
  id text primary key default (gen_random_uuid())::text,
  "cotacaoId" text not null references public."Cotacao"(id) on delete cascade,
  "requisicaoItemId" text not null references public."RequisicaoItem"(id) on delete cascade,
  "precoUnitario" numeric(14, 4) not null check ("precoUnitario" >= 0),
  unique ("cotacaoId", "requisicaoItemId")
);

alter table public."RequisicaoItem"
  add constraint "RequisicaoItem_cotacaoItemVencedorId_fkey"
  foreign key ("cotacaoItemVencedorId") references public."CotacaoItem"(id) on delete set null;

-- 6. Aprovação.

create table public."Aprovacao" (
  id text primary key default (gen_random_uuid())::text,
  "requisicaoId" text not null references public."Requisicao"(id) on delete cascade,
  rodada integer not null,
  nivel public."NivelAlcada" not null,
  "aprovadorId" text not null references public."Usuario"(id) on delete restrict,
  decisao public."DecisaoAprovacao" not null,
  comentario text,
  -- Decisão tomada por quem também pediu a compra. Permitida (só há uma
  -- pessoa por nível), mas fica marcada para conferência.
  "proprioRequisitante" boolean not null default false,
  "valorTotal" numeric(14, 2) not null,
  -- Documento assinado (Gov.br / certificado) no bucket "suprimentos".
  "anexoCaminho" text,
  "anexoNome" text,
  "decididoEm" timestamptz not null default now(),
  unique ("requisicaoId", rodada, nivel)
);

-- 7. Pedido de compra — um por fornecedor da requisição.

create table public."PedidoCompra" (
  id text primary key default (gen_random_uuid())::text,
  "requisicaoId" text not null references public."Requisicao"(id) on delete restrict,
  "cotacaoId" text not null references public."Cotacao"(id) on delete restrict,
  "fornecedorId" text not null references public."Fornecedor"(id) on delete restrict,
  -- PED-0123-A: número da requisição + letra do fornecedor.
  codigo text not null unique,
  "empresaId" text references public."EmpresaGrupo"(id) on delete set null,
  "valorItens" numeric(14, 2) not null,
  "valorFrete" numeric(14, 2) not null default 0,
  "valorDifal" numeric(14, 2) not null default 0,
  "valorTotal" numeric(14, 2) not null,
  frete public."ModalidadeFrete" not null,
  "coletaPropria" boolean not null default false,
  "condicaoPagamento" text not null,
  "prazoEntregaDias" integer,
  "statusEntrega" public."StatusEntregaPedido" not null default 'pendente',
  "emitidoEm" timestamptz not null default now(),
  "emitidoPorId" text references public."Usuario"(id) on delete set null
);

create index "PedidoCompra_requisicao_idx" on public."PedidoCompra" ("requisicaoId");
create index "PedidoCompra_entrega_idx" on public."PedidoCompra" ("statusEntrega");

-- Retrato dos itens no momento da emissão: o pedido impresso não pode mudar
-- se alguém editar o catálogo ou a requisição depois.
create table public."PedidoCompraItem" (
  id text primary key default (gen_random_uuid())::text,
  "pedidoCompraId" text not null references public."PedidoCompra"(id) on delete cascade,
  "requisicaoItemId" text references public."RequisicaoItem"(id) on delete set null,
  ordem integer not null,
  descricao text not null,
  especificacao text,
  quantidade numeric(14, 3) not null,
  unidade text not null,
  "precoUnitario" numeric(14, 4) not null,
  "precoTotal" numeric(14, 2) not null
);

create index "PedidoCompraItem_pedido_idx" on public."PedidoCompraItem" ("pedidoCompraId");

-- 8. Recebimento na obra.

create table public."Recebimento" (
  id text primary key default (gen_random_uuid())::text,
  "pedidoCompraId" text not null references public."PedidoCompra"(id) on delete cascade,
  situacao public."SituacaoRecebimento" not null,
  observacao text,
  -- Quem recebeu fisicamente (pode não ter login no sistema).
  "nomeRecebedor" text not null,
  "documentoRecebedor" text,
  -- Quem lançou no sistema.
  "registradoPorId" text references public."Usuario"(id) on delete set null,
  "recebidoEm" timestamptz not null default now(),
  constraint "Recebimento_inconforme_check"
    check (situacao = 'conforme' or coalesce(btrim(observacao), '') <> '')
);

create index "Recebimento_pedido_idx" on public."Recebimento" ("pedidoCompraId");

create table public."RecebimentoFoto" (
  id text primary key default (gen_random_uuid())::text,
  "recebimentoId" text not null references public."Recebimento"(id) on delete cascade,
  caminho text not null,
  nome text not null,
  mime text,
  tamanho integer,
  "criadoEm" timestamptz not null default now()
);

-- 9. Avisos do módulo (sino próprio na barra superior).

create table public."NotificacaoSuprimentos" (
  id text primary key default (gen_random_uuid())::text,
  "usuarioId" text not null references public."Usuario"(id) on delete cascade,
  "requisicaoId" text references public."Requisicao"(id) on delete cascade,
  "pedidoCompraId" text references public."PedidoCompra"(id) on delete cascade,
  tipo public."TipoNotificacaoSuprimentos" not null,
  titulo text not null,
  detalhe text,
  -- Chave de deduplicação: o mesmo evento não avisa duas vezes a mesma pessoa.
  referencia text not null,
  "geradaPorId" text references public."Usuario"(id) on delete set null,
  "criadoEm" timestamptz not null default now(),
  "lidaEm" timestamptz,
  unique ("usuarioId", tipo, referencia)
);

create index "NotificacaoSuprimentos_naoLidas_idx"
  on public."NotificacaoSuprimentos" ("usuarioId", "criadoEm" desc)
  where "lidaEm" is null;

-- 10. RLS ligada e sem policy, como no resto do schema.

alter table public."PapelUsuarioSuprimentos" enable row level security;
alter table public."ParametroSuprimentos"    enable row level security;
alter table public."EmpresaGrupo"            enable row level security;
alter table public."ObraFaturamento"         enable row level security;
alter table public."Fornecedor"              enable row level security;
alter table public."Produto"                 enable row level security;
alter table public."ProdutoCodigoExterno"    enable row level security;
alter table public."Requisicao"              enable row level security;
alter table public."RequisicaoItem"          enable row level security;
alter table public."Cotacao"                 enable row level security;
alter table public."CotacaoItem"             enable row level security;
alter table public."Aprovacao"               enable row level security;
alter table public."PedidoCompra"            enable row level security;
alter table public."PedidoCompraItem"        enable row level security;
alter table public."Recebimento"             enable row level security;
alter table public."RecebimentoFoto"         enable row level security;
alter table public."NotificacaoSuprimentos"  enable row level security;

-- 11. Bucket privado para fotos de recebimento e documentos assinados. 10 MB,
-- o mesmo teto do bucket "pos-venda" (next.config.ts já aceita 11 MB).

insert into storage.buckets (id, name, public, file_size_limit)
values ('suprimentos', 'suprimentos', false, 10485760)
on conflict (id) do nothing;

commit;
