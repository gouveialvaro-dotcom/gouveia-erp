"use client";

import { useActionState } from "react";
import { criarObraAvulsa, type EstadoFormObra } from "@/app/(app)/obras/actions";
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

export function ObraAvulsaForm({
  clientes,
}: {
  clientes: { id: string; razaoSocial: string }[];
}) {
  const [estado, formAction, pendente] = useActionState<EstadoFormObra, FormData>(
    criarObraAvulsa,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clienteId">Cliente</Label>
          <Select
            name="clienteId"
            items={clientes.map((c) => ({ value: c.id, label: c.razaoSocial }))}
          >
            <SelectTrigger id="clienteId" className="w-full">
              <SelectValue
                placeholder={clientes.length ? "Selecione o cliente" : "Nenhum cliente cadastrado"}
              />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.razaoSocial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nomeProjeto">Nome do projeto</Label>
          <Input id="nomeProjeto" name="nomeProjeto" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="custoOrcado">Custo orçado (R$)</Label>
          <Input id="custoOrcado" name="custoOrcado" type="number" step="0.01" min="0" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dataInicio">Data de início</Label>
          <CampoData id="dataInicio" name="dataInicio" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dataPrevistaConclusao">Previsão de conclusão</Label>
          <CampoData id="dataPrevistaConclusao" name="dataPrevistaConclusao" />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente || clientes.length === 0}>
          {pendente ? "Criando..." : "Criar obra"}
        </Button>
      </div>
    </form>
  );
}
