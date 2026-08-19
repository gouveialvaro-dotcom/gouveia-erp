"use client";

import { useState } from "react";
import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";

export type OpcaoCombobox = { value: string; label: string };

// Campo de busca que entrega o id escolhido ao formulário por um input hidden
// próprio, em vez do campo interno do Combobox — este último dessincroniza do
// que é enviado quando o usuário digita sem clicar numa opção.
export function ComboboxCampo({
  name,
  id,
  itens,
  itemInicial = null,
  placeholder,
  textoVazio,
  aoSelecionar,
}: {
  name: string;
  id?: string;
  itens: OpcaoCombobox[];
  itemInicial?: OpcaoCombobox | null;
  placeholder?: string;
  textoVazio: string;
  aoSelecionar?: (opcao: OpcaoCombobox | null) => void;
}) {
  const [selecionado, setSelecionado] = useState<OpcaoCombobox | null>(itemInicial);
  const [consulta, setConsulta] = useState("");

  function selecionar(opcao: OpcaoCombobox | null) {
    setSelecionado(opcao);
    aoSelecionar?.(opcao);
  }

  // Sair do campo com Tab ou clique confirma a opção quando o texto digitado
  // identifica um único item. Sem isso o campo esvazia em silêncio ao perder o
  // foco e a gravação falha dizendo que nada foi selecionado.
  function confirmarPeloTexto() {
    if (selecionado) return;
    const texto = consulta.trim().toLowerCase();
    if (!texto) return;
    const candidatos = itens.filter((item) => item.label.toLowerCase().includes(texto));
    if (candidatos.length === 1) selecionar(candidatos[0]);
  }

  return (
    <>
      <input type="hidden" name={name} value={selecionado?.value ?? ""} />
      <Combobox
        items={itens}
        value={selecionado}
        onValueChange={(valor) => selecionar((valor as OpcaoCombobox | null) ?? null)}
        onInputValueChange={(valor) => setConsulta(valor)}
        autoHighlight
      >
        <ComboboxInputGroup>
          <ComboboxInput id={id} placeholder={placeholder} onBlur={confirmarPeloTexto} />
          <ComboboxClear />
          <ComboboxTrigger />
        </ComboboxInputGroup>
        <ComboboxContent>
          <ComboboxEmpty>{textoVazio}</ComboboxEmpty>
          <ComboboxList>
            {(item: OpcaoCombobox) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  );
}
