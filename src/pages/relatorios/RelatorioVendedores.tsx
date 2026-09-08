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

const RelatorioVendedores = () => {
  const { data, company, sellerName, memberName, loading } = useReportData(["sales"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const chartRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; total: number }>();
    data.sales
      .filter((s) => inPeriod(s.date, period))
      .forEach((s) => {
        const name = memberName(s.user_id);
        const cur = map.get(name) || { name, qtd: 0, total: 0 };
        cur.qtd += 1;
        cur.total += Number(s.total);
        map.set(name, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data.sales, period, memberName]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const qtd = rows.reduce((s, r) => s + r.qtd, 0);

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Vendas por Vendedor",
      "relatorio_vendedores",
      `${rows.length} vendedores — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to) })
    ),
    columns: [
      { header: "Vendedor", value: (r) => r.name, width: 30 },
      { header: "Vendas", value: (r) => r.qtd },
      { header: "Total", value: (r) => r.total, currency: true },
      { header: "Ticket médio", value: (r) => (r.qtd ? r.total / r.qtd : 0), currency: true },
      { header: "Participação", value: (r) => (total ? `${((r.total / total) * 100).toFixed(1)}%` : "—") },
    ],
    rows,
    summary: [
      ["Vendas", qtd],
      ["Faturamento", total],
    ],
  });

  return (
    <ReportPageShell
      title="Vendas por Vendedor"
      description="Total, ticket médio e participação de cada vendedor"
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />}
      filters={<PeriodFilter period={period} setPeriod={setPeriod} />}
      kpis={[
        { label: "Vendedores", value: String(rows.length) },
        { label: "Vendas", value: String(qtd) },
        { label: "Faturamento", value: fmt(total), tone: "success" },
        { label: "Ticket médio", value: fmt(qtd ? total / qtd : 0), tone: "primary" },
      ]}
    >
      <ReportSection title="Faturamento por vendedor">
        <div ref={chartRef}>
          {rows.length ? (
            <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 40)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </ReportSection>

      <ReportSection title="Detalhamento">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead className="text-right">Part.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Sem vendas no período
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.qtd}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right">{fmt(r.qtd ? r.total / r.qtd : 0)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {total ? `${((r.total / total) * 100).toFixed(1)}%` : "—"}
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

export default RelatorioVendedores;
