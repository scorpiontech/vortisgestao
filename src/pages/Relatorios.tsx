import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Search, FileSpreadsheet, FileText, Receipt, X } from "lucide-react";
import { printA4, PrintCompanyInfo } from "@/lib/printA4";
import { printThermal, ThermalLine } from "@/lib/printThermal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSellerName } from "@/hooks/useSellerName";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ReportColumn,
  ReportDefinition,
  buildReportTableHtml,
  exportReportCsv,
  exportReportXlsx,
} from "@/lib/reportExport";
import { PERIOD_PRESETS, PeriodPresetKey, buildFilterLines, formatDateBR, periodLabel, resolvePeriodPreset } from "@/lib/reportPeriod";
import { chartToDataUrl } from "@/lib/chartCapture";

const COLORS = ["hsl(215, 80%, 50%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)"];

const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v || 0).toFixed(1)}%`;
const today = () => new Date().toISOString().slice(0, 10);

interface PeriodState {
  from: string;
  to: string;
}

const emptyPeriod: PeriodState = { from: "", to: "" };

const Relatorios = () => {
  const sellerName = useSellerName();
  const { isMaster, effectiveUserId } = useUserRole();

  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);
  const [asaasCharges, setAsaasCharges] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [company, setCompany] = useState<PrintCompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Períodos e filtros
  const [finPeriod, setFinPeriod] = useState<PeriodState>(emptyPeriod);
  const [finCategoria, setFinCategoria] = useState("");
  const [finPagamento, setFinPagamento] = useState("");

  const [vendasPeriod, setVendasPeriod] = useState<PeriodState>(emptyPeriod);
  const [vendasCliente, setVendasCliente] = useState("");
  const [vendasPagamento, setVendasPagamento] = useState("");
  const [vendasVendedor, setVendasVendedor] = useState("");
  const [vendasCaixaId, setVendasCaixaId] = useState("");

  const [estoquePeriod, setEstoquePeriod] = useState<PeriodState>(emptyPeriod);
  const [estoqueCategoria, setEstoqueCategoria] = useState("");
  const [estoqueFornecedor, setEstoqueFornecedor] = useState("");
  const [estoqueFabricante, setEstoqueFabricante] = useState("");
  const [estoqueSoBaixo, setEstoqueSoBaixo] = useState(false);

  const [margemPeriod, setMargemPeriod] = useState<PeriodState>(emptyPeriod);
  const [margemCategoria, setMargemCategoria] = useState("");

  const [clienteNome, setClienteNome] = useState("");

  const [billsPeriod, setBillsPeriod] = useState<PeriodState>(emptyPeriod);
  const [billsStatus, setBillsStatus] = useState("");
  const [billsDialogOpen, setBillsDialogOpen] = useState(false);

  const [asaasPeriod, setAsaasPeriod] = useState<PeriodState>(emptyPeriod);
  const [asaasDialogOpen, setAsaasDialogOpen] = useState(false);

  // Período dos relatórios gerenciais
  const [anaPeriod, setAnaPeriod] = useState<PeriodState>(emptyPeriod);
  const [topN, setTopN] = useState(10);

  const finChartRef = useRef<HTMLDivElement>(null);
  const catChartRef = useRef<HTMLDivElement>(null);
  const mvChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const [p, t, s, si, sm, c, sup, b, cr, ac] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("sales").select("*").order("date", { ascending: false }),
        supabase.from("sale_items").select("*"),
        supabase.from("stock_movements").select("*").order("created_at", { ascending: false }),
        supabase.from("customers").select("*").order("name"),
        supabase.from("suppliers").select("id, name").order("name"),
        supabase.from("bills").select("*").order("due_date", { ascending: false }),
        supabase.from("cash_registers").select("*").order("opened_at", { ascending: false }),
        supabase.from("customer_charges").select("*").order("created_at", { ascending: false }),
      ]);
      setProducts(p.data || []);
      setTransactions(t.data || []);
      setSales(s.data || []);
      setSaleItems(si.data || []);
      setStockMovements(sm.data || []);
      setCustomers(c.data || []);
      setSuppliers(sup.data || []);
      setBills(b.data || []);
      setCashRegisters(cr.data || []);
      setAsaasCharges(ac.data || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!effectiveUserId) return;
    const loadCompany = async () => {
      const [{ data: reg }, { data: mem }] = await Promise.all([
        supabase.from("company_registrations").select("*").eq("user_id", effectiveUserId).maybeSingle(),
        supabase.from("company_members").select("user_id, name, email").eq("owner_id", effectiveUserId),
      ]);
      if (reg) {
        const address = [reg.street, reg.number, reg.neighborhood, reg.city && `${reg.city}/${reg.state}`, reg.zip_code]
          .filter(Boolean)
          .join(", ");
        setCompany({ name: reg.name, document: reg.document, address, phone: reg.phone });
      }
      setMembers(mem || []);
    };
    loadCompany();
  }, [effectiveUserId]);

  const memberName = (userId?: string | null) =>
    members.find((m) => m.user_id === userId)?.name || (userId === effectiveUserId ? sellerName : "—");

  // ============ Helpers ============
  const inPeriod = (value: string | null | undefined, period: PeriodState) => {
    const d = value?.slice(0, 10);
    if (!d) return false;
    if (period.from && d < period.from) return false;
    if (period.to && d > period.to) return false;
    return true;
  };

  const saleDateById = useMemo(() => {
    const map = new Map<string, any>();
    sales.forEach((s) => map.set(s.id, s));
    return map;
  }, [sales]);

  const productById = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products]
  );
  const manufacturers = useMemo(
    () => Array.from(new Set(products.map((p) => p.manufacturer).filter(Boolean))).sort(),
    [products]
  );
  const paymentMethods = useMemo(
    () => Array.from(new Set([...sales.map((s) => s.payment_method), ...transactions.map((t) => t.payment_method)].filter(Boolean))).sort(),
    [sales, transactions]
  );
  const transactionCategories = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category).filter(Boolean))).sort(),
    [transactions]
  );

  // ============ Financeiro ============
  const filteredTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        if (!inPeriod(t.date, finPeriod)) return false;
        if (finCategoria && t.category !== finCategoria) return false;
        if (finPagamento && t.payment_method !== finPagamento) return false;
        return true;
      }),
    [transactions, finPeriod, finCategoria, finPagamento]
  );

  const financialData = useMemo(() => {
    const dayMap = new Map<string, { entradas: number; saidas: number }>();
    filteredTransactions.forEach((t) => {
      const d = dayMap.get(t.date) || { entradas: 0, saidas: 0 };
      if (t.type === "entrada") d.entradas += Number(t.amount);
      else d.saidas += Number(t.amount);
      dayMap.set(t.date, d);
    });
    return Array.from(dayMap, ([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const totalEntradas = filteredTransactions.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = filteredTransactions.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);

  // ============ Vendas ============
  const filteredSales = useMemo(() => {
    let list = sales.filter((s) => inPeriod(s.date, vendasPeriod));
    if (vendasCliente) list = list.filter((s) => (s.customer_name || "").toLowerCase().includes(vendasCliente.toLowerCase()));
    if (vendasPagamento) list = list.filter((s) => s.payment_method === vendasPagamento);
    if (vendasVendedor) list = list.filter((s) => s.user_id === vendasVendedor);
    if (vendasCaixaId) {
      const caixa = cashRegisters.find((c) => c.id === vendasCaixaId);
      if (caixa) list = list.filter((s) => s.date >= caixa.opened_at && (!caixa.closed_at || s.date <= caixa.closed_at));
    }
    return list;
  }, [sales, vendasPeriod, vendasCliente, vendasPagamento, vendasVendedor, vendasCaixaId, cashRegisters]);

  // ============ Estoque / Margem ============
  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if ((estoquePeriod.from || estoquePeriod.to) && !inPeriod(p.created_at, estoquePeriod)) return false;
        if (estoqueCategoria && p.category !== estoqueCategoria) return false;
        if (estoqueFornecedor && p.supplier_id !== estoqueFornecedor) return false;
        if (estoqueFabricante && p.manufacturer !== estoqueFabricante) return false;
        if (estoqueSoBaixo && Number(p.stock) > Number(p.min_stock)) return false;
        return true;
      }),
    [products, estoquePeriod, estoqueCategoria, estoqueFornecedor, estoqueFabricante, estoqueSoBaixo]
  );

  const filteredMargemProducts = useMemo(
    () =>
      products.filter((p) => {
        if ((margemPeriod.from || margemPeriod.to) && !inPeriod(p.created_at, margemPeriod)) return false;
        if (margemCategoria && p.category !== margemCategoria) return false;
        return true;
      }),
    [products, margemPeriod, margemCategoria]
  );

  const filteredCustomers = useMemo(
    () => (clienteNome ? customers.filter((c) => c.name.toLowerCase().includes(clienteNome.toLowerCase())) : customers),
    [customers, clienteNome]
  );

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => map.set(p.category || "Sem categoria", (map.get(p.category || "Sem categoria") || 0) + Number(p.stock)));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [products]);

  // ============ Contas / Cobranças ============
  const getFilteredBills = (type: "pagar" | "receber") =>
    bills.filter((b) => {
      if (b.type !== type) return false;
      if (billsPeriod.from && b.due_date < billsPeriod.from) return false;
      if (billsPeriod.to && b.due_date > billsPeriod.to) return false;
      const overdue = !b.paid && b.due_date < today();
      if (billsStatus === "pago" && !b.paid) return false;
      if (billsStatus === "pendente" && (b.paid || overdue)) return false;
      if (billsStatus === "atrasado" && !overdue) return false;
      return true;
    });

  const getFilteredCharges = () => asaasCharges.filter((c) => inPeriod(c.created_at, asaasPeriod));

  // ============ Relatórios gerenciais ============
  const anaSaleItems = useMemo(
    () =>
      saleItems
        .map((it) => ({ ...it, sale: saleDateById.get(it.sale_id) }))
        .filter((it) => it.sale && inPeriod(it.sale.date, anaPeriod)),
    [saleItems, saleDateById, anaPeriod]
  );

  const anaSales = useMemo(() => sales.filter((s) => inPeriod(s.date, anaPeriod)), [sales, anaPeriod]);

  const maisVendidos = useMemo(() => {
    const map = new Map<string, { name: string; qtd: number; receita: number; vendas: Set<string> }>();
    anaSaleItems.forEach((it) => {
      const key = it.product_id || it.product_name;
      const entry = map.get(key) || { name: it.product_name, qtd: 0, receita: 0, vendas: new Set<string>() };
      entry.qtd += Number(it.quantity);
      entry.receita += Number(it.total);
      entry.vendas.add(it.sale_id);
      map.set(key, entry);
    });
    return Array.from(map.values())
      .map((e) => ({ name: e.name, qtd: e.qtd, receita: e.receita, ticket: e.vendas.size ? e.receita / e.vendas.size : 0 }))
      .sort((a, b) => b.receita - a.receita);
  }, [anaSaleItems]);

  const vendasPorVendedor = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    anaSales.forEach((s) => {
      const key = s.user_id || "—";
      const entry = map.get(key) || { nome: memberName(s.user_id), qtd: 0, total: 0 };
      entry.qtd += 1;
      entry.total += Number(s.total);
      map.set(key, entry);
    });
    const geral = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
    return Array.from(map.values())
      .map((v) => ({ ...v, ticket: v.qtd ? v.total / v.qtd : 0, participacao: geral ? (v.total / geral) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [anaSales, members, sellerName]);

  const curvaABC = useMemo(() => {
    const total = maisVendidos.reduce((s, p) => s + p.receita, 0);
    let acumulado = 0;
    return maisVendidos.map((p) => {
      acumulado += p.receita;
      const acumPct = total ? (acumulado / total) * 100 : 0;
      const classe = acumPct <= 80 ? "A" : acumPct <= 95 ? "B" : "C";
      return { ...p, participacao: total ? (p.receita / total) * 100 : 0, acumulado: acumPct, classe };
    });
  }, [maisVendidos]);

  const giroEstoque = useMemo(() => {
    const saidas = new Map<string, number>();
    stockMovements
      .filter((m) => m.type === "saida" && inPeriod(m.created_at, anaPeriod))
      .forEach((m) => saidas.set(m.product_id, (saidas.get(m.product_id) || 0) + Number(m.quantity)));
    const dias = anaPeriod.from && anaPeriod.to
      ? Math.max(1, (new Date(anaPeriod.to).getTime() - new Date(anaPeriod.from).getTime()) / 86400000 + 1)
      : 30;
    return products
      .map((p) => {
        const saida = saidas.get(p.id) || 0;
        const mediaDia = saida / dias;
        return {
          name: p.name,
          sku: p.sku,
          estoque: Number(p.stock),
          saida,
          giro: Number(p.stock) > 0 ? saida / Number(p.stock) : 0,
          cobertura: mediaDia > 0 ? Number(p.stock) / mediaDia : 0,
          parado: saida === 0,
        };
      })
      .sort((a, b) => b.saida - a.saida);
  }, [products, stockMovements, anaPeriod]);

  const dre = useMemo(() => {
    const receitas = anaSales.reduce((s, v) => s + Number(v.total), 0);
    const cmv = anaSaleItems.reduce((s, it) => {
      const prod = it.product_id ? productById.get(it.product_id) : null;
      return s + Number(prod?.cost || 0) * Number(it.quantity);
    }, 0);
    const despesasMap = new Map<string, number>();
    transactions
      .filter((t) => t.type === "saida" && inPeriod(t.date, anaPeriod))
      .forEach((t) => despesasMap.set(t.category || "Sem categoria", (despesasMap.get(t.category || "Sem categoria") || 0) + Number(t.amount)));
    const despesas = Array.from(despesasMap, ([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
    const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
    const lucroBruto = receitas - cmv;
    const resultado = lucroBruto - totalDespesas;
    return {
      receitas,
      cmv,
      lucroBruto,
      despesas,
      totalDespesas,
      resultado,
      margemBruta: receitas ? (lucroBruto / receitas) * 100 : 0,
      margemLiquida: receitas ? (resultado / receitas) * 100 : 0,
    };
  }, [anaSales, anaSaleItems, transactions, anaPeriod, productById]);

  const resumoCaixas = useMemo(
    () =>
      cashRegisters
        .filter((c) => inPeriod(c.opened_at, anaPeriod))
        .map((c) => {
          const vendasCaixa = sales.filter((s) => s.date >= c.opened_at && (!c.closed_at || s.date <= c.closed_at));
          const porPagamento = new Map<string, number>();
          vendasCaixa.forEach((s) => porPagamento.set(s.payment_method, (porPagamento.get(s.payment_method) || 0) + Number(s.total)));
          const diff = c.closing_amount != null && c.expected_amount != null ? Number(c.closing_amount) - Number(c.expected_amount) : null;
          return {
            id: c.id,
            abertura: new Date(c.opened_at).toLocaleString("pt-BR"),
            fechamento: c.closed_at ? new Date(c.closed_at).toLocaleString("pt-BR") : "Em aberto",
            operador: memberName(c.user_id),
            opening: Number(c.opening_amount || 0),
            expected: c.expected_amount != null ? Number(c.expected_amount) : 0,
            closing: c.closing_amount != null ? Number(c.closing_amount) : 0,
            diff,
            vendas: vendasCaixa.reduce((s, v) => s + Number(v.total), 0),
            qtdVendas: vendasCaixa.length,
            porPagamento: Array.from(porPagamento, ([metodo, valor]) => ({ metodo, valor })),
          };
        }),
    [cashRegisters, sales, anaPeriod, members, sellerName]
  );

  // ============ Definições de relatório ============
  const commonMeta = (title: string, filename: string, subtitle: string, filters: string[]) => ({
    title,
    filename,
    subtitle,
    filters,
    companyName: company?.name,
    sellerName,
  });

  const defFinanceiro = (): ReportDefinition<any> => ({
    ...commonMeta(
      "Relatório Financeiro",
      "relatorio_financeiro",
      `${filteredTransactions.length} registros — ${periodLabel(finPeriod.from, finPeriod.to)}`,
      buildFilterLines({ Período: periodLabel(finPeriod.from, finPeriod.to), Categoria: finCategoria, "Forma de pagamento": finPagamento })
    ),
    columns: [
      { header: "Data", value: (r) => formatDateBR(r.date), width: 14 },
      { header: "Entradas", value: (r) => r.entradas, currency: true },
      { header: "Saídas", value: (r) => r.saidas, currency: true },
      { header: "Saldo do dia", value: (r) => r.entradas - r.saidas, currency: true },
    ],
    rows: financialData,
    summary: [
      ["Total Entradas", totalEntradas],
      ["Total Saídas", totalSaidas],
      ["Saldo", totalEntradas - totalSaidas],
    ],
  });

  const defVendas = (): ReportDefinition<any> => ({
    ...commonMeta(
      "Relatório de Vendas",
      "relatorio_vendas",
      `${filteredSales.length} vendas — ${periodLabel(vendasPeriod.from, vendasPeriod.to)}`,
      buildFilterLines({
        Período: periodLabel(vendasPeriod.from, vendasPeriod.to),
        Cliente: vendasCliente,
        Pagamento: vendasPagamento,
        Vendedor: vendasVendedor ? memberName(vendasVendedor) : "",
        Caixa: vendasCaixaId ? "filtrado" : "",
      })
    ),
    columns: [
      { header: "Data", value: (r) => formatDateBR(r.date), width: 14 },
      { header: "Cliente", value: (r) => r.customer_name || "—", width: 28 },
      { header: "Vendedor", value: (r) => memberName(r.user_id), width: 22 },
      { header: "Pagamento", value: (r) => r.payment_method || "—", width: 16 },
      { header: "Parcelas", value: (r) => r.installments || 1, align: "center" },
      { header: "Desconto", value: (r) => Number(r.discount || 0), currency: true },
      { header: "Total", value: (r) => Number(r.total), currency: true },
    ],
    rows: filteredSales,
    summary: [
      ["Quantidade de vendas", filteredSales.length],
      ["Ticket médio", filteredSales.length ? filteredSales.reduce((s, v) => s + Number(v.total), 0) / filteredSales.length : 0],
      ["Faturamento total", filteredSales.reduce((s, v) => s + Number(v.total), 0)],
    ],
  });

  const defEstoque = (): ReportDefinition<any> => ({
    ...commonMeta(
      "Relatório de Estoque",
      "relatorio_estoque",
      `${filteredProducts.length} produtos — ${periodLabel(estoquePeriod.from, estoquePeriod.to)}`,
      buildFilterLines({
        Período: estoquePeriod.from || estoquePeriod.to ? periodLabel(estoquePeriod.from, estoquePeriod.to) : "",
        Categoria: estoqueCategoria,
        Fornecedor: suppliers.find((s) => s.id === estoqueFornecedor)?.name,
        Fabricante: estoqueFabricante,
        Situação: estoqueSoBaixo ? "Somente estoque baixo" : "",
      })
    ),
    columns: [
      { header: "SKU", value: (r) => r.sku || "—", width: 16 },
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Categoria", value: (r) => r.category || "—", width: 18 },
      { header: "Fabricante", value: (r) => r.manufacturer || "—", width: 18 },
      { header: "Estoque", value: (r) => `${r.stock} ${r.unit || ""}`.trim(), align: "right" },
      { header: "Mínimo", value: (r) => `${r.min_stock} ${r.unit || ""}`.trim(), align: "right" },
      { header: "Custo", value: (r) => Number(r.cost), currency: true },
      { header: "Preço", value: (r) => Number(r.price), currency: true },
      { header: "Valor total", value: (r) => Number(r.stock) * Number(r.price), currency: true },
    ],
    rows: [...filteredProducts].sort((a, b) => a.name.localeCompare(b.name)),
    summary: [
      ["Custo total", filteredProducts.reduce((s, p) => s + Number(p.stock) * Number(p.cost), 0)],
      ["Produtos com estoque baixo", filteredProducts.filter((p) => Number(p.stock) <= Number(p.min_stock)).length],
      ["Valor total (venda)", filteredProducts.reduce((s, p) => s + Number(p.stock) * Number(p.price), 0)],
    ],
  });

  const defMargem = (): ReportDefinition<any> => ({
    ...commonMeta(
      "Relatório de Margem de Lucro",
      "relatorio_margem",
      `${filteredMargemProducts.length} produtos — ${periodLabel(margemPeriod.from, margemPeriod.to)}`,
      buildFilterLines({
        Período: margemPeriod.from || margemPeriod.to ? periodLabel(margemPeriod.from, margemPeriod.to) : "",
        Categoria: margemCategoria,
      })
    ),
    columns: [
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Categoria", value: (r) => r.category || "—", width: 18 },
      { header: "Custo", value: (r) => Number(r.cost), currency: true },
      { header: "Preço", value: (r) => Number(r.price), currency: true },
      { header: "Margem R$", value: (r) => Number(r.price) - Number(r.cost), currency: true },
      { header: "Margem %", value: (r) => (Number(r.price) > 0 ? pct(((r.price - r.cost) / r.price) * 100) : "0,0%"), align: "right" },
    ],
    rows: [...filteredMargemProducts].sort((a, b) => b.price - b.cost - (a.price - a.cost)),
  });

  const defClientes = (): ReportDefinition<any> => ({
    ...commonMeta(
      "Relatório de Clientes",
      "relatorio_clientes",
      `${filteredCustomers.length} clientes`,
      buildFilterLines({ Nome: clienteNome })
    ),
    columns: [
      { header: "Nome", value: (r) => r.name, width: 30 },
      { header: "Documento", value: (r) => `${r.document_type?.toUpperCase() || ""} ${r.document || "—"}`.trim(), width: 22 },
      { header: "Telefone", value: (r) => r.phone || "—", width: 18 },
      { header: "E-mail", value: (r) => r.email || "—", width: 28 },
      { header: "Cidade/UF", value: (r) => `${r.city || "—"}${r.state ? "/" + r.state : ""}`, width: 20 },
    ],
    rows: filteredCustomers,
  });

  const defContas = (type: "pagar" | "receber"): ReportDefinition<any> => {
    const rows = getFilteredBills(type);
    const pago = rows.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0);
    const atrasado = rows.filter((b) => !b.paid && b.due_date < today()).reduce((s, b) => s + Number(b.amount), 0);
    const pendente = rows.filter((b) => !b.paid && b.due_date >= today()).reduce((s, b) => s + Number(b.amount), 0);
    return {
      ...commonMeta(
        `Relatório de Contas a ${type === "pagar" ? "Pagar" : "Receber"}`,
        `relatorio_contas_${type}`,
        `${rows.length} registros — ${periodLabel(billsPeriod.from, billsPeriod.to)}`,
        buildFilterLines({ Período: periodLabel(billsPeriod.from, billsPeriod.to), Status: billsStatus })
      ),
      columns: [
        { header: "Vencimento", value: (r) => formatDateBR(r.due_date), width: 14 },
        { header: "Descrição", value: (r) => r.description, width: 34 },
        { header: "Pagamento", value: (r) => r.payment_method || "—", width: 16 },
        { header: "Valor", value: (r) => Number(r.amount), currency: true },
        {
          header: "Status",
          value: (r) => (r.paid ? "Pago" : r.due_date < today() ? "Atrasado" : "Pendente"),
          width: 14,
        },
      ],
      rows,
      summary: [
        ["Total pago", pago],
        ["Total pendente", pendente],
        ["Total atrasado", atrasado],
        ["Total geral", pago + pendente + atrasado],
      ],
    };
  };

  const chargeStatusLabel = (status: string) =>
    status === "paid" ? "Pago" : status === "overdue" ? "Vencido" : status === "cancelled" ? "Cancelado" : "Pendente";

  const defAsaas = (): ReportDefinition<any> => {
    const rows = getFilteredCharges();
    return {
      ...commonMeta(
        "Relatório de Cobranças",
        "relatorio_cobrancas",
        `${rows.length} cobranças — ${periodLabel(asaasPeriod.from, asaasPeriod.to)}`,
        buildFilterLines({ Período: periodLabel(asaasPeriod.from, asaasPeriod.to) })
      ),
      columns: [
        { header: "Data", value: (r) => formatDateBR(r.created_at), width: 14 },
        { header: "Cliente", value: (r) => r.customer_name, width: 28 },
        { header: "Tipo", value: (r) => r.billing_type, width: 14 },
        { header: "Descrição", value: (r) => r.description || "—", width: 30 },
        { header: "Valor", value: (r) => Number(r.total_amount), currency: true },
        { header: "Status", value: (r) => chargeStatusLabel(r.status), width: 14 },
      ],
      rows,
      summary: [
        ["Recebido", rows.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.total_amount), 0)],
        ["Em aberto", rows.filter((c) => ["pending", "partially_paid"].includes(c.status)).reduce((s, c) => s + Number(c.total_amount), 0)],
        ["Vencido", rows.filter((c) => c.status === "overdue").reduce((s, c) => s + Number(c.total_amount), 0)],
        ["Total geral", rows.reduce((s, c) => s + Number(c.total_amount), 0)],
      ],
    };
  };

  const anaSubtitle = (extra: string) => `${extra} — ${periodLabel(anaPeriod.from, anaPeriod.to)}`;
  const anaFilters = () => buildFilterLines({ Período: periodLabel(anaPeriod.from, anaPeriod.to) });

  const defMaisVendidos = (): ReportDefinition<any> => ({
    ...commonMeta(
      "Produtos Mais Vendidos",
      "relatorio_mais_vendidos",
      anaSubtitle(`Top ${topN} de ${maisVendidos.length} produtos`),
      anaFilters()
    ),
    columns: [
      { header: "#", value: (r) => r.pos, align: "center", width: 6 },
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Qtd. vendida", value: (r) => r.qtd, align: "right" },
      { header: "Faturamento", value: (r) => r.receita, currency: true },
      { header: "Ticket médio", value: (r) => r.ticket, currency: true },
    ],
    rows: maisVendidos.slice(0, topN).map((r, i) => ({ ...r, pos: i + 1 })),
    summary: [["Faturamento dos itens listados", maisVendidos.slice(0, topN).reduce((s, r) => s + r.receita, 0)]],
  });

  const defVendedores = (): ReportDefinition<any> => ({
    ...commonMeta("Vendas por Vendedor", "relatorio_vendedores", anaSubtitle(`${anaSales.length} vendas`), anaFilters()),
    columns: [
      { header: "Vendedor", value: (r) => r.nome, width: 28 },
      { header: "Vendas", value: (r) => r.qtd, align: "right" },
      { header: "Faturamento", value: (r) => r.total, currency: true },
      { header: "Ticket médio", value: (r) => r.ticket, currency: true },
      { header: "Participação", value: (r) => pct(r.participacao), align: "right" },
    ],
    rows: vendasPorVendedor,
    summary: [["Faturamento total", vendasPorVendedor.reduce((s, v) => s + v.total, 0)]],
  });

  const defAbc = (): ReportDefinition<any> => ({
    ...commonMeta("Curva ABC de Produtos", "relatorio_curva_abc", anaSubtitle(`${curvaABC.length} produtos`), anaFilters()),
    columns: [
      { header: "Classe", value: (r) => r.classe, align: "center", width: 8 },
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Faturamento", value: (r) => r.receita, currency: true },
      { header: "Participação", value: (r) => pct(r.participacao), align: "right" },
      { header: "Acumulado", value: (r) => pct(r.acumulado), align: "right" },
    ],
    rows: curvaABC,
    summary: [
      ["Classe A (produtos)", curvaABC.filter((p) => p.classe === "A").length],
      ["Classe B (produtos)", curvaABC.filter((p) => p.classe === "B").length],
      ["Classe C (produtos)", curvaABC.filter((p) => p.classe === "C").length],
    ],
  });

  const defGiro = (): ReportDefinition<any> => ({
    ...commonMeta("Giro de Estoque", "relatorio_giro_estoque", anaSubtitle(`${giroEstoque.length} produtos`), anaFilters()),
    columns: [
      { header: "SKU", value: (r) => r.sku || "—", width: 16 },
      { header: "Produto", value: (r) => r.name, width: 34 },
      { header: "Saídas", value: (r) => r.saida, align: "right" },
      { header: "Estoque atual", value: (r) => r.estoque, align: "right" },
      { header: "Giro", value: (r) => r.giro.toFixed(2), align: "right" },
      { header: "Cobertura (dias)", value: (r) => (r.cobertura ? Math.round(r.cobertura) : "—"), align: "right" },
      { header: "Situação", value: (r) => (r.parado ? "Sem saída no período" : "Em movimento"), width: 22 },
    ],
    rows: giroEstoque,
    summary: [["Produtos sem saída no período", giroEstoque.filter((p) => p.parado).length]],
  });

  const defDre = (): ReportDefinition<any> => {
    const rows: { conta: string; valor: number | string }[] = [
      { conta: "Receita de vendas", valor: dre.receitas },
      { conta: "(-) Custo das mercadorias vendidas (CMV)", valor: -dre.cmv },
      { conta: "= Lucro bruto", valor: dre.lucroBruto },
      ...dre.despesas.map((d) => ({ conta: `(-) Despesa: ${d.categoria}`, valor: -d.valor })),
      { conta: "(-) Total de despesas", valor: -dre.totalDespesas },
      { conta: "= Resultado do período", valor: dre.resultado },
    ];
    return {
      ...commonMeta("DRE Simplificado", "relatorio_dre", anaSubtitle("Demonstrativo de resultado"), anaFilters()),
      columns: [
        { header: "Conta", value: (r) => r.conta, width: 44 },
        { header: "Valor", value: (r) => Number(r.valor), currency: true },
      ],
      rows,
      summary: [
        ["Margem bruta", pct(dre.margemBruta)],
        ["Margem líquida", pct(dre.margemLiquida)],
        ["Resultado do período", dre.resultado],
      ],
    };
  };

  const defCaixa = (): ReportDefinition<any> => ({
    ...commonMeta("Resumo de Caixa", "relatorio_caixa", anaSubtitle(`${resumoCaixas.length} caixas`), anaFilters()),
    columns: [
      { header: "Abertura", value: (r) => r.abertura, width: 20 },
      { header: "Fechamento", value: (r) => r.fechamento, width: 20 },
      { header: "Operador", value: (r) => r.operador, width: 20 },
      { header: "Valor inicial", value: (r) => r.opening, currency: true },
      { header: "Vendas", value: (r) => r.vendas, currency: true },
      { header: "Esperado", value: (r) => r.expected, currency: true },
      { header: "Informado", value: (r) => r.closing, currency: true },
      { header: "Diferença", value: (r) => (r.diff == null ? 0 : r.diff), currency: true },
    ],
    rows: resumoCaixas,
    summary: [
      ["Total de vendas nos caixas", resumoCaixas.reduce((s, c) => s + c.vendas, 0)],
      ["Diferença acumulada", resumoCaixas.reduce((s, c) => s + (c.diff || 0), 0)],
    ],
  });

  // ============ Ações ============
  const summaryHtml = (def: ReportDefinition<any>) =>
    def.summary?.length
      ? `<div class="highlight-box">${def.summary
          .map(
            ([label, value], i) =>
              `<div class="summary-row${i === def.summary!.length - 1 ? " total" : ""}"><span>${label}:</span><span>${
                typeof value === "number" ? fmt(value) : value
              }</span></div>`
          )
          .join("")}</div>`
      : "";

  const printReport = async (
    def: ReportDefinition<any>,
    opts?: { orientation?: "portrait" | "landscape"; chartRefs?: (HTMLElement | null)[] }
  ) => {
    const charts = opts?.chartRefs ? await Promise.all(opts.chartRefs.map((r) => chartToDataUrl(r))) : [];
    printA4({
      title: def.title,
      subtitle: def.subtitle,
      sellerName,
      company,
      filters: def.filters,
      charts,
      orientation: opts?.orientation,
      content: summaryHtml(def) + buildReportTableHtml(def.columns as ReportColumn<any>[], def.rows, fmt),
    });
  };

  const ReportActions = ({
    def,
    orientation,
    chartRefs,
    extra,
  }: {
    def: () => ReportDefinition<any>;
    orientation?: "portrait" | "landscape";
    chartRefs?: () => (HTMLElement | null)[];
    extra?: React.ReactNode;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {extra}
      <Button variant="outline" size="sm" onClick={() => printReport(def(), { orientation, chartRefs: chartRefs?.() })}>
        <Printer className="h-3.5 w-3.5 mr-1.5" />PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportReportXlsx(def())}>
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportReportCsv(def())}>
        <FileText className="h-3.5 w-3.5 mr-1.5" />CSV
      </Button>
    </div>
  );

  const printCaixaTermico = () => {
    const lines: ThermalLine[] = [];
    resumoCaixas.forEach((c, idx) => {
      if (idx > 0) lines.push({ divider: true });
      lines.push({ label: `Caixa ${idx + 1} — ${c.operador}`, bold: true });
      lines.push({ label: "Abertura", value: c.abertura });
      lines.push({ label: "Fechamento", value: c.fechamento });
      lines.push({ label: "Valor inicial", value: fmt(c.opening) });
      lines.push({ label: `Vendas (${c.qtdVendas})`, value: fmt(c.vendas) });
      c.porPagamento.forEach((p) => lines.push({ label: `  ${p.metodo}`, value: fmt(p.valor) }));
      lines.push({ label: "Esperado", value: fmt(c.expected) });
      lines.push({ label: "Informado", value: fmt(c.closing) });
      lines.push({ label: "Diferença", value: c.diff == null ? "—" : fmt(c.diff), bold: true });
    });
    if (!lines.length) lines.push({ label: "Sem caixas no período" });
    printThermal({
      title: "Resumo de Caixa",
      subtitle: periodLabel(anaPeriod.from, anaPeriod.to),
      companyName: company?.name,
      companyInfo: [company?.document || "", company?.phone || ""].filter(Boolean),
      sellerName,
      lines,
    });
  };

  const printVendasTermico = () => {
    const lines: ThermalLine[] = [];
    const porPagamento = new Map<string, number>();
    filteredSales.forEach((s) => porPagamento.set(s.payment_method, (porPagamento.get(s.payment_method) || 0) + Number(s.total)));
    lines.push({ label: "Vendas", value: String(filteredSales.length) });
    lines.push({ divider: true });
    Array.from(porPagamento).forEach(([metodo, valor]) => lines.push({ label: metodo, value: fmt(valor) }));
    lines.push({ divider: true });
    lines.push({ label: "TOTAL", value: fmt(filteredSales.reduce((s, v) => s + Number(v.total), 0)), bold: true });
    printThermal({
      title: "Resumo de Vendas",
      subtitle: periodLabel(vendasPeriod.from, vendasPeriod.to),
      companyName: company?.name,
      companyInfo: [company?.document || "", company?.phone || ""].filter(Boolean),
      sellerName,
      lines,
    });
  };

  const printContasTermico = () => {
    const lines: ThermalLine[] = [];
    (["pagar", "receber"] as const).forEach((type, idx) => {
      const rows = getFilteredBills(type);
      if (idx > 0) lines.push({ divider: true });
      lines.push({ label: `Contas a ${type === "pagar" ? "Pagar" : "Receber"} (${rows.length})`, bold: true });
      lines.push({ label: "Pago", value: fmt(rows.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0)) });
      lines.push({
        label: "Atrasado",
        value: fmt(rows.filter((b) => !b.paid && b.due_date < today()).reduce((s, b) => s + Number(b.amount), 0)),
      });
      lines.push({
        label: "Pendente",
        value: fmt(rows.filter((b) => !b.paid && b.due_date >= today()).reduce((s, b) => s + Number(b.amount), 0)),
      });
      lines.push({ label: "Total", value: fmt(rows.reduce((s, b) => s + Number(b.amount), 0)), bold: true });
    });
    printThermal({
      title: "Resumo de Contas",
      subtitle: periodLabel(billsPeriod.from, billsPeriod.to),
      companyName: company?.name,
      companyInfo: [company?.document || "", company?.phone || ""].filter(Boolean),
      sellerName,
      lines,
    });
  };

  // ============ UI ============
  const PeriodFilter = ({
    period,
    setPeriod,
    extra,
    onClearExtra,
  }: {
    period: PeriodState;
    setPeriod: (p: PeriodState) => void;
    extra?: React.ReactNode;
    onClearExtra?: () => void;
  }) => (
    <div className="space-y-2 mb-3">
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_PRESETS.map((p) => {
          const range = resolvePeriodPreset(p.key as PeriodPresetKey);
          const active = range.from === period.from && range.to === period.to;
          return (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setPeriod(range)}
            >
              {p.label}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={period.from}
            onChange={(e) => setPeriod({ ...period, from: e.target.value })}
            className="w-36 h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={period.to}
            onChange={(e) => setPeriod({ ...period, to: e.target.value })}
            className="w-36 h-8 text-xs"
          />
        </div>
        {extra}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setPeriod(emptyPeriod);
            onClearExtra?.();
          }}
        >
          <X className="h-3.5 w-3.5 mr-1" />Limpar filtros
        </Button>
      </div>
    </div>
  );

  const SelectFilter = ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <select
        className="h-8 text-xs border rounded px-2 bg-background block w-full min-w-[130px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const Card = ({
    title,
    count,
    actions,
    children,
    delay = 0,
  }: {
    title: string;
    count?: number;
    actions?: React.ReactNode;
    children: React.ReactNode;
    delay?: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card rounded-lg shadow-card border p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold">
          {title}
          {count !== undefined && <span className="text-muted-foreground font-normal text-sm"> ({count})</span>}
        </h2>
        {actions}
      </div>
      {children}
    </motion.div>
  );

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  const billsPagar = getFilteredBills("pagar");
  const billsReceber = getFilteredBills("receber");
  const charges = getFilteredCharges();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Exportação em PDF, Excel e CSV com filtros por período</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAsaasDialogOpen(true)}>
            <Receipt className="h-3.5 w-3.5 mr-1.5" />Cobranças
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBillsDialogOpen(true)}>
            <Receipt className="h-3.5 w-3.5 mr-1.5" />Contas
          </Button>
        </div>
      </div>

      {/* Dialog contas */}
      <Dialog open={billsDialogOpen} onOpenChange={setBillsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Contas a Pagar e Receber</DialogTitle>
          </DialogHeader>
          <PeriodFilter
            period={billsPeriod}
            setPeriod={setBillsPeriod}
            onClearExtra={() => setBillsStatus("")}
            extra={
              <SelectFilter
                label="Status"
                value={billsStatus}
                onChange={setBillsStatus}
                options={[
                  { value: "pago", label: "Pago" },
                  { value: "pendente", label: "Pendente" },
                  { value: "atrasado", label: "Atrasado" },
                ]}
              />
            }
          />
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => printReport(defContas("pagar"))}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />PDF Pagar
            </Button>
            <Button size="sm" variant="outline" onClick={() => printReport(defContas("receber"))}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />PDF Receber
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportReportXlsx(defContas("pagar"))}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Excel Pagar
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportReportXlsx(defContas("receber"))}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Excel Receber
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportReportCsv(defContas("pagar"))}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />CSV Pagar
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportReportCsv(defContas("receber"))}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />CSV Receber
            </Button>
            <Button size="sm" variant="outline" onClick={printContasTermico}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />80mm
            </Button>
          </div>
          <div className="space-y-6">
            {([
              ["Contas a Pagar", billsPagar],
              ["Contas a Receber", billsReceber],
            ] as const).map(([label, rows]) => (
              <div key={label}>
                <h3 className="font-semibold mb-2">
                  {label} ({rows.length})
                </h3>
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
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Sem registros
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((b: any) => {
                        const isOverdue = !b.paid && b.due_date < today();
                        return (
                          <TableRow key={b.id}>
                            <TableCell>{formatDateBR(b.due_date)}</TableCell>
                            <TableCell>{b.description}</TableCell>
                            <TableCell>{b.payment_method || "—"}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(Number(b.amount))}</TableCell>
                            <TableCell>
                              <Badge variant={b.paid ? "default" : isOverdue ? "destructive" : "secondary"}>
                                {b.paid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <div className="text-sm text-right mt-1 font-semibold">
                  Total: {fmt(rows.reduce((s: number, b: any) => s + Number(b.amount), 0))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Cobranças */}
      <Dialog open={asaasDialogOpen} onOpenChange={setAsaasDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Cobranças</DialogTitle>
          </DialogHeader>
          <PeriodFilter period={asaasPeriod} setPeriod={setAsaasPeriod} />
          <ReportActions def={defAsaas} />
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma cobrança no período
                    </TableCell>
                  </TableRow>
                ) : (
                  charges.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{formatDateBR(c.created_at)}</TableCell>
                      <TableCell className="font-medium">{c.customer_name}</TableCell>
                      <TableCell>{c.billing_type}</TableCell>
                      <TableCell className="text-sm">{c.description}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(c.total_amount))}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "paid" ? "default" : c.status === "overdue" ? "destructive" : "secondary"}>
                          {chargeStatusLabel(c.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Financeiro */}
      <Card
        title="Movimentação Financeira"
        count={filteredTransactions.length}
        actions={<ReportActions def={defFinanceiro} chartRefs={() => [finChartRef.current]} />}
      >
        <PeriodFilter
          period={finPeriod}
          setPeriod={setFinPeriod}
          onClearExtra={() => {
            setFinCategoria("");
            setFinPagamento("");
          }}
          extra={
            <>
              <SelectFilter
                label="Categoria"
                value={finCategoria}
                onChange={setFinCategoria}
                options={transactionCategories.map((c) => ({ value: c, label: c }))}
              />
              <SelectFilter
                label="Pagamento"
                value={finPagamento}
                onChange={setFinPagamento}
                options={paymentMethods.map((c) => ({ value: c, label: c }))}
              />
            </>
          }
        />
        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="font-bold text-success text-sm">{fmt(totalEntradas)}</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Saídas</p>
            <p className="font-bold text-destructive text-sm">{fmt(totalSaidas)}</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="font-bold text-sm">{fmt(totalEntradas - totalSaidas)}</p>
          </div>
        </div>
        <div ref={finChartRef}>
          {financialData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="entradas" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="saidas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Saídas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">Sem dados</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendas */}
        <Card
          title="Vendas"
          count={filteredSales.length}
          actions={
            <ReportActions
              def={defVendas}
              orientation="landscape"
              extra={
                <Button variant="outline" size="sm" onClick={printVendasTermico}>
                  <Printer className="h-3.5 w-3.5 mr-1.5" />80mm
                </Button>
              }
            />
          }
        >
          <PeriodFilter
            period={vendasPeriod}
            setPeriod={setVendasPeriod}
            onClearExtra={() => {
              setVendasCliente("");
              setVendasPagamento("");
              setVendasVendedor("");
              setVendasCaixaId("");
            }}
            extra={
              <>
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <Input
                    value={vendasCliente}
                    onChange={(e) => setVendasCliente(e.target.value)}
                    placeholder="Nome"
                    className="h-8 text-xs w-36"
                  />
                </div>
                <SelectFilter
                  label="Pagamento"
                  value={vendasPagamento}
                  onChange={setVendasPagamento}
                  options={paymentMethods.map((c) => ({ value: c, label: c }))}
                />
                {members.length > 0 && (
                  <SelectFilter
                    label="Vendedor"
                    value={vendasVendedor}
                    onChange={setVendasVendedor}
                    options={members.map((m) => ({ value: m.user_id, label: m.name }))}
                  />
                )}
                {isMaster && cashRegisters.length > 0 && (
                  <SelectFilter
                    label="Caixa"
                    value={vendasCaixaId}
                    onChange={setVendasCaixaId}
                    options={cashRegisters.map((c) => ({
                      value: c.id,
                      label: `${new Date(c.opened_at).toLocaleString("pt-BR")} — ${c.status === "open" ? "Aberto" : "Fechado"}`,
                    }))}
                  />
                )}
              </>
            }
          />
          <div className="bg-muted/30 rounded p-2 mb-3 text-center">
            <p className="text-xs text-muted-foreground">Faturamento</p>
            <p className="font-bold text-sm">{fmt(filteredSales.reduce((s, v) => s + Number(v.total), 0))}</p>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y text-sm">
            {filteredSales.slice(0, 20).map((s) => (
              <div key={s.id} className="py-1.5 flex justify-between gap-2">
                <span className="text-muted-foreground truncate">
                  {formatDateBR(s.date)} · {s.customer_name || "—"}
                </span>
                <span className="font-medium whitespace-nowrap">{fmt(Number(s.total))}</span>
              </div>
            ))}
            {filteredSales.length === 0 && <p className="text-center text-muted-foreground py-4">Sem vendas</p>}
          </div>
        </Card>

        {/* Estoque */}
        <Card
          title="Estoque"
          count={filteredProducts.length}
          delay={0.1}
          actions={<ReportActions def={defEstoque} orientation="landscape" chartRefs={() => [catChartRef.current]} />}
        >
          <PeriodFilter
            period={estoquePeriod}
            setPeriod={setEstoquePeriod}
            onClearExtra={() => {
              setEstoqueCategoria("");
              setEstoqueFornecedor("");
              setEstoqueFabricante("");
              setEstoqueSoBaixo(false);
            }}
            extra={
              <>
                <SelectFilter
                  label="Categoria"
                  value={estoqueCategoria}
                  onChange={setEstoqueCategoria}
                  options={categories.map((c) => ({ value: c, label: c }))}
                />
                <SelectFilter
                  label="Fornecedor"
                  value={estoqueFornecedor}
                  onChange={setEstoqueFornecedor}
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                />
                <SelectFilter
                  label="Fabricante"
                  value={estoqueFabricante}
                  onChange={setEstoqueFabricante}
                  options={manufacturers.map((m) => ({ value: m, label: m }))}
                />
                <label className="flex items-center gap-1.5 text-xs h-8">
                  <input type="checkbox" checked={estoqueSoBaixo} onChange={(e) => setEstoqueSoBaixo(e.target.checked)} />
                  Só estoque baixo
                </label>
              </>
            }
          />
          <div ref={catChartRef}>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-16">Sem produtos</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margem */}
        <Card title="Margem de Lucro" count={filteredMargemProducts.length} delay={0.15} actions={<ReportActions def={defMargem} />}>
          <PeriodFilter
            period={margemPeriod}
            setPeriod={setMargemPeriod}
            onClearExtra={() => setMargemCategoria("")}
            extra={
              <SelectFilter
                label="Categoria"
                value={margemCategoria}
                onChange={setMargemCategoria}
                options={categories.map((c) => ({ value: c, label: c }))}
              />
            }
          />
          <div className="divide-y">
            {[...filteredMargemProducts]
              .sort((a, b) => b.price - b.cost - (a.price - a.cost))
              .slice(0, 5)
              .map((p, i) => {
                const margin = p.price - p.cost;
                const percent = p.price > 0 ? ((margin / p.price) * 100).toFixed(1) : "0";
                return (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Venda: {fmt(p.price)} · Custo: {fmt(p.cost)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-sm font-bold text-success">{fmt(margin)}</p>
                      <p className="text-xs text-muted-foreground">{percent}%</p>
                    </div>
                  </div>
                );
              })}
            {filteredMargemProducts.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nenhum produto</div>}
          </div>
        </Card>

        {/* Clientes */}
        <Card title="Clientes" count={filteredCustomers.length} delay={0.2} actions={<ReportActions def={defClientes} />}>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="max-h-60 overflow-y-auto divide-y text-sm">
            {filteredCustomers.slice(0, 20).map((c) => (
              <div key={c.id} className="py-1.5 flex justify-between gap-2">
                <span className="font-medium truncate">{c.name}</span>
                <span className="text-muted-foreground text-xs whitespace-nowrap">{c.phone || c.email || "—"}</span>
              </div>
            ))}
            {filteredCustomers.length === 0 && <p className="text-center text-muted-foreground py-4">Nenhum cliente</p>}
          </div>
        </Card>
      </div>

      {/* Relatórios gerenciais */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-lg shadow-card border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-semibold">Relatórios Gerenciais</h2>
            <p className="text-xs text-muted-foreground">Período aplicado a todos os relatórios desta seção</p>
          </div>
        </div>
        <PeriodFilter
          period={anaPeriod}
          setPeriod={setAnaPeriod}
          extra={
            <div>
              <Label className="text-xs">Top N</Label>
              <select
                className="h-8 text-xs border rounded px-2 bg-background block"
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
              >
                {[5, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Produtos Mais Vendidos"
          count={maisVendidos.length}
          delay={0.3}
          actions={<ReportActions def={defMaisVendidos} chartRefs={() => [mvChartRef.current]} />}
        >
          <div ref={mvChartRef}>
            {maisVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={maisVendidos.slice(0, 8).map((p) => ({ name: p.name.slice(0, 14), Faturamento: p.receita }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="Faturamento" fill="hsl(215, 80%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem vendas no período</p>
            )}
          </div>
          <div className="divide-y text-sm mt-2 max-h-48 overflow-y-auto">
            {maisVendidos.slice(0, topN).map((p, i) => (
              <div key={p.name + i} className="py-1.5 flex justify-between gap-2">
                <span className="truncate">
                  {i + 1}. {p.name} <span className="text-muted-foreground">({p.qtd})</span>
                </span>
                <span className="font-medium whitespace-nowrap">{fmt(p.receita)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Vendas por Vendedor" count={vendasPorVendedor.length} delay={0.35} actions={<ReportActions def={defVendedores} />}>
          <div className="divide-y text-sm max-h-72 overflow-y-auto">
            {vendasPorVendedor.map((v) => (
              <div key={v.nome} className="py-2 flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{v.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.qtd} vendas · ticket {fmt(v.ticket)}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="font-medium">{fmt(v.total)}</p>
                  <p className="text-xs text-muted-foreground">{pct(v.participacao)}</p>
                </div>
              </div>
            ))}
            {vendasPorVendedor.length === 0 && <p className="text-center text-muted-foreground py-6">Sem vendas no período</p>}
          </div>
        </Card>

        <Card title="Curva ABC de Produtos" count={curvaABC.length} delay={0.4} actions={<ReportActions def={defAbc} />}>
          <div className="grid grid-cols-3 gap-3 mb-3 text-center">
            {(["A", "B", "C"] as const).map((cls) => (
              <div key={cls} className="bg-muted/30 rounded p-2">
                <p className="text-xs text-muted-foreground">Classe {cls}</p>
                <p className="font-bold text-sm">{curvaABC.filter((p) => p.classe === cls).length}</p>
              </div>
            ))}
          </div>
          <div className="divide-y text-sm max-h-56 overflow-y-auto">
            {curvaABC.slice(0, topN).map((p, i) => (
              <div key={p.name + i} className="py-1.5 flex justify-between gap-2">
                <span className="truncate">
                  <Badge variant={p.classe === "A" ? "default" : p.classe === "B" ? "secondary" : "outline"} className="mr-1.5">
                    {p.classe}
                  </Badge>
                  {p.name}
                </span>
                <span className="whitespace-nowrap text-muted-foreground text-xs">
                  {pct(p.participacao)} · {fmt(p.receita)}
                </span>
              </div>
            ))}
            {curvaABC.length === 0 && <p className="text-center text-muted-foreground py-6">Sem vendas no período</p>}
          </div>
        </Card>

        <Card title="Giro de Estoque" count={giroEstoque.length} delay={0.45} actions={<ReportActions def={defGiro} orientation="landscape" />}>
          <div className="divide-y text-sm max-h-72 overflow-y-auto">
            {giroEstoque.slice(0, topN).map((p) => (
              <div key={p.sku + p.name} className="py-1.5 flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  saídas {p.saida} · estoque {p.estoque} ·{" "}
                  {p.parado ? <span className="text-destructive">parado</span> : `${Math.round(p.cobertura)} dias`}
                </span>
              </div>
            ))}
            {giroEstoque.length === 0 && <p className="text-center text-muted-foreground py-6">Sem produtos</p>}
          </div>
        </Card>

        <Card title="DRE Simplificado" delay={0.5} actions={<ReportActions def={defDre} />}>
          <div className="text-sm divide-y">
            <div className="py-1.5 flex justify-between">
              <span>Receita de vendas</span>
              <span className="font-medium">{fmt(dre.receitas)}</span>
            </div>
            <div className="py-1.5 flex justify-between">
              <span>(-) CMV</span>
              <span className="text-destructive">{fmt(dre.cmv)}</span>
            </div>
            <div className="py-1.5 flex justify-between font-semibold">
              <span>= Lucro bruto ({pct(dre.margemBruta)})</span>
              <span>{fmt(dre.lucroBruto)}</span>
            </div>
            {dre.despesas.slice(0, 6).map((d) => (
              <div key={d.categoria} className="py-1.5 flex justify-between text-muted-foreground text-xs">
                <span>(-) {d.categoria}</span>
                <span>{fmt(d.valor)}</span>
              </div>
            ))}
            <div className="py-1.5 flex justify-between">
              <span>(-) Total de despesas</span>
              <span className="text-destructive">{fmt(dre.totalDespesas)}</span>
            </div>
            <div className="py-2 flex justify-between font-bold">
              <span>= Resultado ({pct(dre.margemLiquida)})</span>
              <span className={dre.resultado >= 0 ? "text-success" : "text-destructive"}>{fmt(dre.resultado)}</span>
            </div>
          </div>
        </Card>

        <Card
          title="Resumo de Caixa"
          count={resumoCaixas.length}
          delay={0.55}
          actions={
            <ReportActions
              def={defCaixa}
              orientation="landscape"
              extra={
                <Button variant="outline" size="sm" onClick={printCaixaTermico}>
                  <Printer className="h-3.5 w-3.5 mr-1.5" />80mm
                </Button>
              }
            />
          }
        >
          <div className="divide-y text-sm max-h-72 overflow-y-auto">
            {resumoCaixas.map((c) => (
              <div key={c.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{c.abertura}</span>
                  <span className="whitespace-nowrap">{fmt(c.vendas)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.operador} · {c.qtdVendas} vendas ·{" "}
                  {c.diff == null ? "em aberto" : `diferença ${fmt(c.diff)}`}
                </p>
              </div>
            ))}
            {resumoCaixas.length === 0 && <p className="text-center text-muted-foreground py-6">Sem caixas no período</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Relatorios;
