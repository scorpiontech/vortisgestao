import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer, Plus, ShoppingCart, Users, ScanBarcode, Percent, Search, AlertTriangle, X } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface SaleItem {
  productId: string;
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
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  useEffect(() => {
    supabase.from("products").select("id, name, price, stock, sku").order("name").then(({ data }) => setProducts(data || []));
    supabase.from("customers").select("id, name, document, document_type, phone").order("name").then(({ data }) => setCustomers(data || []));
    supabase.from("cash_registers").select("id").eq("status", "open").limit(1).then(({ data }) => {
      setCaixaAberto(data && data.length > 0);
    });
    supabase.from("company_registrations").select("name, document, person_type, phone, street, number, complement, neighborhood, city, state, zip_code").limit(1).single().then(({ data }) => {
      if (data) setCompanyInfo(data as CompanyInfo);
    });
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleCustomerChange = (value: string) => {
    setSelectedCustomerId(value);
    if (value === "__none__") {
      setCustomerName("");
      setSelectedCustomerId("");
    } else {
      const c = customers.find(c => c.id === value);
      setCustomerName(c?.name || "");
    }
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
      setItems([...items, { productId: product.id, productName: product.name, quantity: qty, unitPrice: product.price, total: qty * product.price }]);
    }
    setQuantity("1");
    setProductSearch("");
  };

  const removeItem = (productId: string) => setItems(items.filter(i => i.productId !== productId));

  const handleBarcodeScan = (code: string) => {
    const product = products.find(p => p.sku.toLowerCase() === code.toLowerCase());
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
      user_id: user!.id,
      customer_name: customerName || null,
      payment_method: paymentMethod,
      total,
      discount: discountValue,
      installments: inst,
    } as any).select().single();

    if (saleError || !sale) { toast({ title: "Erro ao registrar venda", description: saleError?.message, variant: "destructive" }); return; }

    const saleItems = items.map(i => ({
      sale_id: (sale as any).id,
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      total: i.total,
    }));
    await supabase.from("sale_items").insert(saleItems);

    await supabase.from("transactions").insert({
      user_id: user!.id,
      type: "entrada",
      description: `Venda #${(sale as any).id.slice(0, 8)}${customerName ? ` - ${customerName}` : ""}`,
      amount: total,
      category: "Vendas",
      payment_method: paymentMethod + (inst > 1 ? ` ${inst}x` : ""),
    });

    for (const item of items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        await supabase.from("products").update({ stock: Math.max(0, prod.stock - item.quantity) }).eq("id", item.productId);
      }
    }

    setSaleId((sale as any).id);
    setShowReceipt(true);
    toast({ title: "Venda finalizada!", description: `Total: ${formatCurrency(total)}` });
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
      <div>
        <h1 className="text-2xl font-bold">PDV</h1>
        <p className="text-sm text-muted-foreground">Ponto de Venda — registre vendas e emita cupons</p>
      </div>

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
                  <Select value={selectedCustomerId} onValueChange={handleCustomerChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sem cliente —</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.document ? ` (${c.document_type.toUpperCase()}: ${c.document})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedCustomerId && (
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Ou digite o nome manualmente" className="mt-1.5" />
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
              <p className="text-[10px] font-medium">CUPOM FISCAL</p>
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
