"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboboxCampo, type OpcaoCombobox } from "@/components/ui/combobox-campo";

export function AdicionarMaterialForm({
  materiais,
  adicionarMaterial,
}: {
  materiais: OpcaoCombobox[];
  adicionarMaterial: (formData: FormData) => void | Promise<void>;
}) {
  // Sem material escolhido a server action lançaria um erro de página inteira;
  // o botão só libera quando há seleção.
  const [temMaterial, setTemMaterial] = useState(false);

  return (
    <form action={adicionarMaterial} className="flex gap-3 items-end mb-4 max-w-2xl">
      <div className="flex-1">
        <ComboboxCampo
          name="materialId"
          itens={materiais}
          placeholder="Buscar material..."
          textoVazio="Nenhum material encontrado."
          aoSelecionar={(opcao) => setTemMaterial(opcao !== null)}
        />
      </div>
      <Input
        name="quantidade"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="Qtd."
        className="max-w-[100px]"
        required
      />
      <Button type="submit" variant="secondary" disabled={!temMaterial}>
        + Adicionar material
      </Button>
    </form>
  );
}
