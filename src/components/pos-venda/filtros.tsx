import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export type FiltrosPosVenda = {
  cliente?: string;
  tipo?: string;
  responsavel?: string;
  concessionaria?: string;
  de?: string;
  ate?: string;
};

type Opcao = { id: string; nome: string };

function CampoSelect({
  nome,
  rotulo,
  opcoes,
  valor,
  textoTodos,
}: {
  nome: string;
  rotulo: string;
  opcoes: Opcao[];
  valor?: string;
  textoTodos: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={nome}>{rotulo}</Label>
      <SelectNativo id={nome} name={nome} defaultValue={valor ?? ""}>
        <option value="">{textoTodos}</option>
        {opcoes.map((opcao) => (
          <option key={opcao.id} value={opcao.id}>
            {opcao.nome}
          </option>
        ))}
      </SelectNativo>
    </div>
  );
}

export function BarraFiltros({
  filtros,
  clientes,
  tipos,
  responsaveis,
  concessionarias,
}: {
  filtros: FiltrosPosVenda;
  clientes: Opcao[];
  tipos: Opcao[];
  responsaveis: Opcao[];
  concessionarias: Opcao[];
}) {
  const algumFiltro = Object.values(filtros).some(Boolean);

  return (
    <form className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-3 lg:grid-cols-6 lg:items-end">
      <CampoSelect
        nome="cliente"
        rotulo="Cliente"
        opcoes={clientes}
        valor={filtros.cliente}
        textoTodos="Todos os clientes"
      />
      <CampoSelect
        nome="tipo"
        rotulo="Tipo de problema"
        opcoes={tipos}
        valor={filtros.tipo}
        textoTodos="Todos os tipos"
      />
      <CampoSelect
        nome="concessionaria"
        rotulo="Concessionária"
        opcoes={concessionarias}
        valor={filtros.concessionaria}
        textoTodos="Todas"
      />
      <CampoSelect
        nome="responsavel"
        rotulo="Responsável"
        opcoes={responsaveis}
        valor={filtros.responsavel}
        textoTodos="Todos"
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="de">Aberto de</Label>
          <Input id="de" name="de" type="date" defaultValue={filtros.de ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ate">até</Label>
          <Input id="ate" name="ate" type="date" defaultValue={filtros.ate ?? ""} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {algumFiltro && (
          <Button
            variant="ghost"
            render={<Link href="/pos-venda" />}
            nativeButton={false}
          >
            Limpar
          </Button>
        )}
      </div>
    </form>
  );
}
