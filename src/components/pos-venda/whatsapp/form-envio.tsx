"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  enviarArquivo,
  enviarMensagem,
  type EstadoEnvio,
} from "@/app/(app)/pos-venda/whatsapp/actions";
import {
  TAMANHO_MAXIMO_ENVIO,
  TIPOS_ACEITOS_ENVIO,
  formatarTamanho,
} from "@/lib/pos-venda-whatsapp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GravadorVoz } from "@/components/pos-venda/whatsapp/gravador-voz";

export function FormEnvio({
  conversaId,
  envioAtivo,
}: {
  conversaId: string;
  /** Cliente sem mensagem recebida há mais de 24h — responder vira envio ativo. */
  envioAtivo: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [anexo, setAnexo] = useState<File | null>(null);
  const [enviandoArquivo, iniciarEnvioArquivo] = useTransition();

  const enviarComId = enviarMensagem.bind(null, conversaId);
  const [estado, formAction, pendente] = useActionState<EstadoEnvio, FormData>(
    enviarComId,
    undefined
  );

  /**
   * Arquivo e voz não passam pelo formulário de texto: o envio de mídia é outra
   * action, e o campo de texto vira legenda dela. Manter os dois no mesmo submit
   * exigiria decidir no servidor qual caminho seguir a cada envio, o que é a
   * mesma coisa com mais chance de errar.
   */
  function despachar(arquivo: File, ehVoz: boolean) {
    if (arquivo.size > TAMANHO_MAXIMO_ENVIO) {
      toast.error(`Arquivo de ${formatarTamanho(arquivo.size)} — o limite é 10MB.`);
      return;
    }

    const dados = new FormData();
    dados.set("arquivo", arquivo);
    if (ehVoz) dados.set("voz", "1");

    // A legenda só existe para arquivo escolhido à mão; gravação de voz não
    // leva texto junto no WhatsApp.
    const texto = formRef.current?.texto?.value?.trim();
    if (!ehVoz && texto) dados.set("legenda", texto);

    iniciarEnvioArquivo(async () => {
      const resultado = await enviarArquivo(conversaId, undefined, dados);
      if (resultado?.erro) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(ehVoz ? "Áudio enviado." : "Arquivo enviado.");
      setAnexo(null);
      formRef.current?.reset();
    });
  }

  const ocupado = pendente || enviandoArquivo;

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

      {anexo && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
          <Paperclip className="h-3 w-3 shrink-0" />
          <span className="truncate">{anexo.name}</span>
          <span className="shrink-0 text-muted-foreground">
            {formatarTamanho(anexo.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6"
            title="Remover anexo"
            aria-label="Remover anexo"
            onClick={() => {
              setAnexo(null);
              if (campoArquivo.current) campoArquivo.current.value = "";
            }}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={() => despachar(anexo, false)}
          >
            {enviandoArquivo ? "Enviando..." : "Enviar arquivo"}
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* O input fica escondido atrás do botão de clipe: o controle nativo de
            arquivo não aceita estilo e destoaria da barra de envio. */}
        <input
          ref={campoArquivo}
          type="file"
          className="hidden"
          accept={TIPOS_ACEITOS_ENVIO}
          onChange={(evento) => setAnexo(evento.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Anexar arquivo (até 10MB)"
          aria-label="Anexar arquivo"
          disabled={ocupado}
          onClick={() => campoArquivo.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <GravadorVoz onGravado={(arquivo) => despachar(arquivo, true)} desabilitado={ocupado} />

        <Textarea
          name="texto"
          rows={2}
          placeholder={anexo ? "Legenda do arquivo (opcional)" : "Escreva para o cliente"}
          className="resize-none"
          // Enter envia, Shift+Enter quebra linha — é o que se espera de um
          // campo de conversa, e digitar Tab até o botão a cada mensagem seria
          // insuportável no volume de um atendimento.
          onKeyDown={(evento) => {
            if (evento.key === "Enter" && !evento.shiftKey) {
              evento.preventDefault();
              if (anexo) despachar(anexo, false);
              else evento.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={ocupado || anexo !== null}>
          {pendente ? "Enviando..." : "Enviar"}
        </Button>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}
