"use client";

import { useActionState, useState } from "react";
import { iniciarConversa, type EstadoIniciar } from "@/app/(app)/pos-venda/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Inicia conversa com quem não escreveu — envio ativo.
 *
 * O aviso de risco fica visível o tempo todo, e não escondido atrás de um
 * tooltip, porque quem usa esta tela não tem como saber que abordar
 * desconhecido é o que derruba o número: essa informação vive na cabeça de
 * quem montou a integração, não na de quem atende.
 */
export function IniciarConversa({
  iniciadasHoje,
  teto,
}: {
  iniciadasHoje: number;
  teto: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, formAction, pendente] = useActionState<EstadoIniciar, FormData>(
    iniciarConversa,
    undefined
  );

  const restantes = Math.max(0, teto - iniciadasHoje);

  if (!aberto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        + Iniciar conversa
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border bg-card p-2">
      <p className="text-xs font-medium">Iniciar conversa com um número novo</p>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
        <strong>Isto é envio ativo.</strong> Escrever para quem não falou com a
        empresa recentemente é o que mais leva ao bloqueio permanente do número
        pela Meta — sem aviso e sem recurso. Use quando houver motivo concreto.
        <br />
        Restam <strong>{restantes}</strong> de {teto} conversas novas hoje.
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="telefone" className="text-xs">
          Telefone com DDD
        </Label>
        <Input id="telefone" name="telefone" placeholder="(84) 99999-0000" className="h-8" />
      </div>

      <Textarea name="texto" rows={3} placeholder="Mensagem" className="resize-none" />

      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="secondary" disabled={pendente || restantes === 0}>
          {pendente ? "Enviando..." : "Enviar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>

      {restantes === 0 && (
        <p className="text-xs text-destructive">
          Teto diário atingido. Ajuste em Parâmetros se for mesmo necessário.
        </p>
      )}
      {estado?.erro && <p className="text-xs text-destructive">{estado.erro}</p>}
    </form>
  );
}
