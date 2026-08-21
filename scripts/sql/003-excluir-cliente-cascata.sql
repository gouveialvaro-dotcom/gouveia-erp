-- Exclusão em cascata de um cliente e de tudo que depende dele.
--
-- Existe como função no banco (e não como uma sequência de deletes no app)
-- porque precisa ser tudo-ou-nada: uma falha no meio — uma obra que recusa
-- sair, por exemplo — deixaria o cliente sem os chamados mas ainda em pé.
-- Dentro da função tudo roda na mesma transação.
--
-- A ordem segue as chaves estrangeiras que são RESTRICT; o que é CASCADE
-- (itens do orçamento, interações, anexos, unidades, contatos) sai junto
-- sozinho. Os arquivos dos anexos no Storage NÃO são apagados aqui: quem
-- remove é a server action, depois desta função responder ok.
--
-- Já aplicada no projeto Supabase (migração "funcao_excluir_cliente_cascata").
-- Fica aqui como registro do schema — ver README.md.

create or replace function public.excluir_cliente_cascata(p_cliente_id text)
returns void
language plpgsql
as $$
begin
  -- Chamados levam junto interações, anexos e notificações (CASCADE).
  delete from "Chamado" where "clienteId" = p_cliente_id;

  -- Obra aponta para a oportunidade com RESTRICT, então sai antes dela.
  delete from "Obra"
  where "oportunidadeId" in (
    select id from "Oportunidade" where "clienteId" = p_cliente_id
  );

  -- Oportunidade leva junto interações e anexos do CRM (CASCADE).
  delete from "Oportunidade" where "clienteId" = p_cliente_id;

  -- Proposta aponta para o orçamento com RESTRICT.
  delete from "Proposta"
  where "orcamentoId" in (
    select id from "Orcamento" where "clienteId" = p_cliente_id
  );

  -- Orçamento leva junto itens, mão de obra e dados de proposta (CASCADE).
  delete from "Orcamento" where "clienteId" = p_cliente_id;

  -- Cliente leva junto unidades consumidoras e contatos (CASCADE).
  delete from "Cliente" where id = p_cliente_id;
end;
$$;
