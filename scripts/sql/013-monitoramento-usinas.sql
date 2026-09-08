-- Monitoramento de usinas fotovoltaicas (iSolarCloud / Sungrow).
--
-- Acompanha diariamente as usinas dos clientes solares com plano de manutenção
-- ativo e abre alerta quando a usina falha, não gera, ou gera muito abaixo do
-- próprio padrão. Hoje ninguém olha: a empresa só descobre que a usina parou
-- quando o cliente liga reclamando da conta de luz — e a essa altura já se
-- perderam semanas de geração que o contrato de manutenção deveria proteger.
--
-- CHAVES EM TEXT, NÃO UUID. O escopo pedia uuid, mas todo o schema usa
-- `text primary key default (gen_random_uuid())::text` (ver 001-funcoes.sql,
-- 005-whatsapp-pos-venda.sql e 012-programacao-logistica.sql): uma FK uuid
-- contra Usuario.id (text) não fecha.
--
-- A FILA DE WHATSAPP É A QUE JÁ EXISTE. O escopo previa uma tabela
-- EnvioWhatsappAlerta separada, mas o número é o MESMO do atendimento e da
-- programação: duas filas independentes teriam dois tetos diários que não se
-- enxergam, e o número levaria a soma dos dois sem ninguém perceber. Aqui só se
-- acrescenta uma coluna e um papel a EnvioWhatsapp.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais — ver
-- README.md) e depois regerar src/lib/database.types.ts.

-- 1. Enums.
--
-- Fora de transação de propósito, como em 010 e 012: ALTER TYPE ... ADD VALUE
-- só fica utilizável depois do commit, e misturar com o resto convida a erro na
-- primeira gravação.

create type public."JanelaColetaUsina" as enum ('manha', 'meio_dia', 'fim_tarde');

create type public."TipoAlertaUsina" as enum
  ('falha', 'sem_comunicacao', 'sem_geracao', 'potencia_baixa', 'plano_a_vencer');

create type public."SituacaoAlertaUsina" as enum ('aberto', 'resolvido', 'ignorado');

create type public."MotivoInativacaoUsina" as enum ('plano_encerrado', 'manual');

-- Papel novo na fila de WhatsApp que já existe. Sem ele o aviso de alerta teria
-- de se disfarçar de aviso de programação, e /programacao/envios passaria a
-- listar mensagem que não é dela.
alter type public."PapelDestinatario" add value if not exists 'alerta_usina';

begin;

-- 2. A usina monitorada.
--
-- Uma linha por planta do iSolarCloud que a Gouveia acompanha. O vínculo com
-- Cliente e com a UC geradora é obrigatório: alerta sem dono não vira ação, e é
-- pela UC que o chamado de pós-venda nasce depois.

create table public."UsinaMonitorada" (
  id text primary key default (gen_random_uuid())::text,

  -- Identificador da planta no iSolarCloud (ps_id). É a chave de ligação com a
  -- API e o que torna a coleta idempotente.
  "psId" text not null,
  -- Nome como vem da API. Guardado mesmo quando há apelido, para que dê para
  -- reconhecer a planta no portal da Sungrow quando alguém for conferir.
  "nomeIsolar" text not null,
  -- Nome interno, quando o da API for ruim (é comum vir como código do
  -- integrador que instalou).
  apelido text,

  "clienteId" text not null references public."Cliente"(id) on delete restrict,
  -- RESTRICT e unique: uma UC geradora tem uma usina, e apagar a UC por baixo
  -- deixaria o histórico de geração órfão. A regra de que a UC precisa ser do
  -- mesmo cliente e do tipo 'geradora' fica na Server Action — depende de duas
  -- tabelas e não cabe em check.
  "unidadeConsumidoraId" text not null
    references public."UnidadeConsumidora"(id) on delete restrict,

  -- Potência COMO A API INFORMA, e não a potência oficial da usina. A fonte de
  -- verdade continua sendo UnidadeConsumidora.potenciaKwp, que é o que foi
  -- projetado e vendido. As duas divergem na prática (a API reflete o que está
  -- ligado no inversor hoje), e a divergência é informação útil — string fora do
  -- ar aparece aqui antes de aparecer no alerta. Por isso são duas colunas em
  -- lugares diferentes, e não uma sobrescrevendo a outra.
  "potenciaIsolarKwp" numeric,

  ativo boolean not null default true,
  "motivoInativacao" public."MotivoInativacaoUsina",
  "inativadaEm" date,

  "criadoPorId" text references public."Usuario"(id) on delete set null,
  "criadoEm" timestamptz not null default now(),

  -- Inativa sem motivo é estado ambíguo: ninguém saberia se o plano venceu ou
  -- se alguém desligou à mão, e a reativação (que é manual de propósito)
  -- depende justamente dessa distinção.
  constraint "UsinaMonitorada_inativacao_check" check (
    ativo or ("motivoInativacao" is not null and "inativadaEm" is not null)
  )
);

create unique index "UsinaMonitorada_psId_key" on public."UsinaMonitorada" ("psId");
create unique index "UsinaMonitorada_uc_key"
  on public."UsinaMonitorada" ("unidadeConsumidoraId");
create index "UsinaMonitorada_cliente_idx" on public."UsinaMonitorada" ("clienteId");
-- O painel lista sempre as ativas; as inativas ficam numa aba à parte.
create index "UsinaMonitorada_ativo_idx" on public."UsinaMonitorada" (ativo);

-- 3. A leitura de cada janela.
--
-- Três por dia (manhã, meio-dia, fim de tarde). É a matéria-prima de todo o
-- resto: a mediana de referência, o painel e o comparativo anual saem daqui.

create table public."LeituraUsina" (
  id text primary key default (gen_random_uuid())::text,
  "usinaMonitoradaId" text not null
    references public."UsinaMonitorada"(id) on delete cascade,

  -- DIA SOLAR EM HORÁRIO DO BRASIL, não o dia UTC do servidor. `date`, tratada
  -- como string "YYYY-MM-DD" pelo app (ver src/lib/pos-venda.ts): a Vercel roda
  -- em UTC e a coleta das 18h local cairia no dia seguinte se derivada do Date
  -- do servidor — a geração do dia inteiro iria parar na data errada.
  "dataRef" date not null,
  janela public."JanelaColetaUsina" not null,
  "coletadoEm" timestamptz not null default now(),

  -- A planta reportou. FALSO é diferente de "não coletamos": quando a API cai,
  -- não nasce linha nenhuma, e a ausência da linha é o que o painel mostra como
  -- "sem dado". Confundir os dois geraria alerta falso em massa toda vez que o
  -- iSolarCloud saísse do ar.
  comunicando boolean not null,

  -- Nulos quando a API não devolve o ponto de medição. Campo ausente é "sem
  -- dado", NUNCA zero: zero é o que dispara alerta de usina parada.
  "potenciaInstantaneaKw" numeric,
  "energiaDiaKwh" numeric,
  "energiaMesKwh" numeric,

  -- 'planta' quando a API devolveu a potência consolidada, 'soma_inversores'
  -- quando foi preciso somar inversor a inversor. Muda a interpretação do
  -- número (a soma ignora perda no ponto de conexão) e varia por modelo de
  -- inversor, então precisa estar na própria linha e não numa constante do
  -- código.
  "fontePotencia" text,

  -- Resposta bruta, para depuração. Retenção de 30 dias (ver seção 10 do
  -- escopo): é para investigar coleta suspeita, não para histórico.
  payload jsonb
);

-- A coleta é idempotente: rodar de novo a mesma janela ATUALIZA a linha (upsert
-- por esta chave), não cria outra. Sem isso, uma segunda tentativa depois de
-- timeout duplicaria a geração do dia na mediana de referência.
create unique index "LeituraUsina_janela_key"
  on public."LeituraUsina" ("usinaMonitoradaId", "dataRef", janela);
-- A referência de normalidade lê as últimas leituras de UMA janela específica.
create index "LeituraUsina_referencia_idx"
  on public."LeituraUsina" ("usinaMonitoradaId", janela, "dataRef" desc);
create index "LeituraUsina_dataRef_idx" on public."LeituraUsina" ("dataRef");

-- 4. Falhas e alarmes vindos da API.

create table public."FalhaUsina" (
  id text primary key default (gen_random_uuid())::text,
  "usinaMonitoradaId" text not null
    references public."UsinaMonitorada"(id) on delete cascade,

  codigo text not null,
  descricao text not null,
  -- Inversor ou string afetado. Nulo quando o alarme é da planta inteira.
  dispositivo text,
  -- Como vem da API, sem tradução: a escala varia por modelo e inventar um
  -- mapeamento nosso esconderia a diferença.
  severidade text,

  "detectadaEm" timestamptz not null,
  "encerradaEm" timestamptz,

  -- Quantas coletas seguidas já não trouxeram este alarme. A falha só se
  -- encerra com DUAS: uma coleta isolada sem o alarme é oscilação da API, e
  -- fechar na primeira faria a falha reabrir e fechar em ciclo, notificando a
  -- cada volta.
  "coletasSemAlarme" integer not null default 0
);

-- coalesce no dispositivo porque, em índice único do Postgres, NULL nunca é
-- igual a NULL: sem isso, o alarme de planta inteira (dispositivo nulo) seria
-- inserido de novo a cada coleta.
create unique index "FalhaUsina_key"
  on public."FalhaUsina" (
    "usinaMonitoradaId", codigo, coalesce(dispositivo, ''), "detectadaEm"
  );
create index "FalhaUsina_abertas_idx"
  on public."FalhaUsina" ("usinaMonitoradaId")
  where "encerradaEm" is null;

-- 5. O alerta.
--
-- É o que a equipe vê e trata. Nasce da leitura, mas não é a leitura: a leitura
-- é fato bruto e se apaga com o tempo (24 meses); o alerta é histórico de
-- manutenção do cliente e fica para sempre — serve de argumento na renovação do
-- contrato.

create table public."AlertaUsina" (
  id text primary key default (gen_random_uuid())::text,
  "usinaMonitoradaId" text not null
    references public."UsinaMonitorada"(id) on delete cascade,

  tipo public."TipoAlertaUsina" not null,

  -- CHAVE DE DEDUPLICAÇÃO, e é ela que faz o módulo inteiro funcionar. Impede
  -- que a mesma usina parada abra um alerta a cada coleta, e ao mesmo tempo
  -- permite alerta NOVO quando o problema reaparece depois de resolvido. A
  -- composição por tipo está em referenciaAlerta(), em src/lib/monitoramento.ts.
  referencia text not null,

  situacao public."SituacaoAlertaUsina" not null default 'aberto',
  mensagem text not null,

  -- O que se mediu e contra o que se comparou. Guardados na linha e não
  -- recalculados: a mediana de referência muda todo dia, e um alerta da semana
  -- passada relido hoje contaria outra história.
  "valorObservado" numeric,
  "valorReferencia" numeric,

  "abertoEm" timestamptz not null default now(),
  -- Nulo enquanto ninguém foi avisado. É o que o ciclo de repetição de 3 dias
  -- consome.
  "ultimaNotificacaoEm" timestamptz,
  "resolvidoEm" timestamptz,

  -- O alerta NÃO abre chamado sozinho — a decisão de virar atendimento é
  -- humana. Preenchido quando alguém usa o botão "Abrir chamado" no painel.
  "chamadoId" text references public."Chamado"(id) on delete set null
);

create unique index "AlertaUsina_key"
  on public."AlertaUsina" ("usinaMonitoradaId", tipo, referencia);
-- O painel abre pelos alertas em aberto, ordenados por gravidade e antiguidade.
create index "AlertaUsina_abertos_idx"
  on public."AlertaUsina" (situacao, "abertoEm")
  where situacao = 'aberto';
create index "AlertaUsina_usina_idx"
  on public."AlertaUsina" ("usinaMonitoradaId", "abertoEm" desc);

-- 6. Notificação no sistema.
--
-- Espelha NotificacaoPosVenda. O registro aqui é a FONTE DE VERDADE e acontece
-- sempre, mesmo que o WhatsApp falhe: o WhatsApp é canal de entrega, não é
-- registro.

create table public."NotificacaoMonitoramento" (
  id text primary key default (gen_random_uuid())::text,
  "usuarioId" text not null references public."Usuario"(id) on delete cascade,
  "alertaUsinaId" text not null references public."AlertaUsina"(id) on delete cascade,

  titulo text not null,
  -- Mesma referência do alerta, mais o ciclo de repetição. É o que faz a
  -- renotificação de 3 dias virar aviso novo em vez de esbarrar no upsert.
  referencia text not null,

  "lidaEm" timestamptz,
  "criadaEm" timestamptz not null default now()
);

-- Gravar por upsert com onConflict nestas três colunas, igual ao pós-venda.
create unique index "NotificacaoMonitoramento_key"
  on public."NotificacaoMonitoramento" ("usuarioId", "alertaUsinaId", referencia);
create index "NotificacaoMonitoramento_nao_lidas_idx"
  on public."NotificacaoMonitoramento" ("usuarioId", "criadaEm" desc)
  where "lidaEm" is null;

-- 7. Interruptor de aviso por usuário.
--
-- Espelha recebeProgramacao (012), e NÃO notificaPosVenda: aquele está
-- aposentado desde 010, quando o destinatário do pós-venda passou a ser
-- derivado do próprio chamado. Aqui não há de onde derivar — a usina não tem
-- dono —, então volta a ser flag por usuário.
--
-- Nasce FALSO: o padrão é ninguém receber. Um default true encheria o WhatsApp
-- de todo mundo no primeiro dia de coleta.
alter table public."Usuario"
  add column if not exists "notificaMonitoramento" boolean not null default false;

-- 8. Parâmetros do envio.
--
-- Todos em ParametroGeral, e não constantes no código, porque a seção 9 do
-- escopo exige poder desligar o WhatsApp SEM DEPLOY: se o número der problema,
-- o desligamento tem que ser imediato.
alter table public."ParametroGeral"
  -- Interruptor geral. Desligado, o alerta continua nascendo e notificando no
  -- sistema — só para de sair pelo WhatsApp.
  add column if not exists "whatsappMonitoramentoAtivo" boolean not null default true,
  -- Teto próprio, separado do teto da programação. Os dois convivem: a consulta
  -- de teto da programação conta a tabela inteira do dia, então já enxerga o que
  -- o monitoramento gastou — que é a proteção que se quer para o número.
  add column if not exists "tetoDiarioAvisosMonitoramento" integer not null default 30,
  -- Janela de envio, mais larga que o expediente comercial de propósito: usina
  -- parada às 7h da manhã de sábado é informação que a equipe quer ter.
  add column if not exists "horaInicioAvisoMonitoramento" time not null default '07:00',
  add column if not exists "horaFimAvisoMonitoramento" time not null default '20:00';

-- 9. Ligação da fila de WhatsApp com o alerta.
--
-- SET NULL e não CASCADE: a linha de EnvioWhatsapp é o registro do que saiu do
-- número, e é ela que o teto diário conta. Se apagar um alerta apagasse os
-- envios do dia junto, o teto baixaria retroativamente e liberaria mensagens
-- que já deveriam estar barradas — exatamente a trava que protege o número.
alter table public."EnvioWhatsapp"
  add column if not exists "alertaUsinaId" text
    references public."AlertaUsina"(id) on delete set null;

create index "EnvioWhatsapp_alerta_idx"
  on public."EnvioWhatsapp" ("alertaUsinaId")
  where "alertaUsinaId" is not null;

commit;

-- PENDENTE, fora desta migração: a retenção da seção 10 (payload bruto com 30
-- dias, LeituraUsina consolidada em totais mensais depois de 24 meses). Só faz
-- sentido depois que houver volume, e precisa da tabela de consolidação — que
-- ainda não tem formato definido.
