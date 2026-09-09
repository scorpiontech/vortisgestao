import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReportData } from "@/hooks/reports/useReportData";
import { ReportDefinition } from "@/lib/reportExport";
import { buildFilterLines } from "@/lib/reportPeriod";
import {
  CHART_COLORS,
  ChartEmpty,
  ReportActions,
  ReportPageShell,
  ReportSection,
  commonMeta,
  fmt,
} from "./shared";

const RelatorioClientes = () => {
  const { data, company, sellerName, loading } = useReportData(["customers", "sales"]);
  const [busca, setBusca] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const stats = new Map<string, { total: number; qtd: number; last: string }>();
    data.sales.forEach((s) => {
      const key = (s.customer_name || "").trim().toLowerCase();
      if (!key) return;
      const cur = stats.get(key) || { total: 0, qtd: 0, last: "" };
      cur.total += Number(s.total);
      cur.qtd += 1;
      if (s.date > cur.last) cur.last = s.date;
      stats.set(key, cur);
    });
    const q = busca.trim().toLowerCase();
    return data.customers
      .filter((c) => !q || `${c.name} ${c.document} ${c.phone} ${c.email}`.toLowerCase().includes(q))
      .map((c) => {
        const st = stats.get((c.name || "").trim().toLowerCase()) || { total: 0, qtd: 0, last: "" };
        return {
          ...c,
          compras: st.qtd,
          totalCompras: st.total,
          ticket: st.qtd ? st.total / st.qtd : 0,
          ultima: st.last,
        };
      })
      .sort((a, b) => b.totalCompras - a.totalCompras);
  }, [data, busca]);

  const totalCompras = rows.reduce((s, r) => s + r.totalCompras, 0);
  const ativos = rows.filter((r) => r.compras > 0).length;

  const top = rows.filter((r) => r.totalCompras > 0).slice(0, 10);

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Relatório de Clientes",
      "relatorio_clientes",
      `${rows.length} clientes`,
      buildFilterLines({ Busca: busca })
    ),
    columns: [
      { header: "Cliente", value: (r) => r.name, width: 30 },
      { header: "Documento", value: (r) => r.document || "—" },
      { header: "Telefone", value: (r) => r.phone || "—" },
      { header: "E-mail", value: (r) => r.email || "—", width: 26 },
      { header: "Cidade", value: (r) => (r.city ? `${r.city}/${r.state}` : "—") },
      { header: "Compras", value: (r) => r.compras },
      { header: "Total gasto", value: (r) => r.totalCompras, currency: true },
      { header: "Ticket médio", value: (r) => r.ticket, currency: true },
    ],
    rows,
    summary: [
      ["Clientes", rows.length],
      ["Clientes com compras", ativos],
      ["Total comprado", totalCompras],
    ],
  });

  return (
    <ReportPageShell
      title="Clientes"
      description="Cadastro, contatos e histórico de compras"
      loading={loading}
      actions={
        <ReportActions def={def} company={company} sellerName={sellerName} orientation="landscape" chartRefs={() => [chartRef.current]} />
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Buscar</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, documento, telefone..."
              className="h-8 text-xs w-64"
            />
          </div>
        </div>
      }
      kpis={[
        { label: "Clientes", value: String(rows.length) },
        { label: "Com compras", value: String(ativos), tone: "primary" },
        { label: "Total comprado", value: fmt(totalCompras), tone: "success" },
        { label: "Ticket médio geral", value: fmt(ativos ? totalCompras / ativos : 0) },
      ]}
    >
      <ReportSection title="Top 10 clientes por valor comprado">
        <div ref={chartRef}>
          {top.length ? (
            <ResponsiveContainer width="100%" height={Math.max(240, top.length * 34)}>
              <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="totalCompras" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Total comprado" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty text="Nenhuma compra registrada" />
          )}
        </div>
      </ReportSection>

      <ReportSection title={`Clientes (${rows.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Nenhum cliente
                  </TableCell>
                </TableRow>
              ) : (
                rows.slice(0, 300).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.document || "—"}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>{c.city ? `${c.city}/${c.state}` : "—"}</TableCell>
                    <TableCell className="text-right">{c.compras}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.totalCompras)}</TableCell>
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

export default RelatorioClientes;
