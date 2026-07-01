import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Sliders, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { motion } from "framer-motion";

interface Product { id: string; name: string; sku: string; stock: number; unit: string; cost: number; }
interface Movement {
  id: string;
  product_id: string;
  type: "entrada" | "saida" | "ajuste";
  quantity: number;
  unit_cost: number;
  reason: string;
  notes: string;
  reference: string;
  created_at: string;
  products?: { name: string; sku: string; unit: string } | null;
}

const typeLabels: Record<string, { label: string; color: string; icon: any }> = {
  entrada: { label: "Entrada", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: ArrowDownCircle },
  saida:   { label: "Saída",   color: "bg-red-500/15 text-red-600 dark:text-red-400", icon: ArrowUpCircle },
  ajuste:  { label: "Ajuste",  color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Sliders },
};

export default function MovimentacaoEstoque() {
  const { user } = useAuth();
  const { effectiveUserId } = useUserRole();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    product_id: "",
    type: "entrada" as "entrada" | "saida" | "ajuste",
    quantity: "",
    unit_cost: "",
    reason: "",
    notes: "",
    reference: "",
  });

  const loadAll = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    const [pRes, mRes] = await Promise.all([
      supabase.from("products").select("id,name,sku,stock,unit,cost").eq("user_id", effectiveUserId).order("name"),
      supabase.from("stock_movements").select("*, products(name,sku,unit)").eq("user_id", effectiveUserId).order("created_at", { ascending: false }).limit(300),
    ]);
    if (pRes.data) setProducts(pRes.data as Product[]);
    if (mRes.data) setMovements(mRes.data as any);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [effectiveUserId]);

  const selectedProduct = useMemo(() => products.find(p => p.id === form.product_id), [products, form.product_id]);

  const resetForm = () => setForm({ product_id: "", type: "entrada", quantity: "", unit_cost: "", reason: "", notes: "", reference: "" });

  const openNew = (type: "entrada" | "saida" | "ajuste" = "entrada") => {
    resetForm();
    setForm(f => ({ ...f, type }));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !effectiveUserId) return;
    if (!form.product_id) return toast({ title: "Selecione um produto", variant: "destructive" });
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) return toast({ title: "Quantidade inválida", variant: "destructive" });

    if (form.type === "saida" && selectedProduct && qty > selectedProduct.stock) {
      return toast({ title: "Estoque insuficiente", description: `Disponível: ${selectedProduct.stock} ${selectedProduct.unit}`, variant: "destructive" });
    }

    const payload = {
      user_id: effectiveUserId,
      product_id: form.product_id,
      type: form.type,
      quantity: qty,
      unit_cost: Number(form.unit_cost) || 0,
      reason: form.reason.trim(),
      notes: form.notes.trim(),
      reference: form.reference.trim(),
      created_by: user.id,
    };

    const { error } = await supabase.from("stock_movements").insert(payload);
    if (error) return toast({ title: "Erro ao registrar", description: error.message, variant: "destructive" });

    await logAudit({
      action: "stock_movement_created",
      entity: "stock_movement",
      details: { product_id: form.product_id, type: form.type, quantity: qty },
    });

    toast({ title: "Movimentação registrada", description: `Saldo atualizado automaticamente.` });
    setDialogOpen(false);
    resetForm();
    loadAll();
  };

  const handleDelete = async (m: Movement) => {
    if (!confirm(`Estornar esta ${typeLabels[m.type].label.toLowerCase()} de ${m.quantity}? O saldo do produto será revertido.`)) return;
    const { error } = await supabase.from("stock_movements").delete().eq("id", m.id);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    await logAudit({ action: "stock_movement_deleted", entity: "stock_movement", entityId: m.id });
    toast({ title: "Movimentação estornada" });
    loadAll();
  };

  const filtered = movements.filter(m => {
    if (filterType !== "all" && m.type !== filterType) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (m.products?.name || "").toLowerCase().includes(s) ||
      (m.products?.sku || "").toLowerCase().includes(s) ||
      m.reason.toLowerCase().includes(s) ||
      m.reference.toLowerCase().includes(s)
    );
  });

  const stats = useMemo(() => {
    const entradas = movements.filter(m => m.type === "entrada").reduce((s, m) => s + Number(m.quantity), 0);
    const saidas = movements.filter(m => m.type === "saida").reduce((s, m) => s + Number(m.quantity), 0);
    const ajustes = movements.filter(m => m.type === "ajuste").length;
    return { entradas, saidas, ajustes };
  }, [movements]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Movimentação de Estoque</h1>
          <p className="text-sm text-muted-foreground">Registre entradas, saídas e ajustes. O saldo do produto é atualizado automaticamente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openNew("entrada")}><ArrowDownCircle className="w-4 h-4 mr-1" /> Entrada</Button>
          <Button variant="outline" onClick={() => openNew("saida")}><ArrowUpCircle className="w-4 h-4 mr-1" /> Saída</Button>
          <Button variant="outline" onClick={() => openNew("ajuste")}><Sliders className="w-4 h-4 mr-1" /> Ajuste</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openNew("entrada")}><Plus className="w-4 h-4 mr-1" /> Nova</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova Movimentação de Estoque</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (soma ao estoque)</SelectItem>
                      <SelectItem value="saida">Saída (subtrai do estoque)</SelectItem>
                      <SelectItem value="ajuste">Ajuste (correção manual +/-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Produto</Label>
                  <Select value={form.product_id} onValueChange={(v) => {
                    const p = products.find(x => x.id === v);
                    setForm({ ...form, product_id: v, unit_cost: p ? String(p.cost) : form.unit_cost });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {p.sku} (saldo: {p.stock} {p.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProduct && (
                    <p className="text-xs text-muted-foreground">Saldo atual: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong></p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Quantidade {form.type === "ajuste" && <span className="text-xs text-muted-foreground">(use negativo p/ diminuir? Não — use "Saída")</span>}</Label>
                    <Input type="number" step="0.001" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo Unitário (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Motivo</Label>
                  <Input placeholder="Ex.: Compra, Devolução, Perda, Inventário..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Referência (NF, pedido, OS...)</Label>
                  <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave}>Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Entradas (últ. 300)</p><p className="text-2xl font-bold text-emerald-600">{stats.entradas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Saídas (últ. 300)</p><p className="text-2xl font-bold text-red-600">{stats.saidas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ajustes</p><p className="text-2xl font-bold text-amber-600">{stats.ajustes}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar produto, motivo, referência..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
                <SelectItem value="ajuste">Ajustes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Data</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Produto</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Custo Unit.</th>
                  <th className="p-2">Motivo</th>
                  <th className="p-2">Ref.</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>}
                {filtered.map(m => {
                  const t = typeLabels[m.type];
                  const Icon = t.icon;
                  return (
                    <tr key={m.id} className="border-b hover:bg-muted/40">
                      <td className="p-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2"><Badge className={t.color + " gap-1"}><Icon className="w-3 h-3" />{t.label}</Badge></td>
                      <td className="p-2">
                        <div className="font-medium">{m.products?.name || "-"}</div>
                        <div className="text-xs text-muted-foreground">{m.products?.sku}</div>
                      </td>
                      <td className="p-2 text-right font-mono">{Number(m.quantity)} {m.products?.unit}</td>
                      <td className="p-2 text-right font-mono">R$ {Number(m.unit_cost).toFixed(2)}</td>
                      <td className="p-2">{m.reason || "-"}</td>
                      <td className="p-2">{m.reference || "-"}</td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(m)} title="Estornar">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
