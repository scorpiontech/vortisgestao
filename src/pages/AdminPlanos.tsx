import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash2, Shield, LogOut } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_value: number;
  active: boolean;
  created_at: string;
}

const emptyForm = { name: "", description: "", monthly_value: 99.90, active: true };

export default function AdminPlanos() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const navigate = useNavigate();

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("subscription_plans").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar planos");
    else setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin"); };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description, monthly_value: Number(p.monthly_value), active: p.active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.monthly_value <= 0) {
      toast.error("Preencha o nome e um valor válido");
      return;
    }
    if (editing) {
      const { error } = await supabase.from("subscription_plans").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Plano atualizado!");
    } else {
      const { error } = await supabase.from("subscription_plans").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Plano criado!");
    }
    setDialogOpen(false);
    fetchPlans();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Plano excluído"); fetchPlans(); }
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Planos de Assinatura</h1>
            <p className="text-xs text-muted-foreground">Gestão dos planos disponíveis para clientes</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />Sair
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex justify-end">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Plano</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor Mensal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : plans.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum plano cadastrado</TableCell></TableRow>
                ) : plans.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{p.description || "—"}</TableCell>
                    <TableCell>{Number(p.monthly_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"} className={p.active ? "bg-green-600" : ""}>
                        {p.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Plano</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" value={form.monthly_value} onChange={e => setForm({ ...form, monthly_value: parseFloat(e.target.value) || 0 })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Plano ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Contas vinculadas a este plano ficarão sem plano associado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
