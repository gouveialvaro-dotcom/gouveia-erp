"use client";

import { useActionState } from "react";
import { salvarOrcamento, type EstadoFormOrcamento } from "@/app/(app)/orcamentos/actions";
import { Button } from "@/components/ui/button";
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

type OrcamentoFormValues = {
  id: string;
  nomeProjeto: string;
  clienteId: string;
  tipoProposta: "usina_solar" | "redes";
  descricao: string | null;
  status: "em_elaboracao" | "finalizado" | "revisao";
};

export function OrcamentoForm({
  orcamento,
  clientes,
}: {
  orcamento?: OrcamentoFormValues;
  clientes: { id: string; razaoSocial: string }[];
}) {
  const salvarComId = salvarOrcamento.bind(null, orcamento?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormOrcamento, FormData>(
    salvarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="nomeProjeto">Nome do projeto</Label>
          <Input id="nomeProjeto" name="nomeProjeto" defaultValue={orcamento?.nomeProjeto} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clienteId">Cliente</Label>
          <Select name="clienteId" defaultValue={orcamento?.clienteId}>
            <SelectTrigger id="clienteId" className="w-full">
              <SelectValue placeholder="Selecione o cliente" />
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
          <Label htmlFor="tipoProposta">Tipo de proposta</Label>
          <Select name="tipoProposta" defaultValue={orcamento?.tipoProposta ?? "usina_solar"}>
            <SelectTrigger id="tipoProposta" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usina_solar">Usina Solar</SelectItem>
              <SelectItem value="redes">Redes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {orcamento && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={orcamento.status}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_elaboracao">Em elaboração</SelectItem>
                <SelectItem value="revisao">Em revisão</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            name="descricao"
            rows={3}
            defaultValue={orcamento?.descricao ?? ""}
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar orçamento"}
        </Button>
      </div>
    </form>
  );
}
