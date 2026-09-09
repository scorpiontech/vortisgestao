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
} from "./shared";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  paid: "Paga",
  cancelled: "Cancelada",
  overdue: "Vencida",
};

const RelatorioCobrancas = () => {
  const { data, company, sellerName, loading } = useReportData(["customer_charges"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const [status, setStatus] = useState("");
  const [tipo, setTipo] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  const charges = data.customer_charges;

  const statusOptions = useMemo(
    () => Array.from(new Set(charges.map((c) => c.status).filter(Boolean))).sort(),
    [charges]
  );
  const tipos = useMemo(
    () => Array.from(new Set(charges.map((c) => c.billing_type).filter(Boolean))).sort(),
    [charges]
  );

  const rows = useMemo(
    () =>
      charges.filter(
        (c) => inPeriod(c.created_at, period) && (!status || c.status === status) && (!tipo || c.billing_type === tipo)
      ),
    [charges, period, status, tipo]
  );

  const sum = (list: any[]) => list.reduce((s, c) => s + Number(c.total_amount), 0);
  const total = sum(rows);
  const pagas = sum(rows.filter((c) => c.status === "paid"));
  const abertas = sum(rows.filter((c) => c.status === "pending" || c.status === "overdue"));
  const canceladas = sum(rows.filter((c) => c.status === "cancelled"));

  const pie = [
    { name: "Pagas", value: pagas },
    { name: "Em aberto", value: abertas },
    { name: "Canceladas", value: canceladas },
  ].filter((p) => p.value > 0);

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Relatório de Cobranças",
      "relatorio_cobrancas",
      `${rows.length} cobranças — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to), Situação: status, Tipo: tipo })
    ),
    columns: [
      { header: "Criada em", value: (r) => formatDateBR(r.created_at), width: 14 },
      { header: "Cliente", value: (r) => r.customer_name || "—", width: 28 },
      { header: "Tipo", value: (r) => r.billing_type || "—" },
      { header: "Situação", value: (r) => STATUS_LABEL[r.status] || r.status },
      { header: "Pago em", value: (r) => (r.paid_at ? formatDateBR(r.paid_at) : "—") },
      { header: "Valor", value: (r) => Number(r.total_amount), currency: true },
    ],
    rows,
    summary: [
      ["Pagas", pagas],
      ["Em aberto", abertas],
      ["Canceladas", canceladas],
      ["Total", total],
    ],
  });

  return (
    <ReportPageShell
      title="Cobranças"
      description="Boletos e PIX por situação"
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />}
      filters={
        <PeriodFilter
          period={period}
          setPeriod={setPeriod}
          onClearExtra={() => {
            setStatus("");
            setTipo("");
          }}
          extra={
            <>
              <SelectFilter
                label="Situação"
                value={status}
                onChange={setStatus}
                options={statusOptions.map((s) => ({ value: s, label: STATUS_LABEL[s] || s }))}
              />
              <SelectFilter label="Tipo" value={tipo} onChange={setTipo} options={tipos.map((t) => ({ value: t, label: t }))} />
            </>
          }
        />
      }
      kpis={[
        { label: "Total emitido", value: fmt(total), tone: "primary" },
        { label: "Pagas", value: fmt(pagas), tone: "success" },
        { label: "Em aberto", value: fmt(abertas) },
        { label: "Canceladas", value: fmt(canceladas), tone: "destructive" },
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

      <ReportSection title={`Cobranças (${rows.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criada em</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhuma cobrança no período
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatDateBR(c.created_at)}</TableCell>
                    <TableCell>{c.customer_name || "—"}</TableCell>
                    <TableCell>{c.billing_type || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === "paid" ? "default" : c.status === "cancelled" ? "destructive" : "secondary"
                        }
                      >
                        {STATUS_LABEL[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(c.total_amount))}</TableCell>
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

export default RelatorioCobrancas;
