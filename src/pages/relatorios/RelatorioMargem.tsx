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
  pct,
} from "./shared";

const RelatorioMargem = () => {
  const { data, company, sellerName, loading } = useReportData(["sales", "sale_items", "products"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const chartRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const costById = new Map(data.products.map((p) => [p.id, Number(p.cost || 0)]));
    const validSales = new Set(data.sales.filter((s) => inPeriod(s.date, period)).map((s) => s.id));
    const map = new Map<string, { name: string; qtd: number; receita: number; custo: number }>();
    data.sale_items
      .filter((i) => validSales.has(i.sale_id))
      .forEach((i) => {
        const key = i.product_name || i.product_id || "—";
        const cur = map.get(key) || { name: key, qtd: 0, receita: 0, custo: 0 };
        cur.qtd += Number(i.quantity);
        cur.receita += Number(i.total);
        cur.custo += Number(i.quantity) * (costById.get(i.product_id) || 0);
        map.set(key, cur);
      });
    return Array.from(map.values())
      .map((r) => ({ ...r, margem: r.receita - r.custo, margemPct: r.receita ? ((r.receita - r.custo) / r.receita) * 100 : 0 }))
      .sort((a, b) => b.margem - a.margem);
  }, [data, period]);

  const receita = rows.reduce((s, r) => s + r.receita, 0);
  const custo = rows.reduce((s, r) => s + r.custo, 0);
  const margem = receita - custo;

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Margem de Lucro",
      "relatorio_margem",
      `${rows.length} produtos — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to) })
    ),
    columns: [
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Qtd", value: (r) => r.qtd },
      { header: "Receita", value: (r) => r.receita, currency: true },
      { header: "Custo", value: (r) => r.custo, currency: true },
      { header: "Margem", value: (r) => r.margem, currency: true },
      { header: "Margem %", value: (r) => `${r.margemPct.toFixed(1)}%` },
    ],
    rows,
    summary: [
      ["Receita", receita],
      ["Custo", custo],
      ["Margem", margem],
      ["Margem %", receita ? `${((margem / receita) * 100).toFixed(1)}%` : "—"],
    ],
  });

  return (
    <ReportPageShell
      title="Margem de Lucro"
      description="Margem em reais e percentual por produto vendido"
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />}
      filters={<PeriodFilter period={period} setPeriod={setPeriod} />}
      kpis={[
        { label: "Receita", value: fmt(receita), tone: "success" },
        { label: "Custo", value: fmt(custo), tone: "destructive" },
        { label: "Margem", value: fmt(margem), tone: margem >= 0 ? "success" : "destructive" },
        { label: "Margem %", value: receita ? pct((margem / receita) * 100) : "—", tone: "primary" },
      ]}
    >
      <ReportSection title="Top 10 produtos por margem">
        <div ref={chartRef}>
          {rows.length ? (
            <ResponsiveContainer width="100%" height={Math.max(240, Math.min(10, rows.length) * 34)}>
              <BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="margem" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} name="Margem" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </ReportSection>

      <ReportSection title={`Produtos (${rows.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Sem vendas no período
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right">{fmt(r.receita)}</TableCell>
                    <TableCell className="text-right">{fmt(r.custo)}</TableCell>
                    <TableCell className={`text-right font-medium ${r.margem >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmt(r.margem)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.margemPct.toFixed(1)}%</TableCell>
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

export default RelatorioMargem;
