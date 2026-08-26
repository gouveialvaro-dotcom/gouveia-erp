"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Gravação de voz direto na tela, enviada como mensagem de voz do WhatsApp
 * (aquela com onda e play), não como arquivo anexado.
 *
 * O formato preferido é ogg/opus, que é o que o WhatsApp usa de fato; o
 * navegador nem sempre oferece, e aí cai para webm/opus — mesmo codec, outro
 * contêiner, que o gateway converte. A ordem importa: pedir ogg primeiro evita
 * uma conversão a mais no caminho.
 */
const FORMATOS = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function formatoSuportado() {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATOS.find((f) => MediaRecorder.isTypeSupported(f)) ?? null;
}

function duracao(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GravadorVoz({
  onGravado,
  desabilitado,
}: {
  onGravado: (arquivo: File) => void;
  desabilitado?: boolean;
}) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  // Cancelar precisa impedir o envio no onstop, que dispara nos dois casos.
  const cancelado = useRef(false);

  useEffect(() => {
    if (!gravando) return;
    const timer = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [gravando]);

  // Soltar o microfone ao desmontar: sem isso o indicador de gravação do
  // navegador fica aceso depois de a pessoa sair da conversa.
  useEffect(() => {
    return () => {
      gravador.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function iniciar() {
    const formato = formatoSuportado();
    if (!formato) {
      toast.error("Este navegador não grava áudio. Anexe um arquivo de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: formato });
      pedacos.current = [];
      cancelado.current = false;

      rec.ondataavailable = (evento) => {
        if (evento.data.size > 0) pedacos.current.push(evento.data);
      };

      rec.onstop = () => {
        // O microfone é solto sempre, inclusive no cancelamento.
        stream.getTracks().forEach((t) => t.stop());
        if (cancelado.current) return;

        const blob = new Blob(pedacos.current, { type: formato });
        const extensao = formato.includes("ogg") ? "ogg" : formato.includes("mp4") ? "m4a" : "webm";
        onGravado(new File([blob], `voz.${extensao}`, { type: formato }));
      };

      rec.start();
      gravador.current = rec;
      setSegundos(0);
      setGravando(true);
    } catch {
      // Negar o microfone é uma escolha legítima do usuário, não um erro do
      // sistema — a mensagem diz o que fazer em vez de acusar falha.
      toast.error("Permissão de microfone negada. Libere no navegador para gravar.");
    }
  }

  function parar() {
    gravador.current?.stop();
    setGravando(false);
  }

  function cancelar() {
    cancelado.current = true;
    gravador.current?.stop();
    setGravando(false);
  }

  if (!gravando) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Gravar mensagem de voz"
        aria-label="Gravar mensagem de voz"
        onClick={iniciar}
        disabled={desabilitado}
      >
        <Mic className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1">
      <span className="size-2 animate-pulse rounded-full bg-destructive" />
      <span className="text-xs tabular-nums">{duracao(segundos)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Parar e enviar"
        aria-label="Parar e enviar"
        onClick={parar}
      >
        <Square className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Descartar gravação"
        aria-label="Descartar gravação"
        onClick={cancelar}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
