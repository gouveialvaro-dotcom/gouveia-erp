"use client";

import { useActionState } from "react";
import { criarOportunidade, type EstadoFormOportunidade } from "@/app/(app)/crm/actions";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OportunidadeCriarForm({
  orcamentos,
  usuarios,
  responsavelPadraoId,
}: {
  orcamentos: { id: string; nomeProjeto: string; clienteNome: string }[];
  usuarios: { id: string; nome: string }[];
  responsavelPadraoId: string;
}) {
  const [estado, formAction, pendente] = useActionState<EstadoFormOportunidade, FormData>(
    criarOportunidade,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="orcamentoId">Orçamento</Label>
          <Select
            name="orcamentoId"
            items={orcamentos.map((o) => ({
              value: o.id,
              label: `${o.nomeProjeto} — ${o.clienteNome}`,
            }))}
          >
            <SelectTrigger id="orcamentoId" className="w-full">
              <SelectValue
                placeholder={
                  orcamentos.length ? "Selecione o orçamento" : "Nenhum orçamento disponível"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {orcamentos.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nomeProjeto} — {o.clienteNome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="responsavelId">Responsável</Label>
          <Select
            name="responsavelId"
            defaultValue={responsavelPadraoId}
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
          <Input id="valorEstimado" name="valorEstimado" type="number" step="0.01" min="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proximaAcaoData">Próxima ação</Label>
          <CampoData id="proximaAcaoData" name="proximaAcaoData" />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente || orcamentos.length === 0}>
          {pendente ? "Criando..." : "Criar oportunidade"}
        </Button>
      </div>
    </form>
  );
}
