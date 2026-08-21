"use client";

import { useActionState } from "react";
import { atualizarOportunidade, type EstadoFormOportunidade } from "@/app/(app)/crm/actions";
import { ORDEM_ESTAGIO_KANBAN, ROTULO_ESTAGIO } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OportunidadeFormValues = {
  id: string;
  estagio: string;
  responsavelId: string;
  valorEstimado: number | null;
  proximaAcaoData: string | null;
  motivoPerda: string | null;
};

export function OportunidadeForm({
  oportunidade,
  usuarios,
}: {
  oportunidade: OportunidadeFormValues;
  usuarios: { id: string; nome: string }[];
}) {
  const atualizarComId = atualizarOportunidade.bind(null, oportunidade.id);
  const [estado, formAction, pendente] = useActionState<EstadoFormOportunidade, FormData>(
    atualizarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estagio">Estágio</Label>
          {/* `items` é o que faz o gatilho exibir o rótulo em vez do valor cru
              (o id do usuário, no caso do responsável) — ver Select.Value do Base UI. */}
          <Select
            name="estagio"
            defaultValue={oportunidade.estagio}
            items={ORDEM_ESTAGIO_KANBAN.map((e) => ({ value: e, label: ROTULO_ESTAGIO[e] }))}
          >
            <SelectTrigger id="estagio" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDEM_ESTAGIO_KANBAN.map((e) => (
                <SelectItem key={e} value={e}>
                  {ROTULO_ESTAGIO[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="responsavelId">Responsável</Label>
          <Select
            name="responsavelId"
            defaultValue={oportunidade.responsavelId}
            items={usuarios.map((u) => ({ value: u.id, label: u.nome }))}
          >
            <SelectTrigger id="responsavelId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="valorEstimado">Valor estimado (R$)</Label>
          <Input
            id="valorEstimado"
            name="valorEstimado"
            type="number"
            step="0.01"
            min="0"
            defaultValue={oportunidade.valorEstimado ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proximaAcaoData">Próxima ação</Label>
          <CampoData
            id="proximaAcaoData"
            name="proximaAcaoData"
            defaultValue={oportunidade.proximaAcaoData?.slice(0, 10) ?? ""}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="motivoPerda">Motivo da perda (se aplicável)</Label>
          <Textarea
            id="motivoPerda"
            name="motivoPerda"
            rows={2}
            defaultValue={oportunidade.motivoPerda ?? ""}
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar oportunidade"}
        </Button>
      </div>
    </form>
  );
}
