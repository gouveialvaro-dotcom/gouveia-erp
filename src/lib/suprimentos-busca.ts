/**
 * Limpa o texto de busca antes de ir para um filtro `.or()` do PostgREST.
 * Vírgula, parênteses e ponto separam condições na sintaxe do filtro; sem
 * removê-los, a busca "abc),id.neq.(x" viraria uma condição extra.
 */
export function termoBusca(q: string | undefined) {
  return (q ?? "").replace(/[,()%*\\.:"']/g, " ").replace(/\s+/g, " ").trim();
}
