"use client";

import { useActionState } from "react";
import {
  salvarAjustesComerciais,
  type EstadoAjustes,
} from "@/app/(app)/orcamentos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AjustesComerciaisForm({
  orcamentoId,
  bdiPersonalizado,
  bdiPadrao,
  ajusteMaoObraPercent,
  descontoPercent,
}: {
  orcamentoId: string;
  bdiPersonalizado: number | null;
  bdiPadrao: number;
  ajusteMaoObraPercent: number;
  descontoPercent: number;
}) {
  const salvarComId = salvarAjustesComerciais.bind(null, orcamentoId);
  const [estado, formAction, pendente] = useActionState<EstadoAjustes, FormData>(
    salvarComId,
    undefined
  );

  return (
    <form action={formAction} className="rounded-md border bg-card p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">Ajustes comerciais</h3>
        <p className="text-xs text-muted-foreground">
          Alteram o valor da proposta. Entram na próxima revisão que você emitir.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bdi">BDI (%)</Label>
          <Input
            id="bdi"
            name="bdi"
            type="number"
            step="0.01"
            min="0"
            placeholder={`padrão: ${bdiPadrao}`}
            defaultValue={bdiPersonalizado ?? ""}
          />
          <span className="text-xs text-muted-foreground">
            Vazio usa o padrão dos parâmetros ({bdiPadrao}%).
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ajusteMaoObraPercent">Ajuste na mão de obra (%)</Label>
          <Input
            id="ajusteMaoObraPercent"
            name="ajusteMaoObraPercent"
            type="number"
            step="0.01"
            min="-100"
            defaultValue={ajusteMaoObraPercent}
          />
          <span className="text-xs text-muted-foreground">
            Negativo reduz, positivo acresce. Ex.: −10 corta 10% da mão de obra.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="descontoPercent">Desconto (%)</Label>
          <Input
            id="descontoPercent"
            name="descontoPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={descontoPercent}
          />
          <span className="text-xs text-muted-foreground">
            Aplicado sobre o preço final de venda.
          </span>
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
      {estado?.sucesso && <p className="text-sm text-muted-foreground">Ajustes salvos.</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar ajustes"}
        </Button>
      </div>
    </form>
  );
}
