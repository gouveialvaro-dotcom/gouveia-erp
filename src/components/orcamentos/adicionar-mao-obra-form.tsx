"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboboxCampo, type OpcaoCombobox } from "@/components/ui/combobox-campo";

export function AdicionarMaoObraForm({
  funcoes,
  adicionarMaoObra,
}: {
  funcoes: OpcaoCombobox[];
  adicionarMaoObra: (formData: FormData) => void | Promise<void>;
}) {
  // Sem função escolhida a server action lançaria um erro de página inteira;
  // o botão só libera quando há seleção.
  const [temFuncao, setTemFuncao] = useState(false);

  return (
    <form action={adicionarMaoObra} className="flex gap-3 items-end mb-4 max-w-2xl">
      <div className="flex-1">
        <ComboboxCampo
          name="funcaoId"
          itens={funcoes}
          placeholder="Buscar função..."
          textoVazio="Nenhuma função encontrada."
          aoSelecionar={(opcao) => setTemFuncao(opcao !== null)}
        />
      </div>
      <Input
        name="diasAlocados"
        type="number"
        step="0.5"
        min="0.5"
        placeholder="Dias"
        className="max-w-[100px]"
        required
      />
      <Button type="submit" variant="secondary" disabled={!temFuncao}>
        + Alocar função
      </Button>
    </form>
  );
}
