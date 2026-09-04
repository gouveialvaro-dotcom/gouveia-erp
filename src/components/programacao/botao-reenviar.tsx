"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { reenviarEnvio } from "@/app/(app)/programacao/actions";
import { Button } from "@/components/ui/button";

/**
 * Reenvio manual, e não automático.
 *
 * Uma fila de retentativa dispararia sozinha horas depois — possivelmente com
 * a programação já mudada de novo — e é justamente o tipo de tráfego que leva
 * ao bloqueio do número. Quem reenvia é uma pessoa que olhou a falha.
 */
export function BotaoReenviar({ envioId }: { envioId: string }) {
  const [enviando, iniciar] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={enviando}
      onClick={() =>
        iniciar(async () => {
          const resultado = await reenviarEnvio(envioId);
          if (resultado.erro) toast.error(`Falhou de novo: ${resultado.erro}`);
          else toast.success("Aviso reenviado.");
        })
      }
    >
      <RotateCw className="size-4" />
      {enviando ? "Reenviando..." : "Reenviar"}
    </Button>
  );
}
