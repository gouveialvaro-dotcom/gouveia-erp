"use client";

import { useActionState } from "react";
import {
  adicionarUnidade,
  type EstadoFormUnidade,
} from "@/app/(app)/cadastros/clientes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

// Um formulário por tipo: a geradora e a beneficiária são listas separadas
// dentro do cadastro do cliente de energia solar.
export function UnidadeForm({
  clienteId,
  tipo,
  concessionarias,
}: {
  clienteId: string;
  tipo: "geradora" | "beneficiaria";
  concessionarias: { id: string; nome: string }[];
}) {
  const adicionar = adicionarUnidade.bind(null, clienteId, tipo);
  const [estado, formAction, pendente] = useActionState<EstadoFormUnidade, FormData>(
    adicionar,
    undefined
  );

  const rotulo = tipo === "geradora" ? "unidade geradora" : "unidade beneficiária";
  const idNumero = `numero-${tipo}`;
  const idEndereco = `endereco-${tipo}`;
  const idConcessionaria = `concessionariaId-${tipo}`;

  return (
    <form action={formAction} className="grid gap-3 max-w-4xl md:grid-cols-[12rem_1fr_12rem_auto] items-end mb-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idNumero}>Número da {rotulo}</Label>
        <Input id={idNumero} name="numero" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idEndereco}>Endereço</Label>
        <Input id={idEndereco} name="endereco" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idConcessionaria}>Concessionária (opcional)</Label>
        <SelectNativo id={idConcessionaria} name="concessionariaId">
          <option value="">Sem concessionária</option>
          {concessionarias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </SelectNativo>
      </div>
      <Button type="submit" variant="secondary" disabled={pendente}>
        {pendente ? "Salvando..." : tipo === "geradora" ? "+ Geradora" : "+ Beneficiária"}
      </Button>

      {estado?.erro && (
        <p className="md:col-span-4 text-sm text-destructive">{estado.erro}</p>
      )}
    </form>
  );
}
