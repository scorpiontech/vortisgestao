import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, ExternalLink, CheckCircle, Trash2, Copy, RefreshCw, Receipt } from "lucide-react";

interface Invoice {
  id: string;
  client_account_id: string;
  amount: number;
  due_date: string;
  status: string;
  reference_month: string;
  payment_link: string | null;
  mp_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
}

interface ClientAccount {
  id: string;
  name: string;
  email: string;
}

export default function AdminFaturas() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<ClientAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    const [invRes, accRes] = await Promise.all([
      supabase.from("subscription_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("client_accounts").select("id, name, email").order("name"),
    ]);
    if (invRes.error) toast.error("Erro ao carregar faturas");
    else setInvoices(invRes.data || []);
    if (!accRes.error) setAccounts(accRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getClient = (id: string) => accounts.find(a => a.id === id);

  const markPaid = async (inv: Invoice) => {
    const { error } = await supabase.from("subscription_invoices").update({
      status: "paid",
      paid_at: new Date().toISOString(),
    }).eq("id", inv.id);
    if (error) toast.error("Erro ao marcar como pago");
    else { toast.success("Fatura marcada como paga"); fetchData(); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const { error } = await supabase.from("subscription_invoices").delete().eq("id", selected.id);
    if (error) toast.error("Erro ao excluir fatura");
    else { toast.success("Fatura excluída"); setDeleteOpen(false); fetchData(); }
  };

  const copyLink = (link: string | null) => {
    if (!link) { toast.error("Sem link de pagamento"); return; }
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const filtered = invoices.filter(inv => {
    const client = getClient(inv.client_account_id);
    const matchSearch = !search ||
      client?.name.toLowerCase().includes(search.toLowerCase()) ||
      client?.email.toLowerCase().includes(search.toLowerCase()) ||
      inv.reference_month.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchClient = clientFilter === "all" || inv.client_account_id === clientFilter;
    return matchSearch && matchStatus && matchClient;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: "Pendente", cls: "bg-yellow-500" },
      paid: { label: "Pago", cls: "bg-green-600" },
      overdue: { label: "Vencida", cls: "bg-destructive" },
      cancelled: { label: "Cancelada", cls: "bg-muted-foreground" },
    };
    const s = map[status] || { label: status, cls: "bg-muted" };
    return <Badge className={s.cls}>{s.label}</Badge>;
  };

  const totalPago = filtered.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalPendente = filtered.filter(i => i.status === "pending" || i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Receipt className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Faturas</h1>
            <p className="text-xs text-muted-foreground">Todas as cobranças geradas</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />Atualizar
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de Faturas</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pago</p>
            <p className="text-2xl font-bold text-green-600">{totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total em Aberto</p>
            <p className="text-2xl font-bold text-destructive">{totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente, email ou mês..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paid">Pagas</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</TableCell></TableRow>
                ) : filtered.map(inv => {
                  const client = getClient(inv.client_account_id);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="font-medium">{client?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{client?.email}</div>
                      </TableCell>
                      <TableCell>{inv.reference_month}</TableCell>
                      <TableCell className="font-medium">{Number(inv.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell>{new Date(inv.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {inv.payment_link && (
                            <>
                              <Button variant="ghost" size="icon" title="Copiar link" onClick={() => copyLink(inv.payment_link)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Abrir checkout" asChild>
                                <a href={inv.payment_link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 text-primary" /></a>
                              </Button>
                            </>
                          )}
                          {inv.status !== "paid" && (
                            <Button variant="ghost" size="icon" title="Marcar como paga" onClick={() => markPaid(inv)}>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Excluir" onClick={() => { setSelected(inv); setDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fatura?</AlertDialogTitle>
            <AlertDialogDescription>
              A fatura de <strong>{getClient(selected?.client_account_id || "")?.name}</strong> referente a <strong>{selected?.reference_month}</strong> será excluída. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
