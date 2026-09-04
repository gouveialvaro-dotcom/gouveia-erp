"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";
import { consultarPrevia, publicarPeriodo } from "@/app/(app)/programacao/actions";
import type { PreviaPublicacao } from "@/lib/programacao";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Confirmação obrigatória antes de disparar.
 *
 * O modal existe porque envio de WhatsApp é irreversível e chega a pessoas em
 * campo: mostrar a prévia EXATA de cada mensagem, para quem vai e por quê, é a
 * última chance de perceber que a programação está errada antes de o celular
 * de quem está na estrada tocar.
 */
export function PublicarDialog({
  inicio,
  fim,
  pendentes,
}: {
  inicio: string;
  fim: string;
  pendentes: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<PreviaPublicacao | null>(null);
  const [carregando, iniciarCarga] = useTransition();
  const [publicando, iniciarPublicacao] = useTransition();

  function abrir() {
    setAberto(true);
    setPrevia(null);
    iniciarCarga(async () => {
      setPrevia(await consultarPrevia(inicio, fim));
    });
  }

  function publicar() {
    iniciarPublicacao(async () => {
      const resultado = await publicarPeriodo(inicio, fim);

      if (resultado?.erro) {
        toast.error(resultado.erro);
        return;
      }
      setAberto(false);
      // A falha de envio é dita em separado de propósito: a publicação valeu
      // de qualquer jeito, e o que ficou faltando é o aviso — que tem reenvio
      // próprio em /programacao/envios.
      if (resultado.falhas) {
        toast.warning(
          `Programação publicada. ${resultado.enviadas} aviso(s) enviado(s), ${resultado.falhas} falhou(aram) — reenvie em Envios.`
        );
      } else {
        toast.success(`Programação publicada. ${resultado.enviadas ?? 0} aviso(s) enviado(s).`);
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={abrir}>
        <Send className="size-4" />
        Publicar {pendentes > 0 ? `(${pendentes})` : ""}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar publicação</DialogTitle>
            <DialogDescription>
              Estas mensagens serão enviadas por WhatsApp e não podem ser desfeitas. Confira
              o texto e os destinatários.
            </DialogDescription>
          </DialogHeader>

          {carregando && <p className="text-sm text-muted-foreground">Montando a prévia...</p>}

          {previa && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{previa.pendencias.length} linha(s)</Badge>
                <Badge variant="secondary">{previa.totalMensagens} mensagem(ns)</Badge>
                <span className="text-muted-foreground">
                  {previa.enviadasHoje} de {previa.teto} avisos já enviados hoje
                </span>
              </div>

              {previa.excedeTeto && (
                <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  Esta publicação ultrapassa o teto diário de avisos. O limite protege o
                  número corporativo, que é o mesmo do atendimento e usa integração não
                  oficial. Publique em partes ou ajuste o teto em Parâmetros.
                </p>
              )}

              {previa.semTelefone.length > 0 && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  Sem WhatsApp cadastrado e por isso fora do envio:{" "}
                  {previa.semTelefone.map((p) => `${p.nome} (${p.papel})`).join(", ")}.
                </p>
              )}

              {previa.silenciados.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Não receberão por terem o aviso de programação desligado:{" "}
                  {previa.silenciados.map((p) => p.nome).join(", ")}.
                </p>
              )}

              {previa.totalMensagens === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma mensagem sairá. A programação ainda assim será publicada — o
                  registro no sistema é a verdade; a mensagem é só o aviso.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {previa.destinatarios.map((destinatario) => (
                    <div key={destinatario.chave} className="rounded-md border bg-card p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{destinatario.nome}</span>
                        <span className="text-muted-foreground">
                          {destinatario.telefoneExibicao}
                        </span>
                        {destinatario.papeis.map((papel) => (
                          <Badge key={papel} variant="outline">
                            {papel}
                          </Badge>
                        ))}
                        {destinatario.urgente && <Badge variant="destructive">Urgente</Badge>}
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                        {destinatario.mensagem}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAberto(false)}>
                  Cancelar
                </Button>
                <Button onClick={publicar} disabled={publicando || previa.excedeTeto}>
                  {publicando
                    ? "Publicando..."
                    : `Publicar e enviar ${previa.totalMensagens} mensagem(ns)`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
