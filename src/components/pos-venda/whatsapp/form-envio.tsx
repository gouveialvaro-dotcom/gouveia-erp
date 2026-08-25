"use client";

import { useActionState, useRef } from "react";
import { enviarMensagem, type EstadoEnvio } from "@/app/(app)/pos-venda/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FormEnvio({
  conversaId,
  envioAtivo,
}: {
  conversaId: string;
  /** Cliente sem mensagem recebida há mais de 24h — responder vira envio ativo. */
  envioAtivo: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const enviarComId = enviarMensagem.bind(null, conversaId);
  const [estado, formAction, pendente] = useActionState<EstadoEnvio, FormData>(
    enviarComId,
    undefined
  );

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2 border-t bg-card p-3"
    >
      {envioAtivo && (
        // O atendente não tem como saber que responder a uma conversa parada há
        // dias conta como abordagem ativa para a Meta. O aviso é da tela porque
        // essa informação vive em quem montou a integração, não em quem atende.
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          Este cliente não escreve há mais de 24 horas — a mensagem conta como
          envio ativo e aumenta o risco de bloqueio do número.
        </p>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          name="texto"
          rows={2}
          required
          placeholder="Escreva para o cliente"
          className="resize-none"
          // Enter envia, Shift+Enter quebra linha — é o que se espera de um
          // campo de conversa, e digitar Tab até o botão a cada mensagem seria
          // insuportável no volume de um atendimento.
          onKeyDown={(evento) => {
            if (evento.key === "Enter" && !evento.shiftKey) {
              evento.preventDefault();
              evento.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={pendente}>
          {pendente ? "Enviando..." : "Enviar"}
        </Button>
      </div>
      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}
