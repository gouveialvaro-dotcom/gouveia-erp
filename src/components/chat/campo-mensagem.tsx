"use client";

import { useActionState, useEffect, useRef } from "react";
import { enviarMensagem, type EstadoChat } from "@/app/(app)/chat/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CampoMensagem({ conversaId }: { conversaId: string }) {
  const enviarNestaConversa = enviarMensagem.bind(null, conversaId);
  const [estado, formAction, pendente] = useActionState<EstadoChat, FormData>(
    enviarNestaConversa,
    undefined
  );
  const form = useRef<HTMLFormElement>(null);

  // A action devolve undefined quando gravou. Limpar aqui, e não no onSubmit,
  // evita perder o texto quando o envio falha.
  useEffect(() => {
    if (!pendente && !estado?.erro) form.current?.reset();
  }, [pendente, estado]);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-2 border-t p-4">
      <Textarea
        name="corpo"
        rows={2}
        placeholder="Escreva uma mensagem..."
        className="resize-none"
        required
      />
      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
