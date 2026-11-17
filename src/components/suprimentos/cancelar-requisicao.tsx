"use client";

import { useActionState } from "react";
import {
  cancelarRequisicao,
  type EstadoCancelamento,
} from "@/app/(app)/suprimentos/requisicoes/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

export function CancelarRequisicao({ requisicaoId, codigo }: { requisicaoId: string; codigo: string }) {
  const [estado, acao, pendente] = useActionState<EstadoCancelamento, FormData>(
    cancelarRequisicao,
    undefined
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Cancelar requisição
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={acao} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar {codigo}?</AlertDialogTitle>
            <AlertDialogDescription>
              A requisição sai da fila de compras. Quem estiver envolvido recebe um aviso com o
              motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input type="hidden" name="requisicaoId" value={requisicaoId} />
          <Textarea name="motivo" placeholder="Motivo do cancelamento" required rows={3} />
          {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pendente}>
              {pendente ? "Cancelando..." : "Cancelar requisição"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
