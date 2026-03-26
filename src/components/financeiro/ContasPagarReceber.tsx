import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarIcon, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Bill {
  id: string;
  type: string;
  description: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
}

interface ContasPagarReceberProps {
  type: "pagar" | "receber";
}

const ContasPagarReceber = ({ type }: ContasPagarReceberProps) => {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pago" | "atrasado" | "pendente">("all");
  const { toast } = useToast();

  const [form, setForm] = useState({ description: "", amount: "", due_date: undefined as Date | undefined });

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .eq("type", type)
      .order("due_date", { ascending: true });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setBills((data as Bill[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBills(); }, [type]);

  const getStatus = (bill: Bill): "pago" | "atrasado" | "pendente" => {
    if (bill.paid) return "pago";
    if (isPast(parseISO(bill.due_date))) return "atrasado";
    return "pendente";
  };

  const filtered = statusFilter === "all" ? bills : bills.filter(b => getStatus(b) === statusFilter);

  const totalPago = bills.filter(b => b.paid).reduce((s, b) => s + Number(b.amount), 0);
  const totalAtrasado = bills.filter(b => !b.paid && isPast(parseISO(b.due_date))).reduce((s, b) => s + Number(b.amount), 0);
  const totalPendente = bills.filter(b => !b.paid && !isPast(parseISO(b.due_date))).reduce((s, b) => s + Number(b.amount), 0);

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleAdd = async () => {
    if (!form.description || !form.amount || !form.due_date) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("bills").insert({
      user_id: user!.id,
      type,
      description: form.description,
      amount: Number(form.amount),
      due_date: format(form.due_date, "yyyy-MM-dd"),
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setDialogOpen(false);
    setForm({ description: "", amount: "", due_date: undefined });
    toast({ title: type === "pagar" ? "Conta a pagar registrada!" : "Conta a receber registrada!" });
    fetchBills();
  };

  const handleMarkPaid = async (bill: Bill) => {
    const { error } = await supabase.from("bills").update({ paid: true, paid_at: new Date().toISOString() } as any).eq("id", bill.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    // Register in transactions
    await supabase.from("transactions").insert({
      user_id: user!.id,
      type: type === "receber" ? "entrada" : "saida",
      description: bill.description,
      amount: Number(bill.amount),
      category: type === "pagar" ? "Conta a Pagar" : "Conta a Receber",
      payment_method: "",
    });

    toast({ title: "Marcado como pago!" });
    fetchBills();
  };

  const label = type === "pagar" ? "Contas a Pagar" : "Contas a Receber";

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{label}</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas {type === "pagar" ? "obrigações" : "receitas previstas"}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nova {type === "pagar" ? "Conta a Pagar" : "Conta a Receber"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5"><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Data de Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.due_date ? format(form.due_date, "dd/MM/yyyy") : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.due_date} onSelect={(d) => setForm({ ...form, due_date: d || undefined })} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleAdd} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pago</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalPago)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Atrasado</p>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalAtrasado)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pendente</p>
          <p className="text-xl font-bold text-warning">{formatCurrency(totalPendente)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "pago", "atrasado", "pendente"] as const).map(f => (
          <Button key={f} variant={statusFilter === f ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(f)}>
            {f === "all" ? "Todas" : f === "pago" ? "Pagas" : f === "atrasado" ? "Atrasadas" : "Pendentes"}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow-card border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(b => {
              const status = getStatus(b);
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.description}</TableCell>
                  <TableCell>{formatCurrency(Number(b.amount))}</TableCell>
                  <TableCell>{format(parseISO(b.due_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {status === "pago" && <Badge className="bg-success/20 text-success border-0"><Check className="h-3 w-3 mr-1" />Pago</Badge>}
                    {status === "atrasado" && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Atrasado</Badge>}
                    {status === "pendente" && <Badge variant="secondary">Pendente</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {!b.paid && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkPaid(b)}>
                        <Check className="h-3 w-3 mr-1" />Marcar Pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma conta encontrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ContasPagarReceber;
