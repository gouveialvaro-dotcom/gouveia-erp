"use client";

import { useActionState } from "react";
import { atualizarObra, type EstadoFormObra } from "@/app/(app)/obras/actions";
import { ORDEM_STATUS_OBRA, ROTULO_STATUS_OBRA } from "@/lib/obras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ObraFormValues = {
  id: string;
  status: string;
  avancoFisicoPercent: number;
  custoOrcado: number;
  custoRealizado: number;
  dataInicio: string | null;
  dataPrevistaConclusao: string | null;
};

export function ObraForm({ obra }: { obra: ObraFormValues }) {
  const atualizarComId = atualizarObra.bind(null, obra.id);
  const [estado, formAction, pendente] = useActionState<EstadoFormObra, FormData>(
    atualizarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={obra.status}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDEM_STATUS_OBRA.map((s) => (
                <SelectItem key={s} value={s}>
                  {ROTULO_STATUS_OBRA[s].texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avancoFisicoPercent">Avanço físico (%)</Label>
          <Input
            id="avancoFisicoPercent"
            name="avancoFisicoPercent"
            type="number"
            step="1"
            min="0"
            max="100"
            defaultValue={obra.avancoFisicoPercent}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="custoOrcado">Custo orçado (R$)</Label>
          <Input
            id="custoOrcado"
            name="custoOrcado"
            type="number"
            step="0.01"
            min="0"
            defaultValue={obra.custoOrcado}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="custoRealizado">Custo realizado (R$)</Label>
          <Input
            id="custoRealizado"
            name="custoRealizado"
            type="number"
            step="0.01"
            min="0"
            defaultValue={obra.custoRealizado}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dataInicio">Data de início</Label>
          <Input
            id="dataInicio"
            name="dataInicio"
            type="date"
            defaultValue={obra.dataInicio?.slice(0, 10) ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dataPrevistaConclusao">Previsão de conclusão</Label>
          <Input
            id="dataPrevistaConclusao"
            name="dataPrevistaConclusao"
            type="date"
            defaultValue={obra.dataPrevistaConclusao?.slice(0, 10) ?? ""}
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar obra"}
        </Button>
      </div>
    </form>
  );
}
