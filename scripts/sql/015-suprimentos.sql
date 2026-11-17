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

-- 12. Funções do fluxo de aprovação.
--
-- Enviar, decidir e emitir pedidos mexem em várias tabelas de uma vez e
-- precisam travar a requisição (dois aprovadores clicando juntos não podem
-- emitir pedido duas vezes). Por isso moram no banco, cada uma numa transação.
-- Só a service role executa: o app chama via supabase.rpc no servidor.

-- Total da compra escolhida: itens (linha arredondada a centavos) + frete e
-- DIFAL inteiros de cada fornecedor que levou pelo menos um item. A tela faz a
-- mesma conta em src/lib/suprimentos-cotacao.ts.
create or replace function public.suprimentos_total_escolha(p_requisicao_id text)
returns numeric
language sql
stable
set search_path = public
as $$
  with usados as (
    select
      c.id,
      c."valorFrete" as frete,
      case when c."incideDifal" then c."valorDifal" else 0 end as difal,
      sum(round(ri.quantidade * ci."precoUnitario", 2)) as itens
    from "RequisicaoItem" ri
    join "CotacaoItem" ci on ci.id = ri."cotacaoItemVencedorId"
    join "Cotacao" c on c.id = ci."cotacaoId"
    where ri."requisicaoId" = p_requisicao_id
    group by c.id
  )
  select coalesce(sum(itens + frete + difal), 0)::numeric(14, 2) from usados;
$$;

-- Um pedido por fornecedor escolhido (PED-0001-A, -B...), com retrato dos itens.
-- Chamada só pelas duas funções abaixo, já com a requisição travada.
create or replace function public.suprimentos_emitir_pedidos(p_requisicao_id text, p_usuario_id text)
returns void
language plpgsql
set search_path = public
as $$
declare
  r "Requisicao"%rowtype;
  c "Cotacao"%rowtype;
  v_letra integer := 0;
  v_sufixo text;
  v_pedido text;
  v_empresa text;
  v_itens numeric(14, 2);
  v_difal numeric(14, 2);
begin
  select * into r from "Requisicao" where id = p_requisicao_id;
  select "empresaId" into v_empresa from "ObraFaturamento" where "obraId" = r."obraId";

  for c in
    select * from "Cotacao"
    where id in (
      select ci."cotacaoId"
      from "RequisicaoItem" ri
      join "CotacaoItem" ci on ci.id = ri."cotacaoItemVencedorId"
      where ri."requisicaoId" = r.id
    )
    order by "criadoEm", id
  loop
    v_letra := v_letra + 1;
    v_sufixo := case when v_letra <= 26 then chr(64 + v_letra) else v_letra::text end;

    select coalesce(sum(round(ri.quantidade * ci."precoUnitario", 2)), 0)
      into v_itens
    from "RequisicaoItem" ri
    join "CotacaoItem" ci on ci.id = ri."cotacaoItemVencedorId"
    where ri."requisicaoId" = r.id and ci."cotacaoId" = c.id;

    v_difal := case when c."incideDifal" then c."valorDifal" else 0 end;

    insert into "PedidoCompra" (
      "requisicaoId", "cotacaoId", "fornecedorId", codigo, "empresaId",
      "valorItens", "valorFrete", "valorDifal", "valorTotal",
      frete, "coletaPropria", "condicaoPagamento", "prazoEntregaDias", "emitidoPorId"
    ) values (
      r.id, c.id, c."fornecedorId",
      'PED-' || lpad(r.numero::text, 4, '0') || '-' || v_sufixo,
      v_empresa,
      v_itens, c."valorFrete", v_difal, v_itens + c."valorFrete" + v_difal,
      c.frete, c."coletaPropria", c."condicaoPagamento", c."prazoEntregaDias",
      coalesce(r."compradorId", p_usuario_id)
    )
    returning id into v_pedido;

    insert into "PedidoCompraItem" (
      "pedidoCompraId", "requisicaoItemId", ordem, descricao, especificacao,
      quantidade, unidade, "precoUnitario", "precoTotal"
    )
    select
      v_pedido, ri.id, ri.ordem, coalesce(p.descricao, ri.descricao), ri.especificacao,
      ri.quantidade, ri.unidade, ci."precoUnitario", round(ri.quantidade * ci."precoUnitario", 2)
    from "RequisicaoItem" ri
    join "CotacaoItem" ci on ci.id = ri."cotacaoItemVencedorId"
    left join "Produto" p on p.id = ri."produtoId"
    where ri."requisicaoId" = r.id and ci."cotacaoId" = c.id;
  end loop;

  update "Requisicao"
     set status = 'pedido_emitido', "atualizadoEm" = now()
   where id = r.id;
end;
$$;

-- Comprador envia a escolha para aprovação. Até o limite do comprador a
-- própria remessa é a aprovação (autonomia dele) e os pedidos saem na hora.
create or replace function public.suprimentos_enviar_aprovacao(p_requisicao_id text, p_usuario_id text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r "Requisicao"%rowtype;
  v_total numeric(14, 2);
  v_limite_comprador numeric(14, 2);
  v_limite_gerencia numeric(14, 2);
  v_nivel "NivelAlcada";
  v_rodada integer;
begin
  select * into r from "Requisicao" where id = p_requisicao_id for update;
  if not found then
    raise exception 'Requisição não encontrada.';
  end if;
  if r.status <> 'em_cotacao' then
    raise exception 'Só uma requisição em cotação pode ir para aprovação.';
  end if;
  if exists (select 1 from "RequisicaoItem" where "requisicaoId" = r.id and "produtoId" is null) then
    raise exception 'Vincule todos os itens ao catálogo antes de enviar.';
  end if;
  if exists (select 1 from "RequisicaoItem" where "requisicaoId" = r.id and "cotacaoItemVencedorId" is null) then
    raise exception 'Escolha o fornecedor de todos os itens antes de enviar.';
  end if;

  v_total := suprimentos_total_escolha(r.id);
  select coalesce(max("limiteComprador"), 500), coalesce(max("limiteGerencia"), 3000)
    into v_limite_comprador, v_limite_gerencia
  from "ParametroSuprimentos" where id = 'padrao';

  v_nivel := case
    when v_total <= v_limite_comprador then 'comprador'
    when v_total <= v_limite_gerencia then 'gerencia'
    else 'diretoria'
  end;
  v_rodada := r."rodadaAprovacao" + 1;

  update "Requisicao"
     set status = 'aguardando_aprovacao',
         "valorTotal" = v_total,
         "nivelAlcada" = v_nivel,
         "rodadaAprovacao" = v_rodada,
         "enviadaAprovacaoEm" = now(),
         "compradorId" = coalesce("compradorId", p_usuario_id),
         "atualizadoEm" = now()
   where id = r.id;

  if v_nivel = 'comprador' then
    insert into "Aprovacao" (
      "requisicaoId", rodada, nivel, "aprovadorId", decisao, comentario,
      "proprioRequisitante", "valorTotal"
    ) values (
      r.id, v_rodada, 'comprador', p_usuario_id, 'aprovada', 'Dentro da autonomia do comprador.',
      p_usuario_id = r."requisitanteId", v_total
    );
    perform suprimentos_emitir_pedidos(r.id, p_usuario_id);
  end if;

  return jsonb_build_object(
    'nivel', v_nivel,
    'total', v_total,
    'rodada', v_rodada,
    'status', (select status from "Requisicao" where id = r.id)
  );
end;
$$;

-- Decisão de um aprovador. Acima do limite da gerência valem as duas
-- aprovações (em qualquer ordem, de pessoas diferentes). Devolver volta para a
-- cotação; recusar encerra; a última aprovação que faltava emite os pedidos.
-- Quem pode decidir em cada nível (papel) é conferido no app antes da chamada.
create or replace function public.suprimentos_decidir_aprovacao(
  p_requisicao_id text,
  p_usuario_id text,
  p_nivel "NivelAlcada",
  p_decisao "DecisaoAprovacao",
  p_comentario text,
  p_anexo_caminho text,
  p_anexo_nome text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r "Requisicao"%rowtype;
  v_exigidos "NivelAlcada"[];
  v_pendentes "NivelAlcada"[];
begin
  select * into r from "Requisicao" where id = p_requisicao_id for update;
  if not found then
    raise exception 'Requisição não encontrada.';
  end if;
  if r.status <> 'aguardando_aprovacao' then
    raise exception 'Esta requisição não está mais aguardando aprovação.';
  end if;

  v_exigidos := case r."nivelAlcada"
    when 'gerencia' then array['gerencia']::"NivelAlcada"[]
    when 'diretoria' then array['gerencia', 'diretoria']::"NivelAlcada"[]
    else array[]::"NivelAlcada"[]
  end;
  if not (p_nivel = any (v_exigidos)) then
    raise exception 'Esta compra não pede aprovação neste nível.';
  end if;
  if exists (
    select 1 from "Aprovacao"
    where "requisicaoId" = r.id and rodada = r."rodadaAprovacao" and nivel = p_nivel
  ) then
    raise exception 'Este nível já decidiu esta compra.';
  end if;
  if exists (
    select 1 from "Aprovacao"
    where "requisicaoId" = r.id and rodada = r."rodadaAprovacao" and "aprovadorId" = p_usuario_id
  ) then
    raise exception 'A outra aprovação precisa ser de outra pessoa.';
  end if;
  if p_decisao <> 'aprovada' and coalesce(btrim(p_comentario), '') = '' then
    raise exception 'Explique o motivo ao devolver ou recusar.';
  end if;

  insert into "Aprovacao" (
    "requisicaoId", rodada, nivel, "aprovadorId", decisao, comentario,
    "proprioRequisitante", "valorTotal", "anexoCaminho", "anexoNome"
  ) values (
    r.id, r."rodadaAprovacao", p_nivel, p_usuario_id, p_decisao, nullif(btrim(p_comentario), ''),
    p_usuario_id = r."requisitanteId", r."valorTotal", p_anexo_caminho, p_anexo_nome
  );

  if p_decisao = 'devolvida' then
    update "Requisicao"
       set status = 'em_cotacao', "nivelAlcada" = null, "valorTotal" = null, "atualizadoEm" = now()
     where id = r.id;
  elsif p_decisao = 'recusada' then
    update "Requisicao" set status = 'recusada', "atualizadoEm" = now() where id = r.id;
  else
    select coalesce(array_agg(n), array[]::"NivelAlcada"[]) into v_pendentes
    from unnest(v_exigidos) as n
    where not exists (
      select 1 from "Aprovacao"
      where "requisicaoId" = r.id and rodada = r."rodadaAprovacao" and nivel = n and decisao = 'aprovada'
    );
    if cardinality(v_pendentes) = 0 then
      perform suprimentos_emitir_pedidos(r.id, p_usuario_id);
    end if;
  end if;

  return jsonb_build_object(
    'status', (select status from "Requisicao" where id = r.id),
    'pendentes', to_jsonb(coalesce(v_pendentes, array[]::"NivelAlcada"[]))
  );
end;
$$;

-- Recebimento na obra. Entrega parcial ou com problema é "inconforme" (com
-- observação obrigatória) e o pedido aceita um novo registro quando o restante
-- chegar; depois de "conforme", fecha. A requisição conclui quando nenhum
-- pedido dela está mais aguardando entrega.
create or replace function public.suprimentos_registrar_recebimento(
  p_pedido_id text,
  p_usuario_id text,
  p_situacao "SituacaoRecebimento",
  p_observacao text,
  p_nome_recebedor text,
  p_documento_recebedor text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  p "PedidoCompra"%rowtype;
  v_status "StatusRequisicao";
  v_recebimento text;
begin
  select * into p from "PedidoCompra" where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  -- Trava pela requisição: dois pedidos dela recebidos ao mesmo tempo não podem
  -- deixar de concluí-la.
  select status into v_status from "Requisicao" where id = p."requisicaoId" for update;
  select * into p from "PedidoCompra" where id = p_pedido_id;

  if v_status not in ('pedido_emitido', 'concluida') then
    raise exception 'Esta requisição não está com pedido emitido.';
  end if;
  if p."statusEntrega" = 'recebido_conforme' then
    raise exception 'Este pedido já foi recebido conforme.';
  end if;
  if coalesce(btrim(p_nome_recebedor), '') = '' then
    raise exception 'Informe quem recebeu o material.';
  end if;
  if p_situacao = 'inconforme' and coalesce(btrim(p_observacao), '') = '' then
    raise exception 'Descreva o problema ao marcar como inconforme.';
  end if;

  insert into "Recebimento" (
    "pedidoCompraId", situacao, observacao, "nomeRecebedor", "documentoRecebedor", "registradoPorId"
  ) values (
    p.id, p_situacao, nullif(btrim(p_observacao), ''), btrim(p_nome_recebedor),
    nullif(btrim(p_documento_recebedor), ''), p_usuario_id
  )
  returning id into v_recebimento;

  update "PedidoCompra"
     set "statusEntrega" = case when p_situacao = 'conforme' then 'recebido_conforme' else 'recebido_inconforme' end::"StatusEntregaPedido"
   where id = p.id;

  if not exists (
    select 1 from "PedidoCompra" where "requisicaoId" = p."requisicaoId" and "statusEntrega" = 'pendente'
  ) then
    update "Requisicao" set status = 'concluida', "atualizadoEm" = now()
     where id = p."requisicaoId" and status = 'pedido_emitido';
  end if;

  return jsonb_build_object(
    'recebimentoId', v_recebimento,
    'statusRequisicao', (select status from "Requisicao" where id = p."requisicaoId")
  );
end;
$$;

revoke execute on function public.suprimentos_registrar_recebimento(text, text, "SituacaoRecebimento", text, text, text) from public, anon, authenticated;
grant execute on function public.suprimentos_registrar_recebimento(text, text, "SituacaoRecebimento", text, text, text) to service_role;

revoke execute on function public.suprimentos_total_escolha(text) from public, anon, authenticated;
revoke execute on function public.suprimentos_emitir_pedidos(text, text) from public, anon, authenticated;
revoke execute on function public.suprimentos_enviar_aprovacao(text, text) from public, anon, authenticated;
revoke execute on function public.suprimentos_decidir_aprovacao(text, text, "NivelAlcada", "DecisaoAprovacao", text, text, text) from public, anon, authenticated;
grant execute on function public.suprimentos_total_escolha(text) to service_role;
grant execute on function public.suprimentos_emitir_pedidos(text, text) to service_role;
grant execute on function public.suprimentos_enviar_aprovacao(text, text) to service_role;
grant execute on function public.suprimentos_decidir_aprovacao(text, text, "NivelAlcada", "DecisaoAprovacao", text, text, text) to service_role;

commit;
