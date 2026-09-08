"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  buscarPlantasNoIsolar,
  testarConexaoIsolar,
  vincularUsina,
  type EstadoBusca,
  type EstadoFormUsina,
  type PlantaEncontrada,
} from "@/app/(app)/monitoramento/cadastro/actions";
import { impedimentoDeVinculo } from "@/lib/monitoramento";
import type { RamoCliente } from "@/lib/clientes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";

export type ClienteOpcao = {
  id: string;
  razaoSocial: string;
  ramo: RamoCliente;
  manutencaoInicio: string | null;
  manutencaoFim: string | null;
};

export type UnidadeOpcao = {
  id: string;
  clienteId: string;
  numero: string;
  apelido: string | null;
  tipo: "geradora" | "beneficiaria";
  ativo: boolean;
};

export function VincularUsinaForm({
  clientes,
  unidades,
  integracaoConfigurada,
}: {
  clientes: ClienteOpcao[];
  unidades: UnidadeOpcao[];
  integracaoConfigurada: boolean;
}) {
  const [busca, setBusca] = useState<EstadoBusca>(undefined);
  const [planta, setPlanta] = useState<PlantaEncontrada | null>(null);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();

  const naoVinculadas = busca?.plantas?.filter((p) => !p.vinculada) ?? [];
  const jaVinculadas = busca?.plantas?.filter((p) => p.vinculada) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={carregando || !integracaoConfigurada}
            onClick={() =>
              iniciar(async () => {
                setDiagnostico(null);
                setBusca(await buscarPlantasNoIsolar());
              })
            }
          >
            {carregando ? "Buscando..." : "Buscar usinas no iSolarCloud"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={carregando}
            onClick={() =>
              iniciar(async () => {
                const d = await testarConexaoIsolar();
                setDiagnostico(
                  d.erro
                    ? `Falhou em ${d.baseUrl}: ${d.erro}`
                    : `Conexão ok em ${d.baseUrl}. ${d.usinasEncontradas} planta(s) visíveis na conta.`
                );
              })
            }
          >
            Testar conexão
          </Button>
        </div>

        {/* A mensagem antiga dizia "preencha o .env" e mandava procurar no lugar
            errado: o caso real foi o arquivo já preenchido e o processo do
            servidor rodando desde antes, sem nunca ter lido as variáveis. O
            texto agora cobre as duas causas, e o "Testar conexão" ao lado
            distingue uma da outra — ele é Server Action e sempre roda no
            servidor, sem passar por cache de página. */}
        {!integracaoConfigurada && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
            O servidor não está enxergando as credenciais do iSolarCloud
            (<code>ISOLARCLOUD_BASE_URL</code>, <code>ISOLARCLOUD_APP_KEY</code>,{" "}
            <code>ISOLARCLOUD_ACCESS_KEY</code>, <code>ISOLARCLOUD_USUARIO</code>,{" "}
            <code>ISOLARCLOUD_SENHA</code>). Ou elas não estão preenchidas, ou{" "}
            <strong>foram preenchidas depois de o servidor subir</strong> — as variáveis são lidas
            só na inicialização, então em desenvolvimento é preciso reiniciar o{" "}
            <code>next dev</code> e, na Vercel, refazer o deploy depois de cadastrá-las. Clique em{" "}
            <strong>Testar conexão</strong> para ver o que o servidor responde agora. Enquanto
            isso, a usina pode ser cadastrada à mão abaixo.
          </p>
        )}

        {diagnostico && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{diagnostico}</p>
        )}

        {busca?.erro && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {busca.erro}
          </p>
        )}

        {busca?.plantas && (
          <div className="flex flex-col gap-4">
            <ListaDePlantas
              titulo="Sem vínculo — ainda não monitoradas"
              vazio="Todas as plantas da conta já estão vinculadas."
              plantas={naoVinculadas}
              escolhida={planta}
              aoEscolher={setPlanta}
            />
            <ListaDePlantas
              titulo="Já vinculadas"
              vazio="Nenhuma planta vinculada ainda."
              plantas={jaVinculadas}
              escolhida={null}
              aoEscolher={null}
            />
          </div>
        )}
      </section>

      <Formulario
        clientes={clientes}
        unidades={unidades}
        planta={planta}
        aoVincular={() => setPlanta(null)}
      />
    </div>
  );
}

function ListaDePlantas({
  titulo,
  vazio,
  plantas,
  escolhida,
  aoEscolher,
}: {
  titulo: string;
  vazio: string;
  plantas: PlantaEncontrada[];
  escolhida: PlantaEncontrada | null;
  aoEscolher: ((planta: PlantaEncontrada) => void) | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">
        {titulo} <span className="text-muted-foreground">({plantas.length})</span>
      </h3>
      {plantas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {plantas.map((planta) => (
            <li
              key={planta.psId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{planta.nome}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{planta.psId}</span>
                {planta.potenciaKwp !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {planta.potenciaKwp.toLocaleString("pt-BR")} kWp
                  </span>
                )}
                {planta.energiaDiaKwh !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    hoje {planta.energiaDiaKwh.toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    kWh
                  </span>
                )}
                {planta.clienteVinculado && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    → {planta.clienteVinculado}
                  </span>
                )}
                <span className="ml-2 inline-flex gap-1 align-middle">
                  {!planta.comunicando && <Badge variant="outline">sem comunicação</Badge>}
                  {planta.emFalha && <Badge variant="destructive">acusa falha</Badge>}
                </span>
              </div>
              {aoEscolher ? (
                <Button
                  type="button"
                  variant={escolhida?.psId === planta.psId ? "default" : "outline"}
                  size="sm"
                  onClick={() => aoEscolher(planta)}
                >
                  {escolhida?.psId === planta.psId ? "Selecionada" : "Vincular"}
                </Button>
              ) : (
                <Badge variant="secondary">monitorando</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Formulario({
  clientes,
  unidades,
  planta,
  aoVincular,
}: {
  clientes: ClienteOpcao[];
  unidades: UnidadeOpcao[];
  planta: PlantaEncontrada | null;
  aoVincular: () => void;
}) {
  const [estado, formAction, pendente] = useActionState<EstadoFormUsina, FormData>(
    async (anterior, dados) => {
      const resultado = await vincularUsina(anterior, dados);
      if (resultado?.ok) aoVincular();
      return resultado;
    },
    undefined
  );
  const [clienteId, setClienteId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  // Só as geradoras do cliente escolhido: é a UC geradora que tem a usina.
  const geradoras = useMemo(
    () => unidades.filter((u) => u.clienteId === clienteId && u.tipo === "geradora" && u.ativo),
    [unidades, clienteId]
  );

  const unidade = geradoras.find((u) => u.id === unidadeId) ?? null;

  // MESMA função do servidor: aqui avisa antes de enviar, lá bloqueia de fato.
  const impedimento = cliente && unidade ? impedimentoDeVinculo(cliente, unidade) : null;
  // Sem UC escolhida ainda não dá para avaliar o par, mas o plano do cliente já
  // dá — e é o motivo mais comum de recusa.
  const impedimentoDoCliente =
    cliente && !unidade
      ? impedimentoDeVinculo(cliente, { clienteId: cliente.id, tipo: "geradora", ativo: true })
      : null;

  const aviso = impedimento ?? impedimentoDoCliente;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {/* key força os campos a se recarregarem quando outra planta é escolhida:
          com defaultValue e sem key, o React mantém o valor digitado antes e a
          tela mostraria a planta nova com o ps_id da anterior. */}
      <div className="flex flex-col gap-1.5" key={planta?.psId ?? "manual"}>
        <Label htmlFor="psId">Identificador da planta (ps_id)</Label>
        <Input
          id="psId"
          name="psId"
          required
          autoComplete="off"
          defaultValue={planta?.psId ?? ""}
          readOnly={planta !== null}
        />
        <p className="text-xs text-muted-foreground">
          {planta
            ? "Preenchido pela busca no iSolarCloud."
            : "Como aparece no iSolarCloud. Use a busca acima para não digitar à mão."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5" key={`nome-${planta?.psId ?? "manual"}`}>
        <Label htmlFor="nomeIsolar">Nome da planta no iSolarCloud</Label>
        <Input
          id="nomeIsolar"
          name="nomeIsolar"
          required
          autoComplete="off"
          defaultValue={planta?.nome ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apelido">Apelido interno (opcional)</Label>
        <Input id="apelido" name="apelido" autoComplete="off" />
        <p className="text-xs text-muted-foreground">
          Manda sobre o nome da API na tela. Útil quando a planta foi cadastrada pelo integrador
          com um código sem sentido.
        </p>
      </div>

      <div className="flex flex-col gap-1.5" key={`pot-${planta?.psId ?? "manual"}`}>
        <Label htmlFor="potenciaIsolarKwp">Potência informada pela API (kWp, opcional)</Label>
        <Input
          id="potenciaIsolarKwp"
          name="potenciaIsolarKwp"
          type="number"
          step="0.01"
          min="0"
          autoComplete="off"
          defaultValue={planta?.potenciaKwp ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          A potência oficial continua sendo a do cadastro da unidade consumidora. Esta serve para
          a tela mostrar quando as duas divergem.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clienteId">Cliente</Label>
        <SelectNativo
          id="clienteId"
          name="clienteId"
          required
          value={clienteId}
          onChange={(e) => {
            setClienteId(e.target.value);
            setUnidadeId("");
          }}
        >
          <option value="">Selecione…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razaoSocial}
            </option>
          ))}
        </SelectNativo>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unidadeConsumidoraId">Unidade geradora</Label>
        <SelectNativo
          id="unidadeConsumidoraId"
          name="unidadeConsumidoraId"
          required
          value={unidadeId}
          onChange={(e) => setUnidadeId(e.target.value)}
          disabled={!clienteId}
        >
          <option value="">{clienteId ? "Selecione…" : "Escolha o cliente antes"}</option>
          {geradoras.map((u) => (
            <option key={u.id} value={u.id}>
              {u.apelido?.trim() || u.numero}
            </option>
          ))}
        </SelectNativo>
        {clienteId && geradoras.length === 0 && (
          <p className="text-xs text-destructive">
            Este cliente não tem unidade geradora ativa cadastrada.
          </p>
        )}
      </div>

      {aviso && (
        <p className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {aviso}
        </p>
      )}

      {estado?.erro && <p className="sm:col-span-2 text-sm text-destructive">{estado.erro}</p>}
      {estado?.ok && (
        <p className="sm:col-span-2 text-sm text-muted-foreground">Usina vinculada.</p>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendente || aviso !== null}>
          {pendente ? "Vinculando..." : "Vincular usina"}
        </Button>
      </div>
    </form>
  );
}
