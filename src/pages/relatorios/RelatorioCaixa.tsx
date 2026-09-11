import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useReportData } from "@/hooks/reports/useReportData";
import { ReportDefinition } from "@/lib/reportExport";
import { buildFilterLines, formatDateBR, periodLabel } from "@/lib/reportPeriod";
import { ThermalLine, printThermal } from "@/lib/printThermal";
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

const RelatorioCaixa = () => {
  const { data, company, sellerName, memberName, loading } = useReportData(["cash_registers", "sales"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const chartRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () =>
      data.cash_registers
        .filter((c) => inPeriod(c.opened_at, period))
        .map((c) => {
          const day = String(c.opened_at).slice(0, 10);
          const vendas = data.sales.filter((s) => s.date === day);
          const totalVendas = vendas.reduce((s, v) => s + Number(v.total), 0);
          const diferenca =
            c.closing_amount !== null && c.expected_amount !== null
              ? Number(c.closing_amount) - Number(c.expected_amount)
              : null;
          return {
            ...c,
            day,
            operador: memberName(c.user_id),
            vendasQtd: vendas.length,
            totalVendas,
            diferenca,
          };
        }),
    [data, period, memberName]
  );

  const abertura = rows.reduce((s, r) => s + Number(r.opening_amount || 0), 0);
  const vendas = rows.reduce((s, r) => s + r.totalVendas, 0);
  const fechamento = rows.reduce((s, r) => s + Number(r.closing_amount || 0), 0);
  const diferencaTotal = rows.reduce((s, r) => s + (r.diferenca || 0), 0);

  const chartData = rows
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({ day: r.day.slice(5), vendas: r.totalVendas }));

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Resumo de Caixa",
      "relatorio_resumo_caixa",
      `${rows.length} caixas — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to) })
    ),
    columns: [
      { header: "Abertura", value: (r) => formatDateBR(r.opened_at), width: 14 },
      { header: "Operador", value: (r) => r.operador, width: 24 },
      { header: "Situação", value: (r) => (r.status === "aberto" ? "Aberto" : "Fechado") },
      { header: "Valor inicial", value: (r) => Number(r.opening_amount || 0), currency: true },
      { header: "Vendas do dia", value: (r) => r.totalVendas, currency: true },
      { header: "Esperado", value: (r) => Number(r.expected_amount || 0), currency: true },
      { header: "Fechamento", value: (r) => Number(r.closing_amount || 0), currency: true },
      { header: "Diferença", value: (r) => (r.diferenca === null ? "—" : r.diferenca), currency: true },
    ],
    rows,
    summary: [
      ["Valor inicial", abertura],
      ["Vendas", vendas],
      ["Fechamento", fechamento],
      ["Diferença", diferencaTotal],
    ],
  });

  const print80mm = () => {
    const lines: ThermalLine[] = [
      { label: `Período: ${periodLabel(period.from, period.to)}` },
      { divider: true },
      { label: "Caixas", value: String(rows.length) },
      { label: "Valor inicial", value: fmt(abertura) },
      { label: "Vendas", value: fmt(vendas) },
      { label: "Fechamento", value: fmt(fechamento) },
      { label: "Diferença", value: fmt(diferencaTotal), bold: true },
      { divider: true },
      ...rows.flatMap((r) => [
        { label: `${formatDateBR(r.opened_at)} — ${r.operador}` },
        { label: "Vendas", value: fmt(r.totalVendas) },
        { label: "Fechamento", value: fmt(Number(r.closing_amount || 0)) },
      ]),
    ];
    printThermal({
      title: "Resumo de Caixa",
      companyName: company?.name,
      companyInfo: [company?.document, company?.address, company?.phone].filter(Boolean) as string[],
      sellerName,
      lines,
    });
  };

  return (
    <ReportPageShell
      title="Resumo de Caixa"
      description="Abertura, vendas do dia e diferença de fechamento"
      loading={loading}
      actions={
        <ReportActions
          def={def}
          company={company}
          sellerName={sellerName}
          orientation="landscape"
          chartRefs={() => [chartRef.current]}
          extra={
            <Button variant="outline" size="sm" onClick={print80mm}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />80 mm
            </Button>
          }
        />
      }
      filters={<PeriodFilter period={period} setPeriod={setPeriod} />}
      kpis={[
        { label: "Caixas", value: String(rows.length) },
        { label: "Vendas", value: fmt(vendas), tone: "success" },
        { label: "Fechamento", value: fmt(fechamento), tone: "primary" },
        { label: "Diferença", value: fmt(diferencaTotal), tone: diferencaTotal >= 0 ? "success" : "destructive" },
      ]}
    >
      <ReportSection title="Vendas por dia de caixa">
        <div ref={chartRef}>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="vendas" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Vendas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </ReportSection>

      <ReportSection title={`Caixas (${rows.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Abertura</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Fechamento</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Nenhum caixa no período
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDateBR(r.opened_at)}</TableCell>
                    <TableCell>{r.operador}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "aberto" ? "secondary" : "outline"}>
                        {r.status === "aberto" ? "Aberto" : "Fechado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{fmt(Number(r.opening_amount || 0))}</TableCell>
                    <TableCell className="text-right">{fmt(r.totalVendas)}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.closing_amount || 0))}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        r.diferenca === null ? "" : r.diferenca >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {r.diferenca === null ? "—" : fmt(r.diferenca)}
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

export default RelatorioCaixa;
