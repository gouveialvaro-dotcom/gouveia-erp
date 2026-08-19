"use client";

import { useActionState } from "react";
import { salvarMaterial, type EstadoFormMaterial } from "@/app/(app)/cadastros/materiais/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MaterialFormValues = {
  id: string;
  codigo: string;
  descricao: string;
  categoria: string;
  unidade: string;
  custoUnitario: string;
  fornecedor: string | null;
};

const CATEGORIAS_SUGERIDAS = [
  "Condutores",
  "Transformadores",
  "Estruturas",
  "Geração Solar",
  "Isoladores",
  "Proteção",
  "Medição",
  "Aterramento",
  "Infraestrutura",
];

export function MaterialForm({ material }: { material?: MaterialFormValues }) {
  const salvarComId = salvarMaterial.bind(null, material?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormMaterial, FormData>(
    salvarComId,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codigo">Código</Label>
          <Input id="codigo" name="codigo" defaultValue={material?.codigo} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoria">Categoria</Label>
          <Input
            id="categoria"
            name="categoria"
            list="categorias-sugeridas"
            defaultValue={material?.categoria}
            required
          />
          <datalist id="categorias-sugeridas">
            {CATEGORIAS_SUGERIDAS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="descricao">Descrição</Label>
          <Input id="descricao" name="descricao" defaultValue={material?.descricao} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unidade">Unidade de medida</Label>
          <Input id="unidade" name="unidade" placeholder="un, m, kg..." defaultValue={material?.unidade} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="custoUnitario">Custo unitário (R$)</Label>
          <Input
            id="custoUnitario"
            name="custoUnitario"
            type="number"
            step="0.01"
            min="0"
            defaultValue={material?.custoUnitario}
            required
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="fornecedor">Fornecedor</Label>
          <Input id="fornecedor" name="fornecedor" defaultValue={material?.fornecedor ?? ""} />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar material"}
        </Button>
      </div>
    </form>
  );
}
