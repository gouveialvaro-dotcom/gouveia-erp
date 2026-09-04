"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Slot de título na barra superior.
 *
 * A Topbar mora no layout, acima do `children`, então uma página não consegue
 * simplesmente renderizar dentro dela. O caminho é a página publicar o título
 * num contexto que envolve as duas — daí o provedor ficar no layout, em volta
 * da Topbar E do main.
 *
 * Quem não publica nada não muda: o slot fica vazio e a barra continua como
 * era. Isso importa porque a barra é de todas as páginas, e só o WhatsApp
 * precisou dessa mudança — nas outras o título continua no corpo, onde há
 * espaço vertical de sobra.
 */
type Titulo = { titulo: string; subtitulo?: string | null } | null;

const ContextoTitulo = createContext<{
  titulo: Titulo;
  definir: (titulo: Titulo) => void;
}>({ titulo: null, definir: () => {} });

export function ProvedorTituloPagina({ children }: { children: React.ReactNode }) {
  const [titulo, definir] = useState<Titulo>(null);
  return (
    <ContextoTitulo.Provider value={{ titulo, definir }}>{children}</ContextoTitulo.Provider>
  );
}

/** Lido pela Topbar. */
export function useTituloPagina() {
  return useContext(ContextoTitulo).titulo;
}

/**
 * Renderizado pela página que quer o título na barra. Não desenha nada no
 * corpo; a limpeza no unmount é o que impede o título de uma rota vazar para a
 * seguinte ao navegar.
 */
export function TituloPagina({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string | null;
}) {
  const { definir } = useContext(ContextoTitulo);

  useEffect(() => {
    definir({ titulo, subtitulo });
    return () => definir(null);
  }, [titulo, subtitulo, definir]);

  return null;
}
