import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarMoeda } from "@/lib/format";
import { KitForm } from "@/components/cadastros/kit-form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adicionarItemKit, excluirKit, removerItemKit } from "../actions";

export default async function PaginaEditarKit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("cadastrosGerais");
  const podeEditar = podeEscrever(perfil, "cadastrosGerais");
  const { id } = await params;

  const [{ data: kit }, { data: materiaisData }] = await Promise.all([
    supabase
      .from("Kit")
      .select("*, itens:KitItem(*, material:Material(*))")
      .eq("id", id)
      .order("id", { referencedTable: "KitItem", ascending: true })
      .maybeSingle(),
    supabase.from("Material").select("*").order("descricao", { ascending: true }),
  ]);
  const materiais = materiaisData ?? [];

  if (!kit) notFound();

  const custoTotal = kit.itens.reduce(
    (acc, item) => acc + item.quantidade * item.material.custoUnitario,
    0
  );

  const adicionarItemComKit = adicionarItemKit.bind(null, kit.id);

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Kit · {kit.nome}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>

      <KitForm kit={{ id: kit.id, nome: kit.nome, categoria: kit.categoria }} />

      <Separator className="my-6" />

      <h3 className="font-semibold mb-3">Itens do kit</h3>

      {podeEditar && (
        <form action={adicionarItemComKit} className="flex gap-3 items-end mb-4 max-w-2xl">
          <div className="flex-1">
            <Select
              name="materialId"
              required
              items={materiais.map((m) => ({
                value: m.id,
                label: `${m.codigo} · ${m.descricao}`,
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um material..." />
              </SelectTrigger>
              <SelectContent>
                {materiais.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.codigo} · {m.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            name="quantidade"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Qtd."
            className="max-w-[100px]"
            required
          />
          <Button type="submit" variant="secondary">+ Adicionar item</Button>
        </form>
      )}

      <div className="rounded-md border bg-card max-w-3xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Custo unitário</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {podeEditar && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {kit.itens.map((item) => {
              const subtotal = item.quantidade * item.material.custoUnitario;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.material.codigo}</TableCell>
                  <TableCell>{item.material.descricao}</TableCell>
                  <TableCell className="text-right">{item.quantidade}</TableCell>
                  <TableCell className="text-right">
                    {formatarMoeda(item.material.custoUnitario)}
                  </TableCell>
                  <TableCell className="text-right">{formatarMoeda(subtotal)}</TableCell>
                  {podeEditar && (
                    <TableCell className="text-right">
                      <form
                        action={async () => {
                          "use server";
                          await removerItemKit(kit.id, item.id);
                        }}
                      >
                        <Button type="submit" variant="ghost" size="sm">
                          Remover
                        </Button>
                      </form>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {kit.itens.length === 0 && (
              <TableRow>
                <TableCell colSpan={podeEditar ? 6 : 5} className="text-center text-muted-foreground py-6">
                  Nenhum item adicionado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={podeEditar ? 4 : 4} className="text-right font-medium">
                Custo total do kit
              </TableCell>
              <TableCell className="text-right font-bold">{formatarMoeda(custoTotal)}</TableCell>
              {podeEditar && <TableCell />}
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {podeEditar && (
        <form
          action={async () => {
            "use server";
            await excluirKit(kit.id);
            redirect("/cadastros/kits");
          }}
          className="mt-6"
        >
          <Button type="submit" variant="ghost" className="text-destructive hover:text-destructive">
            Excluir kit
          </Button>
        </form>
      )}
    </div>
  );
}
