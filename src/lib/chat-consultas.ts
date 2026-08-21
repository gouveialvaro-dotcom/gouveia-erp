import "server-only";
import { supabase } from "@/lib/supabase";
import { tituloConversa, type TipoConversa } from "@/lib/chat";
import type { ItemConversa } from "@/components/chat/lista-conversas";

// Monta a lista de conversas do usuário já com o título de exibição resolvido.
// Vive fora de actions.ts porque não é Server Action — é consulta usada por
// Server Components, e arquivo "use server" só exporta função async pública.
export async function carregarConversas(usuarioId: string): Promise<ItemConversa[]> {
  const { data: linhas } = await supabase.rpc("conversas_do_usuario", {
    p_usuario_id: usuarioId,
  });

  const conversas = linhas ?? [];
  if (conversas.length === 0) return [];

  const obraIds = conversas.map((c) => c.obraId).filter((id): id is string => !!id);
  const idsDiretas = conversas.filter((c) => c.tipo === "direta").map((c) => c.id);

  // O título de obra e de direta é derivado, então precisa da obra e de quem
  // mais está na conversa. Duas consultas para o conjunto todo, não uma por
  // conversa.
  const [{ data: obras }, { data: participantes }] = await Promise.all([
    obraIds.length
      ? supabase
          .from("Obra")
          .select(
            "id, nomeProjeto, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto))"
          )
          .in("id", obraIds)
      : Promise.resolve({ data: [] }),
    idsDiretas.length
      ? supabase
          .from("ParticipanteConversa")
          .select("conversaId, usuario:Usuario(id, nome)")
          .in("conversaId", idsDiretas)
          .neq("usuarioId", usuarioId)
      : Promise.resolve({ data: [] }),
  ]);

  const porObra = new Map((obras ?? []).map((o) => [o.id, o]));
  const outros = new Map<string, { nome: string }[]>();
  for (const p of participantes ?? []) {
    if (!p.usuario) continue;
    outros.set(p.conversaId, [...(outros.get(p.conversaId) ?? []), { nome: p.usuario.nome }]);
  }

  // Conversa com movimento recente primeiro; a sem mensagem cai para o fim.
  const ordenadas = [...conversas].sort((a, b) =>
    (b.ultimaMensagemEm ?? "").localeCompare(a.ultimaMensagemEm ?? "")
  );

  return ordenadas.map((c) => ({
    id: c.id,
    tipo: c.tipo as TipoConversa,
    titulo: tituloConversa(
      {
        tipo: c.tipo as TipoConversa,
        titulo: c.titulo,
        obra: c.obraId ? porObra.get(c.obraId) : null,
      },
      outros.get(c.id) ?? []
    ),
    previa: c.ultimaMensagemCorpo?.slice(0, 60) ?? "Sem mensagens",
    naoLidas: Number(c.naoLidas ?? 0),
  }));
}
