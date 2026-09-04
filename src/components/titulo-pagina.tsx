"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Título da página — sempre na barra superior.
 *
 * O padrão do sistema é este: nenhuma página desenha o próprio H1 no corpo.
 * Ela publica título (e subtítulo, quando houver) por aqui e a Topbar os
 * renderiza. Assim o topo fica no mesmo lugar em toda tela, o corpo começa
 * direto no conteúdo e nenhuma página gasta ~60px de altura repetindo o nome
 * do módulo.
 *
 * A Topbar mora no layout, acima do `children`, então uma página não consegue
 * simplesmente renderizar dentro dela. O caminho é a página publicar o título
 * num contexto que envolve as duas — daí o provedor ficar no layout, em volta
 * da Topbar E do main.
 *
 * Quem publica é a rota mais específica que tem nome próprio: em módulos com
 * layout de aba (Cadastros, Programação) quem publica é o layout, e as páginas
 * filhas não publicam nada — duas publicações na mesma rota disputariam o slot.
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
