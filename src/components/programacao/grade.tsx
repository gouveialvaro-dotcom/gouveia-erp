"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, CopyPlus, Plus } from "lucide-react";
import { repetirSemanaAnterior } from "@/app/(app)/programacao/actions";
import {
  AGRUPAMENTOS,
  ESCOPOS,
  ROTULO_AGRUPAMENTO,
  ROTULO_ESCOPO,
  deslocarReferencia,
  ehFimDeSemana,
  linhaEditavel,
  nomeDiaCurto,
  tituloDoPeriodo,
  type Agrupamento,
  type Escopo,
  type StatusProgramacao,
} from "@/lib/programacao";
import { formatarData } from "@/lib/format";
import { hojeIso } from "@/lib/pos-venda";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SelectNativo } from "@/components/ui/select-nativo";
import { PublicarDialog } from "@/components/programacao/publicar-dialog";
import {
  PainelLinha,
  type LinhaEmEdicao,
  type OpcoesPainel,
} from "@/components/programacao/painel-linha";

export type LinhaGrade = LinhaEmEdicao & {
  destino: string;
  veiculoTexto: string | null;
  motoristaNome: string | null;
  equipeNomes: string[];
  responsavelNomes: string[];
  status: StatusProgramacao;
};

/** "RS" a partir de "Rafael Souza" — cabe na célula sem esconder quem responde. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

const SEM_VEICULO = "__sem_veiculo__";

export function GradeProgramacao({
  escopo,
  referencia,
  agrupamento,
  dias,
  inicio,
  fim,
  linhas,
  opcoes,
  podeEditar,
  ehAdmin,
  pendentes,
  destinatariosPrevistos,
}: {
  escopo: Escopo;
  referencia: string;
  agrupamento: Agrupamento;
  dias: string[];
  inicio: string;
  fim: string;
  linhas: LinhaGrade[];
  opcoes: OpcoesPainel;
  podeEditar: boolean;
  ehAdmin: boolean;
  pendentes: number;
  destinatariosPrevistos: number;
}) {
  const router = useRouter();
  const [copiando, iniciarCopia] = useTransition();

  const [painelAberto, setPainelAberto] = useState(false);
  const [linhaEmEdicao, setLinhaEmEdicao] = useState<LinhaGrade | null>(null);
  const [dataDoPainel, setDataDoPainel] = useState(dias[0] ?? referencia);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("");
  const [filtroFuncionario, setFiltroFuncionario] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  function navegar(novos: Record<string, string>) {
    const parametros = new URLSearchParams({ escopo, ref: referencia, agrupamento, ...novos });
    router.push(`/programacao?${parametros.toString()}`);
  }

  // Os filtros são aplicados no cliente: os dados do período já vieram
  // inteiros do servidor, e uma ida ao banco a cada troca de filtro só faria a
  // tela piscar.
  const visiveis = useMemo(() => {
    const texto = filtroTexto.trim().toLowerCase();
    return linhas.filter((linha) => {
      if (texto && !`${linha.destino} ${linha.servico}`.toLowerCase().includes(texto)) {
        return false;
      }
      if (filtroVeiculo && linha.veiculoId !== filtroVeiculo) return false;
      if (filtroFuncionario && !linha.equipeIds.includes(filtroFuncionario)) return false;
      if (filtroResponsavel && !linha.responsavelIds.includes(filtroResponsavel)) return false;
      if (filtroStatus && linha.status !== filtroStatus) return false;
      return true;
    });
  }, [linhas, filtroTexto, filtroVeiculo, filtroFuncionario, filtroResponsavel, filtroStatus]);

  // As três leituras da mesma grade. Por destino responde "o que acontece em
  // cada obra"; por veículo, "que carro está parado"; por pessoa, "quem está
  // sem alocação" — e essas duas últimas só mostram a ociosidade porque a
  // linha existe mesmo quando não há nada nela.
  const grupos = useMemo(() => {
    if (agrupamento === "veiculo") {
      const lista = opcoes.veiculos.map((v) => ({ chave: v.id, rotulo: v.nome }));
      return [...lista, { chave: SEM_VEICULO, rotulo: "Sem veículo" }];
    }
    if (agrupamento === "pessoa") {
      return opcoes.funcionarios.map((f) => ({ chave: f.id, rotulo: f.nome }));
    }
    const destinos = [...new Set(visiveis.map((l) => l.destino))].sort((a, b) =>
      a.localeCompare(b)
    );
    return destinos.map((destino) => ({ chave: destino, rotulo: destino }));
  }, [agrupamento, opcoes.veiculos, opcoes.funcionarios, visiveis]);

  function linhasDaCelula(chaveGrupo: string, dia: string) {
    return visiveis.filter((linha) => {
      if (linha.data !== dia) return false;
      if (agrupamento === "destino") return linha.destino === chaveGrupo;
      if (agrupamento === "veiculo") {
        return chaveGrupo === SEM_VEICULO ? !linha.veiculoId : linha.veiculoId === chaveGrupo;
      }
      return linha.equipeIds.includes(chaveGrupo);
    });
  }

  function abrirNova(dia: string) {
    setLinhaEmEdicao(null);
    setDataDoPainel(dia);
    setPainelAberto(true);
  }

  function abrirLinha(linha: LinhaGrade) {
    setLinhaEmEdicao(linha);
    setDataDoPainel(linha.data);
    setPainelAberto(true);
  }

  function copiarSemana() {
    iniciarCopia(async () => {
      const resultado = await repetirSemanaAnterior(referencia);
      if (resultado.erro) {
        toast.error(resultado.erro);
        return;
      }
      const pendencias = resultado.comPendencia ?? [];
      if (pendencias.length) {
        // Copiar em silêncio o que ficou incompleto esconderia trabalho a
        // fazer, e a logística descobriria no dia da saída.
        toast.warning(
          `${resultado.copiadas} linha(s) copiada(s) como rascunho — ${pendencias.length} com pendência: ${pendencias.join(" · ")}`,
          { duration: 12000 }
        );
      } else {
        toast.success(`${resultado.copiadas} linha(s) copiada(s) como rascunho.`);
      }
      router.refresh();
    });
  }

  const hoje = hojeIso();

  return (
    <div className="flex flex-col gap-4">
      {/* --- Barra de período ---------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border">
          {ESCOPOS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => navegar({ escopo: opcao })}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors first:rounded-l-md last:rounded-r-md",
                opcao === escopo
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {ROTULO_ESCOPO[opcao]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navegar({ ref: deslocarReferencia(escopo, referencia, -1) })}
            aria-label="Período anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navegar({ ref: hoje })}>
            <CalendarDays className="size-4" />
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navegar({ ref: deslocarReferencia(escopo, referencia, 1) })}
            aria-label="Próximo período"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <span className="text-sm font-medium">{tituloDoPeriodo(escopo, referencia)}</span>

        <SelectNativo
          className="ml-auto w-auto"
          value={agrupamento}
          onChange={(e) => navegar({ agrupamento: e.target.value })}
          aria-label="Agrupamento da grade"
        >
          {AGRUPAMENTOS.map((opcao) => (
            <option key={opcao} value={opcao}>
              {ROTULO_AGRUPAMENTO[opcao]}
            </option>
          ))}
        </SelectNativo>

        {podeEditar && (
          <Button variant="outline" size="sm" onClick={copiarSemana} disabled={copiando}>
            <CopyPlus className="size-4" />
            {copiando ? "Copiando..." : "Repetir semana anterior"}
          </Button>
        )}
      </div>

      {/* --- Filtros -------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-56"
          placeholder="Buscar destino ou serviço..."
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
        />
        <SelectNativo
          className="w-auto"
          value={filtroVeiculo}
          onChange={(e) => setFiltroVeiculo(e.target.value)}
          aria-label="Filtrar por veículo"
        >
          <option value="">Todos os veículos</option>
          {opcoes.veiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
            </option>
          ))}
        </SelectNativo>
        <SelectNativo
          className="w-auto"
          value={filtroFuncionario}
          onChange={(e) => setFiltroFuncionario(e.target.value)}
          aria-label="Filtrar por funcionário"
        >
          <option value="">Toda a equipe</option>
          {opcoes.funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </SelectNativo>
        <SelectNativo
          className="w-auto"
          value={filtroResponsavel}
          onChange={(e) => setFiltroResponsavel(e.target.value)}
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          {opcoes.usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </SelectNativo>
        <SelectNativo
          className="w-auto"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="publicada">Publicada</option>
          <option value="cancelada">Cancelada</option>
        </SelectNativo>
      </div>

      {/* --- Faixa de pendências -------------------------------------------- */}
      {podeEditar && pendentes > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/95 px-3 py-2 text-sm text-amber-950 backdrop-blur supports-backdrop-filter:bg-amber-500/80">
          <span>
            <strong>{pendentes}</strong> alteraç{pendentes === 1 ? "ão" : "ões"} não publicada
            {pendentes === 1 ? "" : "s"} neste período — <strong>{destinatariosPrevistos}</strong>{" "}
            pessoa{destinatariosPrevistos === 1 ? "" : "s"} ser
            {destinatariosPrevistos === 1 ? "á" : "ão"} avisada
            {destinatariosPrevistos === 1 ? "" : "s"}.
          </span>
          <div className="ml-auto">
            <PublicarDialog inicio={inicio} fim={fim} pendentes={pendentes} />
          </div>
        </div>
      )}

      {/* --- Grade ---------------------------------------------------------- */}
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 min-w-44 bg-muted/40 px-3 py-2 text-left font-medium">
                {ROTULO_AGRUPAMENTO[agrupamento].replace("Por ", "")}
              </th>
              {dias.map((dia) => (
                <th
                  key={dia}
                  className={cn(
                    "min-w-40 px-2 py-2 text-left font-medium",
                    ehFimDeSemana(dia) && "bg-muted/60",
                    dia === hoje && "text-primary"
                  )}
                >
                  <span className="block text-xs uppercase text-muted-foreground">
                    {nomeDiaCurto(dia)}
                  </span>
                  {formatarData(dia).slice(0, 5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => (
              <tr key={grupo.chave} className="border-b last:border-b-0 align-top">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                  {grupo.rotulo}
                </th>
                {dias.map((dia) => {
                  const daCelula = linhasDaCelula(grupo.chave, dia);
                  return (
                    <td
                      key={dia}
                      className={cn(
                        "px-1.5 py-1.5",
                        ehFimDeSemana(dia) && "bg-muted/30"
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        {daCelula.map((linha) => (
                          <CartaoLinha
                            key={linha.id}
                            linha={linha}
                            mostrarDestino={agrupamento !== "destino"}
                            aoAbrir={
                              podeEditar && linhaEditavel(linha.data, ehAdmin)
                                ? () => abrirLinha(linha)
                                : null
                            }
                          />
                        ))}
                        {podeEditar && linhaEditavel(dia, ehAdmin) && daCelula.length === 0 && (
                          <button
                            type="button"
                            onClick={() => abrirNova(dia)}
                            className="flex items-center justify-center rounded-md border border-dashed py-2 text-muted-foreground/60 transition-colors hover:border-primary hover:text-primary"
                            aria-label={`Nova programação em ${formatarData(dia)}`}
                          >
                            <Plus className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {grupos.length === 0 && (
              <tr>
                <td
                  colSpan={dias.length + 1}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  Nada programado neste período.
                  {podeEditar && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => abrirNova(dias[0] ?? referencia)}
                      >
                        Criar a primeira linha
                      </button>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Borda tracejada = rascunho (ninguém foi avisado). Marcador âmbar = editada depois de
        publicada, aguardando novo aviso. Riscada = cancelada.
      </p>

      <PainelLinha
        aberto={painelAberto}
        aoFechar={() => {
          setPainelAberto(false);
          router.refresh();
        }}
        linha={linhaEmEdicao}
        dataInicial={dataDoPainel}
        opcoes={opcoes}
      />
    </div>
  );
}

function CartaoLinha({
  linha,
  mostrarDestino,
  aoAbrir,
}: {
  linha: LinhaGrade;
  mostrarDestino: boolean;
  /** Null para quem só lê: engenharia e obra veem tudo, mas não remanejam. */
  aoAbrir: (() => void) | null;
}) {
  // Quem só lê recebe o detalhe no title em vez do painel de edição: abrir um
  // formulário que o servidor vai recusar seria prometer o que não existe.
  const detalhe = [
    linha.destino,
    linha.servico,
    linha.veiculoTexto,
    linha.motoristaNome ? `Motorista: ${linha.motoristaNome}` : null,
    linha.equipeNomes.length ? `Equipe: ${linha.equipeNomes.join(", ")}` : null,
    linha.responsavelNomes.length
      ? `Responsável: ${linha.responsavelNomes.join(", ")}`
      : null,
    linha.observacao,
  ]
    .filter(Boolean)
    .join("\n");

  const Elemento = aoAbrir ? "button" : "div";

  return (
    <Elemento
      {...(aoAbrir ? { type: "button" as const, onClick: aoAbrir } : { title: detalhe })}
      className={cn(
        "w-full rounded-md border bg-background px-2 py-1.5 text-left transition-colors",
        aoAbrir && "hover:border-primary",
        linha.status === "rascunho" && "border-dashed",
        linha.status === "cancelada" && "opacity-50 line-through",
        linha.temAlteracaoPendente && "border-amber-500 ring-1 ring-amber-500/40"
      )}
    >
      {mostrarDestino && (
        <span className="block truncate text-xs font-medium">{linha.destino}</span>
      )}
      <span className="block truncate text-xs text-muted-foreground">{linha.servico}</span>
      {linha.veiculoTexto && (
        <span className="block truncate text-xs">{linha.veiculoTexto}</span>
      )}
      {linha.motoristaNome && (
        <span className="block truncate text-xs text-muted-foreground">
          Motorista: {linha.motoristaNome}
        </span>
      )}
      <span className="mt-1 flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="px-1 py-0 text-[10px]">
          {linha.equipeIds.length} pessoa{linha.equipeIds.length === 1 ? "" : "s"}
        </Badge>
        {linha.responsavelNomes.map((nome) => (
          <Badge key={nome} variant="secondary" className="px-1 py-0 text-[10px]" title={nome}>
            {iniciais(nome)}
          </Badge>
        ))}
      </span>
    </Elemento>
  );
}
