import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Printer, Users, ShoppingBag } from "lucide-react";
import { printA4 } from "@/lib/printA4";
import { motion } from "framer-motion";

interface Customer {
  id: string;
  name: string;
  document: string;
  document_type: string;
  phone: string;
}

interface Sale {
  id: string;
  date: string;
  total: number;
  payment_method: string;
  customer_name: string | null;
  discount: number;
  installments: number;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const HistoricoCliente = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<Map<string, SaleItemRow[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  useEffect(() => {
    supabase.from("customers").select("id, name, document, document_type, phone").order("name").then(({ data }) => setCustomers(data || []));
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const fetchSales = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    setLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("*")
      .eq("customer_name", customer.name)
      .order("date", { ascending: false });

    const salesData = (data || []) as Sale[];
    setSales(salesData);

    // Fetch items for all sales
    if (salesData.length > 0) {
      const saleIds = salesData.map(s => s.id);
      const { data: items } = await supabase
        .from("sale_items")
        .select("*")
        .in("sale_id", saleIds);

      const itemsMap = new Map<string, SaleItemRow[]>();
      (items || []).forEach((item: any) => {
        const list = itemsMap.get(item.sale_id) || [];
        list.push(item);
        itemsMap.set(item.sale_id, list);
      });
      setSaleItems(itemsMap);
    } else {
      setSaleItems(new Map());
    }

    setLoading(false);
  };

  const handleCustomerChange = (value: string) => {
    setSelectedCustomerId(value);
    setExpandedSale(null);
    if (value) fetchSales(value);
    else { setSales([]); setSaleItems(new Map()); }
  };

  const totalGasto = sales.reduce((s, sale) => s + Number(sale.total), 0);
  const totalDesconto = sales.reduce((s, sale) => s + Number(sale.discount || 0), 0);

  const printHistorico = () => {
    if (!selectedCustomer || sales.length === 0) return;

    const rows = sales.map(s => {
      const items = saleItems.get(s.id) || [];
      const itemsStr = items.map(i => `${i.product_name} (${i.quantity}x)`).join(", ");
      const date = new Date(s.date).toLocaleDateString("pt-BR");
      return `<tr>
        <td>${date}</td>
        <td>${itemsStr || "—"}</td>
        <td>${s.payment_method}${s.installments > 1 ? ` ${s.installments}x` : ""}</td>
        <td style="text-align:right">${Number(s.discount) > 0 ? formatCurrency(Number(s.discount)) : "—"}</td>
        <td style="text-align:right;font-weight:600">${formatCurrency(Number(s.total))}</td>
      </tr>`;
    }).join("");

    printA4({
      title: "Histórico de Compras",
      subtitle: `${selectedCustomer.name}${selectedCustomer.document ? ` — ${selectedCustomer.document_type.toUpperCase()}: ${selectedCustomer.document}` : ""}`,
      content: `
        <div class="highlight-box">
          <div class="summary-row"><span>Total de Compras:</span><span>${sales.length}</span></div>
          <div class="summary-row"><span>Total em Descontos:</span><span>${formatCurrency(totalDesconto)}</span></div>
          <div class="summary-row total"><span>Total Gasto:</span><span>${formatCurrency(totalGasto)}</span></div>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Itens</th><th>Pagamento</th><th style="text-align:right">Desconto</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Histórico de Compras</h1>
          <p className="text-sm text-muted-foreground">Consulte todas as compras realizadas por cliente</p>
        </div>
        {sales.length > 0 && (
          <Button variant="outline" size="sm" onClick={printHistorico}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir Relatório
          </Button>
        )}
      </div>

      <div className="max-w-md space-y-1.5">
        <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Selecione o Cliente</Label>
        <Select value={selectedCustomerId} onValueChange={handleCustomerChange}>
          <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
          <SelectContent>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}{c.document ? ` (${c.document_type.toUpperCase()}: ${c.document})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && selectedCustomerId && sales.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma compra encontrada para este cliente</p>
        </div>
      )}

      {!loading && sales.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg shadow-card border p-4">
              <p className="text-sm text-muted-foreground">Total de Compras</p>
              <p className="text-2xl font-bold">{sales.length}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-lg shadow-card border p-4">
              <p className="text-sm text-muted-foreground">Total Gasto</p>
              <p className="text-2xl font-bold">{formatCurrency(totalGasto)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border p-4">
              <p className="text-sm text-muted-foreground">Ticket Médio</p>
              <p className="text-2xl font-bold">{formatCurrency(sales.length > 0 ? totalGasto / sales.length : 0)}</p>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pagamento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Desconto</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sales.map(s => {
                    const items = saleItems.get(s.id) || [];
                    const isExpanded = expandedSale === s.id;
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedSale(isExpanded ? null : s.id)}
                      >
                        <td className="px-4 py-3">
                          <div>{new Date(s.date).toLocaleDateString("pt-BR")}</div>
                          <div className="text-xs text-muted-foreground">#{s.id.slice(0, 8)}</div>
                          {isExpanded && items.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {items.map(item => (
                                <div key={item.id} className="text-xs text-muted-foreground flex justify-between max-w-xs">
                                  <span>{item.product_name} ({item.quantity}x)</span>
                                  <span className="ml-2">{formatCurrency(Number(item.total))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.payment_method}
                          {s.installments > 1 && <span className="text-xs ml-1">({s.installments}x)</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                          {Number(s.discount) > 0 ? formatCurrency(Number(s.discount)) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(s.total))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default HistoricoCliente;
