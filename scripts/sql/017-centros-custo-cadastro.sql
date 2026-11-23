-- Centros de custo como cadastro do app e acesso a Cadastros por tipo.
--
-- Rodar DEPOIS do 016 e ANTES do merge do código que usa estas colunas. Só
-- acrescenta colunas e troca uma função; nada é apagado.
--
--  1. A requisição passa a apontar só para um centro de custo, cadastrado em
--     Cadastros → Centros de custo (as requisições antigas continuam com a
--     obra delas). Centro de custo ganha um código opcional.
--  2. Compra em nome do cliente: o comprador escolhe o cliente no cadastro
--     (Cotacao.clienteId), copiado para o pedido (PedidoCompra.clienteId).
--  3. Usuario.modulosLiberados: acessos dados por pessoa além do perfil — hoje,
--     o cadastro de centros de custo ("cadastros.centrosCusto").
--
-- Rodar no SQL Editor do Supabase, inteiro de uma vez.

begin;

-- 1. Centro de custo com código opcional.
alter table public."CentroCusto" add column if not exists codigo text;
create unique index if not exists "CentroCusto_codigo_key"
  on public."CentroCusto" (codigo) where codigo is not null;

-- 2. Cliente escolhido na cotação.
alter table public."Cotacao"
  add column if not exists "clienteId" text references public."Cliente"(id) on delete restrict;
alter table public."PedidoCompra"
  add column if not exists "clienteId" text references public."Cliente"(id) on delete restrict;

-- O que já foi faturado ao cliente saiu do cliente da obra.
update public."Cotacao" c
   set "clienteId" = o."clienteId"
  from public."Requisicao" r
  join public."Obra" o on o.id = r."obraId"
 where r.id = c."requisicaoId" and c."faturadoCliente" and c."clienteId" is null;
update public."PedidoCompra" pc
   set "clienteId" = c."clienteId"
  from public."Cotacao" c
 where c.id = pc."cotacaoId" and pc."faturadoCliente" and pc."clienteId" is null;

alter table public."Cotacao" drop constraint if exists "Cotacao_cliente_check";
alter table public."Cotacao" add constraint "Cotacao_cliente_check"
  check (not "faturadoCliente" or "clienteId" is not null) not valid;

-- 3. Acessos liberados por pessoa.
alter table public."Usuario"
  add column if not exists "modulosLiberados" text[] not null default '{}';

-- Quem tinha Cadastros inteiro escondido (chave antiga) passa a ter cada tipo
-- escondido, que é o novo formato.
update public."Usuario"
   set "modulosOcultos" = array_remove("modulosOcultos", 'cadastros') || array[
         'cadastros.clientes', 'cadastros.materiais', 'cadastros.kits', 'cadastros.funcoes',
         'cadastros.funcionarios', 'cadastros.veiculos', 'cadastros.tiposProblema',
         'cadastros.descricoes', 'cadastros.parametros'
       ]
 where 'cadastros' = any("modulosOcultos");

-- Emissão do pedido leva o cliente escolhido na cotação.
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
  -- Só requisições antigas, de obra, têm empresa padrão.
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
      "requisicaoId", "cotacaoId", "fornecedorId", codigo, "empresaId", "faturadoCliente", "clienteId",
      "valorItens", "valorFrete", "valorDifal", "valorTotal",
      frete, "coletaPropria", "condicaoPagamento", "formaPagamento", "prazoPagamentoDias", parcelas,
      "prazoEntregaDias", "emitidoPorId"
    ) values (
      r.id, c.id, c."fornecedorId",
      'PED-' || lpad(r.numero::text, 4, '0') || '-' || v_sufixo,
      case when c."faturadoCliente" then null else coalesce(c."empresaId", v_empresa_obra) end,
      c."faturadoCliente",
      case when c."faturadoCliente" then c."clienteId" end,
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

revoke all on function public.suprimentos_emitir_pedidos(text, text) from public, anon, authenticated;
grant execute on function public.suprimentos_emitir_pedidos(text, text) to service_role;

commit;
