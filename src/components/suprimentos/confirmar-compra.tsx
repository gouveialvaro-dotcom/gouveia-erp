"use client";

import { startTransition, useActionState } from "react";
import { ShoppingCart } from "lucide-react";
import { confirmarCompra, type EstadoConfirmacao } from "@/app/(app)/suprimentos/pedidos/actions";
import { Button } from "@/components/ui/button";

// O comprador marca o momento em que fechou a compra no fornecedor. Antes
// disso o pedido está só emitido: a obra ainda não recebe e a Diretoria ainda
// pode voltar a compra para a cotação.

export function ConfirmarCompra({ pedidoId }: { pedidoId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoConfirmacao, FormData>(confirmarCompra, undefined);

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        startTransition(() => acao(new FormData(evento.currentTarget)));
      }}
      className="flex flex-col gap-2 rounded-md border-2 border-amber-400/60 bg-card p-4"
    >
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <div>
        <h3 className="text-sm font-semibold">Compra ainda não confirmada</h3>
        <p className="text-xs text-muted-foreground">
          Envie o pedido ao fornecedor e, quando a compra estiver fechada, confirme aqui. O pedido passa para
          &quot;Entrega pendente&quot; e a obra pode registrar o recebimento.
        </p>
      </div>
      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
      <Button type="submit" disabled={pendente} className="self-start">
        <ShoppingCart className="h-4 w-4" /> {pendente ? "Confirmando..." : "Confirmar compra no fornecedor"}
      </Button>
    </form>
  );
}
