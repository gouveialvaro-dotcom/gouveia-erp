"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, CornerUpLeft, X } from "lucide-react";
import { decidirAprovacao, type EstadoDecisao } from "@/app/(app)/suprimentos/aprovacoes/actions";
import { ROTULO_NIVEL } from "@/lib/suprimentos";
import { moeda } from "@/lib/suprimentos-cotacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Decisão de um aprovador sobre a compra: aprovar, devolver para o comprador
// refazer a cotação, ou recusar de vez. Devolver e recusar pedem o motivo.

export function PainelDecisao({
  requisicaoId,
  nivel,
  valorTotal,
  proprioRequisitante,
  outroNivelPendente,
}: {
  requisicaoId: string;
  nivel: "gerencia" | "diretoria";
  valorTotal: number;
  proprioRequisitante: boolean;
  /** Nível que ainda falta além deste (compra acima da gerência). */
  outroNivelPendente: "gerencia" | "diretoria" | null;
}) {
  const [estado, acao, pendente] = useActionState<EstadoDecisao, FormData>(decidirAprovacao, undefined);
  const [comentario, setComentario] = useState("");

  return (
    <form
      // Envio manual (com o botão que submeteu): com action={} o React limparia
      // o comentário depois de um erro.
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget, (evento.nativeEvent as SubmitEvent).submitter);
        startTransition(() => acao(dados));
      }}
      className="flex flex-col gap-4 rounded-md border-2 border-primary/40 bg-card p-4"
    >
      <input type="hidden" name="requisicaoId" value={requisicaoId} />
      <input type="hidden" name="nivel" value={nivel} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Sua aprovação · {ROTULO_NIVEL[nivel]}</h3>
        <span className="text-lg font-semibold tabular-nums">{moeda(valorTotal)}</span>
      </div>

      {proprioRequisitante && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Você também é o requisitante desta compra. Pode aprovar, mas a decisão fica marcada.
        </p>
      )}
      {outroNivelPendente && (
        <p className="text-xs text-muted-foreground">
          Também falta a aprovação da {ROTULO_NIVEL[outroNivelPendente]}. O pedido só sai com as duas.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comentario">Comentário</Label>
        <Textarea
          id="comentario"
          name="comentario"
          rows={2}
          placeholder="Obrigatório para devolver ou recusar"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="anexo">Documento assinado (opcional)</Label>
        <Input id="anexo" name="anexo" type="file" accept=".pdf,image/*" />
        <span className="text-xs text-muted-foreground">PDF assinado no Gov.br ou foto, até 10 MB.</span>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decisao" value="aprovada" disabled={pendente}>
          <Check className="h-4 w-4" /> {pendente ? "Enviando..." : "Aprovar"}
        </Button>
        <Button type="submit" name="decisao" value="devolvida" variant="outline" disabled={pendente}>
          <CornerUpLeft className="h-4 w-4" /> Devolver para cotação
        </Button>
        <Button type="submit" name="decisao" value="recusada" variant="destructive" disabled={pendente}>
          <X className="h-4 w-4" /> Recusar
        </Button>
      </div>
    </form>
  );
}
