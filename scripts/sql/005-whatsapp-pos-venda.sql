-- Atendimento por WhatsApp dentro do pós-venda.
--
-- Hoje a conversa com o cliente acontece fora do sistema: a mensagem se perde,
-- não se sabe quem respondeu o quê e o que foi combinado não fica no chamado.
-- Estas duas tabelas trazem a conversa para dentro do ERP. Elas NÃO substituem
-- o chamado — ele continua sendo aberto à mão na tela que já existe, e o SLA
-- continua nascendo de `abertoEm + TipoProblemaPosVenda.prazoDias`.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais — ver
-- README.md) e depois regerar src/lib/database.types.ts.

begin;

create type public."DirecaoMensagemWhatsapp" as enum ('entrada', 'saida');
create type public."TipoMensagemWhatsapp" as enum ('texto', 'imagem', 'documento', 'audio');

-- Uma linha por telefone. Chaves em text e não uuid porque é assim que todo o
-- schema é (ver 001-funcoes.sql): uma FK uuid contra Usuario.id (text) não
-- fecha.
create table public."ConversaWhatsapp" (
  id text primary key default (gen_random_uuid())::text,

  -- Chave canônica do número, SEM o nono dígito: "55" + DDD + 8 dígitos.
  -- O nono dígito fica de fora de propósito. O mesmo cliente escreve ora com
  -- ele, ora sem, e se ele entrasse na chave o WhatsApp de uma pessoa só viraria
  -- duas conversas — cada uma com metade do histórico. Colidir com telefone fixo
  -- é improvável: celular sem o 9 começa em 6–9 e fixo começa em 2–5.
  telefone text not null,
  -- O número como chegou, formatado para leitura. É o que a tela mostra quando
  -- ainda não há cliente vinculado.
  "telefoneExibicao" text not null,
  -- Nome do perfil no WhatsApp. Não identifica ninguém (o cliente escolhe o que
  -- quiser), mas ajuda o atendente a tratar a caixa "Sem cliente".
  "nomePerfil" text,

  -- Nulo enquanto a conversa está em "Sem cliente". Uma vez preenchido — na
  -- mão pelo atendente ou pelo casamento automático de telefone — manda sobre
  -- qualquer tentativa posterior de casar de novo: o vínculo manual persiste.
  "clienteId" text references public."Cliente"(id) on delete set null,
  "contatoClienteId" text references public."ContatoCliente"(id) on delete set null,

  -- Dono = o atendente que assumiu. Qualquer usuário com escrita em posVenda
  -- pode assumir a conversa de outro, sem passar pelo admin.
  "donoId" text references public."Usuario"(id) on delete set null,

  -- Marcação corrente: "a partir de agora, esta conversa é sobre o chamado X".
  -- Vale para as mensagens SEGUINTES, nunca retroativamente. Volta a nulo
  -- sozinha quando o chamado é concluído.
  "chamadoAtivoId" text references public."Chamado"(id) on delete set null,

  -- Pendente = a última mensagem é do cliente e ninguém respondeu ainda.
  pendente boolean not null default false,
  "ultimaMensagemEm" timestamptz,
  "ultimaMensagemDirecao" public."DirecaoMensagemWhatsapp",

  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now()
);

-- É o índice que garante uma conversa por pessoa e o que o webhook usa para
-- achar a conversa a cada mensagem que chega.
create unique index "ConversaWhatsapp_telefone_key"
  on public."ConversaWhatsapp" (telefone);

-- A fila de pendentes é ordenada por tempo de espera — quem espera há mais
-- tempo aparece primeiro.
create index "ConversaWhatsapp_pendente_idx"
  on public."ConversaWhatsapp" (pendente, "ultimaMensagemEm");
create index "ConversaWhatsapp_clienteId_idx"
  on public."ConversaWhatsapp" ("clienteId");
create index "ConversaWhatsapp_donoId_idx"
  on public."ConversaWhatsapp" ("donoId");

create table public."MensagemWhatsapp" (
  id text primary key default (gen_random_uuid())::text,
  "conversaId" text not null
    references public."ConversaWhatsapp"(id) on delete cascade,
  direcao public."DirecaoMensagemWhatsapp" not null,
  tipo public."TipoMensagemWhatsapp" not null default 'texto',
  -- Texto da mensagem ou legenda da mídia.
  conteudo text,

  -- Quem escreveu, só na saída. A tela mostra o nome: o cliente fala com a
  -- empresa, mas internamente é preciso saber quem respondeu o quê.
  "enviadoPorId" text references public."Usuario"(id) on delete set null,

  -- Nulo = mensagem solta, sem chamado. É o estado das mensagens anteriores à
  -- primeira marcação e das que chegam depois de o chamado ser concluído.
  "chamadoId" text references public."Chamado"(id) on delete set null,

  -- Mídia recebida vai para o bucket "whatsapp" (privado). Só o que o atendente
  -- promover é copiado para "pos-venda" e vira AnexoChamado.
  "caminhoStorage" text,
  "nomeArquivo" text,
  tamanho integer,
  mime text,

  -- Id da mensagem no provedor. É o que impede a mesma mensagem de entrar duas
  -- vezes quando o gateway repete a entrega do webhook (ele reenvia se não
  -- receber 2xx rápido).
  "mensagemExternaId" text,

  -- Envio que falhou no gateway continua gravado: o registro do que foi dito ao
  -- cliente não pode depender de o número estar no ar.
  entregue boolean not null default true,
  "erroEnvio" text,

  -- Corpo cru do webhook. O provedor muda campo de payload sem avisar; guardar
  -- o original garante que nenhuma informação se perca antes de alguém revisar
  -- o mapeamento.
  payload jsonb,

  "recebidoEm" timestamptz not null default now(),
  "criadoEm" timestamptz not null default now()
);

-- Índice parcial: só deduplica quem tem id externo (mensagem enviada por nós
-- antes da confirmação do gateway pode não ter).
create unique index "MensagemWhatsapp_mensagemExternaId_key"
  on public."MensagemWhatsapp" ("mensagemExternaId")
  where "mensagemExternaId" is not null;

create index "MensagemWhatsapp_conversaId_recebidoEm_idx"
  on public."MensagemWhatsapp" ("conversaId", "recebidoEm");
create index "MensagemWhatsapp_chamadoId_idx"
  on public."MensagemWhatsapp" ("chamadoId");

-- Mesma baseline das demais tabelas do public: RLS ligada e nenhuma policy. A
-- aplicação inteira acessa pela service role, que ignora RLS.
alter table public."ConversaWhatsapp" enable row level security;
alter table public."MensagemWhatsapp" enable row level security;

-- Bucket próprio para a mídia recebida, separado de "pos-venda". A mídia chega
-- sozinha e em volume, e tem ciclo de vida diferente do anexo de chamado, que é
-- escolhido por uma pessoa: uma futura política de expurgo de conversa não pode
-- esbarrar nos anexos. Promover a anexo copia o arquivo para "pos-venda", então
-- o anexo continua sob as regras que já existem (10 MB).
insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp', 'whatsapp', false, 16777216)
on conflict (id) do nothing;

commit;
