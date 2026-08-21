-- Catálogo de funções de mão de obra.
--
-- Antes desta migração o custo por função morava na tabela Funcionario (uma
-- linha por função, com o nome da função no lugar do nome da pessoa). A partir
-- daqui:
--   Funcao      = quanto custa uma função (fonte: planilha de custo da empresa)
--   Funcionario = a pessoa, que aponta para uma função e herda o custo dela
--   Orçamento   = aloca função ("Eletricista × 30 dias"), não pessoa
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais — ver
-- README.md). Depois rode `npx tsx --env-file=.env scripts/importar-funcoes.ts`
-- para levar as funções da planilha para a tabela nova.

begin;

-- Chaves em text e não uuid: todas as tabelas do schema usam
-- `text default (gen_random_uuid())::text`, e uma FK uuid contra Usuario.id
-- (text) simplesmente não fecha — o Postgres recusa a constraint.
create table public."Funcao" (
  id text primary key default (gen_random_uuid())::text,
  nome text not null,
  "salarioMensal" numeric(12, 2) not null,
  "encargosPercent" numeric(9, 4) not null,
  ativo boolean not null default true,
  "criadoPorId" text references public."Usuario"(id) on delete set null,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now()
);

-- O nome é a chave de negócio: o script de importação casa por ele para poder
-- rodar de novo a cada reajuste sem duplicar função.
create unique index "Funcao_nome_key" on public."Funcao" (nome);

-- Mesma baseline das demais tabelas do public: RLS ligada e nenhuma policy.
-- A aplicação inteira acessa pela service role, que ignora RLS; com a anon key
-- indo para o browser (Realtime), tabela sem RLS vira leitura pública.
alter table public."Funcao" enable row level security;

-- A pessoa herda salário e encargos da função, mas mantém colunas próprias:
-- alguém pode ganhar acima do piso da função sem bagunçar o catálogo.
alter table public."Funcionario"
  add column "funcaoId" text references public."Funcao"(id) on delete set null;

-- O orçamento passa a alocar função. Dropar a coluna é seguro: OrcamentoMaoObra
-- está vazia (0 linhas) no momento desta migração.
alter table public."OrcamentoMaoObra" drop column "funcionarioId";

alter table public."OrcamentoMaoObra"
  add column "funcaoId" text not null references public."Funcao"(id) on delete restrict;

commit;
