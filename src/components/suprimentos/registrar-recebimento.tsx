"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, X, XCircle } from "lucide-react";
import {
  registrarRecebimento,
  type EstadoRecebimento,
} from "@/app/(app)/suprimentos/pedidos/actions";
import type { SituacaoRecebimento } from "@/lib/suprimentos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Registro na obra, pensado para o celular: dois botões grandes, observação
// quando há problema, fotos da câmera e quem recebeu.
//
// Foto de celular tem 3–6 MB e o envio aceita 11 MB no total: cada foto é
// reduzida aqui (lado maior 1600 px, JPEG) antes de subir, ficando ~300 KB.

const FOTOS_MAX = 8;
const LADO_MAX = 1600;

async function reduzir(arquivo: File): Promise<File> {
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    canvas.getContext("2d")!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    imagem.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
    if (!blob) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    // Formato que o navegador não decodifica (ex.: HEIC em alguns aparelhos):
    // segue o original e o servidor confere o tamanho.
    return arquivo;
  }
}

type Foto = { arquivo: File; url: string };

export function RegistrarRecebimento({
  pedidoId,
  nomePadrao,
  reentrega,
}: {
  pedidoId: string;
  /** Nome de quem está logado, sugerido como recebedor. */
  nomePadrao: string;
  /** Já houve recebimento inconforme: este registra o restante/correção. */
  reentrega: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoRecebimento, FormData>(registrarRecebimento, undefined);
  const [situacao, setSituacao] = useState<SituacaoRecebimento | null>(null);
  const [observacao, setObservacao] = useState("");
  const [nome, setNome] = useState(nomePadrao);
  const [documento, setDocumento] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [preparando, setPreparando] = useState(false);

  // Libera as prévias (blob:) ao sair da tela; as removidas são liberadas na hora.
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const ativas = urls.current;
    return () => ativas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  async function adicionarFotos(lista: FileList | null) {
    if (!lista?.length) return;
    setPreparando(true);
    const novas = await Promise.all(
      [...lista].slice(0, FOTOS_MAX - fotos.length).map(async (f) => {
        const arquivo = await reduzir(f);
        const url = URL.createObjectURL(arquivo);
        urls.current.add(url);
        return { arquivo, url };
      })
    );
    setFotos((atual) => [...atual, ...novas]);
    setPreparando(false);
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData();
    dados.set("pedidoId", pedidoId);
    dados.set("situacao", situacao ?? "");
    dados.set("observacao", observacao);
    dados.set("nomeRecebedor", nome);
    dados.set("documentoRecebedor", documento);
    for (const f of fotos) dados.append("fotos", f.arquivo);
    startTransition(() => acao(dados));
  }

  if (estado?.ok) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
        Recebimento registrado. O requisitante e o comprador foram avisados.
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-md border-2 border-primary/40 bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">{reentrega ? "Registrar nova entrega" : "Registrar recebimento"}</h3>
        <p className="text-xs text-muted-foreground">
          Confira quantidade e estado de cada item. Faltou algo ou chegou avariado? Marque inconforme.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSituacao("conforme")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-4 text-sm font-medium transition-colors",
            situacao === "conforme"
              ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "hover:bg-muted"
          )}
        >
          <CheckCircle2 className="h-7 w-7" />
          Conforme
          <span className="text-xs font-normal text-muted-foreground">Tudo certo</span>
        </button>
        <button
          type="button"
          onClick={() => setSituacao("inconforme")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-4 text-sm font-medium transition-colors",
            situacao === "inconforme" ? "border-destructive bg-destructive/10 text-destructive" : "hover:bg-muted"
          )}
        >
          <XCircle className="h-7 w-7" />
          Inconforme
          <span className="text-xs font-normal text-muted-foreground">Parcial, avaria, errado</span>
        </button>
      </div>

      {situacao === "inconforme" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="observacao">O que aconteceu?</Label>
          <Textarea
            id="observacao"
            rows={3}
            required
            placeholder="Ex.: chegaram 80 de 120 m de cabo; 2 terminais amassados"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Fotos ({fotos.length}/{FOTOS_MAX})</Label>
        <div className="flex flex-wrap gap-2">
          {fotos.map((f, i) => (
            <div key={f.url} className="relative h-20 w-20 overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
              <img src={f.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remover foto ${i + 1}`}
                onClick={() => {
                  URL.revokeObjectURL(f.url);
                  urls.current.delete(f.url);
                  setFotos((atual) => atual.filter((x) => x.url !== f.url));
                }}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {fotos.length < FOTOS_MAX && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground hover:bg-muted">
              <Camera className="h-5 w-5" />
              {preparando ? "..." : "Adicionar"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => {
                  adicionarFotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nomeRecebedor">Quem recebeu</Label>
          <Input
            id="nomeRecebedor"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="documentoRecebedor">Documento (opcional)</Label>
          <Input
            id="documentoRecebedor"
            placeholder="CPF, RG ou matrícula"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <Button type="submit" size="lg" disabled={pendente || preparando || !situacao}>
        {pendente ? "Registrando..." : "Registrar recebimento"}
      </Button>
    </form>
  );
}
