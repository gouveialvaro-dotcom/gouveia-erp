"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { criarChamado, type EstadoFormChamado } from "@/app/(app)/pos-venda/actions";
import { formatarData } from "@/lib/format";
import { ROTULO_PRIORIDADE, hojeIso, somarDias } from "@/lib/pos-venda";
import { impedimentoDeAbertura, vigenciaManutencao, type RamoCliente } from "@/lib/clientes";
import { Button } from "@/components/ui/button";
import { ComboboxCampo } from "@/components/ui/combobox-campo";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Textarea } from "@/components/ui/textarea";

export type TipoProblemaOpcao = {
  id: string;
  nome: string;
  prazoDias: number;
};

export type UnidadeOpcao = { id: string; clienteId: string; rotulo: string };
export type ObraOpcao = { id: string; clienteId: string; rotulo: string };

/** Usuário elegível a dono do chamado. O perfil vem junto para desempatar
 *  homônimos na busca. */
export type ResponsavelOpcao = { id: string; nome: string; perfil: string };

export type ClienteOpcao = {
  id: string;
  nome: string;
  ramo: RamoCliente;
  manutencaoInicio: string | null;
  manutencaoFim: string | null;
};

export function ChamadoCriarForm({
  clientes,
  unidades,
  obras,
  tipos,
  responsaveis,
}: {
  clientes: ClienteOpcao[];
  unidades: UnidadeOpcao[];
  obras: ObraOpcao[];
  tipos: TipoProblemaOpcao[];
  responsaveis: ResponsavelOpcao[];
}) {
  const [estado, formAction, pendente] = useActionState<EstadoFormChamado, FormData>(
    criarChamado,
    undefined
  );

  const [clienteId, setClienteId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [abertoEm, setAbertoEm] = useState(hojeIso());
  // Sem valor padrão: escolher o dono é decisão consciente de quem abre. Um
  // padrão pré-preenchido faria todo chamado nascer no nome de quem digitou.
  const [responsavelId, setResponsavelId] = useState("");

  // UC e obra só fazem sentido dentro do cliente escolhido — a base do
  // pós-venda é a mesma dos clientes já cadastrados.
  const unidadesDoCliente = unidades.filter((u) => u.clienteId === clienteId);
  const obrasDoCliente = obras.filter((o) => o.clienteId === clienteId);
  const tipo = tipos.find((t) => t.id === tipoId);

  // O chamado só pode ser aberto dentro do contrato de manutenção do cliente,
  // conferido na data de abertura escolhida. A mesma regra roda na server
  // action — aqui é para avisar antes de o atendente digitar o chamado inteiro.
  const cliente = clientes.find((c) => c.id === clienteId);
  const impedimento = cliente ? impedimentoDeAbertura(cliente, abertoEm) : null;
  const vigencia = cliente ? vigenciaManutencao(cliente) : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="clienteId">Cliente</Label>
          <ComboboxCampo
            id="clienteId"
            name="clienteId"
            itens={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Buscar cliente..."
            textoVazio="Nenhum cliente encontrado."
            aoSelecionar={(opcao) => setClienteId(opcao?.value ?? "")}
          />
          {cliente && !impedimento && vigencia && (
            <p className="text-xs text-muted-foreground">
              Plano de manutenção ativo · vigência {vigencia}
            </p>
          )}
        </div>

        {impedimento && (
          <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <strong>{impedimento}</strong>
            <span className="block mt-1 text-muted-foreground">
              Ajuste o período do contrato no{" "}
              <Link href={`/cadastros/clientes/${clienteId}`} className="underline">
                cadastro do cliente
              </Link>{" "}
              ou escolha uma data de abertura dentro da vigência.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unidadeConsumidoraId">Unidade consumidora</Label>
          {/* Remonta ao trocar de cliente para não manter selecionada uma UC
              que deixou de pertencer à lista. */}
          <SelectNativo
            key={clienteId}
            id="unidadeConsumidoraId"
            name="unidadeConsumidoraId"
            disabled={!clienteId}
          >
            <option value="">
              {!clienteId
                ? "Escolha o cliente primeiro"
                : unidadesDoCliente.length === 0
                  ? "Cliente sem UC cadastrada"
                  : "Sem UC específica"}
            </option>
            {unidadesDoCliente.map((u) => (
              <option key={u.id} value={u.id}>
                {u.rotulo}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obraId">Obra de origem</Label>
          <SelectNativo key={`obra-${clienteId}`} id="obraId" name="obraId" disabled={!clienteId}>
            <option value="">
              {!clienteId
                ? "Escolha o cliente primeiro"
                : obrasDoCliente.length === 0
                  ? "Cliente sem obra registrada"
                  : "Sem obra vinculada"}
            </option>
            {obrasDoCliente.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="tipoProblemaId">Tipo de problema</Label>
          <SelectNativo
            id="tipoProblemaId"
            name="tipoProblemaId"
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
          >
            <option value="">Selecione o tipo</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} ({t.prazoDias}d)
              </option>
            ))}
          </SelectNativo>
          {tipo && (
            <p className="text-xs text-muted-foreground">
              SLA de {tipo.prazoDias} dias corridos — vence em{" "}
              <strong>{formatarData(somarDias(abertoEm, tipo.prazoDias))}</strong>
            </p>
          )}
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="responsavelId">
            Responsável <span className="text-destructive">*</span>
          </Label>
          <ComboboxCampo
            id="responsavelId"
            name="responsavelId"
            itens={responsaveis.map((r) => ({
              value: r.id,
              label: `${r.nome} · ${r.perfil}`,
            }))}
            placeholder="Buscar responsável..."
            textoVazio="Nenhum usuário elegível encontrado."
            aoSelecionar={(opcao) => setResponsavelId(opcao?.value ?? "")}
          />
          <p className="text-xs text-muted-foreground">
            O chamado nasce com dono, e é essa pessoa que recebe o aviso de abertura.
          </p>
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            name="titulo"
            placeholder="Ex.: Fatura de julho cobrada sem o abatimento dos créditos"
            required
          />
        </div>

        <div className="sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            name="descricao"
            rows={3}
            placeholder="O que o cliente relatou, o que já foi verificado..."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prioridade">Prioridade</Label>
          <SelectNativo id="prioridade" name="prioridade" defaultValue="media">
            {Object.entries(ROTULO_PRIORIDADE).map(([valor, { texto }]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </SelectNativo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="abertoEm">Data de abertura</Label>
          <CampoData
            id="abertoEm"
            name="abertoEm"
            value={abertoEm}
            aoMudar={setAbertoEm}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="protocoloConcessionaria">Protocolo da concessionária</Label>
          <Input
            id="protocoloConcessionaria"
            name="protocoloConcessionaria"
            placeholder="Opcional"
          />
        </div>
      </div>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <div>
        <Button
          type="submit"
          disabled={
            pendente || tipos.length === 0 || !responsavelId || Boolean(impedimento)
          }
        >
          {pendente ? "Abrindo..." : "Abrir chamado"}
        </Button>
      </div>
    </form>
  );
}
