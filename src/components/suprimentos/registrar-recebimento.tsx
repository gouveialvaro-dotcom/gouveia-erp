"use client";

import { startTransition, useActionState, useState } from "react";
import { CheckCheck } from "lucide-react";
import {
  registrarRecebimento,
  type EstadoRecebimento,
} from "@/app/(app)/suprimentos/pedidos/actions";
import { numeroBr } from "@/lib/suprimentos-cotacao";
import { cn } from "@/lib/utils";
import { SeletorFotos, type FotoLocal } from "@/components/suprimentos/seletor-fotos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Registro na obra, pensado para o celular. Para cada item: quanto chegou e
// foi aceito, e quanto voltou com o fornecedor (avaria, item errado). O que
// não chegou continua pendente para uma próxima entrega, a não ser que o
// pedido seja encerrado. Foto só é obrigatória quando há problema. Quem
// recebe é o usuário logado.

export type ItemParaReceber = {
  id: string;
  ordem: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  /** Já aceito em entregas anteriores. */
  recebida: number;
};

const FOTOS_MAX = 8;
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function RegistrarRecebimento({
  pedidoId,
  itens,
  nomeUsuario,
}: {
  pedidoId: string;
  itens: ItemParaReceber[];
  nomeUsuario: string;
}) {
  const [estado, acao, pendente] = useActionState<EstadoRecebimento, FormData>(registrarRecebimento, undefined);
  const pendentes = itens.filter((i) => i.quantidade - i.recebida > 0);
  const [aceitos, setAceitos] = useState<Record<string, string>>({});
  const [devolvidos, setDevolvidos] = useState<Record<string, string>>({});
  const [avaria, setAvaria] = useState(false);
  const [encerrar, setEncerrar] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);

  const linhas = pendentes.map((i) => {
    const saldo = i.quantidade - i.recebida;
    const recebida = numeroBr(aceitos[i.id] ?? "") ?? 0;
    const devolvida = numeroBr(devolvidos[i.id] ?? "") ?? 0;
    return { item: i, saldo, recebida, devolvida, excede: recebida + devolvida > saldo + 1e-9 };
  });
  const algumaQuantidade = linhas.some((l) => l.recebida > 0 || l.devolvida > 0);
  const devolveu = linhas.some((l) => l.devolvida > 0);
  const comProblema = avaria || devolveu;
  const faltaraAlgo = linhas.some((l) => l.recebida < l.saldo);
  const precisaTexto = comProblema || encerrar;

  function chegouTudo() {
    setAceitos(Object.fromEntries(pendentes.map((i) => [i.id, qtd(i.quantidade - i.recebida)])));
    setDevolvidos({});
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData();
    dados.set("pedidoId", pedidoId);
    dados.set(
      "itens",
      JSON.stringify(linhas.map((l) => ({ item: l.item.id, recebida: l.recebida, devolvida: l.devolvida })))
    );
    if (avaria) dados.set("avaria", "on");
    if (encerrar && faltaraAlgo) dados.set("encerrar", "on");
    dados.set("observacao", observacao);
    for (const f of fotos) dados.append("fotos", f.arquivo);
    startTransition(() => acao(dados));
  }

  if (estado?.ok) {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
        Recebimento registrado
        {estado.situacao === "parcial" ? " (parcial — o restante continua pendente)" : ""}. O requisitante e o
        comprador foram avisados.
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-md border-2 border-primary/40 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Registrar recebimento</h3>
          <p className="text-xs text-muted-foreground">
            Informe quanto chegou de cada item. O que faltar continua pendente.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={chegouTudo}>
          <CheckCheck className="h-4 w-4" /> Chegou tudo
        </Button>
      </div>

      <div className="flex flex-col divide-y rounded-md border">
        {linhas.map(({ item, saldo, recebida, devolvida, excede }) => (
          <div key={item.id} className="flex flex-col gap-2 p-3">
            <div className="text-sm">
              <span className="mr-1 text-muted-foreground">{item.ordem}.</span>
              <span className="font-medium">{item.descricao}</span>
              <span className="block text-xs text-muted-foreground">
                Pedido {qtd(item.quantidade)} {item.unidade}
                {item.recebida > 0 ? ` · já recebido ${qtd(item.recebida)}` : ""} · falta {qtd(saldo)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`aceito-${item.id}`} className="text-xs">
                  Chegou e aceito ({item.unidade})
                </Label>
                <Input
                  id={`aceito-${item.id}`}
                  inputMode="decimal"
                  placeholder="0"
                  value={aceitos[item.id] ?? ""}
                  onChange={(e) => setAceitos((a) => ({ ...a, [item.id]: e.target.value }))}
                  className={cn("h-11 text-base", excede && "border-destructive")}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`devolvido-${item.id}`} className="text-xs">
                  Devolvido ({item.unidade})
                </Label>
                <Input
                  id={`devolvido-${item.id}`}
                  inputMode="decimal"
                  placeholder="0"
                  value={devolvidos[item.id] ?? ""}
                  onChange={(e) => setDevolvidos((d) => ({ ...d, [item.id]: e.target.value }))}
                  className={cn("h-11 text-base", excede && "border-destructive")}
                />
              </div>
            </div>
            {excede && (
              <span className="text-xs text-destructive">
                Aceito + devolvido passa do que falta ({qtd(saldo)}).
              </span>
            )}
            {!excede && recebida > 0 && recebida < saldo && devolvida === 0 && (
              <span className="text-xs text-muted-foreground">Parcial: faltarão {qtd(saldo - recebida)}.</span>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={avaria} onCheckedChange={(v) => setAvaria(Boolean(v))} />
        Chegou com avaria ou outro problema
      </label>
      {faltaraAlgo && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={encerrar} onCheckedChange={(v) => setEncerrar(Boolean(v))} />
          <span>
            Encerrar o pedido com o que chegou
            <span className="block text-xs text-muted-foreground">
              Marque só se o restante não vai mais ser entregue.
            </span>
          </span>
        </label>
      )}

      {precisaTexto && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="observacao">O que aconteceu?</Label>
          <Textarea
            id="observacao"
            rows={3}
            required
            placeholder="Ex.: 2 sacos rasgados, devolvidos ao motorista; o restante do cabo não virá"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>
          Fotos ({fotos.length}/{FOTOS_MAX}){" "}
          <span className={cn("font-normal", comProblema ? "text-destructive" : "text-muted-foreground")}>
            {comProblema ? "— obrigatória: fotografe a avaria ou o material devolvido" : "— opcional"}
          </span>
        </Label>
        <SeletorFotos fotos={fotos} aoMudar={setFotos} maximo={FOTOS_MAX} rotulo="Foto do recebimento" />
      </div>

      <p className="text-xs text-muted-foreground">
        Recebido por <span className="font-medium text-foreground">{nomeUsuario}</span> (usuário logado).
      </p>

      {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

      <Button
        type="submit"
        size="lg"
        disabled={
          pendente ||
          linhas.some((l) => l.excede) ||
          (!algumaQuantidade && !encerrar) ||
          (comProblema && fotos.length === 0)
        }
      >
        {pendente ? "Registrando..." : "Registrar recebimento"}
      </Button>
    </form>
  );
}
