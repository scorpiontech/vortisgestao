import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { printA4 } from "@/lib/printA4";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = ["hsl(215, 80%, 50%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)"];

const Relatorios = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billsFrom, setBillsFrom] = useState("");
  const [billsTo, setBillsTo] = useState("");
  const [billsDialogOpen, setBillsDialogOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [p, t, s, c, b] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("sales").select("*").order("date", { ascending: false }),
        supabase.from("customers").select("*").order("name"),
        supabase.from("bills").select("*").order("due_date", { ascending: false }),
      ]);
      setProducts(p.data || []);
      setTransactions(t.data || []);
      setSales(s.data || []);
      setCustomers(c.data || []);
      setBills(b.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const categoryMap = new Map<string, number>();
  products.forEach(p => categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + p.stock));
  const categoryData = Array.from(categoryMap, ([name, value]) => ({ name: name || "Sem categoria", value }));

  const dayMap = new Map<string, { entradas: number; saidas: number }>();
  transactions.forEach(t => {
    const d = dayMap.get(t.date) || { entradas: 0, saidas: 0 };
    if (t.type === "entrada") d.entradas += Number(t.amount);
    else d.saidas += Number(t.amount);
    dayMap.set(t.date, d);
  });
  const financialData = Array.from(dayMap, ([date, data]) => ({ date, ...data })).reverse();

  const totalEntradas = transactions.filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = transactions.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);

  // Print handlers
  const printFinanceiro = () => {
    const rows = financialData.map(d => `
      <tr>
        <td>${d.date}</td>
        <td style="color:green">${formatCurrency(d.entradas)}</td>
        <td style="color:red">${formatCurrency(d.saidas)}</td>
        <td>${formatCurrency(d.entradas - d.saidas)}</td>
      </tr>
    `).join("");

    printA4({
      title: "Relatório Financeiro",
      subtitle: `Movimentações — ${transactions.length} registros`,
      content: `
        <div class="highlight-box">
          <div class="summary-row"><span>Total Entradas:</span><span style="color:green">${formatCurrency(totalEntradas)}</span></div>
          <div class="summary-row"><span>Total Saídas:</span><span style="color:red">${formatCurrency(totalSaidas)}</span></div>
          <div class="summary-row total"><span>Saldo:</span><span>${formatCurrency(totalEntradas - totalSaidas)}</span></div>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Entradas</th><th>Saídas</th><th>Saldo Dia</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" style="text-align:center">Sem dados</td></tr>'}</tbody>
        </table>
      `,
    });
  };

  const printEstoque = () => {
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
    const rows = sorted.map(p => {
      const isLow = p.stock <= p.min_stock;
      return `<tr style="${isLow ? 'background:#fff5f5' : ''}">
        <td>${p.sku}</td>
        <td>${p.name}</td>
        <td>${p.category || "—"}</td>
        <td style="text-align:right">${p.stock} ${p.unit}</td>
        <td style="text-align:right">${p.min_stock} ${p.unit}</td>
        <td style="text-align:right">${formatCurrency(p.cost)}</td>
        <td style="text-align:right">${formatCurrency(p.price)}</td>
        <td style="text-align:right;font-weight:600">${formatCurrency(p.stock * p.price)}</td>
      </tr>`;
    }).join("");

    const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0);
    const totalCost = products.reduce((s, p) => s + p.stock * p.cost, 0);
    const lowCount = products.filter(p => p.stock <= p.min_stock).length;

    printA4({
      title: "Relatório de Estoque",
      subtitle: `${products.length} produtos cadastrados`,
      orientation: "landscape",
      content: `
        <div class="highlight-box">
          <div class="summary-row"><span>Valor Total em Estoque (Venda):</span><span>${formatCurrency(totalValue)}</span></div>
          <div class="summary-row"><span>Custo Total em Estoque:</span><span>${formatCurrency(totalCost)}</span></div>
          <div class="summary-row"><span>Produtos com Estoque Baixo:</span><span style="color:red">${lowCount}</span></div>
        </div>
        <table>
          <thead><tr><th>SKU</th><th>Produto</th><th>Categoria</th><th style="text-align:right">Estoque</th><th style="text-align:right">Mínimo</th><th style="text-align:right">Custo</th><th style="text-align:right">Preço</th><th style="text-align:right">Valor Total</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8" style="text-align:center">Sem produtos</td></tr>'}</tbody>
        </table>
      `,
    });
  };

  const printVendas = () => {
    const rows = sales.map(s => `
      <tr>
        <td>${s.date}</td>
        <td>${s.customer_name || "—"}</td>
        <td>${s.payment_method}</td>
        <td style="text-align:right;font-weight:600">${formatCurrency(Number(s.total))}</td>
      </tr>
    `).join("");

    const totalVendas = sales.reduce((sum, s) => sum + Number(s.total), 0);

    printA4({
      title: "Relatório de Vendas",
      subtitle: `${sales.length} vendas realizadas`,
      content: `
        <div class="highlight-box">
          <div class="summary-row total"><span>Faturamento Total:</span><span>${formatCurrency(totalVendas)}</span></div>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Pagamento</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" style="text-align:center">Sem vendas</td></tr>'}</tbody>
        </table>
      `,
    });
  };

  const printClientes = () => {
    const rows = customers.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.document_type?.toUpperCase() || ""}: ${c.document || "—"}</td>
        <td>${c.phone || "—"}</td>
        <td>${c.email || "—"}</td>
        <td>${c.city || "—"}${c.state ? "/" + c.state : ""}</td>
      </tr>
    `).join("");

    printA4({
      title: "Relatório de Clientes",
      subtitle: `${customers.length} clientes cadastrados`,
      content: `
        <table>
          <thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th>Cidade/UF</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center">Sem clientes</td></tr>'}</tbody>
        </table>
      `,
    });
  };

  const printMargem = () => {
    const sorted = [...products].sort((a, b) => (b.price - b.cost) - (a.price - a.cost));
    const rows = sorted.map((p, i) => {
      const margin = p.price - p.cost;
      const pct = p.price > 0 ? ((margin / p.price) * 100).toFixed(1) : "0";
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${p.name}</td>
        <td style="text-align:right">${formatCurrency(p.cost)}</td>
        <td style="text-align:right">${formatCurrency(p.price)}</td>
        <td style="text-align:right;font-weight:600;color:green">${formatCurrency(margin)}</td>
        <td style="text-align:right">${pct}%</td>
      </tr>`;
    }).join("");

    printA4({
      title: "Relatório de Margem de Lucro",
      subtitle: `${products.length} produtos analisados`,
      content: `
        <table>
          <thead><tr><th>#</th><th>Produto</th><th style="text-align:right">Custo</th><th style="text-align:right">Preço</th><th style="text-align:right">Margem R$</th><th style="text-align:right">Margem %</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center">Sem produtos</td></tr>'}</tbody>
        </table>
      `,
    });
  };

  const getFilteredBills = (type: "pagar" | "receber") => {
    return bills.filter(b => {
      if (b.type !== type) return false;
      if (billsFrom && b.due_date < billsFrom) return false;
      if (billsTo && b.due_date > billsTo) return false;
      return true;
    });
  };

  const printContas = (type: "pagar" | "receber") => {
    const filtered = getFilteredBills(type);
    const label = type === "pagar" ? "Pagar" : "Receber";
    const totalPago = filtered.filter(b => b.paid).reduce((s: number, b: any) => s + Number(b.amount), 0);
    const totalPendente = filtered.filter(b => !b.paid).reduce((s: number, b: any) => s + Number(b.amount), 0);
    const totalAtrasado = filtered.filter(b => !b.paid && b.due_date < new Date().toISOString().slice(0, 10)).reduce((s: number, b: any) => s + Number(b.amount), 0);

    const rows = filtered.map(b => {
      const isOverdue = !b.paid && b.due_date < new Date().toISOString().slice(0, 10);
      const status = b.paid ? "Pago" : isOverdue ? "Atrasado" : "Pendente";
      const color = b.paid ? "green" : isOverdue ? "red" : "orange";
      return `<tr>
        <td>${b.due_date}</td>
        <td>${b.description}</td>
        <td>${b.payment_method || "—"}</td>
        <td style="text-align:right">${formatCurrency(Number(b.amount))}</td>
        <td style="color:${color};font-weight:600">${status}</td>
      </tr>`;
    }).join("");

    const periodo = billsFrom || billsTo
      ? `Período: ${billsFrom || "início"} a ${billsTo || "hoje"}`
      : "Todos os períodos";

    printA4({
      title: `Relatório de Contas a ${label}`,
      subtitle: `${filtered.length} registros — ${periodo}`,
      content: `
        <div class="highlight-box">
          <div class="summary-row"><span>Total Pago:</span><span style="color:green">${formatCurrency(totalPago)}</span></div>
          <div class="summary-row"><span>Total Pendente:</span><span style="color:orange">${formatCurrency(totalPendente)}</span></div>
          <div class="summary-row"><span>Total Atrasado:</span><span style="color:red">${formatCurrency(totalAtrasado)}</span></div>
          <div class="summary-row total"><span>Total Geral:</span><span>${formatCurrency(totalPago + totalPendente)}</span></div>
        </div>
        <table>
          <thead><tr><th>Vencimento</th><th>Descrição</th><th>Pagamento</th><th style="text-align:right">Valor</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center">Sem registros</td></tr>'}</tbody>
        </table>
      `,
    });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  const billsPagar = getFilteredBills("pagar");
  const billsReceber = getFilteredBills("receber");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise de estoque e financeiro</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printFinanceiro}><Printer className="h-3.5 w-3.5 mr-1.5" />Financeiro</Button>
          <Button variant="outline" size="sm" onClick={printEstoque}><Printer className="h-3.5 w-3.5 mr-1.5" />Estoque</Button>
          <Button variant="outline" size="sm" onClick={printVendas}><Printer className="h-3.5 w-3.5 mr-1.5" />Vendas</Button>
          <Button variant="outline" size="sm" onClick={printClientes}><Printer className="h-3.5 w-3.5 mr-1.5" />Clientes</Button>
          <Button variant="outline" size="sm" onClick={printMargem}><Printer className="h-3.5 w-3.5 mr-1.5" />Margem</Button>
          <Button variant="outline" size="sm" onClick={() => setBillsDialogOpen(true)}><Printer className="h-3.5 w-3.5 mr-1.5" />Contas</Button>
        </div>
      </div>

      {/* Dialog de filtro por período para contas */}
      <Dialog open={billsDialogOpen} onOpenChange={setBillsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Contas a Pagar e Receber</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={billsFrom} onChange={e => setBillsFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={billsTo} onChange={e => setBillsTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setBillsFrom(""); setBillsTo(""); }}>Limpar</Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={() => printContas("pagar")}><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir Pagar</Button>
              <Button size="sm" onClick={() => printContas("receber")}><Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir Receber</Button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Contas a Pagar ({billsPagar.length})</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billsPagar.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem registros</TableCell></TableRow>
                  ) : billsPagar.map(b => {
                    const isOverdue = !b.paid && b.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <TableRow key={b.id}>
                        <TableCell>{b.due_date}</TableCell>
                        <TableCell>{b.description}</TableCell>
                        <TableCell>{b.payment_method || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(b.amount))}</TableCell>
                        <TableCell>
                          <Badge variant={b.paid ? "default" : isOverdue ? "destructive" : "secondary"}>
                            {b.paid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="text-sm text-right mt-1 font-semibold">
                Total: {formatCurrency(billsPagar.reduce((s: number, b: any) => s + Number(b.amount), 0))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Contas a Receber ({billsReceber.length})</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billsReceber.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem registros</TableCell></TableRow>
                  ) : billsReceber.map(b => {
                    const isOverdue = !b.paid && b.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <TableRow key={b.id}>
                        <TableCell>{b.due_date}</TableCell>
                        <TableCell>{b.description}</TableCell>
                        <TableCell>{b.payment_method || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(b.amount))}</TableCell>
                        <TableCell>
                          <Badge variant={b.paid ? "default" : isOverdue ? "destructive" : "secondary"}>
                            {b.paid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="text-sm text-right mt-1 font-semibold">
                Total: {formatCurrency(billsReceber.reduce((s: number, b: any) => s + Number(b.amount), 0))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg shadow-card border p-5">
          <h2 className="font-semibold mb-4">Movimentação Financeira</h2>
          {financialData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="entradas" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="saidas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">Sem dados ainda</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border p-5">
          <h2 className="font-semibold mb-4">Estoque por Categoria</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">Sem produtos cadastrados</p>}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg shadow-card border">
        <div className="p-5 border-b"><h2 className="font-semibold">Produtos com Maior Margem</h2></div>
        <div className="divide-y">
          {[...products].sort((a, b) => (b.price - b.cost) - (a.price - a.cost)).slice(0, 5).map((p, i) => {
            const margin = p.price - p.cost;
            const pct = p.price > 0 ? ((margin / p.price) * 100).toFixed(1) : "0";
            return (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Venda: {formatCurrency(p.price)} · Custo: {formatCurrency(p.cost)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-success">{formatCurrency(margin)}</p>
                  <p className="text-xs text-muted-foreground">{pct}%</p>
                </div>
              </div>
            );
          })}
          {products.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum produto cadastrado</div>}
        </div>
      </motion.div>
    </div>
  );
};

export default Relatorios;
