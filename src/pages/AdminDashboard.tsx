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
import { Users, Shield, LogOut, Search, Plus, Edit, Trash2, Ban, CheckCircle } from "lucide-react";

interface ClientAccount {
  id: string;
  user_id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  monthly_value: number;
  created_at: string;
}

const PLANS = [
  { label: "Plano Mensal", value: "Plano Mensal" },
  { label: "Plano Trimestral", value: "Plano Trimestral" },
  { label: "Plano Semestral", value: "Plano Semestral" },
  { label: "Plano Anual", value: "Plano Anual" },
];

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState<ClientAccount[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ClientAccount | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", plan: "Plano Mensal", status: "ativo", monthly_value: 99.90 });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", plan: "Plano Mensal", monthly_value: 99.90 });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar contas");
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  const openEdit = (account: ClientAccount) => {
    setSelected(account);
    setEditForm({
      name: account.name,
      email: account.email,
      plan: account.plan,
      status: account.status,
      monthly_value: account.monthly_value,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("client_accounts")
      .update({
        name: editForm.name,
        email: editForm.email,
        plan: editForm.plan,
        status: editForm.status,
        monthly_value: editForm.monthly_value,
      })
      .eq("id", selected.id);

    if (error) {
      toast.error("Erro ao atualizar conta");
    } else {
      toast.success("Conta atualizada com sucesso!");
      setEditOpen(false);
      fetchAccounts();
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("client_accounts")
      .delete()
      .eq("id", selected.id);

    if (error) {
      toast.error("Erro ao excluir conta");
    } else {
      toast.success("Conta excluída com sucesso!");
      setDeleteOpen(false);
      fetchAccounts();
    }
  };

  const toggleStatus = async (account: ClientAccount) => {
    const newStatus = account.status === "ativo" ? "inativo" : "ativo";
    const { error } = await supabase
      .from("client_accounts")
      .update({ status: newStatus })
      .eq("id", account.id);

    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(`Conta ${newStatus === "ativo" ? "ativada" : "desativada"} com sucesso!`);
      fetchAccounts();
    }
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error("Nome, e-mail e senha são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: createForm.email,
            password: createForm.password,
            name: createForm.name,
            plan: createForm.plan,
            monthly_value: createForm.monthly_value,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || "Erro ao criar conta");
      } else {
        toast.success("Conta criada com sucesso!");
        setCreateOpen(false);
        setCreateForm({ name: "", email: "", password: "", plan: "Plano Mensal", monthly_value: 99.90 });
        fetchAccounts();
      }
    } catch (err) {
      toast.error("Erro ao criar conta");
    }
    setCreating(false);
  };
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalAtivos = accounts.filter((a) => a.status === "ativo").length;
  const totalInativos = accounts.filter((a) => a.status === "inativo").length;
  const receitaMensal = accounts
    .filter((a) => a.status === "ativo")
    .reduce((sum, a) => sum + Number(a.monthly_value), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-xs text-muted-foreground">Gestão de contas de clientes</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Contas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contas Ativas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalAtivos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contas Inativas</CardTitle>
              <Ban className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{totalInativos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
              <span className="text-xs text-muted-foreground">R$</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {receitaMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma conta encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>{account.email}</TableCell>
                      <TableCell>{account.plan}</TableCell>
                      <TableCell>
                        {Number(account.monthly_value).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={account.status === "ativo" ? "default" : "destructive"}
                          className={account.status === "ativo" ? "bg-green-600" : ""}
                        >
                          {account.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(account.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={account.status === "ativo" ? "Desativar" : "Ativar"}
                            onClick={() => toggleStatus(account)}
                          >
                            {account.status === "ativo" ? (
                              <Ban className="h-4 w-4 text-destructive" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(account)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelected(account);
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm({ ...editForm, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor Mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.monthly_value}
                onChange={(e) => setEditForm({ ...editForm, monthly_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
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

      {/* Delete confirmation */}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
