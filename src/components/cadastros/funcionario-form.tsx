"use client";

import { useActionState } from "react";
import {
  salvarFuncionario,
  type EstadoFormFuncionario,
} from "@/app/(app)/cadastros/funcionarios/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type FuncionarioFormValues = {
  id: string;
  nome: string;
  cargo: string;
  salarioMensal: string;
  encargosPercent: string;
  ativo: boolean;
};

export function FuncionarioForm({ funcionario }: { funcionario?: FuncionarioFormValues }) {
  const salvarComId = salvarFuncionario.bind(null, funcionario?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormFuncionario, FormData>(
    salvarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" defaultValue={funcionario?.nome} required />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="cargo">Função/Cargo</Label>
          <Input id="cargo" name="cargo" defaultValue={funcionario?.cargo} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="salarioMensal">Salário mensal (R$)</Label>
          <Input
            id="salarioMensal"
            name="salarioMensal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={funcionario?.salarioMensal}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="encargosPercent">Encargos sociais (%)</Label>
          <Input
            id="encargosPercent"
            name="encargosPercent"
            type="number"
            step="0.01"
            min="0"
            defaultValue={funcionario?.encargosPercent}
            required
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Checkbox id="ativo" name="ativo" defaultChecked={funcionario?.ativo ?? true} />
          <Label htmlFor="ativo" className="font-normal">Ativo</Label>
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar funcionário"}
        </Button>
      </div>
    </form>
  );
}
