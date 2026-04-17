import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Users, Shield, LogOut, Search, Plus, Edit, Trash2, Ban, CheckCircle, CreditCard, Receipt, FileText } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  monthly_value: number;
  active: boolean;
}

interface ClientAccount {
  id: string;
  user_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  monthly_value: number;
  created_at: string;
  plan_id: string | null;
  billing_type: string;
  due_day: number;
  blocked: boolean;
  tolerance_days: number;
}

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState<ClientAccount[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ClientAccount | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", plan_id: "", billing_type: "avulsa", due_day: 10, status: "ativo", monthly_value: 99.90, tolerance_days: 15 });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", plan_id: "", monthly_value: 99.90 });
  const [creating, setCreating] = useState(false);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({ due_date: "", reference_month: "", custom_amount: "" });
  const [generating, setGenerating] = useState(false);

  const navigate = useNavigate();

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("client_accounts").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar contas");
    else setAccounts(data || []);
    setLoading(false);
  };

  const fetchPlans = async () => {
    const { data } = await supabase.from("subscription_plans").select("id, name, monthly_value, active").eq("active", true).order("monthly_value");
    setPlans(data || []);
  };

  useEffect(() => { fetchAccounts(); fetchPlans(); }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin"); };

  const openEdit = (account: ClientAccount) => {
    setSelected(account);
    setEditForm({
      name: account.name,
      email: account.email,
      plan_id: account.plan_id || "",
      billing_type: account.billing_type || "avulsa",
      due_day: account.due_day || 10,
      status: account.status,
      monthly_value: Number(account.monthly_value),
      tolerance_days: account.tolerance_days || 15,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    const plan = plans.find(p => p.id === editForm.plan_id);
    const updateData: Record<string, unknown> = {
      name: editForm.name,
      email: editForm.email,
      plan_id: editForm.plan_id || null,
      plan: plan?.name || editForm.plan_id || "Plano",
      billing_type: editForm.billing_type,
      due_day: editForm.due_day,
      status: editForm.status,
      monthly_value: editForm.monthly_value,
      tolerance_days: editForm.tolerance_days,
    };
    const { error } = await supabase.from("client_accounts").update(updateData).eq("id", selected.id);
    if (error) toast.error("Erro ao atualizar conta: " + error.message);
    else { toast.success("Conta atualizada!"); setEditOpen(false); fetchAccounts(); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const { error } = await supabase.from("client_accounts").delete().eq("id", selected.id);
    if (error) toast.error("Erro ao excluir conta");
    else { toast.success("Conta excluída!"); setDeleteOpen(false); fetchAccounts(); }
  };

  const toggleBlocked = async (account: ClientAccount) => {
    const newBlocked = !account.blocked;
    const { error } = await supabase.from("client_accounts").update({
      blocked: newBlocked,
      blocked_at: newBlocked ? new Date().toISOString() : null,
      status: newBlocked ? "inativo" : "ativo",
    }).eq("id", account.id);
    if (error) toast.error("Erro ao alterar bloqueio");
    else { toast.success(newBlocked ? "Conta bloqueada" : "Conta desbloqueada"); fetchAccounts(); }
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error("Nome, e-mail e senha são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const plan = plans.find(p => p.id === createForm.plan_id);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          name: createForm.name,
          plan: plan?.name || "Plano Mensal",
          monthly_value: createForm.monthly_value,
        }),
      });
      const result = await response.json();
      if (!response.ok) toast.error(result.error || "Erro ao criar conta");
      else {
        // se houver plano selecionado, vincula
        if (createForm.plan_id && result.user_id) {
          await supabase.from("client_accounts").update({ plan_id: createForm.plan_id }).eq("user_id", result.user_id);
        }
        toast.success("Conta criada com sucesso!");
        setCreateOpen(false);
        setCreateForm({ name: "", email: "", password: "", plan_id: "", monthly_value: 99.90 });
        fetchAccounts();
      }
    } catch {
      toast.error("Erro ao criar conta");
    }
    setCreating(false);
  };

  const openCharge = (account: ClientAccount) => {
    setSelected(account);
    const today = new Date();
    const dueDay = account.due_day || 10;
    const next = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (next < today) next.setMonth(next.getMonth() + 1);
    const refMonth = next.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    setChargeForm({
      due_date: next.toISOString().slice(0, 10),
      reference_month: refMonth.charAt(0).toUpperCase() + refMonth.slice(1),
      custom_amount: "",
    });
    setChargeOpen(true);
  };

  const handleGenerateCharge = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-create-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          client_account_id: selected.id,
          due_date: chargeForm.due_date,
          reference_month: chargeForm.reference_month,
          custom_amount: chargeForm.custom_amount ? Number(chargeForm.custom_amount) : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || "Erro ao gerar cobrança");
      } else {
        toast.success("Cobrança gerada! Link de pagamento criado.");
        setChargeOpen(false);
      }
    } catch (e) {
      toast.error("Erro ao gerar cobrança");
    }
    setGenerating(false);
  };

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalAtivos = accounts.filter(a => !a.blocked && a.status === "ativo").length;
  const totalBloqueados = accounts.filter(a => a.blocked).length;
  const receitaMensal = accounts.filter(a => !a.blocked).reduce((sum, a) => sum + Number(a.monthly_value), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-xs text-muted-foreground">Gestão de contas e cobranças</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/planos")}>
            <FileText className="h-4 w-4 mr-2" />Planos
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />Sair
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Contas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{accounts.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contas Ativas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{totalAtivos}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bloqueadas</CardTitle>
              <Ban className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{totalBloqueados}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
              <span className="text-xs text-muted-foreground">R$</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{receitaMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</TableCell></TableRow>
                ) : filtered.map(account => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>{plans.find(p => p.id === account.plan_id)?.name || account.plan}</TableCell>
                    <TableCell>{Number(account.monthly_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>Dia {account.due_day || 10}</TableCell>
                    <TableCell>
                      {account.blocked ? (
                        <Badge variant="destructive">Bloqueado</Badge>
                      ) : (
                        <Badge className="bg-green-600">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Gerar cobrança" onClick={() => openCharge(account)}>
                          <Receipt className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" title={account.blocked ? "Desbloquear" : "Bloquear"} onClick={() => toggleBlocked(account)}>
                          {account.blocked ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Ban className="h-4 w-4 text-destructive" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(account)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelected(account); setDeleteOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Conta</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2"><Label>Nome</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={editForm.plan_id} onValueChange={v => {
                const p = plans.find(x => x.id === v);
                setEditForm({ ...editForm, plan_id: v, monthly_value: p ? Number(p.monthly_value) : editForm.monthly_value });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.monthly_value).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor Mensal</Label><Input type="number" step="0.01" value={editForm.monthly_value} onChange={e => setEditForm({ ...editForm, monthly_value: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Dia Vencimento</Label><Input type="number" min={1} max={28} value={editForm.due_day} onChange={e => setEditForm({ ...editForm, due_day: parseInt(e.target.value) || 10 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Cobrança</Label>
                <Select value={editForm.billing_type} onValueChange={v => setEditForm({ ...editForm, billing_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avulsa">Fatura Avulsa</SelectItem>
                    <SelectItem value="recorrente">Assinatura Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tolerância (dias)</Label><Input type="number" min={0} value={editForm.tolerance_days} onChange={e => setEditForm({ ...editForm, tolerance_days: parseInt(e.target.value) || 15 })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Charge */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar Cobrança — {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Mês de Referência</Label><Input value={chargeForm.reference_month} onChange={e => setChargeForm({ ...chargeForm, reference_month: e.target.value })} placeholder="Ex.: Maio de 2026" /></div>
            <div className="space-y-2"><Label>Data de Vencimento</Label><Input type="date" value={chargeForm.due_date} onChange={e => setChargeForm({ ...chargeForm, due_date: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Valor Customizado (opcional)</Label>
              <Input type="number" step="0.01" placeholder={selected ? `Padrão: R$ ${Number(selected.monthly_value).toFixed(2)}` : ""} value={chargeForm.custom_amount} onChange={e => setChargeForm({ ...chargeForm, custom_amount: e.target.value })} />
              <p className="text-xs text-muted-foreground">Deixe vazio para usar o valor mensal do plano.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateCharge} disabled={generating}>
              <CreditCard className="h-4 w-4 mr-2" />
              {generating ? "Gerando..." : "Gerar no Mercado Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta de <strong>{selected?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Conta de Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Senha</Label><Input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={createForm.plan_id} onValueChange={v => {
                const p = plans.find(x => x.id === v);
                setCreateForm({ ...createForm, plan_id: v, monthly_value: p ? Number(p.monthly_value) : createForm.monthly_value });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano (opcional)" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.monthly_value).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" value={createForm.monthly_value} onChange={e => setCreateForm({ ...createForm, monthly_value: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Criando..." : "Criar Conta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
