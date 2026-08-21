import { formatarDataHora } from "@/lib/format";
import { removerMensagem } from "@/app/(app)/chat/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MensagemThread = {
  id: string;
  corpo: string | null;
  criadaEm: string;
  removidaEm: string | null;
  autor: { id: string; nome: string } | null;
  removidaPor: { nome: string } | null;
};

export function Thread({
  conversaId,
  mensagens,
  usuarioId,
  podeRemover,
}: {
  conversaId: string;
  mensagens: MensagemThread[];
  usuarioId: string;
  podeRemover: boolean;
}) {
  if (mensagens.length === 0) {
    return (
      <div className="flex-1 p-6 text-sm text-muted-foreground">
        Nenhuma mensagem ainda. Escreva a primeira.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {mensagens.map((m) => {
        const minha = m.autor?.id === usuarioId;
        return (
          <div key={m.id} className={cn("flex flex-col gap-1", minha && "items-end")}>
            <div
              className={cn(
                "max-w-[70ch] rounded-lg px-3 py-2 text-sm",
                minha ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {m.removidaEm ? (
                <span className="italic opacity-70">
                  Mensagem removida
                  {m.removidaPor?.nome ? ` por ${m.removidaPor.nome}` : ""}
                </span>
              ) : (
                <span className="whitespace-pre-wrap break-words">{m.corpo}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {m.autor?.nome ?? "—"} · {formatarDataHora(m.criadaEm)}
              </span>
              {podeRemover && !m.removidaEm && (
                <form action={removerMensagem.bind(null, conversaId, m.id)}>
                  <Button type="submit" variant="ghost" size="xs">
                    Remover
                  </Button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
