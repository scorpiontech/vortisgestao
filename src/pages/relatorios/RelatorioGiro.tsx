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
  inPeriod,
} from "./shared";

const RelatorioGiro = () => {
  const { data, company, sellerName, loading } = useReportData(["products", "stock_movements"]);
  const [period, setPeriod] = useState<PeriodState>(emptyPeriod);
  const chartRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    if (period.from && period.to) {
      const d = (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86400000 + 1;
      return Math.max(1, Math.round(d));
    }
    return 30;
  }, [period]);

  const rows = useMemo(() => {
    const moves = data.stock_movements.filter((m) => inPeriod(m.created_at, period) && m.type === "saida");
    const outByProduct = new Map<string, number>();
    moves.forEach((m) => outByProduct.set(m.product_id, (outByProduct.get(m.product_id) || 0) + Number(m.quantity)));
    return data.products
      .map((p) => {
        const saidas = outByProduct.get(p.id) || 0;
        const media = saidas / days;
        return {
          name: p.name,
          stock: Number(p.stock),
          saidas,
          media,
          cobertura: media > 0 ? Number(p.stock) / media : null,
          giro: Number(p.stock) > 0 ? saidas / Number(p.stock) : 0,
        };
      })
      .sort((a, b) => b.saidas - a.saidas);
  }, [data, period, days]);

  const parados = rows.filter((r) => r.saidas === 0 && r.stock > 0).length;
  const totalSaidas = rows.reduce((s, r) => s + r.saidas, 0);
  const criticos = rows.filter((r) => r.cobertura !== null && r.cobertura < 7).length;

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Giro de Estoque",
      "relatorio_giro_estoque",
      `${rows.length} produtos — ${periodLabel(period.from, period.to)}`,
      buildFilterLines({ Período: periodLabel(period.from, period.to), "Dias considerados": String(days) })
    ),
    columns: [
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Estoque", value: (r) => r.stock },
      { header: "Saídas", value: (r) => r.saidas },
      { header: "Média/dia", value: (r) => r.media.toFixed(2) },
      { header: "Cobertura (dias)", value: (r) => (r.cobertura === null ? "—" : r.cobertura.toFixed(0)) },
      { header: "Giro", value: (r) => r.giro.toFixed(2) },
    ],
    rows,
    summary: [
      ["Saídas no período", totalSaidas],
      ["Produtos parados", parados],
      ["Cobertura crítica (<7 dias)", criticos],
    ],
  });

  return (
    <ReportPageShell
      title="Giro de Estoque"
      description="Saídas, cobertura em dias e itens parados"
      loading={loading}
      actions={<ReportActions def={def} company={company} sellerName={sellerName} orientation="landscape" chartRefs={() => [chartRef.current]} />}
      filters={<PeriodFilter period={period} setPeriod={setPeriod} />}
      kpis={[
        { label: "Saídas no período", value: String(totalSaidas), tone: "primary" },
        { label: "Produtos parados", value: String(parados), tone: "destructive" },
        { label: "Cobertura crítica", value: String(criticos), tone: "destructive" },
        { label: "Dias considerados", value: String(days) },
      ]}
    >
      <ReportSection title="Top 10 produtos por saída">
        <div ref={chartRef}>
          {rows.some((r) => r.saidas > 0) ? (
            <ResponsiveContainer width="100%" height={Math.max(240, Math.min(10, rows.length) * 34)}>
              <BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="saidas" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} name="Saídas" />
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
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Média/dia</TableHead>
                <TableHead className="text-right">Cobertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum produto
                  </TableCell>
                </TableRow>
              ) : (
                rows.slice(0, 300).map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.stock}</TableCell>
                    <TableCell className="text-right">{r.saidas}</TableCell>
                    <TableCell className="text-right">{r.media.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.cobertura === null ? "—" : `${r.cobertura.toFixed(0)} dias`}</TableCell>
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

export default RelatorioGiro;
