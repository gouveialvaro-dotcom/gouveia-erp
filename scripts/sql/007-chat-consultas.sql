-- Consulta da lista de conversas do chat.
--
-- Uma função e não uma view porque o resultado depende do usuário: o não lido
-- sai de ParticipanteConversa."ultimaLeituraEm", que é por pessoa. É a mesma
-- query que alimenta a ordenação da lista e, na etapa do sino, o badge — sem
-- gravar uma linha de notificação por mensagem por usuário.
--
-- SECURITY INVOKER de propósito (é o padrão; explicitado aqui porque a
-- diferença importa): com RLS habilitada e nenhuma policy, quem chamar esta
-- função com a anon key não enxerga nada. Fosse SECURITY DEFINER, a função
-- furaria a RLS e viraria uma porta para ler o chat inteiro pelo PostgREST.
-- O EXECUTE também é revogado de anon e authenticated logo abaixo.
--
-- Rodar no SQL Editor do Supabase (o projeto não usa migrations locais).

begin;

create or replace function public.conversas_do_usuario(p_usuario_id text)
returns table (
  id text,
  tipo public."TipoConversa",
  titulo text,
  "obraId" text,
  "ultimaMensagemEm" timestamptz,
  "ultimaMensagemCorpo" text,
  "naoLidas" bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.tipo,
    c.titulo,
    c."obraId",
    max(m."criadaEm") as "ultimaMensagemEm",
    (array_agg(m.corpo order by m."criadaEm" desc))[1] as "ultimaMensagemCorpo",
    count(m.id) filter (
      where m."criadaEm" > coalesce(p."ultimaLeituraEm", '-infinity'::timestamptz)
        and m."autorId" <> p."usuarioId"
    ) as "naoLidas"
  from public."Conversa" c
  join public."ParticipanteConversa" p
    on p."conversaId" = c.id
   and p."usuarioId" = p_usuario_id
  -- left join: conversa recém-criada ainda não tem mensagem e precisa aparecer.
  left join public."Mensagem" m
    on m."conversaId" = c.id
   and m."removidaEm" is null
  group by c.id, c.tipo, c.titulo, c."obraId";
$$;

revoke execute on function public.conversas_do_usuario(text) from anon, authenticated;

commit;
