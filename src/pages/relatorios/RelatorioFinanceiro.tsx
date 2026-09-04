import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportData } from "@/hooks/reports/useReportData";
import { ReportDefinition } from "@/lib/reportExport";
import { buildFilterLines, formatDateBR, periodLabel } from "@/lib/reportPeriod";
import {
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

const RelatorioFinanceiro = () => {
  const { data, company, sellerName, loading } = useReportData(["transactions"]);
  const transactions = data.transactions;

  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const [categoria, setCategoria] = useState("");
  const [pagamento, setPagamento] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  const categorias = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category).filter(Boolean))).sort(),
    [transactions]
  );
  const pagamentos = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.payment_method).filter(Boolean))).sort(),
    [transactions]
  );

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (!inPeriod(t.date, period)) return false;
        if (categoria && t.category !== categoria) return false;
        if (pagamento && t.payment_method !== pagamento) return false;
        return true;
      }),
    [transactions, period, categoria, pagamento]
  );

  const daily = useMemo(() => {
    const map = new Map<string, { entradas: number; saidas: number }>();
    filtered.forEach((t) => {
      const d = map.get(t.date) || { entradas: 0, saidas: 0 };
      if (t.type === "entrada") d.entradas += Number(t.amount);
      else d.saidas += Number(t.amount);
      map.set(t.date, d);
    });
    return Array.from(map, ([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const totalEntradas = filtered.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = filtered.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Relatório Financeiro",
      "relatorio_financeiro",
      `${filtered.length} registros — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to), Categoria: categoria, "Forma de pagamento": pagamento })
    ),
    columns: [
      { header: "Data", value: (r) => formatDateBR(r.date), width: 14 },
      { header: "Entradas", value: (r) => r.entradas, currency: true },
      { header: "Saídas", value: (r) => r.saidas, currency: true },
      { header: "Saldo do dia", value: (r) => r.entradas - r.saidas, currency: true },
    ],
    rows: daily,
    summary: [
      ["Total Entradas", totalEntradas],
      ["Total Saídas", totalSaidas],
      ["Saldo", totalEntradas - totalSaidas],
    ],
  });

  return (
    <ReportPageShell
      title="Movimentação Financeira"
      description="Entradas, saídas e saldo por dia"
      loading={loading}
      actions={
        <ReportActions def={def} company={company} sellerName={sellerName} chartRefs={() => [chartRef.current]} />
      }
      filters={
        <PeriodFilter
          period={period}
          setPeriod={setPeriod}
          onClearExtra={() => {
            setCategoria("");
            setPagamento("");
          }}
          extra={
            <>
              <SelectFilter label="Categoria" value={categoria} onChange={setCategoria} options={categorias.map((c) => ({ value: c, label: c }))} />
              <SelectFilter label="Pagamento" value={pagamento} onChange={setPagamento} options={pagamentos.map((c) => ({ value: c, label: c }))} />
            </>
          }
        />
      }
      kpis={[
        { label: "Entradas", value: fmt(totalEntradas), tone: "success" },
        { label: "Saídas", value: fmt(totalSaidas), tone: "destructive" },
        { label: "Saldo", value: fmt(totalEntradas - totalSaidas), tone: totalEntradas - totalSaidas >= 0 ? "success" : "destructive" },
        { label: "Lançamentos", value: String(filtered.length) },
      ]}
    >
      <ReportSection title="Entradas x Saídas por dia">
        <div ref={chartRef}>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="entradas" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="saidas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </ReportSection>

      <ReportSection title={`Detalhamento por dia (${daily.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo do dia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Sem lançamentos no período
                  </TableCell>
                </TableRow>
              ) : (
                daily.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell>{formatDateBR(d.date)}</TableCell>
                    <TableCell className="text-right text-success">{fmt(d.entradas)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(d.saidas)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(d.entradas - d.saidas)}</TableCell>
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

export default RelatorioFinanceiro;
