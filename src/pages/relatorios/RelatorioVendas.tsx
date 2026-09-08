import { useMemo, useRef, useState } from "react";
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportData } from "@/hooks/reports/useReportData";
import { ReportDefinition } from "@/lib/reportExport";
import { buildFilterLines, formatDateBR, periodLabel } from "@/lib/reportPeriod";
import {
  CHART_COLORS,
  ChartEmpty,
  PeriodFilter,
  PeriodState,
  ReportActions,
  ReportPageShell,
  ReportSection,
  SelectFilter,
  commonMeta,
  emptyPeriod,
  fmt,
  inPeriod,
} from "./shared";

const RelatorioVendas = () => {
  const { data, company, sellerName, loading } = useReportData(["sales"]);
  const sales = data.sales;

  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const [pagamento, setPagamento] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);

  const pagamentos = useMemo(
    () => Array.from(new Set(sales.map((s) => s.payment_method).filter(Boolean))).sort(),
    [sales]
  );

  const filtered = useMemo(
    () => sales.filter((s) => inPeriod(s.date, period) && (!pagamento || s.payment_method === pagamento)),
    [sales, period, pagamento]
  );

  const total = filtered.reduce((s, v) => s + Number(v.total), 0);
  const desconto = filtered.reduce((s, v) => s + Number(v.discount || 0), 0);
  const ticket = filtered.length ? total / filtered.length : 0;

  const daily = useMemo(() => {
    const map = new Map<string, { total: number; qtd: number }>();
    filtered.forEach((s) => {
      const d = map.get(s.date) || { total: 0, qtd: 0 };
      d.total += Number(s.total);
      d.qtd += 1;
      map.set(s.date, d);
    });
    return Array.from(map, ([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const byPayment = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((s) => map.set(s.payment_method || "—", (map.get(s.payment_method || "—") || 0) + Number(s.total)));
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Relatório de Vendas",
      "relatorio_vendas",
      `${filtered.length} vendas — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to), "Forma de pagamento": pagamento })
    ),
    columns: [
      { header: "Data", value: (r) => formatDateBR(r.date), width: 14 },
      { header: "Cliente", value: (r) => r.customer_name || "Consumidor final", width: 28 },
      { header: "Pagamento", value: (r) => r.payment_method || "—" },
      { header: "Parcelas", value: (r) => r.installments || 1 },
      { header: "Desconto", value: (r) => Number(r.discount || 0), currency: true },
      { header: "Total", value: (r) => Number(r.total), currency: true },
    ],
    rows: filtered,
    summary: [
      ["Vendas", filtered.length],
      ["Descontos", desconto],
      ["Ticket médio", ticket],
      ["Faturamento", total],
    ],
  });

  return (
    <ReportPageShell
      title="Vendas"
      description="Faturamento, ticket médio e formas de pagamento"
      loading={loading}
      actions={
        <ReportActions
          def={def}
          company={company}
          sellerName={sellerName}
          orientation="landscape"
          chartRefs={() => [chartRef.current, pieRef.current]}
        />
      }
      filters={
        <PeriodFilter
          period={period}
          setPeriod={setPeriod}
          onClearExtra={() => setPagamento("")}
          extra={
            <SelectFilter
              label="Pagamento"
              value={pagamento}
              onChange={setPagamento}
              options={pagamentos.map((p) => ({ value: p, label: p }))}
            />
          }
        />
      }
      kpis={[
        { label: "Faturamento", value: fmt(total), tone: "success" },
        { label: "Vendas", value: String(filtered.length) },
        { label: "Ticket médio", value: fmt(ticket), tone: "primary" },
        { label: "Descontos", value: fmt(desconto), tone: "destructive" },
      ]}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReportSection title="Faturamento por dia">
            <div ref={chartRef}>
              {daily.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Line type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={2} name="Faturamento" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
          </ReportSection>
        </div>
        <ReportSection title="Formas de pagamento">
          <div ref={pieRef}>
            {byPayment.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={byPayment} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {byPayment.map((_, i) => (
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
      </div>

      <ReportSection title={`Vendas (${filtered.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Sem vendas no período
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 300).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDateBR(s.date)}</TableCell>
                    <TableCell>{s.customer_name || "Consumidor final"}</TableCell>
                    <TableCell>{s.payment_method || "—"}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(Number(s.discount || 0))}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(s.total))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filtered.length > 300 && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando as 300 primeiras vendas. Exporte para ver a lista completa.
            </p>
          )}
        </div>
      </ReportSection>
    </ReportPageShell>
  );
};

export default RelatorioVendas;
