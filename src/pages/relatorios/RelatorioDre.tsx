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

const RelatorioDre = () => {
  const { data, company, sellerName, loading } = useReportData(["transactions", "sales", "sale_items", "products"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const chartRef = useRef<HTMLDivElement>(null);

  const receitaBruta = useMemo(
    () =>
      data.transactions
        .filter((t) => t.type === "entrada" && inPeriod(t.date, period))
        .reduce((s, t) => s + Number(t.amount), 0),
    [data.transactions, period]
  );

  const cmv = useMemo(() => {
    const costById = new Map(data.products.map((p) => [p.id, Number(p.cost || 0)]));
    const validSales = new Set(data.sales.filter((s) => inPeriod(s.date, period)).map((s) => s.id));
    return data.sale_items
      .filter((i) => validSales.has(i.sale_id))
      .reduce((s, i) => s + Number(i.quantity) * (costById.get(i.product_id) || 0), 0);
  }, [data, period]);

  const despesasPorCategoria = useMemo(() => {
    const map = new Map<string, number>();
    data.transactions
      .filter((t) => t.type === "saida" && inPeriod(t.date, period))
      .forEach((t) => map.set(t.category || "Outras", (map.get(t.category || "Outras") || 0) + Number(t.amount)));
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data.transactions, period]);

  const despesas = despesasPorCategoria.reduce((s, d) => s + d.value, 0);
  const lucroBruto = receitaBruta - cmv;
  const resultado = lucroBruto - despesas;

  const linhas = [
    { conta: "Receita bruta", valor: receitaBruta, destaque: true },
    { conta: "(-) Custo das mercadorias vendidas", valor: -cmv },
    { conta: "= Lucro bruto", valor: lucroBruto, destaque: true },
    ...despesasPorCategoria.map((d) => ({ conta: `(-) ${d.name}`, valor: -d.value, destaque: false })),
    { conta: "(-) Total de despesas", valor: -despesas },
    { conta: "= Resultado do período", valor: resultado, destaque: true },
  ];

  const chartData = [
    { name: "Receita", value: receitaBruta },
    { name: "CMV", value: cmv },
    { name: "Despesas", value: despesas },
    { name: "Resultado", value: resultado },
  ];

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "DRE Simplificado",
      "relatorio_dre",
      periodLabel(period.from, period.to),
      buildFilterLines({ Período: periodLabel(period.from, period.to) })
    ),
    columns: [
      { header: "Conta", value: (r) => r.conta, width: 40 },
      { header: "Valor", value: (r) => r.valor, currency: true },
    ],
    rows: linhas,
    summary: [
      ["Receita bruta", receitaBruta],
      ["Lucro bruto", lucroBruto],
      ["Despesas", despesas],
      ["Resultado", resultado],
      ["Margem líquida", receitaBruta ? `${((resultado / receitaBruta) * 100).toFixed(1)}%` : "—"],
    ],
  });

  return (
    <ReportPageShell
      title="DRE Simplificado"
      description="Receitas, custos, despesas e resultado do período"
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />}
      filters={<PeriodFilter period={period} setPeriod={setPeriod} />}
      kpis={[
        { label: "Receita bruta", value: fmt(receitaBruta), tone: "success" },
        { label: "Lucro bruto", value: fmt(lucroBruto), tone: "primary" },
        { label: "Despesas", value: fmt(despesas), tone: "destructive" },
        {
          label: "Resultado",
          value: `${fmt(resultado)}${receitaBruta ? ` (${pct((resultado / receitaBruta) * 100)})` : ""}`,
          tone: resultado >= 0 ? "success" : "destructive",
        },
      ]}
    >
      <ReportSection title="Composição do resultado">
        <div ref={chartRef}>
          {receitaBruta || despesas || cmv ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </ReportSection>

      <ReportSection title="Demonstrativo">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.conta} className={l.destaque ? "font-semibold" : ""}>
                  <TableCell>{l.conta}</TableCell>
                  <TableCell className={`text-right ${l.valor >= 0 ? "text-success" : "text-destructive"}`}>
                    {fmt(l.valor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ReportSection>
    </ReportPageShell>
  );
};

export default RelatorioDre;
