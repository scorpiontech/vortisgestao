import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Unlock, Printer, DollarSign, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
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
  user_id: string;
}

interface CompanyMember {
  user_id: string;
  name: string;
  role: string;
}

const Caixa = () => {
  const { user } = useAuth();
  const { effectiveUserId, isMaster } = useUserRole();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [openRegister, setOpenRegister] = useState<CashRegister | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [closingRegister, setClosingRegister] = useState<CashRegister | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<string>("all");
  const { toast } = useToast();

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatDate = (d: string) => new Date(d).toLocaleString("pt-BR");

  const fetchMembers = async () => {
    if (!isMaster || !user) return;
    const { data } = await supabase
      .from("company_members")
      .select("user_id, name, role")
      .eq("owner_id", user.id)
      .eq("active", true);
    setMembers(data || []);
  };

  const fetchRegisters = async () => {
    const { data } = await supabase
      .from("cash_registers")
      .select("*")
      .order("opened_at", { ascending: false });
    const list = (data || []) as CashRegister[];
    setRegisters(list);
    // For the current user, find their open register (use actual user id, not effective)
    setOpenRegister(list.find(r => r.status === "open" && r.user_id === user?.id) || null);
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

  useEffect(() => {
    fetchRegisters();
    fetchMembers();
  }, [isMaster]);

  useEffect(() => {
    if (openRegister) fetchSalesForPeriod(openRegister.opened_at);
  }, [openRegister]);

  const getMemberName = (userId: string) => {
    if (userId === user?.id) return "Você (Master)";
    const m = members.find(m => m.user_id === userId);
    return m?.name || userId.slice(0, 8);
  };

  const handleOpen = async () => {
    const targetUserId = isMaster && selectedMemberId ? selectedMemberId : effectiveUserId!;
    // Re-fetch to ensure up-to-date state (prevents race conditions)
    const { data: currentOpen } = await supabase
      .from("cash_registers")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("status", "open")
      .maybeSingle();
    if (currentOpen) {
      const who = targetUserId === user?.id ? "você" : getMemberName(targetUserId);
      toast({
        title: "Caixa já aberto",
        description: `Já existe um caixa aberto para ${who}. Feche o caixa atual antes de abrir um novo.`,
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("cash_registers").insert({
      user_id: targetUserId,
      opening_amount: Number(openingAmount) || 0,
      status: "open",
    } as any);
    if (error) {
      // Unique index violation (defense-in-depth)
      if (error.code === "23505") {
        toast({
          title: "Caixa já aberto",
          description: "Não é possível abrir um novo caixa enquanto houver um em aberto para este operador.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: "Caixa aberto!" });
    logAudit({ action: "cash_open", entity: "cash_register", details: { opening_amount: Number(openingAmount) || 0, target_user: targetUserId } });
    setOpenDialog(false);
    setOpeningAmount("");
    setSelectedMemberId("");
    fetchRegisters();
  };

  const handleClose = async () => {
    const reg = closingRegister || openRegister;
    if (!reg) return;
    // Fetch sales for that register's period
    const { data: txData } = await supabase
      .from("transactions")
      .select("amount, type")
      .gte("created_at", reg.opened_at);
    const entradas = (txData || []).filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
    const saidas = (txData || []).filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
    const regSalesTotal = entradas - saidas;
    const expectedAmount = reg.opening_amount + regSalesTotal;

    const { error } = await supabase
      .from("cash_registers")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closing_amount: Number(closingAmount) || 0,
        expected_amount: expectedAmount,
        notes,
      } as any)
      .eq("id", reg.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Caixa fechado!" });
    logAudit({ action: "cash_close", entity: "cash_register", details: { closing_amount: Number(closingAmount) || 0 } });
    setCloseDialog(false);
    setClosingAmount("");
    setNotes("");
    setClosingRegister(null);
    fetchRegisters();
  };

  const openCloseDialogFor = (reg: CashRegister) => {
    setClosingRegister(reg);
    setCloseDialog(true);
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
      <div class="row"><span>Operador:</span><span>${getMemberName(reg.user_id)}</span></div>
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
  const openRegisters = registers.filter(r => r.status === "open");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Controle de Caixa</h1>
          <p className="text-sm text-muted-foreground">Abertura, fechamento e conferência</p>
        </div>
        <div className="flex gap-2">
          {openRegister && (
            <Button variant="destructive" onClick={() => openCloseDialogFor(openRegister)}>
              <Lock className="h-4 w-4 mr-2" />Fechar Meu Caixa
            </Button>
          )}
          {isMaster && (
            <Button onClick={() => setOpenDialog(true)}>
              <Unlock className="h-4 w-4 mr-2" />Abrir Caixa
            </Button>
          )}
        </div>
      </div>

      {/* Master: show all open registers */}
      {isMaster && openRegisters.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Caixas Abertos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {openRegisters.map(reg => (
              <div key={reg.id} className="bg-card rounded-lg p-4 shadow-card border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{getMemberName(reg.user_id)}</p>
                  <Badge className="text-[10px] h-4">Aberto</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(reg.opened_at)}</p>
                <p className="text-lg font-bold">{formatCurrency(reg.opening_amount)}</p>
                <Button variant="destructive" size="sm" className="w-full" onClick={() => openCloseDialogFor(reg)}>
                  <Lock className="h-3.5 w-3.5 mr-1.5" />Fechar Caixa
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Current user open register summary (non-master or master's own) */}
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

      {(() => {
        const filteredRegisters = filterMemberId === "all" ? registers : registers.filter(r => r.user_id === filterMemberId);
        return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border">
        <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-semibold">Histórico de Caixas</h2>
          {isMaster && members.length > 0 && (
            <Select value={filterMemberId} onValueChange={setFilterMemberId}>
              <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Filtrar por vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value={user?.id || ""}>Você (Master)</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="divide-y">
          {filteredRegisters.map(r => {
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
                      {isMaster && <span className="text-xs text-muted-foreground">({getMemberName(r.user_id)})</span>}
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
                <div className="flex items-center gap-1">
                  {r.status === "open" && (isMaster || r.user_id === user?.id) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCloseDialogFor(r)}>
                      <Lock className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                  {r.status === "closed" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printReport(r)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredRegisters.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum registro de caixa</div>}
        </div>
      </motion.div>
        );
      })()}

      {/* Open Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Abrir Caixa</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            {isMaster && members.length > 0 && (
              <div className="space-y-1.5">
                <Label>Operador</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger><SelectValue placeholder="Selecione (ou deixe para você)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={user?.id || ""}>Você (Master)</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Valor Inicial (R$)</Label>
              <Input type="number" step="0.01" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="0,00" />
            </div>
            <Button onClick={handleOpen} className="w-full">Confirmar Abertura</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={closeDialog} onOpenChange={(v) => { setCloseDialog(v); if (!v) setClosingRegister(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Fechar Caixa{closingRegister && isMaster ? ` — ${getMemberName(closingRegister.user_id)}` : ""}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Abertura:</span><span>{formatCurrency((closingRegister || openRegister)?.opening_amount || 0)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Aberto em:</span><span>{(closingRegister || openRegister) ? formatDate((closingRegister || openRegister)!.opened_at) : ""}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label>Valor em Caixa (R$)</Label>
              <Input type="number" step="0.01" value={closingAmount} onChange={e => setClosingAmount(e.target.value)} placeholder="Conte o dinheiro..." />
            </div>
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
