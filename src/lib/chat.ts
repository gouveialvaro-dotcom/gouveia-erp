// Constantes e regras puras do chat interno. Fica separado de actions.ts
// porque arquivo "use server" só pode exportar função async.
import type { Perfil } from "@/lib/permissoes";
import { projetoDaObra, type ObraIdentificavel } from "@/lib/obras";

export type TipoConversa = "obra" | "direta" | "grupo";

export const ROTULO_TIPO_CONVERSA: Record<TipoConversa, string> = {
  obra: "Obra",
  direta: "Conversa direta",
  grupo: "Grupo",
};

export const LIMITE_ANEXO_BYTES = 10 * 1024 * 1024;

export const BUCKET_CHAT = "chat";

// A conversa direta e o grupo são auditáveis pela administração. O aviso é
// exibido em tela: o usuário precisa saber, não dá para deixar implícito.
export const AVISO_AUDITORIA =
  "Conversas no sistema podem ser auditadas pela administração.";

export function podeAuditarChat(perfil: Perfil): boolean {
  return perfil === "admin";
}

// A mensagem é imutável para quem escreveu: ninguém edita nem apaga a
// própria. Só o admin remove, e mesmo assim por soft delete — o histórico
// é a razão de existir do módulo.
export function podeRemoverMensagem(perfil: Perfil): boolean {
  return perfil === "admin";
}

type ConversaExibivel = {
  tipo: TipoConversa;
  titulo: string | null;
  obra?: ObraIdentificavel | null;
};

// O título não é gravado em obra nem em direta — é derivado, para não divergir
// da origem quando a obra é renomeada ou o participante troca de nome.
export function tituloConversa(
  conversa: ConversaExibivel,
  outrosParticipantes: { nome: string }[] = []
): string {
  switch (conversa.tipo) {
    case "obra":
      return conversa.obra ? projetoDaObra(conversa.obra) : "Obra";
    case "direta":
      return outrosParticipantes.map((p) => p.nome).join(", ") || "Conversa direta";
    case "grupo":
      return conversa.titulo ?? "Grupo";
  }
}
