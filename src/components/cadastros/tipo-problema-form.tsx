"use client";

import { useActionState } from "react";
import {
  criarTipoProblema,
  type EstadoFormTipoProblema,
} from "@/app/(app)/cadastros/tipos-problema/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TipoProblemaForm() {
  const [estado, formAction, pendente] = useActionState<EstadoFormTipoProblema, FormData>(
    criarTipoProblema,
    undefined
  );

  return (
    <form action={formAction} className="grid gap-3 max-w-3xl md:grid-cols-4 items-end">
      <div className="md:col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="nome">Tipo de problema</Label>
        <Input id="nome" name="nome" placeholder="Ex.: Crédito não repassado" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prazoDias">Prazo (dias corridos)</Label>
        <Input id="prazoDias" name="prazoDias" type="number" min="1" defaultValue="5" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="diasAlerta">Alertar com (dias)</Label>
        <Input id="diasAlerta" name="diasAlerta" type="number" min="0" defaultValue="2" required />
      </div>
      <div className="md:col-span-3 flex flex-col gap-1.5">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" rows={2} />
      </div>
      <div className="flex flex-col justify-end">
        <Button type="submit" variant="secondary" disabled={pendente}>
          {pendente ? "Salvando..." : "+ Cadastrar tipo"}
        </Button>
      </div>
      {estado?.erro && (
        <p className="md:col-span-4 text-sm text-destructive">{estado.erro}</p>
      )}
    </form>
  );
}
