import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Unlock, Printer, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface CashRegister {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  notes: string;
  status: string;
}

const Caixa = () => {
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [openRegister, setOpenRegister] = useState<CashRegister | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatDate = (d: string) => new Date(d).toLocaleString("pt-BR");

  const fetchRegisters = async () => {
    const { data } = await supabase
      .from("cash_registers")
      .select("*")
      .order("opened_at", { ascending: false });
    const list = (data || []) as CashRegister[];
    setRegisters(list);
    setOpenRegister(list.find(r => r.status === "open") || null);
    setLoading(false);
  };

  const fetchSalesForPeriod = async (since: string) => {
    const { data } = await supabase
      .from("transactions")
      .select("amount, type")
      .gte("created_at", since);
    const entradas = (data || []).filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
    const saidas = (data || []).filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
    setSalesTotal(entradas - saidas);
  };

  useEffect(() => { fetchRegisters(); }, []);

  useEffect(() => {
    if (openRegister) fetchSalesForPeriod(openRegister.opened_at);
  }, [openRegister]);

  const handleOpen = async () => {
    if (openRegister) {
      toast({ title: "Já existe um caixa aberto", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("cash_registers").insert({
      user_id: user!.id,
      opening_amount: Number(openingAmount) || 0,
      status: "open",
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Caixa aberto!" });
    setOpenDialog(false);
    setOpeningAmount("");
    fetchRegisters();
  };

  const handleClose = async () => {
    if (!openRegister) return;
    const expectedAmount = openRegister.opening_amount + salesTotal;
    const { error } = await supabase
      .from("cash_registers")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closing_amount: Number(closingAmount) || 0,
        expected_amount: expectedAmount,
        notes,
      } as any)
      .eq("id", openRegister.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Caixa fechado!" });
    setCloseDialog(false);
    setClosingAmount("");
    setNotes("");
    fetchRegisters();
  };

  const printReport = (reg: CashRegister) => {
    const diff = reg.closing_amount != null && reg.expected_amount != null
      ? reg.closing_amount - reg.expected_amount : 0;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>Relatório de Caixa</title>
      <style>body{font-family:monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto}
      h2{text-align:center;margin-bottom:16px}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .divider{border-top:1px dashed #999;margin:8px 0}
      .diff-pos{color:green}.diff-neg{color:red}
      </style></head><body>
      <h2>RELATÓRIO DE CAIXA</h2>
      <div class="divider"></div>
      <div class="row"><span>Abertura:</span><span>${formatDate(reg.opened_at)}</span></div>
      ${reg.closed_at ? `<div class="row"><span>Fechamento:</span><span>${formatDate(reg.closed_at)}</span></div>` : ""}
      <div class="divider"></div>
      <div class="row"><span>Valor Abertura:</span><span>${formatCurrency(reg.opening_amount)}</span></div>
      ${reg.expected_amount != null ? `<div class="row"><span>Valor Esperado:</span><span>${formatCurrency(reg.expected_amount)}</span></div>` : ""}
      ${reg.closing_amount != null ? `<div class="row"><span>Valor Fechamento:</span><span>${formatCurrency(reg.closing_amount)}</span></div>` : ""}
      ${reg.closing_amount != null && reg.expected_amount != null ? `<div class="divider"></div><div class="row"><span>Diferença:</span><span class="${diff >= 0 ? "diff-pos" : "diff-neg"}">${diff >= 0 ? "+" : ""}${formatCurrency(diff)}</span></div>` : ""}
      ${reg.notes ? `<div class="divider"></div><div><strong>Obs:</strong> ${reg.notes}</div>` : ""}
      <div class="divider"></div>
      <div style="text-align:center;margin-top:16px">Vortis Gestão - Controle de Caixa</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  const expectedAmount = openRegister ? openRegister.opening_amount + salesTotal : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Controle de Caixa</h1>
          <p className="text-sm text-muted-foreground">Abertura, fechamento e conferência</p>
        </div>
        <div className="flex gap-2">
          {!openRegister ? (
            <Button onClick={() => setOpenDialog(true)}>
              <Unlock className="h-4 w-4 mr-2" />Abrir Caixa
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setCloseDialog(true)}>
              <Lock className="h-4 w-4 mr-2" />Fechar Caixa
            </Button>
          )}
        </div>
      </div>

      {openRegister && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-4 shadow-card border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Abertura</p>
            <p className="text-xl font-bold">{formatCurrency(openRegister.opening_amount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(openRegister.opened_at)}</p>
          </div>
          <div className="bg-card rounded-lg p-4 shadow-card border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Movimentação</p>
            <p className={`text-xl font-bold ${salesTotal >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(salesTotal)}</p>
          </div>
          <div className="bg-card rounded-lg p-4 shadow-card border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Esperado</p>
            <p className="text-xl font-bold">{formatCurrency(expectedAmount)}</p>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border">
        <div className="p-5 border-b"><h2 className="font-semibold">Histórico de Caixas</h2></div>
        <div className="divide-y">
          {registers.map(r => {
            const diff = r.closing_amount != null && r.expected_amount != null ? r.closing_amount - r.expected_amount : null;
            return (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${r.status === "open" ? "bg-success/10" : "bg-muted"}`}>
                    <DollarSign className={`h-4 w-4 ${r.status === "open" ? "text-success" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{formatDate(r.opened_at)}</p>
                      <Badge variant={r.status === "open" ? "default" : "secondary"} className="text-[10px] h-4">
                        {r.status === "open" ? "Aberto" : "Fechado"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>Abertura: {formatCurrency(r.opening_amount)}</span>
                      {r.closing_amount != null && <span>Fechamento: {formatCurrency(r.closing_amount)}</span>}
                      {diff != null && (
                        <span className={diff >= 0 ? "text-success" : "text-destructive"}>
                          Dif: {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {r.status === "closed" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printReport(r)}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          {registers.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum registro de caixa</div>}
        </div>
      </motion.div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Valor Inicial (R$)</Label>
              <Input type="number" step="0.01" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="0,00" />
            </div>
            <Button onClick={handleOpen} className="w-full">Confirmar Abertura</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Fechar Caixa</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Abertura:</span><span>{formatCurrency(openRegister?.opening_amount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Movimentação:</span><span>{formatCurrency(salesTotal)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Esperado:</span><span>{formatCurrency(expectedAmount)}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label>Valor em Caixa (R$)</Label>
              <Input type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} placeholder="Conte o dinheiro..." />
            </div>
            {closingAmount && (
              <div className={`text-sm font-medium ${Number(closingAmount) - expectedAmount >= 0 ? "text-success" : "text-destructive"}`}>
                Diferença: {Number(closingAmount) - expectedAmount >= 0 ? "+" : ""}{formatCurrency(Number(closingAmount) - expectedAmount)}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações do fechamento..." rows={3} />
            </div>
            <Button onClick={handleClose} className="w-full" variant="destructive">Confirmar Fechamento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Caixa;
