-- Suprimentos: cadastro de unidades de medida e autorização do cliente opcional.
--
-- Rodar DEPOIS do 017 e ANTES do merge do código que usa a tabela nova. Só
-- acrescenta uma tabela e troca uma função; nada é apagado.
--
--  1. UnidadeMedida: as unidades da requisição saem de uma lista fixa no
--     código e passam a ser cadastradas em Cadastros → Unidades de medida.
--     Já vem com as de antes mais Litro.
--  2. A compra faturada em nome do cliente não exige mais o anexo da
--     autorização para ir à aprovação (continua opcional e continua pedindo
--     ao menos a Gerência).
--
-- Rodar no SQL Editor do Supabase, inteiro de uma vez.

begin;

-- 1. Unidades de medida.
create table if not exists public."UnidadeMedida" (
  id text primary key default (gen_random_uuid())::text,
  -- O que vai gravado no item (UN, SC, L...). Sempre em maiúsculas.
  sigla text not null unique check (sigla = upper(sigla) and btrim(sigla) <> ''),
  nome text not null,
  ordem integer not null default 100,
  ativo boolean not null default true,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null
);

alter table public."UnidadeMedida" enable row level security;

insert into public."UnidadeMedida" (sigla, nome, ordem) values
  ('UN', 'Unidade', 10),
  ('SC', 'Saco', 20),
  ('M', 'Metro', 30),
  ('M2', 'Metro quadrado (m²)', 40),
  ('M3', 'Metro cúbico (m³)', 50),
  ('L', 'Litro', 55),
  ('KG', 'Quilo (kg)', 60),
  ('T', 'Tonelada', 70)
on conflict (sigla) do nothing;

-- 2. Envio para aprovação sem exigir a autorização do cliente.
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
    coalesce(bool_or(c."faturadoCliente"), false)
  into v_tem_cliente
  from "RequisicaoItem" ri
  join "CotacaoItem" ci on ci.id = ri."cotacaoItemVencedorId"
  join "Cotacao" c on c.id = ci."cotacaoId"
  where ri."requisicaoId" = r.id;

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

commit;
