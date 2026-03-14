import { useState, useRef } from "react";
import { mockProducts } from "@/data/mockData";
import { SaleItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Printer, Plus, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const Vendas = () => {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [customerName, setCustomerName] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const total = items.reduce((s, i) => s + i.total, 0);
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const addItem = () => {
    const product = mockProducts.find(p => p.id === selectedProduct);
    if (!product) { toast({ title: "Selecione um produto", variant: "destructive" }); return; }
    const qty = Number(quantity) || 1;
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      setItems(items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty, total: (i.quantity + qty) * i.unitPrice } : i));
    } else {
      setItems([...items, { productId: product.id, productName: product.name, quantity: qty, unitPrice: product.price, total: qty * product.price }]);
    }
    setQuantity("1");
    setSelectedProduct("");
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const finalizeSale = () => {
    if (items.length === 0) { toast({ title: "Adicione itens à venda", variant: "destructive" }); return; }
    setShowReceipt(true);
    toast({ title: "Venda finalizada!", description: `Total: ${formatCurrency(total)}` });
  };

  const printReceipt = () => {
    window.print();
  };

  const newSale = () => {
    setItems([]);
    setCustomerName("");
    setShowReceipt(false);
  };

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vendas / Cupom Fiscal</h1>
        <p className="text-sm text-muted-foreground">Registre vendas e emita cupons</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sale form */}
        <div className="lg:col-span-2 space-y-4">
          {!showReceipt && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Produto</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {mockProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1.5">
                  <Label>Qtd</Label>
                  <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button onClick={addItem}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
                </div>
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
                  <Label>Cliente (opcional)</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-1.5">
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Total da Venda</p>
                  <p className="text-2xl font-bold">{formatCurrency(total)}</p>
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
                <Button onClick={printReceipt} variant="default"><Printer className="h-4 w-4 mr-2" />Imprimir Cupom</Button>
                <Button onClick={newSale} variant="outline">Nova Venda</Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Receipt Preview */}
        <div>
          <div ref={receiptRef} className="receipt-print bg-card rounded-lg shadow-card border p-5">
            <div className="text-center border-b pb-3 mb-3">
              <h3 className="font-bold text-sm">STOCKFLOW LTDA</h3>
              <p className="text-[10px] text-muted-foreground">CNPJ: 00.000.000/0001-00</p>
              <p className="text-[10px] text-muted-foreground">Rua Exemplo, 123 - Centro</p>
              <div className="border-t border-dashed my-2" />
              <p className="text-[10px] font-medium">CUPOM FISCAL</p>
              <p className="text-[10px] text-muted-foreground">{now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR")}</p>
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
                  <div className="flex justify-between text-xs"><span>Subtotal</span><span>{formatCurrency(total)}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Pagamento</span><span>{paymentMethod}</span></div>
                  {customerName && <div className="flex justify-between text-xs text-muted-foreground"><span>Cliente</span><span>{customerName}</span></div>}
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
    </div>
  );
};

export default Vendas;
