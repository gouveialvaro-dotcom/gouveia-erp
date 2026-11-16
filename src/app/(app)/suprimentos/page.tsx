import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { PAPEIS, ROTULO_PAPEL } from "@/lib/suprimentos";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PaginaSuprimentos() {
  const { papeis, ehAdmin } = await contextoSuprimentos();

  const [{ count: produtos }, { count: revisar }, { count: fornecedores }] = await Promise.all([
    supabase.from("Produto").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase
      .from("Produto")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("revisar", true),
    supabase.from("Fornecedor").select("id", { count: "exact", head: true }).eq("ativo", true),
  ]);

  const meusPapeis = PAPEIS.filter((papel) => papeis.has(papel));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Seus papéis no módulo:</span>
        {ehAdmin && <Badge>Administrador</Badge>}
        {meusPapeis.map((papel) => (
          <Badge key={papel} variant="secondary">
            {ROTULO_PAPEL[papel]}
          </Badge>
        ))}
        {!ehAdmin && meusPapeis.length === 0 && <span>Requisitante</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produtos no catálogo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <Link href="/suprimentos/produtos" className="hover:underline">
              {produtos ?? 0}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produtos a revisar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <Link href="/suprimentos/produtos?revisar=1" className="hover:underline">
              {revisar ?? 0}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fornecedores ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <Link href="/suprimentos/fornecedores" className="hover:underline">
              {fornecedores ?? 0}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
