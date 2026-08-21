-- Obra cadastrada na mão, fora do funil comercial.
--
-- Até aqui toda Obra nascia de uma Oportunidade aprovada, e a identidade dela
-- (cliente e nome do projeto) era emprestada desse caminho:
--   Obra -> Oportunidade -> Cliente.razaoSocial
--   Obra -> Oportunidade -> Orcamento.nomeProjeto
-- Ao permitir obra sem oportunidade, essa identidade some — a listagem e a tela
-- da obra renderizariam "—". Por isso a obra manual ganha colunas próprias de
-- cliente e nome de projeto, e uma constraint garante que uma das duas origens
-- esteja completa.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais).

begin;

create type public."OrigemObra" as enum ('funil', 'manual');

-- Toda obra existente veio do funil; o default mantém o comportamento atual
-- para qualquer insert que ainda não informe a origem.
alter table public."Obra"
  add column origem public."OrigemObra" not null default 'funil';

alter table public."Obra"
  alter column "oportunidadeId" drop not null;

-- Identidade própria da obra manual. Nulas na obra de funil, que continua
-- lendo cliente e projeto pela oportunidade.
alter table public."Obra"
  add column "clienteId" text references public."Cliente"(id) on delete restrict,
  add column "nomeProjeto" text;

-- Sem isso dá para gravar uma obra sem oportunidade e sem cliente, que é uma
-- linha órfã que nenhuma tela sabe exibir.
alter table public."Obra"
  add constraint "Obra_origem_check" check (
    (origem = 'funil'  and "oportunidadeId" is not null)
    or
    (origem = 'manual' and "clienteId" is not null and "nomeProjeto" is not null)
  );

-- Os dashboards filtram origem = 'funil'; o índice serve essas queries e a
-- listagem de obras, que ordena por criadoEm.
create index "Obra_origem_criadoEm_idx" on public."Obra" (origem, "criadoEm" desc);

commit;
