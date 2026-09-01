// A grade da lista de usuários mora aqui, fora do módulo "use client" da linha:
// a página é Server Component e importar um valor de um arquivo com "use
// client" devolve uma referência de cliente, não a string — o cabeçalho ficava
// sem grade nenhuma e as legendas empilhavam.
// A trilha das ações tem largura fixa em vez de `auto` porque cabeçalho e
// linhas são grids independentes: dimensionada pelo conteúdo, ela mede
// diferente em cada linha (a sua própria não tem "Senha" nem "Excluir") e arrasta as
// colunas seguintes para lados diferentes.
export const COLUNAS_USUARIO = "md:grid-cols-[minmax(0,1fr)_11rem_6rem_10rem_15rem]";
