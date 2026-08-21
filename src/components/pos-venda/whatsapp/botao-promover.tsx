"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { promoverParaAnexo } from "@/app/(app)/pos-venda/whatsapp/actions";
import { Button } from "@/components/ui/button";

/**
 * Promove a mídia da mensagem a anexo do chamado. Item a item, por decisão do
 * atendente: a mídia recebida fica na conversa por padrão e só vai para o
 * chamado o que ele escolher.
 *
 * O erro vem por toast e não inline porque este botão aparece dentro do balão
 * da mensagem — texto de erro ali empurraria a conversa inteira para baixo.
 */
export function BotaoPromover({
  conversaId,
  mensagemId,
}: {
  conversaId: string;
  mensagemId: string;
}) {
  const [pendente, iniciar] = useTransition();

  function promover() {
    iniciar(async () => {
      const estado = await promoverParaAnexo(conversaId, mensagemId);
      if (estado?.erro) toast.error(estado.erro);
      else toast.success("Arquivo anexado ao chamado.");
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={promover} disabled={pendente}>
      {pendente ? "Anexando..." : "Anexar ao chamado"}
    </Button>
  );
}
