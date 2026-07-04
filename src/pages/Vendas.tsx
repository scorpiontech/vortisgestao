import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer, Plus, ShoppingCart, Users, ScanBarcode, Percent, Search, AlertTriangle, X, FileText, ClipboardList, Wrench, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { useSellerName } from "@/hooks/useSellerName";
import { getPdvPending, clearPdvPending, type PdvPending } from "@/lib/pdvPending";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SaleItem {
  productId: string;            // React key (real product id or synthetic)
  realProductId: string | null; // FK to products (null for service/labor lines)
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
}

interface Customer {
  id: string;
  name: string;
  document: string;
  document_type: string;
  phone: string;
}

interface CompanyInfo {
  name: string;
  document: string;
  person_type: string;
  phone: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

const Vendas = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useUserRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"percent" | "value">("percent");
  const [installments, setInstallments] = useState("1");
  const [caixaAberto, setCaixaAberto] = useState<boolean | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [pending, setPending] = useState<PdvPending | null>(null);
  const [approvedQuotes, setApprovedQuotes] = useState<Array<{ id: string; customer_id: string | null; customer_name: string | null; total: number; created_at: string; payment_method: string | null; installments: number | null; discount: number | null }>>([]);
  const [quotesDialogOpen, setQuotesDialogOpen] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState("");
  const sellerName = useSellerName();
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const fetchApprovedQuotes = async () => {
    const { data } = await supabase
      .from("quotes")
      .select("id, customer_id, customer_name, total, created_at, payment_method, installments, discount")
      .eq("status", "aprovado")
      .is("converted_sale_id", null)
      .order("created_at", { ascending: false });
    setApprovedQuotes((data as any) || []);
  };

  const applyPending = (p: PdvPending) => {
    setPending(p);
    setItems(
      p.items.map((it, idx) => ({
        productId: it.productId ?? `pending-${idx}-${Date.now()}`,
        realProductId: it.productId ?? null,
        productName: it.productName,
        quantity: Math.max(1, Math.floor(Number(it.quantity))),
        unitPrice: Number(it.unitPrice),
        total: Number(it.total),
      }))
    );
    setSelectedCustomerId(p.customerId || "");
    setCustomerName(p.customerName || "");
    setPaymentMethod(p.paymentMethod || "Dinheiro");
    setInstallments(p.installments && p.installments > 1 ? String(p.installments) : "1");
    if (p.discountValue && p.discountValue > 0) {
      setDiscountType("value");
      setDiscount(String(p.discountValue));
    } else {
      setDiscountType("percent");
      setDiscount("0");
    }
  };

  const loadQuoteIntoPdv = async (quoteId: string) => {
    const { data: q } = await supabase
      .from("quotes")
      .select("id, customer_id, customer_name, total, discount, payment_method, installments")
      .eq("id", quoteId)
      .maybeSingle();
    if (!q) { toast({ title: "Orçamento não encontrado", variant: "destructive" }); return; }
    const { data: qi } = await supabase
      .from("quote_items")
      .select("product_id, product_name, quantity, unit_price, total")
      .eq("quote_id", quoteId);
    const p: PdvPending = {
      source: "quote",
      sourceId: (q as any).id,
      sourceLabel: `Orçamento #${(q as any).id.slice(0, 8)}${(q as any).customer_name ? ` — ${(q as any).customer_name}` : ""}`,
      customerId: (q as any).customer_id,
      customerName: (q as any).customer_name,
      paymentMethod: (q as any).payment_method,
      installments: (q as any).installments,
      discountValue: Number((q as any).discount || 0),
      items: (qi || []).map((it: any) => ({
        productId: it.product_id,
        productName: it.product_name,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        total: Number(it.total),
      })),
    };
    applyPending(p);
    setQuotesDialogOpen(false);
    setQuoteSearch("");
    toast({ title: "Pré-venda carregada", description: p.sourceLabel });
  };

  useEffect(() => {
    supabase.from("products").select("id, name, price, stock, sku").order("name").then(({ data }) => setProducts(data || []));
    supabase.from("customers").select("id, name, document, document_type, phone").order("name").then(({ data }) => setCustomers(data || []));
    supabase.from("cash_registers").select("id").eq("status", "open").eq("user_id", user!.id).limit(1).then(({ data }) => {
      setCaixaAberto(data && data.length > 0);
    });
    supabase.from("company_registrations").select("name, document, person_type, phone, street, number, complement, neighborhood, city, state, zip_code").limit(1).single().then(({ data }) => {
      if (data) setCompanyInfo(data as CompanyInfo);
    });
    fetchApprovedQuotes();

    // Pre-load cart if PDV was opened from Orçamento or Ordem de Serviço
    const p = getPdvPending();
    if (p) applyPending(p);
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const filteredCustomersForPDV = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    if (!q) return false;
    return c.name.toLowerCase().includes(q) || c.document.toLowerCase().includes(q);
  });

  const handleSelectCustomerPDV = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const c = customers.find(c => c.id === customerId);
    setCustomerName(c?.name || "");
    setCustomerSearch("");
  };

  const clearCustomer = () => {
    setSelectedCustomerId("");
    setCustomerName("");
    setCustomerSearch("");
  };

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discountValue = discountType === "percent"
    ? subtotal * (Math.min(Number(discount) || 0, 100) / 100)
    : Math.min(Number(discount) || 0, subtotal);
  const total = Math.max(0, subtotal - discountValue);
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const showInstallments = paymentMethod === "Cartão Crédito";

  const addProductById = (productId: string, qty: number = 1) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      setItems(items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.unitPrice } : i));
    } else {
      setItems([...items, { productId: product.id, realProductId: product.id, productName: product.name, quantity: qty, unitPrice: product.price, total: qty * product.price }]);
    }
    setQuantity("1");
    setProductSearch("");
  };

  const removeItem = (productId: string) => setItems(items.filter(i => i.productId !== productId));

  const handleBarcodeScan = async (code: string, format?: string) => {
    const product = products.find(p => p.sku.toLowerCase() === code.toLowerCase());
    // Log the scan (always, matched or not) for auditing
    if (user && effectiveUserId) {
      supabase.from("barcode_scan_logs").insert({
        owner_id: effectiveUserId,
        user_id: user.id,
        user_name: sellerName || "",
        user_email: user.email || "",
        code,
        format: format || "",
        product_id: product?.id || null,
        product_name: product?.name || "",
        matched: !!product,
        context: "pdv",
      } as any).then(() => {});
    }
    if (!product) {
      toast({ title: "Produto não encontrado", description: `Código: ${code}`, variant: "destructive" });
      return;
    }
    addProductById(product.id, 1);
    toast({ title: `${product.name} adicionado` });
  };

  const finalizeSale = async () => {
    if (items.length === 0) { toast({ title: "Adicione itens à venda", variant: "destructive" }); return; }

    const inst = showInstallments ? Math.max(1, Number(installments) || 1) : 1;

    const { data: sale, error: saleError } = await supabase.from("sales").insert({
      user_id: effectiveUserId!,
      customer_name: customerName || null,
      payment_method: paymentMethod,
      total,
      discount: discountValue,
      installments: inst,
    } as any).select().single();

    if (saleError || !sale) { toast({ title: "Erro ao registrar venda", description: saleError?.message, variant: "destructive" }); return; }

    const saleItems = items.map(i => ({
      sale_id: (sale as any).id,
      product_id: i.realProductId,
      product_name: i.productName,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      total: i.total,
    }));
    await supabase.from("sale_items").insert(saleItems);

    const txDescription = pending
      ? `${pending.source === "quote" ? "Venda (Orçamento)" : "Venda (OS)"} #${(sale as any).id.slice(0, 8)}${customerName ? ` - ${customerName}` : ""}`
      : `Venda #${(sale as any).id.slice(0, 8)}${customerName ? ` - ${customerName}` : ""}`;

    await supabase.from("transactions").insert({
      user_id: effectiveUserId!,
      type: "entrada",
      description: txDescription,
      amount: total,
      category: pending?.source === "service_order" ? "Ordem de Serviço" : "Vendas",
      payment_method: paymentMethod + (inst > 1 ? ` ${inst}x` : ""),
    });

    for (const item of items) {
      if (!item.realProductId) continue;
      const prod = products.find(p => p.id === item.realProductId);
      if (prod) {
        await supabase.from("products").update({ stock: Math.max(0, prod.stock - item.quantity) }).eq("id", item.realProductId);
      }
    }

    // If sale originated from a quote or service order, update the source record now.
    if (pending) {
      try {
        if (pending.source === "quote") {
          const { data: qNow } = await supabase
            .from("quotes")
            .select("negotiation_log")
            .eq("id", pending.sourceId)
            .maybeSingle();
          const prevLog = Array.isArray((qNow as any)?.negotiation_log) ? (qNow as any).negotiation_log : [];
          await supabase.from("quotes").update({
            status: "convertido",
            converted_sale_id: (sale as any).id,
            negotiation_log: [
              ...prevLog,
              {
                at: new Date().toISOString(),
                from: "aprovado",
                to: "convertido",
                note: `Finalizado no PDV — Venda #${(sale as any).id.slice(0, 8)}`,
                by: user?.email,
              },
            ] as any,
          }).eq("id", pending.sourceId);
        } else if (pending.source === "service_order") {
          await supabase.from("service_orders").update({
            paid: true,
            paid_at: new Date().toISOString(),
            payment_method: paymentMethod,
            discount: discountValue,
          }).eq("id", pending.sourceId);
        }
        logAudit({
          action: "pdv_finalize_from_source",
          entity: pending.source,
          entityId: pending.sourceId,
          details: { sale_id: (sale as any).id, total },
        });
      } catch (e) {
        console.error("Falha ao atualizar origem da venda", e);
      }
      clearPdvPending();
      setPending(null);
    }

    setSaleId((sale as any).id);
    setShowReceipt(true);
    toast({ title: "Venda finalizada!", description: `Total: ${formatCurrency(total)}` });
    logAudit({ action: "sale", entity: "sale", entityId: (sale as any).id, details: { total, paymentMethod, items: items.length, customer: customerName || "Consumidor" } });
    fetchApprovedQuotes();
  };


  const printReceipt = () => window.print();

  const newSale = () => {
    setItems([]);
    setCustomerName("");
    setSelectedCustomerId("");
    setShowReceipt(false);
    setSaleId(null);
    setDiscount("0");
    setDiscountType("percent");
    setInstallments("1");
    supabase.from("products").select("id, name, price, stock, sku").order("name").then(({ data }) => setProducts(data || []));
    fetchApprovedQuotes();
  };

  const now = new Date();
  const installmentsNum = Math.max(1, Number(installments) || 1);

  // Loading state
  if (caixaAberto === null) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  // Cash register not open
  if (!caixaAberto) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold">Caixa Fechado</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Para registrar vendas, é necessário abrir o caixa primeiro. Acesse o menu <strong>Financeiro → Caixa</strong> para abrir um novo caixa.
        </p>
        <Button variant="outline" onClick={() => window.location.href = "/caixa"}>Ir para Caixa</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">PDV</h1>
          <p className="text-sm text-muted-foreground">Ponto de Venda — registre vendas e emita cupons</p>
        </div>
        {approvedQuotes.length > 0 && !showReceipt && (
          <Button variant="outline" onClick={() => setQuotesDialogOpen(true)} className="gap-2">
            <ListChecks className="h-4 w-4" />
            Pré-vendas aprovadas
            <Badge variant="secondary" className="ml-1">{approvedQuotes.length}</Badge>
          </Button>
        )}
      </div>

      {pending && !showReceipt && (
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border px-4 py-3 shadow-elevated",
            pending.source === "quote"
              ? "border-l-4 border-l-primary bg-primary/5 border-primary/20"
              : "border-l-4 border-l-amber-500 bg-amber-500/5 border-amber-500/20"
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  pending.source === "quote" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-600"
                )}
              >
                {pending.source === "quote" ? <ClipboardList className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    Finalizando {pending.source === "quote" ? "Orçamento" : "Ordem de Serviço"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-medium",
                      pending.source === "quote"
                        ? "border-primary/30 text-primary bg-primary/10"
                        : "border-amber-500/40 text-amber-700 bg-amber-500/10"
                    )}
                  >
                    {pending.source === "quote" ? "Pré-venda" : "OS pendente"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pending.sourceLabel
                    ? pending.sourceLabel
                    : pending.source === "quote"
                      ? "Os itens, cliente e desconto do orçamento aprovado foram pré-carregados."
                      : "Os itens, cliente e desconto da ordem de serviço foram pré-carregados."}
                  {" "}Finalize no caixa após conferência.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearPdvPending();
                setPending(null);
                setItems([]);
                setCustomerName("");
                setSelectedCustomerId("");
                setDiscount("0");
                setDiscountType("percent");
                setInstallments("1");
                toast({ title: "Pré-venda descartada", description: "Você pode iniciar uma nova venda do zero." });
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Descartar
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {!showReceipt && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border p-5 space-y-4">
              {/* Product search as table */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label>Buscar Produto</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Input
                        placeholder="Nome, SKU ou código de barras..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label>Qtd</Label>
                    <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} title="Escanear código de barras">
                      <ScanBarcode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Product table */}
                {productSearch && (
                  <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Produto</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Preço</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground">Estoque</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredProducts.map(p => (
                          <tr key={p.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => addProductById(p.id, Number(quantity) || 1)}>
                            <td className="px-3 py-2 font-medium">{p.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.sku}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(p.price)}</td>
                            <td className="px-3 py-2 text-center">{p.stock}</td>
                            <td className="px-2 py-2">
                              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); addProductById(p.id, Number(quantity) || 1); }}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Nenhum produto encontrado</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50 border-b">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Item</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Unit.</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                      <th className="px-2 py-2"></th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {items.map(i => (
                        <tr key={i.productId}>
                          <td className="px-4 py-2">{i.productName}</td>
                          <td className="px-4 py-2 text-center">{i.quantity}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(i.unitPrice)}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatCurrency(i.total)}</td>
                          <td className="px-2 py-2"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i.productId)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Cliente</Label>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                      <span className="font-medium">{selectedCustomer.name}</span>
                      {selectedCustomer.document && (
                        <span className="text-muted-foreground text-xs">
                          ({selectedCustomer.document_type.toUpperCase()}: {selectedCustomer.document})
                        </span>
                      )}
                      <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={clearCustomer}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Input
                          placeholder="Buscar por nome, CPF ou CNPJ..."
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {customerSearch && (
                        <div className="border rounded-lg overflow-hidden max-h-[180px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0">
                              <tr className="bg-muted/50 border-b">
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Documento</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {filteredCustomersForPDV.map(c => (
                                <tr key={c.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => handleSelectCustomerPDV(c.id)}>
                                  <td className="px-3 py-2 font-medium">{c.name}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{c.document ? `${c.document_type.toUpperCase()}: ${c.document}` : "—"}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{c.phone || "—"}</td>
                                </tr>
                              ))}
                              {filteredCustomersForPDV.length === 0 && (
                                <tr><td colSpan={3} className="px-3 py-3 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {!customerSearch && (
                        <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Ou digite o nome manualmente" className="mt-1.5" />
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={v => { setPaymentMethod(v); if (v !== "Cartão Crédito") setInstallments("1"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                      <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Desconto e Parcelas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" />Desconto</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      className="flex-1"
                    />
                    <Select value={discountType} onValueChange={v => setDiscountType(v as "percent" | "value")}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="value">R$</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {showInstallments && (
                  <div className="space-y-1.5">
                    <Label>Parcelas</Label>
                    <Select value={installments} onValueChange={setInstallments}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x {formatCurrency(total / n)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  {discountValue > 0 && (
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      <span>Subtotal: {formatCurrency(subtotal)}</span>
                      <span className="text-destructive">Desc: -{formatCurrency(discountValue)}</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Total da Venda</p>
                  <p className="text-2xl font-bold">{formatCurrency(total)}</p>
                  {showInstallments && installmentsNum > 1 && (
                    <p className="text-sm text-muted-foreground">{installmentsNum}x de {formatCurrency(total / installmentsNum)}</p>
                  )}
                </div>
                <Button onClick={finalizeSale} size="lg" disabled={items.length === 0}>
                  <ShoppingCart className="h-4 w-4 mr-2" />Finalizar Venda
                </Button>
              </div>
            </motion.div>
          )}

          {showReceipt && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <div className="flex gap-3">
                <Button onClick={printReceipt}><Printer className="h-4 w-4 mr-2" />Imprimir Cupom</Button>
                <Button onClick={newSale} variant="outline">Nova Venda</Button>
              </div>
            </motion.div>
          )}
        </div>

        <div>
          <div ref={receiptRef} className="receipt-print bg-card rounded-lg shadow-card border p-5">
            <div className="text-center border-b pb-3 mb-3">
              <h3 className="font-bold text-sm">{companyInfo?.name || "MINHA EMPRESA"}</h3>
              {companyInfo?.document && (
                <p className="text-[10px] text-muted-foreground">
                  {companyInfo.person_type === "pj" ? "CNPJ" : "CPF"}: {companyInfo.document}
                </p>
              )}
              {companyInfo?.street && (
                <p className="text-[10px] text-muted-foreground">
                  {companyInfo.street}{companyInfo.number ? `, ${companyInfo.number}` : ""}{companyInfo.complement ? ` - ${companyInfo.complement}` : ""} - {companyInfo.neighborhood || ""}{companyInfo.city ? `, ${companyInfo.city}` : ""}{companyInfo.state ? `/${companyInfo.state}` : ""}
                </p>
              )}
              {companyInfo?.phone && (
                <p className="text-[10px] text-muted-foreground">Tel: {companyInfo.phone}</p>
              )}
              <div className="border-t border-dashed my-2" />
              <p className="text-[10px] font-medium">CUPOM NÃO FISCAL</p>
              <p className="text-[10px] text-muted-foreground">{now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR")}</p>
              {saleId && <p className="text-[10px] text-muted-foreground">Venda: #{saleId.slice(0, 8)}</p>}
            </div>

            {items.length > 0 ? (
              <>
                <div className="space-y-1 text-xs mb-3">
                  {items.map((i, idx) => (
                    <div key={i.productId} className="flex justify-between">
                      <div className="flex-1">
                        <span className="text-muted-foreground">{String(idx + 1).padStart(2, "0")} </span>
                        {i.productName}
                        <div className="text-muted-foreground pl-4">{i.quantity}x {formatCurrency(i.unitPrice)}</div>
                      </div>
                      <span className="font-medium">{formatCurrency(i.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed pt-2 space-y-1">
                  <div className="flex justify-between text-xs"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-xs text-destructive"><span>Desconto</span><span>-{formatCurrency(discountValue)}</span></div>
                  )}
                  <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pagamento</span>
                    <span>{paymentMethod}{showInstallments && installmentsNum > 1 ? ` ${installmentsNum}x` : ""}</span>
                  </div>
                  {showInstallments && installmentsNum > 1 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Valor Parcela</span>
                      <span>{formatCurrency(total / installmentsNum)}</span>
                    </div>
                  )}
                  {customerName && <div className="flex justify-between text-xs text-muted-foreground"><span>Cliente</span><span>{customerName}</span></div>}
                  {sellerName && <div className="flex justify-between text-xs text-muted-foreground"><span>Vendedor</span><span>{sellerName}</span></div>}
                  {selectedCustomer?.document && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{selectedCustomer.document_type.toUpperCase()}</span>
                      <span>{selectedCustomer.document}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-dashed mt-3 pt-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Obrigado pela preferência!</p>
                  <p className="text-[10px] text-muted-foreground">Volte sempre</p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Adicione itens para visualizar o cupom</p>
            )}
          </div>
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  );
};

export default Vendas;
