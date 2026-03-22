import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowUpRight, ArrowDownRight, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

  const [form, setForm] = useState({ type: "entrada" as "entrada" | "saida", description: "", amount: "", category: "", payment_method: "" });

  const fetchTransactions = async () => {
    const fromStr = format(dateFrom, "yyyy-MM-dd");
    const toStr = format(dateTo, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("date", fromStr)
      .lte("date", toStr)
      .order("date", { ascending: false });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTransactions(); }, [dateFrom, dateTo]);

  const filtered = filter === "all" ? transactions : transactions.filter(t => t.type === filter);
  const totalEntradas = transactions.filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = transactions.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const saldo = totalEntradas - totalSaidas;

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const setQuickPeriod = (months: number) => {
    if (months === 0) {
      setDateFrom(startOfMonth(new Date()));
      setDateTo(endOfMonth(new Date()));
    } else {
      const from = startOfMonth(subMonths(new Date(), months));
      const to = endOfMonth(new Date());
      setDateFrom(from);
      setDateTo(to);
    }
  };

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
          <h1 className="text-2xl font-bold">Movimentação Financeira</h1>
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

      {/* Period Filter */}
      <div className="bg-card rounded-lg shadow-card border p-4 space-y-3">
        <p className="text-sm font-medium">Filtrar por Período</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setQuickPeriod(0)}>Mês Atual</Button>
          <Button variant="outline" size="sm" onClick={() => setQuickPeriod(1)}>Últimos 2 meses</Button>
          <Button variant="outline" size="sm" onClick={() => setQuickPeriod(2)}>Últimos 3 meses</Button>
          <Button variant="outline" size="sm" onClick={() => setQuickPeriod(5)}>Últimos 6 meses</Button>
          <Button variant="outline" size="sm" onClick={() => setQuickPeriod(11)}>Último ano</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateFrom, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateTo, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
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
