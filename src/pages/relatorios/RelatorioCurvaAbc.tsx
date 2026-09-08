import { useMemo, useRef, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

const RelatorioCurvaAbc = () => {
  const { data, company, sellerName, loading } = useReportData(["sales", "sale_items"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const chartRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
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
    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const total = list.reduce((s, r) => s + r.total, 0);
    let acc = 0;
    return list.map((r) => {
      acc += r.total;
      const accPct = total ? (acc / total) * 100 : 0;
      const classe = accPct <= 80 ? "A" : accPct <= 95 ? "B" : "C";
      return { ...r, accPct, classe, part: total ? (r.total / total) * 100 : 0 };
    });
  }, [data, period]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const byClass = ["A", "B", "C"].map((c) => ({
    name: `Classe ${c}`,
    value: rows.filter((r) => r.classe === c).reduce((s, r) => s + r.total, 0),
    count: rows.filter((r) => r.classe === c).length,
  }));

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Curva ABC",
      "relatorio_curva_abc",
      `${rows.length} produtos — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to) })
    ),
    columns: [
      { header: "Classe", value: (r) => r.classe, width: 8 },
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Qtd", value: (r) => r.qtd },
      { header: "Faturamento", value: (r) => r.total, currency: true },
      { header: "Part. %", value: (r) => `${r.part.toFixed(1)}%` },
      { header: "Acumulado %", value: (r) => `${r.accPct.toFixed(1)}%` },
    ],
    rows,
    summary: byClass.map((c) => [`${c.name} (${c.count} produtos)`, c.value] as [string, number]),
  });

  return (
    <ReportPageShell
      title="Curva ABC"
      description="Classificação dos produtos por participação no faturamento"
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />}
      filters={<PeriodFilter period={period} setPeriod={setPeriod} />}
      kpis={[
        { label: "Faturamento", value: fmt(total), tone: "success" },
        { label: "Classe A", value: `${byClass[0].count} produtos`, tone: "primary" },
        { label: "Classe B", value: `${byClass[1].count} produtos` },
        { label: "Classe C", value: `${byClass[2].count} produtos` },
      ]}
    >
      <ReportSection title="Faturamento por classe">
        <div ref={chartRef}>
          {total > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byClass} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95}>
                  {byClass.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
              </PieChart>
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
                <TableHead className="w-16">Classe</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Part.</TableHead>
                <TableHead className="text-right">Acum.</TableHead>
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
                    <TableCell>
                      <Badge variant={r.classe === "A" ? "default" : r.classe === "B" ? "secondary" : "outline"}>{r.classe}</Badge>
                    </TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.part.toFixed(1)}%</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.accPct.toFixed(1)}%</TableCell>
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

export default RelatorioCurvaAbc;
