"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Plus, Search, Unlink } from "lucide-react";
import {
  buscarProdutosCatalogo,
  criarProdutoDoItem,
  vincularProduto,
  type ProdutoEncontrado,
} from "@/app/(app)/suprimentos/requisicoes/cotacao-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Ligação de um item (texto livre do canteiro) a um produto do catálogo. A
// busca começa com a descrição que o requisitante escreveu.

export function VincularProduto({
  itemId,
  descricaoItem,
  produto,
  editavel,
}: {
  itemId: string;
  descricaoItem: string;
  produto: { descricao: string; unidade: string } | null;
  editavel: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState(descricaoItem);
  const [resultados, setResultados] = useState<ProdutoEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, iniciar] = useTransition();

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const encontrados = await buscarProdutosCatalogo(termo);
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
  }, [termo, aberto]);

  function executar(acao: () => Promise<{ erro?: string } | undefined>) {
    setErro(null);
    iniciar(async () => {
      const resultado = await acao();
      if (resultado?.erro) setErro(resultado.erro);
      else setAberto(false);
    });
  }

  if (!editavel) {
    return (
      <span className={produto ? "" : "text-muted-foreground"}>
        {produto?.descricao ?? "Não vinculado"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={produto ? "text-sm" : "text-sm text-amber-700 dark:text-amber-400"}>
        {produto?.descricao ?? "Não vinculado"}
      </span>
      <Dialog
        open={aberto}
        onOpenChange={(abrir) => {
          setAberto(abrir);
          if (abrir) {
            setTermo(descricaoItem);
            setErro(null);
          }
        }}
      >
        <DialogTrigger
          render={
            <Button type="button" variant="ghost" size="icon" aria-label="Vincular ao catálogo" title="Vincular ao catálogo" />
          }
        >
          <Link2 className="h-4 w-4" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Vincular ao catálogo</DialogTitle>
            <DialogDescription>Pedido do canteiro: “{descricaoItem}”</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar no catálogo"
              className="h-9 pl-8"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={gravando}
                onClick={() => executar(() => vincularProduto(itemId, p.id))}
                className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted disabled:opacity-50"
              >
                <span>{p.descricao}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.unidade}</span>
              </button>
            ))}
            {resultados.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {buscando ? "Buscando..." : "Nenhum produto encontrado. Tente menos palavras."}
              </p>
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={gravando}
              onClick={() => executar(() => criarProdutoDoItem(itemId))}
            >
              <Plus className="h-4 w-4" /> Criar no catálogo com a descrição do pedido
            </Button>
            {produto && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={gravando}
                onClick={() => executar(() => vincularProduto(itemId, null))}
              >
                <Unlink className="h-4 w-4" /> Desvincular
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
