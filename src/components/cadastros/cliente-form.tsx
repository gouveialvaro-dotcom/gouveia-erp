"use client";

import { useActionState } from "react";
import { salvarCliente, type EstadoFormCliente } from "@/app/(app)/cadastros/clientes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClienteFormValues = {
  id: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
};

export function ClienteForm({ cliente }: { cliente?: ClienteFormValues }) {
  const salvarComId = salvarCliente.bind(null, cliente?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormCliente, FormData>(
    salvarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="razaoSocial">Razão social</Label>
          <Input id="razaoSocial" name="razaoSocial" defaultValue={cliente?.razaoSocial} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input id="cnpj" name="cnpj" defaultValue={cliente?.cnpj} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" name="cidade" defaultValue={cliente?.cidade ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="uf">UF</Label>
            <Input id="uf" name="uf" maxLength={2} defaultValue={cliente?.uf ?? ""} />
          </div>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" name="endereco" defaultValue={cliente?.endereco ?? ""} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            name="observacoes"
            rows={3}
            defaultValue={cliente?.observacoes ?? ""}
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar cliente"}
        </Button>
      </div>
    </form>
  );
}
