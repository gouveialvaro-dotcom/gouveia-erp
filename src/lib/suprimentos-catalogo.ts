import { supabase } from "@/lib/supabase";
import { termoBusca } from "@/lib/suprimentos-busca";
import { chaveDescricao } from "@/lib/suprimentos";

// Busca no catálogo de produtos, comum ao requisitante (ao montar a
// requisição) e ao comprador (ao vincular itens). Server-only.

export type ProdutoEncontrado = { id: string; numero: number; descricao: string; unidade: string };

export async function buscarProdutos(q: string): Promise<ProdutoEncontrado[]> {
  const termo = termoBusca(q);
  if (termo.length < 2) return [];

  // Cada palavra precisa aparecer, em qualquer ordem, e sem olhar acento:
  // "cabo flexível 10" acha "CABO FLEXIVEL 10MM".
  let consulta = supabase
    .from("Produto")
    .select("id, numero, descricao, unidade")
    .eq("ativo", true)
    .order("descricao")
    .limit(20);
  for (const palavra of chaveDescricao(termo).split(" ").slice(0, 5)) {
    consulta = consulta.like("chaveDescricao", `%${palavra}%`);
  }
  const { data } = await consulta;
  return data ?? [];
}
