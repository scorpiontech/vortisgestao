import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setPdvPending } from "@/lib/pdvPending";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, FileText, CheckCircle2, XCircle, Send, ShoppingCart, History, Edit, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { useSellerName } from "@/hooks/useSellerName";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { motion } from "framer-motion";

type Status = "rascunho" | "enviado" | "aprovado" | "recusado" | "expirado" | "convertido";

interface Product { id: string; name: string; price: number; stock: number; sku: string; }
interface Customer { id: string; name: string; document: string; document_type: string; }
interface QuoteItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}
interface NegLog { at: string; from: Status; to: Status; note?: string; by?: string; }
interface Quote {
  id: string;
  user_id: string;
  customer_id: string | null;
  customer_name: string | null;
  status: Status;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string | null;
  installments: number;
  valid_until: string | null;
  notes: string | null;
  negotiation_log: NegLog[];
  converted_sale_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Convertido",
};

const STATUS_COLOR: Record<Status, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  aprovado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  recusado: "bg-destructive/15 text-destructive",
  expirado: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  convertido: "bg-primary/15 text-primary",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Orcamentos() {
  const { user } = useAuth();
  const { effectiveUserId } = useUserRole();
  const { toast } = useToast();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | "todos">("todos");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [installments, setInstallments] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [qty, setQty] = useState("1");

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Quote | null>(null);
  const [newStatus, setNewStatus] = useState<Status>("enviado");
  const [statusNote, setStatusNote] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuote, setHistoryQuote] = useState<Quote | null>(null);

  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const sellerName = useSellerName();

  const loadAll = async () => {
    const [q, p, c, comp] = await Promise.all([
      supabase.from("quotes").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, price, stock, sku").order("name"),
      supabase.from("customers").select("id, name, document, document_type").order("name"),
      supabase.from("company_registrations").select("name, document, phone, email, street, number, neighborhood, city, state, zip_code").limit(1).maybeSingle(),
    ]);
    const quotesData = (q.data || []) as any[];
    // Auto-mark expired (client side display logic only; persist when user opens)
    const today = new Date().toISOString().slice(0, 10);
    for (const qt of quotesData) {
      if (qt.valid_until && qt.valid_until < today && (qt.status === "enviado" || qt.status === "rascunho")) {
        qt.status = "expirado";
      }
    }
    setQuotes(quotesData as Quote[]);
    setProducts((p.data || []) as Product[]);
    setCustomers((c.data || []) as Customer[]);
    setCompanyInfo(comp.data || null);
  };

  useEffect(() => { loadAll(); }, []);

  const handleDownloadPdf = async (q: Quote) => {
    const { data: qItems } = await supabase
      .from("quote_items").select("*").eq("quote_id", q.id);
    const cust = q.customer_id ? customers.find(c => c.id === q.customer_id) : null;
    // Position in chronological order for friendly number
    const sortedAsc = [...quotes].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const idx = sortedAsc.findIndex(x => x.id === q.id);
    const number = `ORC-${String(idx + 1).padStart(5, "0")}`;
    // Taxes: not stored on quote; default 0 (placeholder lines in PDF)
    const taxRate = 0;
    const taxAmount = 0;
    downloadQuotePdf({
      id: q.id,
      number,
      status: q.status,
      customer_name: q.customer_name,
      customer_document: cust?.document || null,
      payment_method: q.payment_method,
      installments: q.installments,
      valid_until: q.valid_until,
      notes: q.notes,
      subtotal: Number(q.subtotal),
      discount: Number(q.discount),
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: Number(q.total),
      created_at: q.created_at,
      items: (qItems || []).map((it: any) => ({
        product_name: it.product_name,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total: Number(it.total),
      })),
      negotiation_log: q.negotiation_log || [],
      company: companyInfo || undefined,
      sellerName: sellerName || undefined,
    });
    logAudit({ action: "download_pdf", entity: "quote", entityId: q.id });
  };


  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discNum = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = Math.max(0, subtotal - discNum);

  const filteredProducts = productSearch
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()))
    : [];

  const filteredQuotes = quotes.filter(q => {
    if (statusFilter !== "todos" && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(q.customer_name || "").toLowerCase().includes(s) && !q.id.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const resetEditor = () => {
    setEditing(null);
    setItems([]);
    setCustomerId("");
    setCustomerName("");
    setPaymentMethod("Dinheiro");
    setInstallments("1");
    setDiscount("0");
    setValidUntil("");
    setNotes("");
    setProductSearch("");
    setQty("1");
  };

  const openNew = () => {
    resetEditor();
    setEditorOpen(true);
  };

  const openEdit = async (q: Quote) => {
    setEditing(q);
    setCustomerId(q.customer_id || "");
    setCustomerName(q.customer_name || "");
    setPaymentMethod(q.payment_method || "Dinheiro");
    setInstallments(String(q.installments || 1));
    setDiscount(String(q.discount || 0));
    setValidUntil(q.valid_until || "");
    setNotes(q.notes || "");
    const { data } = await supabase.from("quote_items").select("*").eq("quote_id", q.id);
    setItems((data || []).map((it: any) => ({
      id: it.id,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      total: Number(it.total),
    })));
    setEditorOpen(true);
  };

  const addItem = (p: Product) => {
    const q = Math.max(1, Number(qty) || 1);
    const existing = items.find(i => i.product_id === p.id);
    if (existing) {
      setItems(items.map(i => i.product_id === p.id
        ? { ...i, quantity: i.quantity + q, total: (i.quantity + q) * i.unit_price }
        : i));
    } else {
      setItems([...items, {
        product_id: p.id, product_name: p.name,
        quantity: q, unit_price: p.price, total: q * p.price,
      }]);
    }
    setProductSearch("");
    setQty("1");
  };

  const updateItemQty = (pid: string, q: number) => {
    setItems(items.map(i => i.product_id === pid
      ? { ...i, quantity: q, total: q * i.unit_price }
      : i));
  };

  const removeItem = (pid: string) => setItems(items.filter(i => i.product_id !== pid));

  const handleSelectCustomer = (id: string) => {
    setCustomerId(id);
    setCustomerName(customers.find(c => c.id === id)?.name || "");
  };

  const saveQuote = async () => {
    if (items.length === 0) {
      toast({ title: "Adicione ao menos um item", variant: "destructive" });
      return;
    }
    const payload = {
      user_id: effectiveUserId!,
      customer_id: customerId || null,
      customer_name: customerName || null,
      subtotal,
      discount: discNum,
      total,
      payment_method: paymentMethod,
      installments: Math.max(1, Number(installments) || 1),
      valid_until: validUntil || null,
      notes: notes || null,
    };

    let quoteId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("quotes").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
      await supabase.from("quote_items").delete().eq("quote_id", editing.id);
    } else {
      const { data, error } = await supabase.from("quotes").insert(payload).select().single();
      if (error || !data) { toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" }); return; }
      quoteId = (data as any).id;
    }

    const rows = items.map(i => ({
      quote_id: quoteId!,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total: i.total,
    }));
    await supabase.from("quote_items").insert(rows);

    logAudit({ action: editing ? "update" : "create", entity: "quote", entityId: quoteId, details: { total } });
    toast({ title: editing ? "Orçamento atualizado" : "Orçamento criado" });
    setEditorOpen(false);
    resetEditor();
    loadAll();
  };

  const removeQuote = async (q: Quote) => {
    if (q.status === "convertido") {
      toast({ title: "Orçamento convertido não pode ser excluído", variant: "destructive" });
      return;
    }
    if (!confirm("Excluir este orçamento?")) return;
    const { error } = await supabase.from("quotes").delete().eq("id", q.id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    logAudit({ action: "delete", entity: "quote", entityId: q.id });
    toast({ title: "Orçamento removido" });
    loadAll();
  };

  const openStatusDialog = (q: Quote) => {
    setStatusTarget(q);
    setNewStatus(q.status === "rascunho" ? "enviado" : "aprovado");
    setStatusNote("");
    setStatusOpen(true);
  };

  const applyStatus = async () => {
    if (!statusTarget) return;
    const q = statusTarget;
    if (q.status === "convertido") { toast({ title: "Orçamento já convertido", variant: "destructive" }); return; }

    const log: NegLog = {
      at: new Date().toISOString(),
      from: q.status, to: newStatus,
      note: statusNote || undefined,
      by: user?.email || undefined,
    };
    const newLog = [...(q.negotiation_log || []), log];

    if (newStatus === "aprovado") {
      // Auto-convert to sale
      await convertToSale(q, newLog);
      return;
    }

    const { error } = await supabase.from("quotes").update({
      status: newStatus,
      negotiation_log: newLog as any,
    }).eq("id", q.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    logAudit({ action: "status_change", entity: "quote", entityId: q.id, details: { from: q.status, to: newStatus, note: statusNote } });
    toast({ title: `Status alterado para ${STATUS_LABEL[newStatus]}` });
    setStatusOpen(false);
    loadAll();
  };

  const convertToSale = async (q: Quote, logSoFar: NegLog[]) => {
    // Need open cash register for current user
    const { data: cr } = await supabase
      .from("cash_registers").select("id").eq("status", "open").eq("user_id", user!.id).limit(1);
    if (!cr || cr.length === 0) {
      toast({
        title: "Caixa fechado",
        description: "Abra o caixa antes de aprovar/converter o orçamento em venda.",
        variant: "destructive",
      });
      return;
    }

    const { data: qItems } = await supabase.from("quote_items").select("*").eq("quote_id", q.id);
    if (!qItems || qItems.length === 0) {
      toast({ title: "Orçamento sem itens", variant: "destructive" });
      return;
    }

    const inst = Math.max(1, Number(q.installments) || 1);
    const { data: sale, error: sErr } = await supabase.from("sales").insert({
      user_id: effectiveUserId!,
      customer_name: q.customer_name,
      payment_method: q.payment_method || "Dinheiro",
      total: Number(q.total),
      discount: Number(q.discount),
      installments: inst,
    } as any).select().single();
    if (sErr || !sale) { toast({ title: "Erro ao gerar venda", description: sErr?.message, variant: "destructive" }); return; }

    const saleItems = qItems.map((it: any) => ({
      sale_id: (sale as any).id,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: Math.max(1, Math.floor(Number(it.quantity))),
      unit_price: Number(it.unit_price),
      total: Number(it.total),
    }));
    await supabase.from("sale_items").insert(saleItems);

    await supabase.from("transactions").insert({
      user_id: effectiveUserId!,
      type: "entrada",
      description: `Venda (Orçamento) #${(sale as any).id.slice(0, 8)}${q.customer_name ? ` - ${q.customer_name}` : ""}`,
      amount: Number(q.total),
      category: "Vendas",
      payment_method: (q.payment_method || "Dinheiro") + (inst > 1 ? ` ${inst}x` : ""),
    });

    // Stock deduction
    for (const it of qItems as any[]) {
      if (!it.product_id) continue;
      const prod = products.find(p => p.id === it.product_id);
      if (prod) {
        await supabase.from("products").update({
          stock: Math.max(0, prod.stock - Math.floor(Number(it.quantity))),
        }).eq("id", it.product_id);
      }
    }

    await supabase.from("quotes").update({
      status: "convertido",
      converted_sale_id: (sale as any).id,
      negotiation_log: [...logSoFar, {
        at: new Date().toISOString(), from: "aprovado", to: "convertido",
        note: `Venda #${(sale as any).id.slice(0, 8)} gerada automaticamente`,
        by: user?.email,
      }] as any,
    }).eq("id", q.id);

    logAudit({ action: "convert_to_sale", entity: "quote", entityId: q.id, details: { sale_id: (sale as any).id, total: q.total } });
    toast({ title: "Orçamento aprovado e convertido em venda!", description: `Venda: ${fmt(Number(q.total))}` });
    setStatusOpen(false);
    loadAll();
  };

  const showHistory = (q: Quote) => { setHistoryQuote(q); setHistoryOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orçamentos / Pré-venda</h1>
          <p className="text-sm text-muted-foreground">Negocie com o cliente, atualize status e converta em venda quando aprovado.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Orçamento</Button>
      </div>

      <div className="bg-card rounded-lg shadow-card border p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente ou ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Validade</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredQuotes.map(q => (
                <tr key={q.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{q.id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{q.customer_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2">
                    <Badge className={STATUS_COLOR[q.status]} variant="secondary">{STATUS_LABEL[q.status]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {q.valid_until ? new Date(q.valid_until + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(Number(q.total))}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadPdf(q)} title="Baixar PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => showHistory(q)} title="Histórico">
                        <History className="h-4 w-4" />
                      </Button>
                      {q.status !== "convertido" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openStatusDialog(q)} title="Atualizar status">
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeQuote(q)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {q.status === "convertido" && q.converted_sale_id && (
                        <Badge variant="outline" className="text-xs">
                          <ShoppingCart className="h-3 w-3 mr-1" />Venda #{q.converted_sale_id.slice(0, 8)}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum orçamento encontrado
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle>
            <DialogDescription>Pré-venda com negociação de cliente</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={customerId} onValueChange={handleSelectCustomer}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.document ? ` — ${c.document}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome (livre)</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Ou digite o nome" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Adicionar produto</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Nome ou SKU..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                </div>
                <Input className="w-20" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
              </div>
              {productSearch && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="px-3 py-2 hover:bg-muted/40 cursor-pointer flex justify-between items-center" onClick={() => addItem(p)}>
                      <div>
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-muted-foreground">SKU: {p.sku} • Estoque: {p.stock}</div>
                      </div>
                      <span className="text-sm font-medium">{fmt(p.price)}</span>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="px-3 py-3 text-center text-muted-foreground text-sm">Nenhum produto</div>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2">Produto</th>
                      <th className="text-center px-3 py-2 w-24">Qtd</th>
                      <th className="text-right px-3 py-2">Unit.</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map(i => (
                      <tr key={i.product_id}>
                        <td className="px-3 py-2">{i.product_name}</td>
                        <td className="px-3 py-2">
                          <Input type="number" min="1" className="h-8 text-center" value={i.quantity}
                            onChange={e => updateItemQty(i.product_id, Math.max(1, Number(e.target.value) || 1))} />
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(i.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(i.total)}</td>
                        <td className="px-2"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i.product_id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Pix">Pix</SelectItem>
                    <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                    <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Input type="number" min="1" max="12" value={installments} onChange={e => setInstallments(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto (R$)</Label>
                <Input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Validade</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condições, prazos, observações da negociação..." />
            </div>

            <div className="flex justify-between items-center bg-muted/40 rounded-md p-3">
              <div className="text-sm space-y-0.5">
                <div>Subtotal: <span className="font-medium">{fmt(subtotal)}</span></div>
                <div>Desconto: <span className="font-medium">{fmt(discNum)}</span></div>
              </div>
              <div className="text-2xl font-bold text-primary">{fmt(total)}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={saveQuote}>{editing ? "Salvar alterações" : "Criar orçamento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar status da negociação</DialogTitle>
            <DialogDescription>
              {statusTarget && <>Status atual: <Badge className={STATUS_COLOR[statusTarget.status]} variant="secondary">{STATUS_LABEL[statusTarget.status]}</Badge></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Novo status</Label>
              <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enviado"><Send className="inline h-3.5 w-3.5 mr-1" />Enviado</SelectItem>
                  <SelectItem value="aprovado"><CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />Aprovado (gera venda)</SelectItem>
                  <SelectItem value="recusado"><XCircle className="inline h-3.5 w-3.5 mr-1" />Recusado</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                  <SelectItem value="rascunho">Voltar para rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Textarea rows={3} value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="Ex: cliente pediu desconto adicional..." />
            </div>
            {newStatus === "aprovado" && (
              <div className="text-xs bg-primary/10 text-primary rounded-md p-2 border border-primary/20">
                Ao aprovar, será gerada automaticamente uma venda no PDV com baixa de estoque e lançamento financeiro. Exige caixa aberto.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancelar</Button>
            <Button onClick={applyStatus}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de negociação</DialogTitle>
            <DialogDescription>{historyQuote?.customer_name || "Orçamento"} — #{historyQuote?.id.slice(0, 8)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(historyQuote?.negotiation_log || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração registrada ainda.</p>
            )}
            {(historyQuote?.negotiation_log || []).map((l, idx) => (
              <div key={idx} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{STATUS_LABEL[l.from]}</Badge>
                    →
                    <Badge className={STATUS_COLOR[l.to]} variant="secondary">{STATUS_LABEL[l.to]}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(l.at).toLocaleString("pt-BR")}</span>
                </div>
                {l.note && <p className="mt-2 text-muted-foreground">{l.note}</p>}
                {l.by && <p className="mt-1 text-xs text-muted-foreground">por {l.by}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
