"use client";

import { useActionState } from "react";
import { salvarKit, type EstadoFormKit } from "@/app/(app)/cadastros/kits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIAS_SUGERIDAS = ["Subestações", "Linhas de Transmissão", "Usina Solar"];

export function KitForm({ kit }: { kit?: { id: string; nome: string; categoria: string | null } }) {
  const salvarComId = salvarKit.bind(null, kit?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormKit, FormData>(
    salvarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome do kit</Label>
          <Input id="nome" name="nome" defaultValue={kit?.nome} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoria">Categoria/Tipo de obra</Label>
          <Input
            id="categoria"
            name="categoria"
            list="categorias-kit-sugeridas"
            defaultValue={kit?.categoria ?? ""}
          />
          <datalist id="categorias-kit-sugeridas">
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : kit ? "Salvar alterações" : "Criar kit e adicionar itens"}
        </Button>
      </div>
    </form>
  );
}
