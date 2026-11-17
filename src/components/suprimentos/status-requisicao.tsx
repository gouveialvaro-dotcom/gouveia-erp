import { Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ROTULO_STATUS_ENTREGA,
  ROTULO_STATUS_REQUISICAO,
  type StatusEntregaPedido,
  type StatusRequisicao,
  type UrgenciaRequisicao,
} from "@/lib/suprimentos";

const VARIANTE: Record<StatusRequisicao, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "default",
  em_cotacao: "secondary",
  aguardando_aprovacao: "secondary",
  aprovada: "secondary",
  pedido_emitido: "secondary",
  concluida: "outline",
  recusada: "destructive",
  cancelada: "outline",
};

export function BadgeStatusRequisicao({ status }: { status: StatusRequisicao }) {
  return <Badge variant={VARIANTE[status]}>{ROTULO_STATUS_REQUISICAO[status]}</Badge>;
}

export function BadgeUrgencia({ urgencia }: { urgencia: UrgenciaRequisicao }) {
  if (urgencia !== "emergencial") return null;
  return (
    <Badge variant="destructive" className="gap-1">
      <Siren className="h-3 w-3" /> Emergencial
    </Badge>
  );
}

const VARIANTE_ENTREGA: Record<StatusEntregaPedido, "default" | "secondary" | "destructive"> = {
  pendente: "secondary",
  recebido_conforme: "default",
  recebido_inconforme: "destructive",
};

export function BadgeStatusEntrega({ status }: { status: StatusEntregaPedido }) {
  return <Badge variant={VARIANTE_ENTREGA[status]}>{ROTULO_STATUS_ENTREGA[status]}</Badge>;
}
