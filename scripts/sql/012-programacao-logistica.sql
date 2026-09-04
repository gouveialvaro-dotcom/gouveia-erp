-- Programação de Logística — alocação diária de destino, veículo, motorista e
-- equipe, com aviso por WhatsApp a quem precisa saber que algo mudou.
--
-- Hoje o remanejo é combinado por WhatsApp solto e ligação: quem está à frente
-- da obra e quem vai dirigir não recebem a informação de forma confiável. As
-- tabelas abaixo trazem a programação para dentro do ERP e tornam o aviso um
-- efeito do ato de publicar, não um favor de quem lembrou de avisar.
--
-- CHAVES EM TEXT, NÃO UUID. O escopo pedia uuid, mas todo o schema usa
-- `text primary key default (gen_random_uuid())::text` (ver 001-funcoes.sql e
-- 005-whatsapp-pos-venda.sql): uma FK uuid contra Usuario.id (text) não fecha.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais — ver
-- README.md) e depois regerar src/lib/database.types.ts.

-- 1. Enums.
--
-- Fora de transação de propósito, como em 010: ALTER TYPE ... ADD VALUE só fica
-- utilizável depois do commit, e misturar com o resto convida a erro na
-- primeira gravação.

create type public."TipoVeiculo" as enum
  ('caminhonete', 'van', 'munck', 'caminhao', 'carro_passeio', 'outro');

create type public."TipoDestinoProgramacao" as enum ('obra', 'avulso');

create type public."StatusProgramacao" as enum ('rascunho', 'publicada', 'cancelada');

create type public."TipoIndisponibilidade" as enum ('funcionario', 'veiculo');

create type public."PapelDestinatario" as enum
  ('responsavel', 'motorista_novo', 'motorista_removido');

-- Perfil novo: quem monta a programação. Engenharia e obra só leem; o
-- atendimento não enxerga o módulo (ver src/lib/permissoes.ts).
alter type public."PerfilUsuario" add value if not exists 'logistica';

begin;

-- 2. Frota.
--
-- Sem quilometragem, abastecimento ou condutor fixo: o módulo existe para
-- comunicar alocação, não para gerir frota. O motorista é escolhido por dia, na
-- linha da programação, entre a equipe daquele dia.

create table public."Veiculo" (
  id text primary key default (gen_random_uuid())::text,
  -- Guardada em maiúsculas e sem hífen (a normalização acontece na Server
  -- Action). Sem isso "PGA-1A23" e "pga1a23" seriam dois veículos, e a trava de
  -- duplicidade deixaria o mesmo carro sair para dois destinos no mesmo dia.
  placa text not null,
  modelo text not null,
  tipo public."TipoVeiculo" not null,
  -- Apelido interno ("Caminhonete 03"). É como a operação chama o carro no
  -- dia a dia; a placa é como ela confere.
  identificacao text,
  -- Veículo baixado sai das listas sem apagar histórico de programação.
  ativo boolean not null default true,
  "criadoEm" timestamptz not null default now(),
  "criadoPorId" text references public."Usuario"(id) on delete set null
);

create unique index "Veiculo_placa_key" on public."Veiculo" (placa);

-- 3. Telefone e interruptor de aviso.
--
-- Levantamento antes de aplicar: nem Usuario nem Funcionario tinham qualquer
-- coluna de telefone (só Cliente e ContatoCliente têm). Por isso as quatro
-- colunas abaixo são criadas, e não reaproveitadas.
--
-- Ficam NULL: o cadastro existente não tem os números. Quem não tiver telefone
-- simplesmente não pode ser salvo como responsável nem como motorista — a
-- Server Action barra com mensagem dizendo qual cadastro completar.

alter table public."Usuario"
  add column if not exists telefone text,
  add column if not exists "recebeProgramacao" boolean not null default true;

alter table public."Funcionario"
  add column if not exists telefone text,
  add column if not exists "recebeProgramacao" boolean not null default true;

-- 4. A programação.
--
-- Uma linha = um veículo, em um dia, para um destino, com o motorista e a
-- equipe que vão nele.

create table public."ProgramacaoDiaria" (
  id text primary key default (gen_random_uuid())::text,

  -- `date`, não timestamptz: a granularidade é dia inteiro, não há turno nem
  -- horário. O app trata a coluna como string "YYYY-MM-DD" em UTC (ver
  -- src/lib/pos-venda.ts) porque converter para Date local desloca o dia em
  -- fuso negativo — e programação exibida um dia errado é falha grave aqui.
  data date not null,

  "tipoDestino" public."TipoDestinoProgramacao" not null,
  "obraId" text references public."Obra"(id) on delete restrict,
  "descricaoAvulsa" text,

  -- Pode ser nulo: há serviço que a equipe faz sem carro.
  "veiculoId" text references public."Veiculo"(id) on delete restrict,
  "motoristaId" text references public."Funcionario"(id) on delete restrict,

  servico text not null,
  observacao text,

  status public."StatusProgramacao" not null default 'rascunho',
  "publicadaEm" timestamptz,
  -- true quando a linha foi editada depois de publicada. É o que acende a
  -- faixa de "alterações não publicadas" e o que a republicação zera.
  "temAlteracaoPendente" boolean not null default false,

  "criadoPorId" text references public."Usuario"(id) on delete set null,
  "criadoEm" timestamptz not null default now(),
  "atualizadoPorId" text references public."Usuario"(id) on delete set null,
  "atualizadoEm" timestamptz,

  -- Coerência do destino no BANCO, e não só na action: destino errado corrompe
  -- a mensagem que sai para quem está em campo.
  constraint "ProgramacaoDiaria_destino_check" check (
    ("tipoDestino" = 'obra'   and "obraId" is not null and "descricaoAvulsa" is null)
    or
    ("tipoDestino" = 'avulso' and "obraId" is null     and "descricaoAvulsa" is not null)
  ),

  -- Carro sem motorista definido é exatamente o buraco de comunicação que o
  -- módulo existe para fechar.
  constraint "ProgramacaoDiaria_motorista_check" check (
    "veiculoId" is null or "motoristaId" is not null
  )
);

-- Reforço da trava de duplicidade do veículo no banco. A duplicidade de pessoa
-- não cabe em índice — a equipe é tabela filha — e fica por conta da validação
-- da Server Action.
create unique index "ProgramacaoDiaria_data_veiculo_key"
  on public."ProgramacaoDiaria" (data, "veiculoId")
  where status <> 'cancelada' and "veiculoId" is not null;

-- A tela é sempre um recorte por período (dia, semana ou mês).
create index "ProgramacaoDiaria_data_idx" on public."ProgramacaoDiaria" (data, status);
create index "ProgramacaoDiaria_pendente_idx"
  on public."ProgramacaoDiaria" (data)
  where "temAlteracaoPendente";

-- 5. Equipe e responsáveis.
--
-- Pessoa a pessoa, sempre. Não há cadastro de equipe padrão de propósito: a
-- operação precisa de maleabilidade para montar o time do dia.

create table public."ProgramacaoEquipe" (
  id text primary key default (gen_random_uuid())::text,
  "programacaoId" text not null
    references public."ProgramacaoDiaria"(id) on delete cascade,
  "funcionarioId" text not null
    references public."Funcionario"(id) on delete restrict
);

create unique index "ProgramacaoEquipe_key"
  on public."ProgramacaoEquipe" ("programacaoId", "funcionarioId");
create index "ProgramacaoEquipe_funcionario_idx"
  on public."ProgramacaoEquipe" ("funcionarioId");

-- Responsável é sempre USUÁRIO do sistema (tem login) — quem responde pela
-- obra, não quem vai nela. Mínimo 1 por linha, validado na Server Action:
-- "pelo menos uma filha" não é constraint simples.
create table public."ProgramacaoResponsavel" (
  id text primary key default (gen_random_uuid())::text,
  "programacaoId" text not null
    references public."ProgramacaoDiaria"(id) on delete cascade,
  "usuarioId" text not null
    references public."Usuario"(id) on delete restrict
);

create unique index "ProgramacaoResponsavel_key"
  on public."ProgramacaoResponsavel" ("programacaoId", "usuarioId");

-- 6. Indisponibilidade — férias, atestado, treinamento, veículo em oficina.

create table public."Indisponibilidade" (
  id text primary key default (gen_random_uuid())::text,
  tipo public."TipoIndisponibilidade" not null,
  "funcionarioId" text references public."Funcionario"(id) on delete cascade,
  "veiculoId" text references public."Veiculo"(id) on delete cascade,
  "dataInicio" date not null,
  -- Inclusiva: quem volta dia 12 tem dataFim = 11.
  "dataFim" date not null,
  motivo text not null,
  "criadoPorId" text references public."Usuario"(id) on delete set null,
  "criadoEm" timestamptz not null default now(),

  constraint "Indisponibilidade_alvo_check" check (
    (tipo = 'funcionario' and "funcionarioId" is not null and "veiculoId" is null)
    or
    (tipo = 'veiculo'     and "veiculoId" is not null     and "funcionarioId" is null)
  ),
  constraint "Indisponibilidade_periodo_check" check ("dataFim" >= "dataInicio")
);

create index "Indisponibilidade_periodo_idx"
  on public."Indisponibilidade" ("dataInicio", "dataFim");

-- 7. O que mudou entre uma publicação e a seguinte.
--
-- É a FONTE da mensagem, e não um log genérico de auditoria: recalcular o diff
-- a partir de auditoria daria uma consulta cara e ambígua, e a mensagem sairia
-- diferente do que a tela mostrou na hora de publicar.

create table public."AlteracaoProgramacao" (
  id text primary key default (gen_random_uuid())::text,
  "programacaoId" text not null
    references public."ProgramacaoDiaria"(id) on delete cascade,

  -- veiculo | motorista | equipe | servico | data | destino | observacao
  -- | responsaveis | cancelamento
  campo text not null,

  -- TEXTO LEGÍVEL, não id ("Hilux SR — PGA1A23"). A mensagem precisa reproduzir
  -- o que a pessoa viu no dia: se o veículo for renomeado ou o funcionário
  -- desligado depois, o histórico continua correto — um id resolvido na hora do
  -- envio contaria outra história.
  "valorAnterior" text,
  "valorNovo" text,

  -- ROTEAMENTO, não conteúdo. Quem saiu como motorista precisa ser avisado de
  -- que saiu, e para isso é preciso o telefone dele — que o texto legível de
  -- "valorAnterior" não devolve (dois funcionários homônimos, alguém renomeado
  -- depois). A coluna existe só para achar a pessoa; o que a mensagem diz
  -- continua vindo de valorAnterior/valorNovo.
  "motoristaAnteriorId" text references public."Funcionario"(id) on delete set null,

  "alteradoPorId" text references public."Usuario"(id) on delete set null,
  "alteradoEm" timestamptz not null default now(),
  -- Nulo = ainda não comunicada. É o que a republicação consome.
  "publicadaEm" timestamptz
);

create index "AlteracaoProgramacao_pendente_idx"
  on public."AlteracaoProgramacao" ("programacaoId")
  where "publicadaEm" is null;

-- 8. Registro de envio.
--
-- Gravado SEMPRE antes de tentar enviar, e a falha não desfaz a publicação: a
-- programação publicada é a verdade do sistema; a mensagem é o aviso. Perder o
-- aviso é ruim e fica visível em /programacao/envios com botão de reenvio;
-- desfazer a publicação por causa do gateway seria pior.

create table public."EnvioWhatsapp" (
  id text primary key default (gen_random_uuid())::text,
  -- Número normalizado no momento do envio (chaveTelefone). Fica na linha e não
  -- é relido do cadastro: o registro tem que dizer para onde a mensagem foi.
  telefone text not null,
  "usuarioId" text references public."Usuario"(id) on delete set null,
  "funcionarioId" text references public."Funcionario"(id) on delete set null,
  papel public."PapelDestinatario" not null,
  mensagem text not null,
  urgente boolean not null default false,
  -- pendente | enviado | falha
  status text not null default 'pendente',
  tentativas integer not null default 0,
  erro text,
  "criadoEm" timestamptz not null default now(),
  "enviadoEm" timestamptz
);

create index "EnvioWhatsapp_criadoEm_idx" on public."EnvioWhatsapp" ("criadoEm" desc);
create index "EnvioWhatsapp_status_idx" on public."EnvioWhatsapp" (status);

-- 9. Teto diário do aviso de programação.
--
-- Mesmo número corporativo do atendimento, mesma exposição ao bloqueio pela
-- Meta. O teto de conversas novas do atendimento não serve aqui: lá ele conta
-- conversa iniciada com cliente, e programação não cria conversa nenhuma.
alter table public."ParametroGeral"
  add column if not exists "tetoDiarioAvisosProgramacao" integer not null default 60;

commit;
