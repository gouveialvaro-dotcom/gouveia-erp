-- Separa o cadastro de cliente por ramo de atividade.
--
--   energia_solar      = tem unidades geradoras/beneficiárias e contrato de
--                        manutenção; é o único ramo atendido pelo pós-venda
--   redes_subestacoes  = cadastro simples (contato, e-mail, endereço)
--
-- Já aplicada no projeto Supabase (migração
-- "separar_cliente_por_ramo_e_plano_manutencao"). Fica aqui como registro do
-- schema — o projeto não usa migrations locais, ver README.md.

begin;

create type "RamoCliente" as enum ('energia_solar', 'redes_subestacoes');

alter table "Cliente"
  add column "ramo" "RamoCliente" not null default 'energia_solar',
  add column "contato" text,
  add column "telefone" text,
  add column "email" text,
  -- Janela do contrato de manutenção (só energia solar). Fora dela o
  -- pós-venda recusa a abertura de chamado.
  add column "manutencaoInicio" date,
  add column "manutencaoFim" date,
  add constraint "Cliente_manutencao_check" check (
    "manutencaoInicio" is null
    or "manutencaoFim" is null
    or "manutencaoFim" >= "manutencaoInicio"
  );

-- O contato passa a ser campo do próprio cadastro: puxa o primeiro contato já
-- registrado de cada cliente. A tabela ContatoCliente fica intacta.
update "Cliente" c
set contato = p.nome, telefone = p.telefone, email = p.email
from (
  select distinct on ("clienteId") "clienteId", nome, telefone, email
  from "ContatoCliente"
  order by "clienteId", id
) p
where p."clienteId" = c.id;

-- UG/UB são cadastradas com número e endereço; a concessionária deixou de ser
-- obrigatória, então a unicidade passa a valer também por cliente + número.
alter table "UnidadeConsumidora" alter column "concessionariaId" drop not null;

create unique index "UnidadeConsumidora_cliente_numero_key"
  on "UnidadeConsumidora" ("clienteId", numero);

commit;
