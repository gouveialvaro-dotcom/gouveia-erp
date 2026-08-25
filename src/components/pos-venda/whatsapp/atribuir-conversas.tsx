"use client";

import { useActionState, useState } from "react";
import {
  atribuirConversas,
  type EstadoAtribuicao,
} from "@/app/(app)/pos-venda/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export type ConversaSemDono = { id: string; rotulo: string; espera: string };

/**
 * Distribuição da fila pelo admin: várias conversas sem dono para um atendente
 * de uma vez.
 *
 * Existe para o começo do dia, quando a fila chegou e ninguém puxou nada. Não
 * substitui a regra geral — qualquer atendente continua assumindo a conversa de
 * outro direto na lista, sem passar por aqui.
 */
export function AtribuirConversas({
  conversas,
  atendentes,
}: {
  conversas: ConversaSemDono[];
  atendentes: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, formAction, pendente] = useActionState<EstadoAtribuicao, FormData>(
    atribuirConversas,
    undefined
  );

  if (conversas.length === 0) return null;

  if (!aberto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        Distribuir {conversas.length} sem dono
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border bg-card p-2">
      <p className="text-xs font-medium">Atribuir a um atendente</p>

      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {conversas.map((conversa) => (
          <Label key={conversa.id} className="flex items-center gap-2 text-xs">
            <Checkbox name="conversaIds" value={conversa.id} defaultChecked />
            <span className="truncate">{conversa.rotulo}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">{conversa.espera}</span>
          </Label>
        ))}
      </div>

      <SelectNativo name="donoId" defaultValue="" aria-label="Atendente">
        <option value="">Selecione o atendente</option>
        {atendentes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </SelectNativo>

      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="secondary" disabled={pendente}>
          {pendente ? "Atribuindo..." : "Atribuir"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>

      {estado?.erro && <p className="text-xs text-destructive">{estado.erro}</p>}
    </form>
  );
}
