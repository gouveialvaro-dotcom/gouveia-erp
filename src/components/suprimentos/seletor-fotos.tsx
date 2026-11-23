"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { reduzirFoto } from "@/lib/reduzir-foto";

// Miniaturas + botão "Adicionar" (abre a câmera no celular). Cada foto é
// reduzida antes de entrar na lista. O pai guarda a lista; as prévias (blob:)
// são liberadas ao remover e ao sair da tela.

export type FotoLocal = { arquivo: File; url: string };

export function SeletorFotos({
  fotos,
  aoMudar,
  maximo,
  rotulo,
}: {
  fotos: FotoLocal[];
  aoMudar: (fotos: FotoLocal[]) => void;
  maximo: number;
  /** Prefixo do texto alternativo, ex.: "Foto do item 2". */
  rotulo: string;
}) {
  const [preparando, setPreparando] = useState(false);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const ativas = urls.current;
    return () => ativas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  async function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    setPreparando(true);
    const novas = await Promise.all(
      [...lista].slice(0, maximo - fotos.length).map(async (f) => {
        const arquivo = await reduzirFoto(f);
        const url = URL.createObjectURL(arquivo);
        urls.current.add(url);
        return { arquivo, url };
      })
    );
    aoMudar([...fotos, ...novas]);
    setPreparando(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map((f, i) => (
        <div key={f.url} className="relative h-16 w-16 overflow-hidden rounded-md border">
          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
          <img src={f.url} alt={`${rotulo} ${i + 1}`} className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label={`Remover ${rotulo.toLowerCase()} ${i + 1}`}
            onClick={() => {
              URL.revokeObjectURL(f.url);
              urls.current.delete(f.url);
              aoMudar(fotos.filter((x) => x.url !== f.url));
            }}
            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {fotos.length < maximo && (
        <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed text-[11px] text-muted-foreground hover:bg-muted">
          <Camera className="h-4 w-4" />
          {preparando ? "..." : "Foto"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            aria-label={`Adicionar ${rotulo.toLowerCase()}`}
            onChange={(e) => {
              adicionar(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
