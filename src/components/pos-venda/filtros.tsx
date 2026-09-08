import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export type FiltrosPosVenda = {
  cliente?: string;
  tipo?: string;
  responsavel?: string;
  de?: string;
  ate?: string;
};

export type Opcao = { id: string; nome: string };

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
    <div className="flex flex-col gap-1.5 lg:min-w-40 lg:flex-1">
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
  acoes,
}: {
  filtros: FiltrosPosVenda;
  clientes: Opcao[];
  tipos: Opcao[];
  responsaveis: Opcao[];
  /** Botões que dividem a linha com "Filtrar" — o recorte "Meus chamados" e a
   *  abertura de chamado. Ficam aqui, e não em linhas próprias acima, porque
   *  cada linha só de botão custava altura de tela que o quadro precisa. */
  acoes?: ReactNode;
}) {
  const algumFiltro = Object.values(filtros).some(Boolean);

  return (
    <form className="flex flex-col gap-3 rounded-md border bg-card p-3 lg:flex-row lg:flex-wrap lg:items-end">
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
        nome="responsavel"
        rotulo="Responsável"
        opcoes={responsaveis}
        valor={filtros.responsavel}
        textoTodos="Todos"
      />
      <div className="grid grid-cols-2 gap-2 lg:w-56 lg:shrink-0">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="de">Aberto de</Label>
          <CampoData id="de" name="de" defaultValue={filtros.de ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ate">até</Label>
          <CampoData id="ate" name="ate" defaultValue={filtros.ate ?? ""} />
        </div>
      </div>
      {/* ml-auto joga o grupo para a direita quando sobra espaço, e some
          sozinho quando a barra quebra em mais de uma linha. */}
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
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
        {acoes}
      </div>
    </form>
  );
}
