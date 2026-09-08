-- Cores e sinalização dos cards do Pós-venda.
--
-- O quadro passa a responder de bate-olho a dois riscos que hoje se confundem:
-- "ninguém assumiu o chamado" (amarelo) e "o prazo está acabando" (laranja /
-- vermelho). Prazo manda mais que posse — ver a ordem de prioridade em
-- estadoDoCard(), em src/lib/pos-venda.ts.
--
-- Para isso o banco precisa guardar duas datas que hoje não existem. Elas não
-- podem ser derivadas do histórico: a linha do tempo registra QUEM fez, mas a
-- regra é sobre o RESPONSÁVEL DO MOMENTO, e o dono pode ter mudado depois.
-- Reconstruir isso a cada leitura seria caro e, pior, mudaria de resposta a
-- cada repasse. Então a virada é gravada quando acontece.
--
-- Rodar no SQL Editor do Supabase e depois regerar src/lib/database.types.ts.

-- 1. As duas datas.
--
-- Nulo em "primeira" é o estado amarelo: ninguém com posse do chamado encostou
-- nele ainda. Quem escreve nessas colunas é registrarAcaoDoResponsavel(), em
-- src/app/(app)/pos-venda/actions.ts, e só quando quem age É o responsável.

alter table public."Chamado"
  add column if not exists "primeiraAcaoResponsavelEm" timestamptz,
  add column if not exists "ultimaAcaoResponsavelEm" timestamptz;

comment on column public."Chamado"."primeiraAcaoResponsavelEm" is
  'Primeira ação do responsável do chamado. Nulo = card amarelo (Aguardando); preenchido = verde (Em andamento), e não volta atrás.';
comment on column public."Chamado"."ultimaAcaoResponsavelEm" is
  'Última ação do responsável. Alimenta a etiqueta de inatividade do card; nulo cai para abertoEm ("Sem ação há X dias").';

-- 2. Backfill da virada.
--
-- Regra combinada: chamado que já existe entra VERDE se tiver qualquer
-- histórico, e amarelo se não tiver. Não se tenta descobrir quem fez o quê —
-- a autoria antiga não distingue responsável de terceiro, e forçar essa
-- reconstrução produziria um número inventado com cara de fato.
--
-- A data usada é "criadoEm" (quando o registro entrou no sistema), não
-- InteracaoChamado.data (que o atendente digita e pode retroagir): a etiqueta
-- de inatividade fala de quando alguém MEXEU, não da data declarada do
-- contato. Aplicado em 08/09/2026: 15 chamados verdes, 1 amarelo, de 16.

with acoes as (
  select "chamadoId", min(ts) as primeira, max(ts) as ultima
  from (
    select "chamadoId", "criadoEm" as ts from public."InteracaoChamado"
    union all
    select "chamadoId", "criadoEm" as ts from public."AnexoChamado"
  ) t
  group by "chamadoId"
)
update public."Chamado" c
   set "primeiraAcaoResponsavelEm" = a.primeira,
       "ultimaAcaoResponsavelEm"   = a.ultima
  from acoes a
 where a."chamadoId" = c.id
   and c."primeiraAcaoResponsavelEm" is null;
