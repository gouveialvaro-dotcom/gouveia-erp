"use client";

import { useActionState } from "react";
import { criarFuncao, type EstadoFormFuncao } from "@/app/(app)/cadastros/funcoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FuncaoForm() {
  const [estado, formAction, pendente] = useActionState<EstadoFormFuncao, FormData>(
    criarFuncao,
    undefined
  );

  return (
    <form action={formAction} className="grid gap-3 max-w-3xl md:grid-cols-4 items-end">
      <div className="md:col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="nome">Função</Label>
        <Input id="nome" name="nome" placeholder="Ex.: Eletricista Montador" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="salarioMensal">Salário mensal (R$)</Label>
        <Input
          id="salarioMensal"
          name="salarioMensal"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="encargosPercent">Encargos (%)</Label>
        <Input
          id="encargosPercent"
          name="encargosPercent"
          type="number"
          step="0.0001"
          min="0"
          required
        />
      </div>
      <div className="md:col-start-4">
        <Button type="submit" variant="secondary" disabled={pendente} className="w-full">
          {pendente ? "Salvando..." : "+ Cadastrar função"}
        </Button>
      </div>
      {estado?.erro && <p className="md:col-span-4 text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}
