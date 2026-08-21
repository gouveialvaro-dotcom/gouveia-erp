"use client";

import { useActionState, type ReactNode } from "react";
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

// Toda exclusão do sistema passa por aqui: confirmação antes, e o erro devolvido
// pela action (registro com vínculo, permissão) aparece dentro do próprio
// diálogo, sem tirar o usuário da tela.
// `podeForcar` é decidido pela action, no servidor: é ela que sabe se o
// usuário tem alçada para arrastar o histórico junto. A tela só obedece.
export type EstadoExclusao = { erro?: string; podeForcar?: boolean } | undefined;

export function BotaoExcluir({
  acao,
  campos,
  titulo,
  descricao,
  rotulo = "Excluir",
  rotuloForcar = "Excluir tudo mesmo assim",
  variant = "destructive",
  size = "sm",
}: {
  /** Server action no formato do useActionState: (estado, formData). */
  acao: (estado: EstadoExclusao, formData: FormData) => Promise<EstadoExclusao>;
  /** Identificadores enviados à action como campos ocultos. */
  campos: Record<string, string>;
  titulo: string;
  descricao: ReactNode;
  rotulo?: string;
  /** Texto do botão que aparece quando a action devolve `podeForcar`. */
  rotuloForcar?: string;
  variant?: "destructive" | "ghost" | "outline";
  size?: "default" | "sm" | "xs";
}) {
  const [estado, formAction, pendente] = useActionState<EstadoExclusao, FormData>(
    acao,
    undefined
  );

  return (
    <AlertDialog>
      {/* type="button" explícito: o gatilho pode viver dentro de um <form> da
          tela (a linha do tipo de problema é um form), e sem isso o clique
          submeteria esse form em vez de abrir a confirmação. */}
      <AlertDialogTrigger render={<Button type="button" variant={variant} size={size} />}>
        {rotulo}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>

        {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={formAction} className="flex flex-col-reverse gap-2 sm:flex-row">
            {Object.entries(campos).map(([nome, valor]) => (
              <input key={nome} type="hidden" name={nome} value={valor} />
            ))}
            <Button type="submit" variant="destructive" disabled={pendente}>
              {pendente ? "Excluindo..." : "Excluir"}
            </Button>
            {/* O name/value vai junto no envio porque é o botão que submete —
                é assim que a action sabe que a cascata foi pedida. */}
            {estado?.podeForcar && (
              <Button
                type="submit"
                name="cascata"
                value="1"
                variant="destructive"
                disabled={pendente}
              >
                {pendente ? "Excluindo..." : rotuloForcar}
              </Button>
            )}
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
