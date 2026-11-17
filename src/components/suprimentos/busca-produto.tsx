"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  buscarProdutosRequisicao,
} from "@/app/(app)/suprimentos/requisicoes/actions";
import type { ProdutoEncontrado } from "@/lib/suprimentos-catalogo";
import { Input } from "@/components/ui/input";

// Campo de busca no catálogo para a requisição: digita, aparecem até 20
// produtos, toca num deles. A busca ignora acento e ordem das palavras.

export function BuscaProduto({
  rotulo,
  aoEscolher,
}: {
  /** aria-label do campo, ex.: "Produto do item 1". */
  rotulo: string;
  aoEscolher: (produto: ProdutoEncontrado) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termo.trim().length < 2) return;
    let ativo = true;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const encontrados = await buscarProdutosRequisicao(termo);
        if (ativo) setResultados(encontrados);
      } catch {
        if (ativo) setResultados([]);
      } finally {
        if (ativo) setBuscando(false);
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [termo]);

  useEffect(() => {
    if (!aberto) return;
    function fora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const curto = termo.trim().length < 2;

  return (
    <div className="relative" ref={caixa}>
      <Search className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        aria-label={rotulo}
        placeholder="Buscar no catálogo (ex.: cabo 10mm)"
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAberto(false);
          // Enter escolhe o primeiro resultado em vez de enviar o formulário.
          if (e.key === "Enter") {
            e.preventDefault();
            if (!curto && resultados[0]) aoEscolher(resultados[0]);
          }
        }}
        className="h-10 pl-8"
      />
      {aberto && !curto && (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                aoEscolher(p);
                setAberto(false);
              }}
              className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
            >
              <span>{p.descricao}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{p.unidade}</span>
            </button>
          ))}
          {resultados.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {buscando ? "Buscando..." : "Nada encontrado. Tente menos palavras ou marque a caixa abaixo."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
