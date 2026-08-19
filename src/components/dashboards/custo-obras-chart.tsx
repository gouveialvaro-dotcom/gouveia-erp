"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarMoeda } from "@/lib/format";

export type ItemCustoObra = {
  id: string;
  label: string;
  orcado: number;
  realizado: number;
};

function TooltipCusto({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.name}:{" "}
          <span className="font-medium text-foreground">{formatarMoeda(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function GraficoCustoObras({ dados }: { dados: ItemCustoObra[] }) {
  const altura = Math.max(dados.length * 48, 180);

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        barGap={2}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Tooltip content={<TooltipCusto />} cursor={{ fill: "var(--muted)" }} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
        />
        <Bar dataKey="orcado" name="Orçado" fill="var(--chart-3)" radius={[0, 4, 4, 0]} maxBarSize={16} />
        <Bar
          dataKey="realizado"
          name="Realizado"
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
