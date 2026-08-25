import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FiltrosBusca = { q?: string; de?: string; ate?: string };

/**
 * Busca na lista de conversas: texto da mensagem, cliente, telefone e período.
 *
 * Formulário GET, sem "use client": a busca vira URL, então o resultado é
 * compartilhável, sobrevive ao recarregar e funciona com o botão de voltar do
 * navegador. Mesmo motivo da BarraFiltros do Kanban de chamados.
 */
export function BuscaConversas({
  filtros,
  caixa,
  total,
}: {
  filtros: FiltrosBusca;
  caixa: string;
  total: number | null;
}) {
  const algumFiltro = Boolean(filtros.q || filtros.de || filtros.ate);

  return (
    <form className="flex flex-col gap-2 rounded-md border bg-card p-2">
      {/* A caixa selecionada acompanha a busca para o usuário não ser jogado
          de volta em "Pendentes" ao pesquisar. */}
      <input type="hidden" name="caixa" value={caixa} />

      <div className="flex flex-col gap-1">
        <Label htmlFor="q" className="text-xs">
          Buscar
        </Label>
        <Input
          id="q"
          name="q"
          defaultValue={filtros.q ?? ""}
          placeholder="Mensagem, cliente ou telefone"
          className="h-8"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="de" className="text-xs">
            De
          </Label>
          <CampoData id="de" name="de" defaultValue={filtros.de ?? ""} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ate" className="text-xs">
            Até
          </Label>
          <CampoData id="ate" name="ate" defaultValue={filtros.ate ?? ""} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="secondary">
          Buscar
        </Button>
        {algumFiltro && (
          <Button
            size="sm"
            variant="ghost"
            render={<Link href={`/pos-venda/whatsapp?caixa=${caixa}`} />}
            nativeButton={false}
          >
            Limpar
          </Button>
        )}
        {total !== null && (
          <span className="text-xs text-muted-foreground">
            {total} resultado(s), inclusive arquivadas
          </span>
        )}
      </div>
    </form>
  );
}
