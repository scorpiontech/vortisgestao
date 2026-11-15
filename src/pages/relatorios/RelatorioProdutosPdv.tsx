import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportData } from "@/hooks/reports/useReportData";
import { usePdvDailyData } from "@/hooks/reports/usePdvDailyData";
import { groupPdvProducts, pdvDay } from "@/lib/pdvDailyReport";
import { type ReportDefinition } from "@/lib/reportExport";
import { periodLabel } from "@/lib/reportPeriod";
import { ChartEmpty, PeriodFilter, ReportActions, ReportPageShell, fmt, commonMeta } from "./shared";

const RelatorioProdutosPdv = () => {
  const { company, sellerName, memberName, effectiveUserId } = useReportData([]);
  const { sales, cashRegisters, loading, error, retry } = usePdvDailyData(effectiveUserId);
  const [period, setPeriod] = useState(() => ({ from: pdvDay(new Date().toISOString()), to: pdvDay(new Date().toISOString()) }));
  const [cash, setCash] = useState("");
  const [attendant, setAttendant] = useState("");
  const [product, setProduct] = useState("");
  const rows = useMemo(() => groupPdvProducts(sales, { ...period, cash, attendant, product }), [sales, period, cash, attendant, product]);
  const cashLabel = (id: string) => {
    const register = cashRegisters.find(c => c.id === id);
    return register ? `#${id.slice(0, 8)} · ${format(new Date(register.opened_at), "dd/MM/yyyy HH:mm")} · ${memberName(register.user_id)}` : id === "unassigned" ? "Sem caixa identificado" : `#${id.slice(0, 8)}`;
  };
  const attendantLabel = (id: string) => id === "unassigned" ? "Não identificado" : memberName(id) === "—" ? `Atendente #${id.slice(0, 8)}` : memberName(id);
  const options = (label: string, value: string, onChange: (v: string) => void, items: { id: string; name: string }[]) => <div className="min-w-0 w-full sm:w-64">
    <Label className="text-xs">{label}</Label>
    <Select value={value || "all"} onValueChange={v => onChange(v === "all" ? "" : v)}>
      <SelectTrigger aria-label={label} className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">Todos</SelectItem>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
  const quantity = rows.reduce((sum, r) => sum + r.quantity, 0);
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const saleCount = new Set(rows.flatMap(r => [...r.saleIds])).size;
  const daily = useMemo(() => {
    const days = new Map<string, number>();
    rows.forEach(r => days.set(r.day, (days.get(r.day) || 0) + r.quantity));
    return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, quantity]) => ({ day: day.split("-").reverse().join("/"), quantity }));
  }, [rows]);
  const def = (): ReportDefinition<(typeof rows)[number]> => ({
    ...commonMeta(company, sellerName, "Produtos vendidos no PDV", "produtos_pdv_diario", periodLabel(period.from, period.to), [
      `Período: ${periodLabel(period.from, period.to)}`, `Caixa: ${cash ? cashLabel(cash) : "Todos"}`, `Atendente: ${attendant ? attendantLabel(attendant) : "Todos"}`, ...(product ? [`Produto: ${product}`] : []),
    ]),
    columns: [
      { header: "Dia", value: r => r.day.split("-").reverse().join("/") },
      { header: "Caixa", value: r => cashLabel(r.cashId), width: 45 },
      { header: "Atendente", value: r => attendantLabel(r.attendantId), width: 24 },
      { header: "Produto", value: r => r.product, width: 30 },
      { header: "Quantidade", value: r => r.quantity },
      { header: "Vendas", value: r => r.saleIds.size },
      { header: "Valor dos itens", value: r => r.total, currency: true },
    ], rows,
    summary: [["Quantidade vendida", String(quantity)], ["Vendas", String(saleCount)], ["Valor dos itens (antes do desconto da venda)", total]],
  });
  return <ReportPageShell title="Produtos vendidos no PDV" loading={loading}
    actions={!error && <ReportActions def={def} company={company} sellerName={sellerName} orientation="landscape" />}
    filters={<PeriodFilter period={period} setPeriod={setPeriod} onClearExtra={() => { setCash(""); setAttendant(""); setProduct(""); }} extra={<>
      {options("Caixa", cash, setCash, [...new Set(sales.map(s => s.cash_register_id || "unassigned"))].map(id => ({ id, name: cashLabel(id) })))}
      {options("Atendente", attendant, setAttendant, [...new Set(sales.map(s => s.attendant_id || "unassigned"))].map(id => ({ id, name: attendantLabel(id) })))}
      <div><Label htmlFor="pdv-report-product" className="text-xs">Produto</Label><Input id="pdv-report-product" className="h-8 text-xs" placeholder="Buscar produto" value={product} onChange={e => setProduct(e.target.value)} /></div>
    </>} />}
    kpis={error ? [] : [{ label: "Vendas", value: String(saleCount) }, { label: "Quantidade vendida", value: String(quantity) }, { label: "Produtos", value: String(new Set(rows.map(r => r.product)).size) }, { label: "Valor dos itens", value: fmt(total), tone: "success" }]}
  >
    {error ? <div role="alert" className="space-y-3 text-destructive"><p>Não foi possível carregar o relatório: {error}</p><Button variant="outline" onClick={retry}>Tentar novamente</Button></div> : <>
      <section className="space-y-3"><h2 className="font-semibold">Quantidade vendida por dia</h2>{daily.length ? <ResponsiveContainer width="100%" height={260}>
        <BarChart data={daily}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="quantity" name="Quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
      </ResponsiveContainer> : <ChartEmpty />}</section>
      <section className="space-y-3"><h2 className="font-semibold">Produtos por dia, caixa e atendente</h2>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow>{["Dia", "Caixa", "Atendente", "Produto", "Quantidade", "Vendas", "Valor dos itens"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.length ? rows.map((r, i) => <TableRow key={i}><TableCell className="whitespace-nowrap">{r.day.split("-").reverse().join("/")}</TableCell><TableCell className="min-w-48">{cashLabel(r.cashId)}</TableCell><TableCell>{attendantLabel(r.attendantId)}</TableCell><TableCell className="font-medium">{r.product}</TableCell><TableCell>{r.quantity}</TableCell><TableCell>{r.saleIds.size}</TableCell><TableCell className="whitespace-nowrap">{fmt(r.total)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto vendido no período selecionado</TableCell></TableRow>}</TableBody>
        </Table></div>
      </section>
    </>}
  </ReportPageShell>;
};
export default RelatorioProdutosPdv;