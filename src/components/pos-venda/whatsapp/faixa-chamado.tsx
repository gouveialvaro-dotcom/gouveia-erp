"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { marcarChamado, type EstadoMarcacao } from "@/app/(app)/pos-venda/whatsapp/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectNativo } from "@/components/ui/select-nativo";

export type ChamadoOpcao = { id: string; numero: number; titulo: string };

/**
 * Faixa fixa no topo da conversa dizendo para qual chamado o que for dito
 * daqui em diante será vinculado.
 *
 * É deliberadamente grande e sempre visível, nunca escondida em menu ou aba: o
 * erro mais provável deste modelo é o atendente esquecer de trocar a marcação e
 * jogar assunto novo dentro de chamado velho. Estar sem chamado é um estado
 * legítimo e aparece com o mesmo destaque.
 */
export function FaixaChamado({
  conversaId,
  chamadoAtivo,
  chamados,
  podeEditar,
}: {
  conversaId: string;
  chamadoAtivo: ChamadoOpcao | null;
  chamados: ChamadoOpcao[];
  podeEditar: boolean;
}) {
  const [trocando, setTrocando] = useState(false);
  const marcarComId = marcarChamado.bind(null, conversaId);
  const [estado, formAction, pendente] = useActionState<EstadoMarcacao, FormData>(
    marcarComId,
    undefined
  );

  const semChamado = chamadoAtivo === null;

  return (
    <div
      className={
        semChamado
          ? "flex flex-col gap-2 border-b border-dashed bg-muted/50 px-3 py-2"
          : "flex flex-col gap-2 border-b border-primary/40 bg-primary/5 px-3 py-2"
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={semChamado ? "outline" : "default"}>
          {semChamado ? "Sem chamado" : `Chamado #${chamadoAtivo.numero}`}
        </Badge>
        <span className={semChamado ? "text-muted-foreground" : "font-medium"}>
          {semChamado
            ? "As mensagens desta conversa não estão sendo vinculadas a nenhum chamado."
            : chamadoAtivo.titulo}
        </span>
        {!semChamado && (
          <Link
            href={`/pos-venda/${chamadoAtivo.id}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            abrir chamado
          </Link>
        )}
        {podeEditar && !trocando && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setTrocando(true)}
          >
            {semChamado ? "Apontar para um chamado" : "Trocar"}
          </Button>
        )}
      </div>

      {podeEditar && trocando && (
        <form
          action={async (formData) => {
            await formAction(formData);
            setTrocando(false);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <SelectNativo
            name="chamadoId"
            defaultValue={chamadoAtivo?.id ?? ""}
            className="max-w-md"
            aria-label="Chamado da conversa"
          >
            <option value="">Sem chamado — deixar as mensagens soltas</option>
            {chamados.map((chamado) => (
              <option key={chamado.id} value={chamado.id}>
                #{chamado.numero} · {chamado.titulo}
              </option>
            ))}
          </SelectNativo>
          <Button type="submit" size="sm" variant="secondary" disabled={pendente}>
            {pendente ? "Salvando..." : "Confirmar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setTrocando(false)}>
            Cancelar
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Vale para as mensagens seguintes. As anteriores continuam como estão.
          </p>
        </form>
      )}

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
    </div>
  );
}
