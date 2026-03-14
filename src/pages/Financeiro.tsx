import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  category: string;
  payment_method: string;
  date: string;
}

const Financeiro = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "entrada" | "saida">("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [form, setForm] = useState({ type: "entrada" as "entrada" | "saida", description: "", amount: "", category: "", payment_method: "" });

  const fetchTransactions = async () => {
    const { data, error } = await supabase.from("transactions").select("*").order("date", { ascending: false });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTransactions(); }, []);

  const filtered = filter === "all" ? transactions : transactions.filter(t => t.type === filter);
  const totalEntradas = transactions.filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = transactions.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const saldo = totalEntradas - totalSaidas;

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleAdd = async () => {
    if (!form.description || !form.amount) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("transactions").insert({
      user_id: user!.id,
      type: form.type,
      description: form.description,
      amount: Number(form.amount),
      category: form.category,
      payment_method: form.payment_method,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDialogOpen(false);
    setForm({ type: "entrada", description: "", amount: "", category: "", payment_method: "" });
    toast({ title: "Movimentação registrada!" });
    fetchTransactions();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Controle de entradas e saídas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Movimentação</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "entrada" | "saida" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Forma de Pagamento</Label><Input value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} placeholder="Dinheiro, PIX, Cartão..." /></div>
              <Button onClick={handleAdd} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Entradas</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalEntradas)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Saídas</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Saldo</p>
          <p className={`text-xl font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(saldo)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "entrada", "saida"] as const).map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? "Todas" : f === "entrada" ? "Entradas" : "Saídas"}
          </Button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border divide-y">
        {filtered.map(t => (
          <div key={t.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
              </div>
              <div>
                <p className="text-sm font-medium">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{t.date}</span>
                  <Badge variant="secondary" className="text-[10px] h-4">{t.payment_method}</Badge>
                </div>
              </div>
            </div>
            <span className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
              {t.type === "entrada" ? "+" : "-"}{formatCurrency(Number(t.amount))}
            </span>
          </div>
        ))}
        {filtered.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação encontrada</div>}
      </motion.div>
    </div>
  );
};

export default Financeiro;
