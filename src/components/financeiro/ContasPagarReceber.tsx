import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarIcon, Check, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Bill {
  id: string;
  type: string;
  description: string;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
  payment_method: string;
}

interface ContasPagarReceberProps {
  type: "pagar" | "receber";
}

const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão de Débito", "Cartão de Crédito"];

const emptyForm = { description: "", amount: "", due_date: undefined as Date | undefined, payment_method: "" };

const ContasPagarReceber = ({ type }: ContasPagarReceberProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useUserRole();
  const [bills, setBills] = useState<Bill[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pago" | "atrasado" | "pendente">("all");
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState(emptyForm);

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

  const openEdit = (bill: Bill) => {
    setEditingBill(bill);
    setForm({
      description: bill.description,
      amount: String(bill.amount),
      due_date: parseISO(bill.due_date),
      payment_method: bill.payment_method || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingBill(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.due_date || !form.payment_method) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    if (editingBill) {
      if (editingBill.paid) {
        toast({ title: "Erro", description: "Não é possível editar uma conta já paga", variant: "destructive" });
        return;
      }
      const { error } = await supabase.from("bills").update({
        description: form.description,
        amount: Number(form.amount),
        due_date: format(form.due_date, "yyyy-MM-dd"),
        payment_method: form.payment_method,
      } as any).eq("id", editingBill.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Conta atualizada!" });
    } else {
      const { error } = await supabase.from("bills").insert({
        user_id: effectiveUserId!,
        type,
        description: form.description,
        amount: Number(form.amount),
        due_date: format(form.due_date, "yyyy-MM-dd"),
        payment_method: form.payment_method,
      } as any);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: type === "pagar" ? "Conta a pagar registrada!" : "Conta a receber registrada!" });
    }

    setDialogOpen(false);
    setForm(emptyForm);
    setEditingBill(null);
    fetchBills();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const bill = bills.find(b => b.id === deleteId);
    if (bill?.paid) {
      toast({ title: "Erro", description: "Não é possível excluir uma conta já paga", variant: "destructive" });
      setDeleteId(null);
      return;
    }
    const { error } = await supabase.from("bills").delete().eq("id", deleteId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Conta excluída!" }); fetchBills(); }
    setDeleteId(null);
  };

  const handleMarkPaid = async (bill: Bill) => {
    const { error } = await supabase.from("bills").update({ paid: true, paid_at: new Date().toISOString() } as any).eq("id", bill.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    await supabase.from("transactions").insert({
      user_id: effectiveUserId!,
      type: type === "receber" ? "entrada" : "saida",
      description: bill.description,
      amount: Number(bill.amount),
      category: type === "pagar" ? "Conta a Pagar" : "Conta a Receber",
      payment_method: bill.payment_method || "",
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
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
      </div>

      {/* Dialog for new/edit */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingBill(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingBill ? "Editar" : "Nova"} {type === "pagar" ? "Conta a Pagar" : "Conta a Receber"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Forma de {type === "pagar" ? "Pagamento" : "Recebimento"}</Label>
              <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            <Button onClick={handleSave} className="w-full">{editingBill ? "Salvar" : "Registrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <TableHead>Forma</TableHead>
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
                  <TableCell>{b.payment_method || "—"}</TableCell>
                  <TableCell>{format(parseISO(b.due_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    {status === "pago" && <Badge className="bg-success/20 text-success border-0"><Check className="h-3 w-3 mr-1" />Pago</Badge>}
                    {status === "atrasado" && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Atrasado</Badge>}
                    {status === "pendente" && <Badge variant="secondary">Pendente</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!b.paid && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(b)}>
                            <Check className="h-3 w-3 mr-1" />Pagar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(b.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma conta encontrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ContasPagarReceber;
