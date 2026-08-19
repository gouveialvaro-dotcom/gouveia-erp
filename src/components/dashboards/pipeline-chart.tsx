"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarMoeda } from "@/lib/format";

export type ItemPipeline = {
  estagio: string;
  rotulo: string;
  valor: number;
  quantidade: number;
};

function TooltipPipeline({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ItemPipeline }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{item.rotulo}</p>
      <p className="text-muted-foreground">
        {item.quantidade} oportunidade{item.quantidade === 1 ? "" : "s"}
      </p>
      <p className="font-medium">{formatarMoeda(item.valor)}</p>
    </div>
  );
}

export function GraficoPipeline({ dados }: { dados: ItemPipeline[] }) {
  const altura = Math.max(dados.length * 40, 160);

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 4, right: 88, bottom: 4, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" domain={[0, (max: number) => max * 1.15]} hide />
        <YAxis
          type="category"
          dataKey="rotulo"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Tooltip content={<TooltipPipeline />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="valor" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList
            dataKey="valor"
            position="right"
            formatter={(valor: string | number | boolean | null | undefined) =>
              typeof valor === "number" ? formatarMoeda(valor) : ""
            }
            style={{ fill: "var(--foreground)", fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
