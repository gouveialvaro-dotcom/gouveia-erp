"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus, Trash2, Siren, X } from "lucide-react";
import {
  criarRequisicao,
  type EstadoFormRequisicao,
} from "@/app/(app)/suprimentos/requisicoes/actions";
import {
  DIAS_PRAZO_PADRAO,
  ITENS_POR_REQUISICAO_MAX,
  somarDiasIso,
  type UrgenciaRequisicao,
} from "@/lib/suprimentos";
import { cn } from "@/lib/utils";
import type { ProdutoEncontrado } from "@/lib/suprimentos-catalogo";
import { BuscaProduto } from "@/components/suprimentos/busca-produto";
import { SeletorFotos, type FotoLocal } from "@/components/suprimentos/seletor-fotos";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { Textarea } from "@/components/ui/textarea";

type Item = {
  chave: number;
  /** Produto do catálogo escolhido (o padrão). */
  produto: ProdutoEncontrado | null;
  /** Marcado quando o requisitante não achou no catálogo: vale o texto livre. */
  foraCatalogo: boolean;
  descricao: string;
  quantidade: string;
  unidade: string;
  especificacao: string;
  /** Fotos do material, para o comprador identificar (já reduzidas). */
  fotos: FotoLocal[];
};

/** Até 3 fotos por item: com ~300 KB cada, 20 itens cabem no limite de envio. */
const FOTOS_POR_ITEM = 3;

export type OpcaoCentroCusto = { id: string; nome: string; codigo: string | null };

let proximaChave = 1;
const itemVazio = (unidade: string): Item => ({
  chave: proximaChave++,
  produto: null,
  foraCatalogo: false,
  descricao: "",
  quantidade: "",
  unidade,
  especificacao: "",
  fotos: [],
});

export type OpcaoUnidade = { sigla: string; nome: string };

export function RequisicaoForm({
  centros,
  unidades,
  hoje,
}: {
  /** Centros de custo ativos do cadastro. */
  centros: OpcaoCentroCusto[];
  /** Unidades ativas do cadastro (Cadastros → Unidades de medida), na ordem. */
  unidades: OpcaoUnidade[];
  /** "Hoje" calculado no servidor no fuso de Natal. */
  hoje: string;
}) {
  const [estado, acao, pendente] = useActionState<EstadoFormRequisicao, FormData>(
    criarRequisicao,
    undefined
  );
  const [urgencia, setUrgencia] = useState<UrgenciaRequisicao>("normal");
  const [prazo, setPrazo] = useState(somarDiasIso(hoje, DIAS_PRAZO_PADRAO.normal));
  const [prazoEditado, setPrazoEditado] = useState(false);
  const unidadePadrao = unidades[0]?.sigla ?? "UN";
  const [itens, setItens] = useState<Item[]>(() => [itemVazio(unidadePadrao)]);
  // Controlados: o React limpa campos não controlados depois da action, e um
  // erro de validação apagaria a obra e as observações já preenchidas.
  const [centroCusto, setCentroCusto] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function escolherUrgencia(nova: UrgenciaRequisicao) {
    setUrgencia(nova);
    // O prazo acompanha a urgência até a pessoa mexer nele.
    if (!prazoEditado) setPrazo(somarDiasIso(hoje, DIAS_PRAZO_PADRAO[nova]));
  }

  function alterarItem(chave: number, mudanca: Partial<Omit<Item, "chave">>) {
    setItens((atual) => atual.map((i) => (i.chave === chave ? { ...i, ...mudanca } : i)));
  }

  const [erroLocal, setErroLocal] = useState<string | null>(null);

  // Item "preenchido" = tem produto, texto ou quantidade. Os vazios no fim da
  // lista são ignorados.
  const itensPreenchidos = itens.filter(
    (i) => (i.foraCatalogo ? i.descricao.trim() !== "" : i.produto !== null) || i.quantidade.trim() !== ""
  );

  const itensJson = JSON.stringify(
    itensPreenchidos.map((i) => ({
      produtoId: !i.foraCatalogo && i.produto ? i.produto.id : undefined,
      descricao: !i.foraCatalogo && i.produto ? i.produto.descricao : i.descricao,
      quantidade: i.quantidade.replace(",", "."),
      unidade: i.unidade,
      especificacao: i.especificacao || undefined,
    }))
  );

  return (
    <form
      // Envio manual, e não action={acao}: com action o React limpa o form
      // depois de um erro de validação, e o <select> da obra volta para
      // "Selecione" mesmo controlado (o estado não muda, então não redesenha).
      onSubmit={(evento) => {
        evento.preventDefault();
        // Item no modo catálogo sem produto escolhido: avisa aqui, com o número
        // do item, em vez de o servidor responder "Descreva cada item".
        const semProduto = itens.findIndex(
          (i) => itensPreenchidos.includes(i) && !i.foraCatalogo && !i.produto
        );
        if (semProduto >= 0) {
          setErroLocal(
            `Escolha o produto do item ${semProduto + 1} no catálogo, ou marque que não encontrou.`
          );
          return;
        }
        setErroLocal(null);
        const dados = new FormData(evento.currentTarget);
        // Fotos vão junto, com o índice do item na lista enviada.
        itensPreenchidos.forEach((item, indice) => {
          for (const foto of item.fotos) dados.append(`foto-${indice}`, foto.arquivo);
        });
        startTransition(() => acao(dados));
      }}
      className="flex flex-col gap-6 max-w-3xl"
    >
      <input type="hidden" name="itens" value={itensJson} />
      <input type="hidden" name="urgencia" value={urgencia} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="centroCusto">Centro de custo</Label>
          <SelectNativo
            id="centroCusto"
            name="centroCusto"
            value={centroCusto}
            onChange={(e) => setCentroCusto(e.target.value)}
            required
            className="h-10"
          >
            <option value="" disabled>
              Selecione o centro de custo
            </option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo ? `${c.codigo} · ${c.nome}` : c.nome}
              </option>
            ))}
          </SelectNativo>
          <span className="text-xs text-muted-foreground">
            Não achou? Os centros de custo são mantidos em Cadastros → Centros de custo.
          </span>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Urgência</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => escolherUrgencia("normal")}
              className={cn(
                "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                urgencia === "normal" ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"
              )}
            >
              Normal
              <span className="block text-xs font-normal text-muted-foreground">Prazo padrão (~2 dias)</span>
            </button>
            <button
              type="button"
              onClick={() => escolherUrgencia("emergencial")}
              className={cn(
                "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                urgencia === "emergencial"
                  ? "border-destructive bg-destructive/10 font-medium text-destructive"
                  : "hover:bg-muted"
              )}
            >
              <span className="flex items-center gap-1.5">
                <Siren className="h-4 w-4" /> Emergencial
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                Paralisa o canteiro
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prazoDesejado">Entregar até</Label>
          <CampoData
            id="prazoDesejado"
            name="prazoDesejado"
            value={prazo}
            aoMudar={(iso) => {
              setPrazo(iso);
              setPrazoEditado(true);
            }}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Itens ({itens.length})</h3>
          <p className="text-xs text-muted-foreground">
            Busque no catálogo. Não achou? Marque a caixa e descreva.
          </p>
        </div>

        {itens.map((item, indice) => (
          <div key={item.chave} className="rounded-lg border bg-card p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Item {indice + 1}</span>
              {itens.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover item ${indice + 1}`}
                  onClick={() => setItens((atual) => atual.filter((i) => i.chave !== item.chave))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {item.foraCatalogo ? (
              <Input
                aria-label={`Descrição do item ${indice + 1}`}
                placeholder="Descreva o material, peça ou serviço"
                value={item.descricao}
                onChange={(e) => alterarItem(item.chave, { descricao: e.target.value })}
                className="h-10"
              />
            ) : item.produto ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-sm font-medium">{item.produto.descricao}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Trocar o produto do item ${indice + 1}`}
                  title="Trocar produto"
                  onClick={() => alterarItem(item.chave, { produto: null })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <BuscaProduto
                rotulo={`Produto do item ${indice + 1}`}
                aoEscolher={(produto) =>
                  alterarItem(item.chave, { produto, unidade: produto.unidade.toUpperCase() })
                }
              />
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={item.foraCatalogo}
                onCheckedChange={(marcado) =>
                  alterarItem(item.chave, {
                    foraCatalogo: Boolean(marcado),
                    // Ao abrir o texto livre, já leva o nome do produto escolhido.
                    descricao: marcado && item.produto && !item.descricao ? item.produto.descricao : item.descricao,
                    produto: marcado ? null : item.produto,
                  })
                }
              />
              Não encontrei no catálogo — descrever com minhas palavras
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label={`Quantidade do item ${indice + 1}`}
                placeholder="Quantidade"
                inputMode="decimal"
                value={item.quantidade}
                onChange={(e) => alterarItem(item.chave, { quantidade: e.target.value })}
                className="h-10"
              />
              <SelectNativo
                aria-label={`Unidade do item ${indice + 1}`}
                value={item.unidade}
                onChange={(e) => alterarItem(item.chave, { unidade: e.target.value })}
                className="h-10"
              >
                {unidades.map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.nome}
                  </option>
                ))}
                {/* Unidade do catálogo fora da lista (ex.: produto antigo em PC). */}
                {!unidades.some((u) => u.sigla === item.unidade) && (
                  <option value={item.unidade}>{item.unidade}</option>
                )}
              </SelectNativo>
            </div>
            <Textarea
              aria-label={`Especificações do item ${indice + 1}`}
              placeholder="Especificações técnicas / observações (opcional)"
              value={item.especificacao}
              onChange={(e) => alterarItem(item.chave, { especificacao: e.target.value })}
              rows={2}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Fotos do material (opcional, até {FOTOS_POR_ITEM}) — ajudam o comprador a achar o item certo
              </span>
              <SeletorFotos
                fotos={item.fotos}
                aoMudar={(fotos) => alterarItem(item.chave, { fotos })}
                maximo={FOTOS_POR_ITEM}
                rotulo={`Foto do item ${indice + 1}`}
              />
            </div>
          </div>
        ))}

        {itens.length < ITENS_POR_REQUISICAO_MAX && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setItens((atual) => [...atual, itemVazio(unidadePadrao)])}
            className="self-start"
          >
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observacoes">Observações gerais (opcional)</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      {(erroLocal ?? estado?.erro) && (
        <p className="text-sm text-destructive">{erroLocal ?? estado?.erro}</p>
      )}

      <div>
        <Button type="submit" disabled={pendente} size="lg">
          {pendente ? "Enviando..." : "Enviar requisição"}
        </Button>
      </div>
    </form>
  );
}
