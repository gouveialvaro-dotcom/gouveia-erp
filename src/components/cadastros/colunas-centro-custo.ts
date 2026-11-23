// Grade da lista de centros de custo, fora do arquivo "use client" do
// formulário: a página é Server Component e, importada de lá, a constante
// chegaria como referência de cliente e não como texto (ver
// components/administracao/colunas.ts). Cabeçalho e linhas são grids
// independentes, então nenhuma trilha é dimensionada pelo conteúdo.
export const COLUNAS_CENTRO_CUSTO = "md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.4fr)_6rem_15rem]";
