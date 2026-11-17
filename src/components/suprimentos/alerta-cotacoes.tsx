import { AlertTriangle } from "lucide-react";

// Abaixo do mínimo de cotações a compra segue (decisão do cliente), mas o
// comprador e o requisitante veem o aviso.
export function AlertaMinimoCotacoes({
  quantidade,
  minimo,
  paraRequisitante = false,
}: {
  quantidade: number;
  minimo: number;
  paraRequisitante?: boolean;
}) {
  if (quantidade >= minimo || quantidade === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {quantidade === 1 ? "Só 1 cotação" : `Só ${quantidade} cotações`} — o mínimo é {minimo}.{" "}
        {paraRequisitante
          ? "O comprador pode seguir assim, mas confira se faz sentido para a obra."
          : "Dá para seguir, mas o requisitante e os aprovadores vão ver este aviso."}
      </span>
    </div>
  );
}
