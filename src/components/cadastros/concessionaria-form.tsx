"use client";

import { useActionState } from "react";
import {
  criarConcessionaria,
  type EstadoFormConcessionaria,
} from "@/app/(app)/cadastros/concessionarias/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConcessionariaForm() {
  const [estado, formAction, pendente] = useActionState<EstadoFormConcessionaria, FormData>(
    criarConcessionaria,
    undefined
  );

  return (
    <form action={formAction} className="grid gap-3 max-w-2xl grid-cols-[1fr_8rem_4rem_auto] items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nome">Concessionária</Label>
        <Input id="nome" name="nome" placeholder="Ex.: Neoenergia Cosern" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sigla">Sigla</Label>
        <Input id="sigla" name="sigla" placeholder="COSERN" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="uf">UF</Label>
        <Input id="uf" name="uf" maxLength={2} />
      </div>
      <Button type="submit" variant="secondary" disabled={pendente}>
        {pendente ? "Salvando..." : "+ Cadastrar"}
      </Button>
      {estado?.erro && <p className="col-span-4 text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}
