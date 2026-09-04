"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  cancelarProgramacao,
  consultarOcupacao,
  excluirProgramacao,
  salvarProgramacao,
  type EstadoFormProgramacao,
} from "@/app/(app)/programacao/actions";
import {
  ROTULO_TIPO_DESTINO,
  dataComDiaSemana,
  type Ocupacao,
  type TipoDestinoProgramacao,
} from "@/lib/programacao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CampoData } from "@/components/ui/campo-data";
import { SelectNativo } from "@/components/ui/select-nativo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type OpcaoSimples = { id: string; nome: string };

export type OpcoesPainel = {
  obras: OpcaoSimples[];
  veiculos: OpcaoSimples[];
  funcionarios: OpcaoSimples[];
  usuarios: OpcaoSimples[];
};

export type LinhaEmEdicao = {
  id: string;
  data: string;
  tipoDestino: TipoDestinoProgramacao;
  obraId: string | null;
  descricaoAvulsa: string | null;
  servico: string;
  observacao: string | null;
  veiculoId: string | null;
  motoristaId: string | null;
  equipeIds: string[];
  responsavelIds: string[];
  status: string;
  temAlteracaoPendente: boolean;
};

export function PainelLinha({
  aberto,
  aoFechar,
  linha,
  dataInicial,
  opcoes,
}: {
  aberto: boolean;
  aoFechar: () => void;
  linha: LinhaEmEdicao | null;
  dataInicial: string;
  opcoes: OpcoesPainel;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && aoFechar()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{linha ? "Editar programação" : "Nova programação"}</DialogTitle>
          <DialogDescription>
            {linha?.status === "publicada"
              ? "Linha já publicada. Salvar registra a alteração; quem foi avisado só recebe o novo aviso quando você publicar."
              : "Rascunho não avisa ninguém. O disparo acontece só na publicação."}
          </DialogDescription>
        </DialogHeader>
        {/* O formulário vive dentro do popup, que o Base UI desmonta ao fechar:
            assim o estado da action não sobrevive para a próxima abertura. */}
        <FormLinha
          linha={linha}
          dataInicial={dataInicial}
          opcoes={opcoes}
          aoSalvar={aoFechar}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormLinha({
  linha,
  dataInicial,
  opcoes,
  aoSalvar,
}: {
  linha: LinhaEmEdicao | null;
  dataInicial: string;
  opcoes: OpcoesPainel;
  aoSalvar: () => void;
}) {
  const salvarComId = salvarProgramacao.bind(null, linha?.id ?? null);
  const [estado, formAction, pendente] = useActionState<EstadoFormProgramacao, FormData>(
    salvarComId,
    undefined
  );

  const [data, setData] = useState(linha?.data ?? dataInicial);
  const [tipoDestino, setTipoDestino] = useState<TipoDestinoProgramacao>(
    linha?.tipoDestino ?? "obra"
  );
  const [equipeIds, setEquipeIds] = useState<string[]>(linha?.equipeIds ?? []);
  const [responsavelIds, setResponsavelIds] = useState<string[]>(linha?.responsavelIds ?? []);
  const [motoristaId, setMotoristaId] = useState(linha?.motoristaId ?? "");
  const [veiculoId, setVeiculoId] = useState(linha?.veiculoId ?? "");
  const [avisoMotorista, setAvisoMotorista] = useState<string | null>(null);

  const [ocupacao, setOcupacao] = useState<Ocupacao>({ funcionarios: {}, veiculos: {} });
  const [carregandoOcupacao, iniciarConsulta] = useTransition();

  // A ocupação é reconsultada a cada troca de data porque é ela que decide o
  // que fica desabilitado — e é a MESMA função que o servidor usa para recusar
  // a gravação. Desabilitar aqui não substitui aquele bloqueio; só evita que a
  // logística descubra o conflito depois de montar a linha inteira.
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    iniciarConsulta(async () => {
      setOcupacao(await consultarOcupacao(data, linha?.id ?? null));
    });
  }, [data, linha?.id]);

  useEffect(() => {
    if (estado?.ok) aoSalvar();
  }, [estado, aoSalvar]);

  const equipeSelecionada = useMemo(
    () => opcoes.funcionarios.filter((f) => equipeIds.includes(f.id)),
    [opcoes.funcionarios, equipeIds]
  );

  function alternarEquipe(id: string, marcado: boolean) {
    setEquipeIds((atual) => {
      const proxima = marcado ? [...atual, id] : atual.filter((i) => i !== id);
      // Tirar da equipe quem está como motorista limpa o campo e avisa: deixar
      // o motorista apontando para alguém que não vai é exatamente o erro que
      // a trava do banco recusa depois, sem explicar o porquê.
      if (!marcado && id === motoristaId) {
        setMotoristaId("");
        const nome = opcoes.funcionarios.find((f) => f.id === id)?.nome ?? "A pessoa";
        setAvisoMotorista(`${nome} saiu da equipe e deixou de ser o motorista. Escolha outro.`);
      }
      return proxima;
    });
  }

  function alternarResponsavel(id: string, marcado: boolean) {
    setResponsavelIds((atual) =>
      marcado ? [...atual, id] : atual.filter((i) => i !== id)
    );
  }

  const impedimentoVeiculo = veiculoId ? ocupacao.veiculos[veiculoId] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* As listas são enviadas por campos ocultos, e não pelos checkboxes:
          o estado precisa ser controlado para limpar o motorista quando ele
          sai da equipe. */}
      {equipeIds.map((id) => (
        <input key={`e-${id}`} type="hidden" name="equipeIds" value={id} />
      ))}
      {responsavelIds.map((id) => (
        <input key={`r-${id}`} type="hidden" name="responsavelIds" value={id} />
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data">Data</Label>
          <CampoData id="data" name="data" value={data} aoMudar={setData} required />
          <p className="text-xs text-muted-foreground">
            {/^\d{4}-\d{2}-\d{2}$/.test(data) ? dataComDiaSemana(data) : "Dia inteiro"}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipoDestino">Tipo de destino</Label>
          <SelectNativo
            id="tipoDestino"
            name="tipoDestino"
            value={tipoDestino}
            onChange={(e) => setTipoDestino(e.target.value as TipoDestinoProgramacao)}
          >
            {(Object.keys(ROTULO_TIPO_DESTINO) as TipoDestinoProgramacao[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULO_TIPO_DESTINO[tipo]}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          {tipoDestino === "obra" ? (
            <>
              <Label htmlFor="obraId">Obra</Label>
              <SelectNativo id="obraId" name="obraId" defaultValue={linha?.obraId ?? ""}>
                <option value="">Selecione a obra...</option>
                {opcoes.obras.map((obra) => (
                  <option key={obra.id} value={obra.id}>
                    {obra.nome}
                  </option>
                ))}
              </SelectNativo>
            </>
          ) : (
            <>
              <Label htmlFor="descricaoAvulsa">Destino avulso</Label>
              <Input
                id="descricaoAvulsa"
                name="descricaoAvulsa"
                defaultValue={linha?.descricaoAvulsa ?? ""}
                placeholder="Entrega de material em Natal"
              />
            </>
          )}
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="servico">Serviço do dia</Label>
          <Input
            id="servico"
            name="servico"
            defaultValue={linha?.servico ?? ""}
            placeholder="Comissionamento de inversores"
            required
          />
        </div>
      </div>

      {/* --- Equipe -------------------------------------------------------- */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label>Equipe do dia</Label>
          <span className="text-xs text-muted-foreground">
            {carregandoOcupacao ? "conferindo o dia..." : `${equipeIds.length} pessoa(s)`}
          </span>
        </div>
        <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
          {opcoes.funcionarios.map((pessoa) => {
            const impedimento = ocupacao.funcionarios[pessoa.id];
            const marcado = equipeIds.includes(pessoa.id);
            // Já selecionado nunca é desabilitado: a ocupação é consultada
            // ignorando esta linha, então um impedimento aqui vem de fora.
            const bloqueado = Boolean(impedimento) && !marcado;
            return (
              <label
                key={pessoa.id}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${
                  bloqueado ? "opacity-60" : "cursor-pointer hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={marcado}
                  disabled={bloqueado}
                  onCheckedChange={(valor) => alternarEquipe(pessoa.id, Boolean(valor))}
                />
                <span className={bloqueado ? "text-muted-foreground" : ""}>{pessoa.nome}</span>
                {impedimento && (
                  <span className="ml-auto text-xs text-destructive">{impedimento.motivo}</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* --- Veículo e motorista ------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="veiculoId">Veículo (opcional)</Label>
          <SelectNativo
            id="veiculoId"
            name="veiculoId"
            value={veiculoId}
            onChange={(e) => setVeiculoId(e.target.value)}
          >
            <option value="">Sem veículo</option>
            {opcoes.veiculos.map((veiculo) => {
              const impedimento = ocupacao.veiculos[veiculo.id];
              const bloqueado = Boolean(impedimento) && veiculo.id !== linha?.veiculoId;
              return (
                <option key={veiculo.id} value={veiculo.id} disabled={bloqueado}>
                  {veiculo.nome}
                  {impedimento ? ` — ${impedimento.motivo}` : ""}
                </option>
              );
            })}
          </SelectNativo>
          {impedimentoVeiculo && (
            <p className="text-xs text-destructive">{impedimentoVeiculo.motivo}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motoristaId">Motorista</Label>
          <SelectNativo
            id="motoristaId"
            name="motoristaId"
            value={motoristaId}
            disabled={equipeSelecionada.length === 0}
            onChange={(e) => {
              setMotoristaId(e.target.value);
              setAvisoMotorista(null);
            }}
          >
            <option value="">{veiculoId ? "Escolha o motorista..." : "Sem motorista"}</option>
            {/* A lista é restrita à equipe do dia: quem dirige vai no carro. */}
            {equipeSelecionada.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </SelectNativo>
          <p className="text-xs text-muted-foreground">
            {equipeSelecionada.length === 0
              ? "Escolha a equipe primeiro — o motorista sai dela."
              : "Obrigatório quando há veículo."}
          </p>
        </div>
      </div>

      {avisoMotorista && (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
          <AlertTriangle className="size-4 shrink-0" />
          {avisoMotorista}
        </p>
      )}

      {/* --- Responsáveis --------------------------------------------------- */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label>Responsáveis pelo destino</Label>
          <span className="text-xs text-muted-foreground">mínimo 1</span>
        </div>
        <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
          {opcoes.usuarios.map((usuario) => (
            <label
              key={usuario.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
            >
              <Checkbox
                checked={responsavelIds.includes(usuario.id)}
                onCheckedChange={(valor) => alternarResponsavel(usuario.id, Boolean(valor))}
              />
              {usuario.nome}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Responsável é usuário do sistema e recebe o aviso de toda alteração. Sem WhatsApp
          cadastrado, a linha não salva.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Textarea
          id="observacao"
          name="observacao"
          rows={2}
          defaultValue={linha?.observacao ?? ""}
        />
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {linha && <AcoesDaLinha linha={linha} aoConcluir={aoSalvar} />}
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando..." : linha ? "Salvar alteração" : "Salvar rascunho"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Cancelar e excluir são coisas diferentes de propósito.
 *
 * Rascunho nunca foi comunicado a ninguém: pode sumir sem deixar rastro.
 * Publicada, não — quem recebeu o aviso precisa receber o cancelamento, e uma
 * linha apagada não teria como avisar que deixou de existir.
 */
function AcoesDaLinha({
  linha,
  aoConcluir,
}: {
  linha: LinhaEmEdicao;
  aoConcluir: () => void;
}) {
  const [executando, iniciar] = useTransition();

  function cancelar() {
    if (
      !confirm(
        linha.status === "publicada"
          ? "Cancelar esta programação? Quem foi avisado receberá o aviso de cancelamento na próxima publicação."
          : "Cancelar esta programação?"
      )
    ) {
      return;
    }
    iniciar(async () => {
      const resultado = await cancelarProgramacao(linha.id);
      if (resultado.erro) toast.error(resultado.erro);
      else {
        toast.success("Programação cancelada.");
        aoConcluir();
      }
    });
  }

  function excluir() {
    if (!confirm("Excluir este rascunho? Ele nunca foi comunicado a ninguém.")) return;
    iniciar(async () => {
      const resultado = await excluirProgramacao(linha.id);
      if (resultado.erro) toast.error(resultado.erro);
      else {
        toast.success("Rascunho excluído.");
        aoConcluir();
      }
    });
  }

  return (
    <div className="mr-auto flex gap-2">
      {linha.status === "rascunho" ? (
        <Button type="button" variant="outline" size="sm" onClick={excluir} disabled={executando}>
          Excluir rascunho
        </Button>
      ) : null}
      {linha.status !== "cancelada" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={cancelar}
          disabled={executando}
        >
          Cancelar programação
        </Button>
      )}
    </div>
  );
}
