import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface SaleCancellation {
  id: string;
  sale_id: string;
  cancelled_by_name: string;
  cancelled_by_email: string;
  reason: string;
  customer_name: string;
  payment_method: string;
  sale_date: string | null;
  sale_total: number;
  sale_discount: number;
  items: Array<{ product_name: string; quantity: number; unit_price: number; total: number; stock_returned: number }>;
  stock_returned_qty: number;
  cash_reverted: number;
  created_at: string;
}

const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleCancellationsDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<SaleCancellation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("sale_cancellations" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows(((data as any) || []) as SaleCancellation[]);
        setLoading(false);
      });
  }, [open]);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) =>
        [r.sale_id, r.cancelled_by_name, r.cancelled_by_email, r.reason, r.customer_name]
          .join(" ")
          .toLowerCase()
          .includes(term) ||
        r.items?.some((i) => i.product_name?.toLowerCase().includes(term)),
      )
    : rows;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de cancelamentos</DialogTitle>
          <DialogDescription>
            Quem cancelou, o motivo, os itens afetados e os valores devolvidos ao estoque e ao caixa.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar por venda, responsável, motivo, cliente ou produto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>}
          {!loading && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cancelamento registrado.</p>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Venda #{r.sale_id.slice(0, 8)} — {r.customer_name || "Consumidor"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cancelada em {new Date(r.created_at).toLocaleString("pt-BR")} por{" "}
                    {r.cancelled_by_name || r.cancelled_by_email || "usuário"}
                    {r.sale_date && ` · venda de ${new Date(r.sale_date).toLocaleString("pt-BR")}`}
                  </p>
                </div>
                <Badge variant="destructive">{money(Number(r.sale_total))}</Badge>
              </div>

              <p className="text-sm">
                <span className="text-muted-foreground">Motivo: </span>
                {r.reason || "Não informado"}
              </p>

              <div className="flex flex-wrap gap-4 text-xs">
                <span>
                  <span className="text-muted-foreground">Devolvido ao estoque: </span>
                  {Number(r.stock_returned_qty || 0)} un.
                </span>
                <span>
                  <span className="text-muted-foreground">Removido do caixa: </span>
                  {money(Number(r.cash_reverted))}
                </span>
                <span>
                  <span className="text-muted-foreground">Forma de pagamento: </span>
                  {r.payment_method || "—"}
                </span>
              </div>

              {r.items?.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-1 text-left">Item</th>
                        <th className="px-2 py-1 text-right">Qtd</th>
                        <th className="px-2 py-1 text-right">Unit.</th>
                        <th className="px-2 py-1 text-right">Total</th>
                        <th className="px-2 py-1 text-right">Estoque devolvido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((i, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1">{i.product_name}</td>
                          <td className="px-2 py-1 text-right">{Number(i.quantity)}</td>
                          <td className="px-2 py-1 text-right">{money(Number(i.unit_price))}</td>
                          <td className="px-2 py-1 text-right">{money(Number(i.total))}</td>
                          <td className="px-2 py-1 text-right">{Number(i.stock_returned || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
