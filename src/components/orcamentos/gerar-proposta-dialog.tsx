"use client";

import { useActionState, useEffect, useState } from "react";
import { gerarProposta, type EstadoGerarProposta } from "@/app/(app)/orcamentos/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GerarPropostaDialog({
  orcamentoId,
  modeloPadrao,
}: {
  orcamentoId: string;
  modeloPadrao: "usina_solar" | "redes";
}) {
  const [aberto, setAberto] = useState(false);
  const gerarComId = gerarProposta.bind(null, orcamentoId);
  const [estado, formAction, pendente] = useActionState<EstadoGerarProposta, FormData>(
    gerarComId,
    undefined
  );

  // Fecha o diálogo assim que a geração retorna com sucesso. Ajustar o estado
  // durante o render (e não dentro do efeito) evita o render em cascata.
  const [estadoTratado, setEstadoTratado] = useState(estado);
  if (estado !== estadoTratado) {
    setEstadoTratado(estado);
    if (estado?.url) setAberto(false);
  }

  // Navegação na mesma aba de propósito: window.open() é barrado pelo bloqueador
  // de pop-ups, já que a URL só chega depois da server action e não parte de um
  // gesto do usuário. No formato PDF isso leva à página de impressão; no Word o
  // Content-Disposition faz o navegador baixar o arquivo sem sair da página.
  useEffect(() => {
    if (estado?.url) {
      window.location.assign(estado.url);
    }
  }, [estado]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="secondary" />}>Gerar proposta</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Gerar proposta</DialogTitle>
            <DialogDescription>
              A proposta é numerada automaticamente e a oportunidade correspondente entra no funil
              de vendas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modelo">Modelo da proposta</Label>
            <Select
              name="modelo"
              defaultValue={modeloPadrao}
              items={[
                { value: "usina_solar", label: "Usina Solar" },
                { value: "redes", label: "Redes" },
              ]}
            >
              <SelectTrigger id="modelo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usina_solar">Usina Solar</SelectItem>
                <SelectItem value="redes">Redes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="formato">Emitir em</Label>
            <Select
              name="formato"
              defaultValue="pdf"
              items={[
                { value: "pdf", label: "PDF" },
                { value: "word", label: "Word (.doc)" },
              ]}
            >
              <SelectTrigger id="formato" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="word">Word (.doc)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {estado?.erro && <p className="text-sm text-destructive">{estado.erro}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Gerando..." : "Gerar proposta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
