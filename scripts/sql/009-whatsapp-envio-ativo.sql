-- Envio ativo: iniciar conversa com quem não escreveu.
--
-- Decisão do sócio-diretor, com o risco assumido. O contexto que justifica a
-- coluna: a conexão é por API não oficial sobre o número corporativo, e disparo
-- para quem não escreveu recentemente é o comportamento que mais leva ao
-- bloqueio permanente do número pela Meta — sem aviso e sem recurso.
--
-- O teto diário de ParametroGeral é a trava. Para contá-lo é preciso saber
-- quais conversas nasceram de um envio nosso, e não de uma mensagem do cliente.
-- Derivar isso da primeira mensagem daria uma consulta cara e ambígua (mensagem
-- apagada, ordem por carimbo do provedor); a marca explícita também serve de
-- registro de auditoria de quando a empresa tomou a iniciativa.
--
-- Rodar no SQL Editor do Supabase e depois regerar src/lib/database.types.ts.

begin;

alter table public."ConversaWhatsapp"
  add column "iniciadaAtivamenteEm" timestamptz;

-- Índice parcial: a única consulta é "quantas foram iniciadas hoje", e a
-- esmagadora maioria das conversas nasce de mensagem do cliente, com a coluna
-- nula.
create index "ConversaWhatsapp_iniciadaAtivamente_idx"
  on public."ConversaWhatsapp" ("iniciadaAtivamenteEm")
  where "iniciadaAtivamenteEm" is not null;

commit;
