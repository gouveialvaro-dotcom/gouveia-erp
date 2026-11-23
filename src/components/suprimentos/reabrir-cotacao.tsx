"use client";

import { startTransition, useActionState, useState } from "react";
import { CornerUpLeft } from "lucide-react";
import { reabrirCotacao, type EstadoDecisao } from "@/app/(app)/suprimentos/aprovacoes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Diretoria devolve para a cotação uma compra já aprovada (pedido emitido, mas
// ainda não confirmado no fornecedor). Os pedidos emitidos são descartados.

export function ReabrirCotacao({ requisicaoId }: { requisicaoId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDecisao, FormData>(reabrirCotacao, undefined);
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <CornerUpLeft className="h-4 w-4" /> Voltar para cotação
      </Button>
    );
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        startTransition(() => acao(new FormData(evento.currentTarget)));
      }}
      className="flex w-full flex-col gap-3 rounded-md border-2 border-amber-400/60 bg-card p-4"
    >
      <input type="hidden" name="requisicaoId" value={requisicaoId} />
      <div>
        <h3 className="text-sm font-semibold">Voltar esta compra para a cotação</h3>
        <p className="text-xs text-muted-foreground">
          Os pedidos emitidos são descartados e o comprador refaz a cotação. Depois ela passa de novo
          pela aprovação.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motivo-reabrir">Motivo</Label>
        <Textarea
          id="motivo-reabrir"
          name="motivo"
          rows={2}
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: negociar o frete; buscar outro fornecedor para o cabo"
        />
      </div>
      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Enviando..." : "Confirmar e voltar para cotação"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAberto(false)} disabled={pendente}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
