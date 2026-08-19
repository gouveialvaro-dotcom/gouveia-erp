"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboboxCampo, type OpcaoCombobox } from "@/components/ui/combobox-campo";

export function AdicionarMaoObraForm({
  funcionarios,
  adicionarMaoObra,
}: {
  funcionarios: OpcaoCombobox[];
  adicionarMaoObra: (formData: FormData) => void | Promise<void>;
}) {
  // Sem funcionário escolhido a server action lançaria um erro de página
  // inteira; o botão só libera quando há seleção.
  const [temFuncionario, setTemFuncionario] = useState(false);

  return (
    <form action={adicionarMaoObra} className="flex gap-3 items-end mb-4 max-w-2xl">
      <div className="flex-1">
        <ComboboxCampo
          name="funcionarioId"
          itens={funcionarios}
          placeholder="Buscar funcionário..."
          textoVazio="Nenhum funcionário encontrado."
          aoSelecionar={(opcao) => setTemFuncionario(opcao !== null)}
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
      <Button type="submit" variant="secondary" disabled={!temFuncionario}>
        + Alocar funcionário
      </Button>
    </form>
  );
}
