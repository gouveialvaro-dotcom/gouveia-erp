"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { enviarParaAprovacao } from "@/app/(app)/suprimentos/aprovacoes/actions";
import { ROTULO_NIVEL, type NivelAlcada } from "@/lib/suprimentos";
import { moeda } from "@/lib/suprimentos-cotacao";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Fecha a cotação. Até o limite do comprador a remessa já é a aprovação e os
// pedidos saem na hora; acima, vai para a gerência (e diretoria).

export function EnviarAprovacao({
  requisicaoId,
  total,
  nivel,
  pendencias,
  cotacoes,
  minimoCotacoes,
}: {
  requisicaoId: string;
  total: number;
  nivel: NivelAlcada;
  /** O que ainda impede o envio (itens sem vínculo, escolha não salva...). */
  pendencias: string[];
  cotacoes: number;
  minimoCotacoes: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const autonomia = nivel === "comprador";

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await enviarParaAprovacao(requisicaoId);
      if (resultado?.erro) setErro(resultado.erro);
      else setAberto(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogTrigger
          render={<Button type="button" disabled={pendencias.length > 0} className="self-start" />}
        >
          <Send className="h-4 w-4" />
          {autonomia ? "Aprovar e emitir pedido" : "Enviar para aprovação"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {autonomia ? "Fechar a compra?" : "Enviar para aprovação?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Total de {moeda(total)}.{" "}
              {autonomia
                ? "Está dentro da sua autonomia: os pedidos de compra são emitidos agora."
                : nivel === "diretoria"
                  ? "Precisa da aprovação da Gerência e da Diretoria. A cotação fica travada até a decisão."
                  : `Precisa da aprovação da ${ROTULO_NIVEL[nivel]}. A cotação fica travada até a decisão.`}
              {cotacoes < minimoCotacoes &&
                ` Atenção: só ${cotacoes} ${cotacoes === 1 ? "cotação" : "cotações"} (mínimo ${minimoCotacoes}).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button type="button" onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando..." : autonomia ? "Emitir pedido" : "Enviar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {pendencias.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-4">
          {pendencias.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
