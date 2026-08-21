import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo, usuarioIdAtual } from "@/lib/pagina-auth";
import {
  AVISO_AUDITORIA,
  ROTULO_TIPO_CONVERSA,
  podeRemoverMensagem,
  tituloConversa,
  type TipoConversa,
} from "@/lib/chat";
import { Thread } from "@/components/chat/thread";
import { CampoMensagem } from "@/components/chat/campo-mensagem";
import { marcarLida } from "../actions";

export default async function PaginaConversa({
  params,
}: {
  params: Promise<{ conversaId: string }>;
}) {
  const { perfil } = await acessoModulo("chat");
  const { conversaId } = await params;
  const usuarioId = await usuarioIdAtual();

  const { data: conversa } = await supabase
    .from("Conversa")
    .select(
      "id, tipo, titulo, obra:Obra(id, nomeProjeto, oportunidade:Oportunidade(orcamento:Orcamento(nomeProjeto))), participantes:ParticipanteConversa(usuarioId, usuario:Usuario(id, nome))"
    )
    .eq("id", conversaId)
    .maybeSingle();

  // Não participar é indistinguível de não existir: quem não está na conversa
  // não deve nem saber que ela existe.
  const participa = (conversa?.participantes ?? []).some((p) => p.usuarioId === usuarioId);
  if (!conversa || !participa) notFound();

  const { data: mensagens } = await supabase
    .from("Mensagem")
    .select(
      "id, corpo, criadaEm, removidaEm, autor:Usuario!Mensagem_autorId_fkey(id, nome), removidaPor:Usuario!Mensagem_removidaPorId_fkey(nome)"
    )
    .eq("conversaId", conversaId)
    .order("criadaEm", { ascending: true });

  // Abrir a conversa zera o não lido dela.
  await marcarLida(conversaId);

  const tipo = conversa.tipo as TipoConversa;
  const outros = (conversa.participantes ?? [])
    .filter((p) => p.usuarioId !== usuarioId)
    .map((p) => ({ nome: p.usuario?.nome ?? "—" }));

  return (
    <>
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          {tituloConversa({ tipo, titulo: conversa.titulo, obra: conversa.obra }, outros)}
        </h2>
        <p className="text-xs text-muted-foreground">
          {ROTULO_TIPO_CONVERSA[tipo]} · {(conversa.participantes ?? []).length} participante(s)
        </p>
        {/* Conversa direta e grupo são auditáveis pela administração, e isso
            precisa estar escrito na tela — não implícito numa política. */}
        {tipo !== "obra" && (
          <p className="mt-1 text-xs text-muted-foreground italic">{AVISO_AUDITORIA}</p>
        )}
      </header>

      <Thread
        conversaId={conversaId}
        mensagens={mensagens ?? []}
        usuarioId={usuarioId}
        podeRemover={podeRemoverMensagem(perfil)}
      />

      <CampoMensagem conversaId={conversaId} />
    </>
  );
}
