-- Suprimentos — ajustes da reunião de validação.
--
-- Rodar DEPOIS do 015 e ANTES do merge do código que usa estas colunas. É
-- compatível com a versão no ar: só acrescenta tabelas, colunas com valor
-- padrão e funções; nada que a versão atual use é removido.
--
--  1. Centro de custo: a requisição aponta para uma obra OU para um centro de
--     custo cadastrado (sede, frota, manutenção...).
--  2. Fotos nos itens da requisição.
--  3. Cotação: CNPJ faturado, compra em nome do cliente (com autorização
--     anexada) e condição de pagamento em campos (forma, prazo, parcelas).
--  4. Alçada: compra faturada para o cliente passa só pela gerência; a
--     diretoria pode decidir no lugar da gerência e pode reabrir a cotação
--     depois de aprovada, enquanto a compra não foi confirmada no fornecedor.
--  5. Pedido: confirmação da compra pelo comprador ("entrega pendente").
--  6. Recebimento por item: aceite parcial, devolução parcial/total, e o
--     recebedor é o usuário logado.
--  7. Módulos que cada usuário vê no menu.
--
-- Rodar no SQL Editor do Supabase, inteiro de uma vez.

-- Valores novos de enum precisam existir (commit) antes de serem usados.
alter type public."StatusEntregaPedido" add value if not exists 'recebido_parcial';
alter type public."SituacaoRecebimento" add value if not exists 'parcial';
alter type public."TipoNotificacaoSuprimentos" add value if not exists 'compra_confirmada';
alter type public."TipoNotificacaoSuprimentos" add value if not exists 'cotacao_reaberta';

begin;

-- 1. Centro de custo.

create table public."CentroCusto" (
  id text primary key default (gen_random_uuid())::text,
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null
);

alter table public."CentroCusto" enable row level security;

insert into public."CentroCusto" (nome, descricao) values
  ('Sede', 'Escritório e despesas administrativas'),
  ('Frota de veículos', 'Peças, pneus e manutenção dos veículos'),
  ('Manutenção', 'Manutenção predial e de equipamentos')
on conflict (nome) do nothing;

alter table public."Requisicao" alter column "obraId" drop not null;
alter table public."Requisicao"
  add column "centroCustoId" text references public."CentroCusto"(id) on delete restrict;
alter table public."Requisicao"
  add constraint "Requisicao_centroCusto_check" check (("obraId" is null) <> ("centroCustoId" is null));

create index "Requisicao_centroCusto_idx" on public."Requisicao" ("centroCustoId");

-- 2. Fotos dos itens da requisição (bucket "suprimentos").

create table public."RequisicaoItemFoto" (
  id text primary key default (gen_random_uuid())::text,
  "requisicaoItemId" text not null references public."RequisicaoItem"(id) on delete cascade,
  caminho text not null,
  nome text not null,
  mime text,
  tamanho integer,
  "criadoEm" timestamptz not null default now()
);

create index "RequisicaoItemFoto_item_idx" on public."RequisicaoItemFoto" ("requisicaoItemId");
alter table public."RequisicaoItemFoto" enable row level security;

-- 3. Cotação: faturamento e pagamento.

create type public."FormaPagamento" as enum (
  'boleto', 'pix', 'transferencia', 'cartao_credito', 'cartao_debito', 'dinheiro', 'cheque'
);

alter table public."Cotacao"
  -- CNPJ do grupo que será faturado. Nulo quando a compra sai em nome do cliente.
  add column "empresaId" text references public."EmpresaGrupo"(id) on delete restrict,
  -- Faturada direto para o cliente da obra: não sai do caixa da empresa.
  add column "faturadoCliente" boolean not null default false,
  -- Ordem de compra / print da conversa em que o cliente autoriza.
  add column "autorizacaoCaminho" text,
  add column "autorizacaoNome" text,
  add column "formaPagamento" public."FormaPagamento",
  -- Dias até o (primeiro) pagamento. 0 = à vista.
  add column "prazoPagamentoDias" integer check ("prazoPagamentoDias" >= 0),
  add column parcelas integer check (parcelas between 1 and 60);

alter table public."Requisicao"
  -- Parte do total faturada em nome do cliente (não conta para a alçada da diretoria).
  add column "valorFaturadoCliente" numeric(14, 2) not null default 0;

-- 5. Pedido: dados copiados da cotação e confirmação da compra.

alter table public."PedidoCompra"
  add column "faturadoCliente" boolean not null default false,
  add column "formaPagamento" public."FormaPagamento",
  add column "prazoPagamentoDias" integer,
  add column parcelas integer,
  -- Momento em que o comprador fechou a compra no fornecedor. Antes disso o
  -- pedido está emitido, mas não comprado: não recebe e pode ser reaberto.
  add column "compraConfirmadaEm" timestamptz,
  add column "compraConfirmadaPorId" text references public."Usuario"(id) on delete set null;

-- Pedidos que já estavam no fluxo seguem como comprados.
update public."PedidoCompra" set "compraConfirmadaEm" = "emitidoEm" where "compraConfirmadaEm" is null;

-- 6. Recebimento por item.

alter table public."PedidoCompraItem"
  add column "quantidadeRecebida" numeric(14, 3) not null default 0,
  add column "quantidadeDevolvida" numeric(14, 3) not null default 0;

-- Pedidos já recebidos conforme: tudo entregue.
update public."PedidoCompraItem" i
   set "quantidadeRecebida" = i.quantidade
  from public."PedidoCompra" p
 where p.id = i."pedidoCompraId" and p."statusEntrega" = 'recebido_conforme';

-- Quem recebe agora é o usuário logado; o nome continua gravado para o histórico.
alter table public."Recebimento" alter column "nomeRecebedor" drop not null;

-- Observação continua obrigatória só no inconforme. A entrega parcial sem
-- problema (chegou 6 de 10, o resto vem depois) não precisa de texto.
alter table public."Recebimento" drop constraint if exists "Recebimento_inconforme_check";
alter table public."Recebimento" add constraint "Recebimento_inconforme_check"
  check (situacao <> 'inconforme' or coalesce(btrim(observacao), '') <> '');

create table public."RecebimentoItem" (
  id text primary key default (gen_random_uuid())::text,
  "recebimentoId" text not null references public."Recebimento"(id) on delete cascade,
  "pedidoCompraItemId" text not null references public."PedidoCompraItem"(id) on delete cascade,
  -- Aceito na obra.
  "quantidadeRecebida" numeric(14, 3) not null default 0 check ("quantidadeRecebida" >= 0),
  -- Chegou mas voltou com o fornecedor (avaria, errado). Continua pendente.
  "quantidadeDevolvida" numeric(14, 3) not null default 0 check ("quantidadeDevolvida" >= 0),
  unique ("recebimentoId", "pedidoCompraItemId")
);

alter table public."RecebimentoItem" enable row level security;

-- 7. Módulos escondidos do menu de cada usuário (chave = item do menu).
alter table public."Usuario" add column "modulosOcultos" text[] not null default '{}';

-- 8. Funções.

-- Emissão: empresa da cotação (ou a da obra, para cotações antigas), dados de
-- pagamento e marca de compra para o cliente. Sem confirmação de compra.
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
  v_empresa_obra text;
  v_itens numeric(14, 2);
  v_difal numeric(14, 2);
begin
  select * into r from "Requisicao" where id = p_requisicao_id;
  select "empresaId" into v_empresa_obra from "ObraFaturamento" where "obraId" = r."obraId";

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
      "requisicaoId", "cotacaoId", "fornecedorId", codigo, "empresaId", "faturadoCliente",
      "valorItens", "valorFrete", "valorDifal", "valorTotal",
      frete, "coletaPropria", "condicaoPagamento", "formaPagamento", "prazoPagamentoDias", parcelas,
      "prazoEntregaDias", "emitidoPorId"
    ) values (
      r.id, c.id, c."fornecedorId",
      'PED-' || lpad(r.numero::text, 4, '0') || '-' || v_sufixo,
      case when c."faturadoCliente" then null else coalesce(c."empresaId", v_empresa_obra) end,
      c."faturadoCliente",
      v_itens, c."valorFrete", v_difal, v_itens + c."valorFrete" + v_difal,
      c.frete, c."coletaPropria", c."condicaoPagamento", c."formaPagamento", c."prazoPagamentoDias", c.parcelas,
      c."prazoEntregaDias", coalesce(r."compradorId", p_usuario_id)
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

-- Envio para aprovação. A alçada olha só o que sai do caixa da empresa: a
-- parte faturada para o cliente não sobe para a diretoria, mas qualquer
-- compra para o cliente passa pela gerência (que confere a autorização).
create or replace function public.suprimentos_enviar_aprovacao(p_requisicao_id text, p_usuario_id text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r "Requisicao"%rowtype;
  v_total numeric(14, 2);
  v_cliente numeric(14, 2);
  v_tem_cliente boolean;
  v_sem_autorizacao boolean;
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

  select
    coalesce(bool_or(c."faturadoCliente"), false),
    coalesce(bool_or(c."faturadoCliente" and c."autorizacaoCaminho" is null), false)
  into v_tem_cliente, v_sem_autorizacao
  from "RequisicaoItem" ri
  join "CotacaoItem" ci on ci.id = ri."cotacaoItemVencedorId"
  join "Cotacao" c on c.id = ci."cotacaoId"
  where ri."requisicaoId" = r.id;
  if v_sem_autorizacao then
    raise exception 'Anexe a autorização do cliente nas cotações faturadas em nome dele.';
  end if;

  v_total := suprimentos_total_escolha(r.id);

  with usados as (
    select
      c.id,
      c."faturadoCliente",
      c."valorFrete" as frete,
      case when c."incideDifal" then c."valorDifal" else 0 end as difal,
      sum(round(ri.quantidade * ci."precoUnitario", 2)) as itens
    from "RequisicaoItem" ri
    join "CotacaoItem" ci on ci.id = ri."cotacaoItemVencedorId"
    join "Cotacao" c on c.id = ci."cotacaoId"
    where ri."requisicaoId" = r.id
    group by c.id
  )
  select coalesce(sum(itens + frete + difal) filter (where "faturadoCliente"), 0)
    into v_cliente
  from usados;

  select coalesce(max("limiteComprador"), 500), coalesce(max("limiteGerencia"), 3000)
    into v_limite_comprador, v_limite_gerencia
  from "ParametroSuprimentos" where id = 'padrao';

  v_nivel := case
    when v_total - v_cliente > v_limite_gerencia then 'diretoria'
    when v_total - v_cliente > v_limite_comprador or v_tem_cliente then 'gerencia'
    else 'comprador'
  end;
  v_rodada := r."rodadaAprovacao" + 1;

  update "Requisicao"
     set status = 'aguardando_aprovacao',
         "valorTotal" = v_total,
         "valorFaturadoCliente" = v_cliente,
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

-- Decisão de um aprovador.
--  * Alçada da gerência: basta uma aprovação, da gerência OU da diretoria.
--  * Alçada da diretoria: gerência e diretoria, em qualquer ordem, de pessoas
--    diferentes.
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
  v_pendentes "NivelAlcada"[] := array[]::"NivelAlcada"[];
begin
  select * into r from "Requisicao" where id = p_requisicao_id for update;
  if not found then
    raise exception 'Requisição não encontrada.';
  end if;
  if r.status <> 'aguardando_aprovacao' then
    raise exception 'Esta requisição não está mais aguardando aprovação.';
  end if;
  if r."nivelAlcada" not in ('gerencia', 'diretoria') or p_nivel not in ('gerencia', 'diretoria') then
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
    raise exception 'Você já decidiu esta compra. A outra aprovação precisa ser de outra pessoa.';
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
       set status = 'em_cotacao', "nivelAlcada" = null, "valorTotal" = null,
           "valorFaturadoCliente" = 0, "atualizadoEm" = now()
     where id = r.id;
  elsif p_decisao = 'recusada' then
    update "Requisicao" set status = 'recusada', "atualizadoEm" = now() where id = r.id;
  else
    if r."nivelAlcada" = 'diretoria' then
      select coalesce(array_agg(n), array[]::"NivelAlcada"[]) into v_pendentes
      from unnest(array['gerencia', 'diretoria']::"NivelAlcada"[]) as n
      where not exists (
        select 1 from "Aprovacao"
        where "requisicaoId" = r.id and rodada = r."rodadaAprovacao" and nivel = n and decisao = 'aprovada'
      );
    end if;
    if cardinality(v_pendentes) = 0 then
      perform suprimentos_emitir_pedidos(r.id, p_usuario_id);
    end if;
  end if;

  return jsonb_build_object(
    'status', (select status from "Requisicao" where id = r.id),
    'pendentes', to_jsonb(v_pendentes)
  );
end;
$$;

-- Diretoria volta uma compra já aprovada para a cotação. Só enquanto nenhum
-- pedido foi confirmado no fornecedor: os pedidos emitidos são apagados e a
-- devolução fica no histórico numa rodada própria.
create or replace function public.suprimentos_reabrir_cotacao(
  p_requisicao_id text,
  p_usuario_id text,
  p_motivo text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r "Requisicao"%rowtype;
  v_rodada integer;
begin
  select * into r from "Requisicao" where id = p_requisicao_id for update;
  if not found then
    raise exception 'Requisição não encontrada.';
  end if;
  if r.status <> 'pedido_emitido' then
    raise exception 'Só uma compra aprovada, com pedido emitido, pode voltar para a cotação.';
  end if;
  if exists (
    select 1 from "PedidoCompra"
    where "requisicaoId" = r.id and ("compraConfirmadaEm" is not null or "statusEntrega" <> 'pendente')
  ) then
    raise exception 'O comprador já confirmou a compra no fornecedor. Fale com ele para cancelar.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Explique o motivo de voltar para a cotação.';
  end if;

  delete from "PedidoCompra" where "requisicaoId" = r.id;

  v_rodada := r."rodadaAprovacao" + 1;
  insert into "Aprovacao" (
    "requisicaoId", rodada, nivel, "aprovadorId", decisao, comentario, "proprioRequisitante", "valorTotal"
  ) values (
    r.id, v_rodada, 'diretoria', p_usuario_id, 'devolvida', btrim(p_motivo),
    p_usuario_id = r."requisitanteId", coalesce(r."valorTotal", 0)
  );

  update "Requisicao"
     set status = 'em_cotacao', "nivelAlcada" = null, "valorTotal" = null, "valorFaturadoCliente" = 0,
         "rodadaAprovacao" = v_rodada, "atualizadoEm" = now()
   where id = r.id;

  return jsonb_build_object('status', 'em_cotacao');
end;
$$;

-- Comprador registra que fechou a compra no fornecedor.
create or replace function public.suprimentos_confirmar_compra(p_pedido_id text, p_usuario_id text)
returns void
language plpgsql
set search_path = public
as $$
declare
  p "PedidoCompra"%rowtype;
begin
  select * into p from "PedidoCompra" where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  perform 1 from "Requisicao" where id = p."requisicaoId" and status = 'pedido_emitido' for update;
  if not found then
    raise exception 'A requisição deste pedido não está com pedido emitido.';
  end if;
  update "PedidoCompra"
     set "compraConfirmadaEm" = now(), "compraConfirmadaPorId" = p_usuario_id
   where id = p_pedido_id and "compraConfirmadaEm" is null;
  if not found then
    raise exception 'Esta compra já foi confirmada.';
  end if;
end;
$$;

-- Recebimento por item. p_itens = [{"item": id do PedidoCompraItem,
-- "recebida": n, "devolvida": n}]. Devolvido continua pendente (o fornecedor
-- repõe). p_encerrar fecha o pedido com o que chegou (falta aceita).
create or replace function public.suprimentos_registrar_recebimento_itens(
  p_pedido_id text,
  p_usuario_id text,
  p_itens jsonb,
  p_avaria boolean,
  p_observacao text,
  p_encerrar boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  p "PedidoCompra"%rowtype;
  v_status "StatusRequisicao";
  v_recebimento text;
  v_situacao "SituacaoRecebimento";
  v_entrega "StatusEntregaPedido";
  v_devolveu boolean;
  v_algo boolean;
  v_completo boolean;
  v_teve_problema boolean;
  linha record;
begin
  select * into p from "PedidoCompra" where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  select status into v_status from "Requisicao" where id = p."requisicaoId" for update;
  select * into p from "PedidoCompra" where id = p_pedido_id;

  if v_status not in ('pedido_emitido', 'concluida') then
    raise exception 'Esta requisição não está com pedido emitido.';
  end if;
  if p."compraConfirmadaEm" is null then
    raise exception 'O comprador ainda não confirmou esta compra no fornecedor.';
  end if;
  if p."statusEntrega" in ('recebido_conforme', 'recebido_inconforme') then
    raise exception 'Este pedido já foi encerrado.';
  end if;

  -- Confere as quantidades contra o saldo de cada item.
  for linha in
    select
      x.item,
      coalesce(x.recebida, 0) as recebida,
      coalesce(x.devolvida, 0) as devolvida,
      i.quantidade - i."quantidadeRecebida" as saldo,
      i.id as existe
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(item text, recebida numeric, devolvida numeric)
    left join "PedidoCompraItem" i on i.id = x.item and i."pedidoCompraId" = p.id
  loop
    if linha.existe is null then
      raise exception 'Item que não é deste pedido.';
    end if;
    if linha.recebida < 0 or linha.devolvida < 0 then
      raise exception 'Quantidade não pode ser negativa.';
    end if;
    if linha.recebida + linha.devolvida > linha.saldo then
      raise exception 'Quantidade maior que a pendente em um dos itens.';
    end if;
  end loop;

  select
    coalesce(bool_or(coalesce(x.recebida, 0) + coalesce(x.devolvida, 0) > 0), false),
    coalesce(bool_or(coalesce(x.devolvida, 0) > 0), false)
  into v_algo, v_devolveu
  from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(item text, recebida numeric, devolvida numeric);

  if not v_algo and not coalesce(p_encerrar, false) then
    raise exception 'Informe a quantidade que chegou de pelo menos um item.';
  end if;
  if (coalesce(p_avaria, false) or v_devolveu or coalesce(p_encerrar, false))
     and coalesce(btrim(p_observacao), '') = '' then
    raise exception 'Descreva o que aconteceu (avaria, devolução, falta).';
  end if;

  update "PedidoCompraItem" i
     set "quantidadeRecebida" = i."quantidadeRecebida" + coalesce(x.recebida, 0),
         "quantidadeDevolvida" = i."quantidadeDevolvida" + coalesce(x.devolvida, 0)
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(item text, recebida numeric, devolvida numeric)
   where i.id = x.item and i."pedidoCompraId" = p.id;

  select bool_and("quantidadeRecebida" >= quantidade) into v_completo
  from "PedidoCompraItem" where "pedidoCompraId" = p.id;

  v_situacao := case
    when coalesce(p_avaria, false) or v_devolveu then 'inconforme'
    when v_completo then 'conforme'
    else 'parcial'
  end;

  insert into "Recebimento" (
    "pedidoCompraId", situacao, observacao, "nomeRecebedor", "registradoPorId"
  ) values (
    p.id, v_situacao, nullif(btrim(p_observacao), ''),
    (select nome from "Usuario" where id = p_usuario_id), p_usuario_id
  )
  returning id into v_recebimento;

  insert into "RecebimentoItem" ("recebimentoId", "pedidoCompraItemId", "quantidadeRecebida", "quantidadeDevolvida")
  select v_recebimento, x.item, coalesce(x.recebida, 0), coalesce(x.devolvida, 0)
  from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(item text, recebida numeric, devolvida numeric)
  where coalesce(x.recebida, 0) + coalesce(x.devolvida, 0) > 0;

  select exists (
    select 1 from "Recebimento" where "pedidoCompraId" = p.id and situacao = 'inconforme'
  ) into v_teve_problema;

  v_entrega := case
    when v_completo and not v_teve_problema then 'recebido_conforme'
    when v_completo or coalesce(p_encerrar, false) then 'recebido_inconforme'
    else 'recebido_parcial'
  end;
  update "PedidoCompra" set "statusEntrega" = v_entrega where id = p.id;

  if not exists (
    select 1 from "PedidoCompra"
    where "requisicaoId" = p."requisicaoId" and "statusEntrega" in ('pendente', 'recebido_parcial')
  ) then
    update "Requisicao" set status = 'concluida', "atualizadoEm" = now()
     where id = p."requisicaoId" and status = 'pedido_emitido';
  end if;

  return jsonb_build_object(
    'recebimentoId', v_recebimento,
    'situacao', v_situacao,
    'statusEntrega', v_entrega,
    'statusRequisicao', (select status from "Requisicao" where id = p."requisicaoId")
  );
end;
$$;

revoke execute on function public.suprimentos_reabrir_cotacao(text, text, text) from public, anon, authenticated;
revoke execute on function public.suprimentos_confirmar_compra(text, text) from public, anon, authenticated;
revoke execute on function public.suprimentos_registrar_recebimento_itens(text, text, jsonb, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.suprimentos_reabrir_cotacao(text, text, text) to service_role;
grant execute on function public.suprimentos_confirmar_compra(text, text) to service_role;
grant execute on function public.suprimentos_registrar_recebimento_itens(text, text, jsonb, boolean, text, boolean) to service_role;

commit;
