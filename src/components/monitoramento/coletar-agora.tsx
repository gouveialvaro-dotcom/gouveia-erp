"use client";

import { useState, useTransition } from "react";
import { coletarAgora } from "@/app/(app)/monitoramento/cadastro/actions";
import type { ResultadoColeta } from "@/lib/monitoramento-coleta";
import { JANELAS, ROTULO_JANELA, type JanelaColetaUsina } from "@/lib/monitoramento";
import { Button } from "@/components/ui/button";
import { SelectNativo } from "@/components/ui/select-nativo";

/**
 * Dispara uma janela de coleta na hora.
 *
 * Existe porque o cron roda três vezes ao dia e ninguém vai esperar até as 18h
 * para saber se o vínculo que acabou de fazer traz número. É a MESMA função do
 * agendamento, e o upsert por (usina, dataRef, janela) faz as duas convergirem
 * para a mesma linha — clicar aqui não cria leitura duplicada.
 */
export function ColetarAgora({ janelaSugerida }: { janelaSugerida: JanelaColetaUsina }) {
  const [janela, setJanela] = useState<JanelaColetaUsina>(janelaSugerida);
  const [resultado, setResultado] = useState<ResultadoColeta | null>(null);
  const [rodando, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SelectNativo
          className="w-44"
          value={janela}
          onChange={(e) => setJanela(e.target.value as JanelaColetaUsina)}
          aria-label="Janela de coleta"
        >
          {JANELAS.map((j) => (
            <option key={j} value={j}>
              {ROTULO_JANELA[j]}
            </option>
          ))}
        </SelectNativo>
        <Button
          type="button"
          size="sm"
          disabled={rodando}
          onClick={() =>
            iniciar(async () => {
              const dados = new FormData();
              dados.set("janela", janela);
              setResultado(await coletarAgora(dados));
            })
          }
        >
          {rodando ? "Coletando..." : "Coletar agora"}
        </Button>
      </div>

      {resultado && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {resultado.erro ? (
            // FALHA DE COLETA, e a tela diz isso com todas as letras: nenhuma
            // leitura foi gravada e nenhuma usina está em falha por causa disso.
            <p className="text-destructive">
              Falha de coleta (nenhuma leitura gravada, nenhuma usina em falha por isso):{" "}
              {resultado.erro}
            </p>
          ) : (
            <p>
              {resultado.gravadas} leitura(s) gravada(s) de {resultado.elegiveis} usina(s)
              elegível(is), janela {ROTULO_JANELA[resultado.janela]} de {resultado.dataRef}.
              {resultado.inativadas > 0 &&
                ` ${resultado.inativadas} usina(s) saíram do monitoramento por plano vencido.`}
            </p>
          )}
          {resultado.semRetorno.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              Cadastradas aqui e ausentes na conta do iSolarCloud (ps_id):{" "}
              {resultado.semRetorno.join(", ")}. Isso é problema de cadastro, não usina parada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
