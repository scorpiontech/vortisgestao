import { useMemo, useRef, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  today,
} from "./shared";

const RelatorioContas = ({ type }: { type: "pagar" | "receber" }) => {
  const { data, company, sellerName, loading } = useReportData(["bills"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const [status, setStatus] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  const isPagar = type === "pagar";
  const hoje = today();

  const rows = useMemo(() => {
    return data.bills
      .filter((b) => b.type === type && inPeriod(b.due_date, period))
      .map((b) => ({
        ...b,
        situacao: b.paid ? "paga" : b.due_date < hoje ? "atrasada" : "pendente",
      }))
      .filter((b) => !status || b.situacao === status)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [data.bills, type, period, status, hoje]);

  const sum = (list: any[]) => list.reduce((s, b) => s + Number(b.amount), 0);
  const total = sum(rows);
  const pagas = sum(rows.filter((b) => b.situacao === "paga"));
  const pendentes = sum(rows.filter((b) => b.situacao === "pendente"));
  const atrasadas = sum(rows.filter((b) => b.situacao === "atrasada"));

  const pie = [
    { name: isPagar ? "Pagas" : "Recebidas", value: pagas },
    { name: "Pendentes", value: pendentes },
    { name: "Atrasadas", value: atrasadas },
  ].filter((p) => p.value > 0);

  const title = isPagar ? "Contas a Pagar" : "Contas a Receber";

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      title,
      isPagar ? "relatorio_contas_pagar" : "relatorio_contas_receber",
      `${rows.length} contas — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to), Situação: status })
    ),
    columns: [
      { header: "Vencimento", value: (r) => formatDateBR(r.due_date), width: 14 },
      { header: "Descrição", value: (r) => r.description || "—", width: 34 },
      { header: "Situação", value: (r) => r.situacao },
      { header: "Pagamento", value: (r) => r.payment_method || "—" },
      { header: "Valor", value: (r) => Number(r.amount), currency: true },
    ],
    rows,
    summary: [
      [isPagar ? "Pagas" : "Recebidas", pagas],
      ["Pendentes", pendentes],
      ["Atrasadas", atrasadas],
      ["Total", total],
    ],
  });

  return (
    <ReportPageShell
      title={title}
      description={isPagar ? "Pagas, pendentes e atrasadas" : "Recebidas, pendentes e atrasadas"}
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />}
      filters={
        <PeriodFilter
          period={period}
          setPeriod={setPeriod}
          onClearExtra={() => setStatus("")}
          extra={
            <SelectFilter
              label="Situação"
              value={status}
              onChange={setStatus}
              options={[
                { value: "paga", label: isPagar ? "Paga" : "Recebida" },
                { value: "pendente", label: "Pendente" },
                { value: "atrasada", label: "Atrasada" },
              ]}
            />
          }
        />
      }
      kpis={[
        { label: "Total", value: fmt(total), tone: "primary" },
        { label: isPagar ? "Pagas" : "Recebidas", value: fmt(pagas), tone: "success" },
        { label: "Pendentes", value: fmt(pendentes) },
        { label: "Atrasadas", value: fmt(atrasadas), tone: "destructive" },
      ]}
    >
      <ReportSection title="Composição por situação">
        <div ref={chartRef}>
          {pie.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95}>
                  {pie.map((_, i) => (
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

      <ReportSection title={`Contas (${rows.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhuma conta no período
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{formatDateBR(b.due_date)}</TableCell>
                    <TableCell>{b.description || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={b.situacao === "paga" ? "default" : b.situacao === "atrasada" ? "destructive" : "secondary"}
                      >
                        {b.situacao === "paga" ? (isPagar ? "Paga" : "Recebida") : b.situacao === "atrasada" ? "Atrasada" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(b.amount))}</TableCell>
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

export default RelatorioContas;
