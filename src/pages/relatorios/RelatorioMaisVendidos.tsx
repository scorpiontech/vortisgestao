import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportData } from "@/hooks/reports/useReportData";
import { ReportDefinition } from "@/lib/reportExport";
import { buildFilterLines, periodLabel } from "@/lib/reportPeriod";
import {
  CHART_COLORS,
  ChartEmpty,
  PeriodFilter,
  PeriodState,
  ReportActions,
  ReportPageShell,
  ReportSection,
  commonMeta,
  emptyPeriod,
  fmt,
  inPeriod,
} from "./shared";

const RelatorioMaisVendidos = () => {
  const { data, company, sellerName, loading } = useReportData(["sales", "sale_items"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const chartRef = useRef<HTMLDivElement>(null);

  const ranking = useMemo(() => {
    const validSales = new Set(data.sales.filter((s) => inPeriod(s.date, period)).map((s) => s.id));
    const map = new Map<string, { name: string; qtd: number; total: number }>();
    data.sale_items
      .filter((i) => validSales.has(i.sale_id))
      .forEach((i) => {
        const key = i.product_name || i.product_id || "—";
        const cur = map.get(key) || { name: key, qtd: 0, total: 0 };
        cur.qtd += Number(i.quantity);
        cur.total += Number(i.total);
        map.set(key, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data, period]);

  const totalFat = ranking.reduce((s, r) => s + r.total, 0);
  const totalQtd = ranking.reduce((s, r) => s + r.qtd, 0);

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Produtos Mais Vendidos",
      "relatorio_mais_vendidos",
      `${ranking.length} produtos — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to) })
    ),
    columns: [
      { header: "#", value: (r) => r.pos, width: 6 },
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Quantidade", value: (r) => r.qtd },
      { header: "Faturamento", value: (r) => r.total, currency: true },
      { header: "Participação", value: (r) => (totalFat ? `${((r.total / totalFat) * 100).toFixed(1)}%` : "—") },
    ],
    rows: ranking.map((r, i) => ({ ...r, pos: i + 1 })),
    summary: [
      ["Itens vendidos", totalQtd],
      ["Faturamento", totalFat],
    ],
  });

  return (
    <ReportPageShell
      title="Produtos Mais Vendidos"
      description="Ranking por faturamento e quantidade"
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />}
      filters={<PeriodFilter period={period} setPeriod={setPeriod} />}
      kpis={[
        { label: "Produtos vendidos", value: String(ranking.length) },
        { label: "Itens vendidos", value: String(totalQtd) },
        { label: "Faturamento", value: fmt(totalFat), tone: "success" },
        { label: "Líder", value: ranking[0]?.name || "—", tone: "primary" },
      ]}
    >
      <ReportSection title="Top 10 por faturamento">
        <div ref={chartRef}>
          {ranking.length ? (
            <ResponsiveContainer width="100%" height={Math.max(240, Math.min(10, ranking.length) * 34)}>
              <BarChart data={ranking.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Faturamento" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </ReportSection>

      <ReportSection title={`Ranking completo (${ranking.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Part.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Sem vendas no período
                  </TableCell>
                </TableRow>
              ) : (
                ranking.map((r, i) => (
                  <TableRow key={r.name}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totalFat ? `${((r.total / totalFat) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ReportSection>
    </ReportPageShell>
  );
};

export default RelatorioMaisVendidos;
