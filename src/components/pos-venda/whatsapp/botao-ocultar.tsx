"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { exibirMensagem, ocultarMensagem } from "@/app/(app)/pos-venda/whatsapp/actions";
import { Button } from "@/components/ui/button";

/**
 * Higiene da base: tira da vista mensagem que não é atendimento — teste
 * técnico, número interno. Só o admin vê este botão, e a ação também é barrada
 * no servidor (ver exigirAdmin nas actions).
 *
 * Ocultar não apaga. A mensagem continua no banco, com quem ocultou registrado,
 * e o próprio admin traz de volta pelo alternador "ver ocultas" da conversa.
 */
export function BotaoOcultar({
  conversaId,
  mensagemId,
  oculta,
}: {
  conversaId: string;
  mensagemId: string;
  oculta: boolean;
}) {
  const [pendente, iniciar] = useTransition();

  function alternar() {
    iniciar(async () => {
      if (oculta) {
        await exibirMensagem(conversaId, mensagemId);
        toast.success("Mensagem de volta à conversa.");
        return;
      }

      const estado = await ocultarMensagem(conversaId, mensagemId);
      if (estado?.erro) toast.error(estado.erro);
      else toast.success("Mensagem oculta — continua no banco.");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={alternar}
      disabled={pendente}
      title={
        oculta
          ? "Trazer de volta para a conversa"
          : "Tirar da conversa sem apagar do banco"
      }
    >
      {pendente ? "..." : oculta ? "Reexibir" : "Ocultar"}
    </Button>
  );
}
