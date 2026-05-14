import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Eye, Search, Bell, Trash2, PlayCircle } from "lucide-react";

interface LogRow {
  id: string;
  client_account_id: string | null;
  client_name: string;
  reference_month: string;
  amount: number;
  status: string;
  error_message: string;
  error_details: any;
  source: string;
  acknowledged: boolean;
  created_at: string;
}

export default function AdminLogsFaturas() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<LogRow | null>(null);
  const navigate = useNavigate();

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoice_generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("Erro ao carregar logs");
    else setLogs((data as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const ackOne = async (id: string) => {
    const { error } = await supabase.from("invoice_generation_logs").update({ acknowledged: true }).eq("id", id);
    if (error) return toast.error("Erro ao marcar como visto");
    fetchLogs();
  };

  const ackAll = async () => {
    const { error } = await supabase.from("invoice_generation_logs").update({ acknowledged: true }).eq("acknowledged", false);
    if (error) return toast.error("Erro ao marcar tudo");
    toast.success("Todas as notificações marcadas como vistas");
    fetchLogs();
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    const { error } = await supabase.from("invoice_generation_logs").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    fetchLogs();
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-recurring-invoices");
      if (error) throw error;
      toast.success(`Execução concluída: ${data?.generated || 0} geradas, ${data?.errors?.length || 0} erros`);
      fetchLogs();
    } catch (e: any) {
      toast.error(`Falha ao executar: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.client_name.toLowerCase().includes(search.toLowerCase()) ||
      l.error_message.toLowerCase().includes(search.toLowerCase()) ||
      l.reference_month.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const errorCount = logs.filter(l => l.status === "error" && !l.acknowledged).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Logs de Geração de Faturas</h1>
            <p className="text-xs text-muted-foreground">Notificações e detalhes de erros do Mercado Pago</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runNow} disabled={running}>
            <PlayCircle className="h-4 w-4 mr-2" />{running ? "Executando..." : "Executar agora"}
          </Button>
          {errorCount > 0 && (
            <Button variant="outline" size="sm" onClick={ackAll}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Marcar todas como vistas
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />Atualizar
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total de registros</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Erros não vistos</p>
            <p className="text-2xl font-bold text-destructive">{errorCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sucessos (todos)</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{logs.filter(l => l.status === "success").length}</p>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente, erro ou mês..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="error">Apenas erros</SelectItem>
              <SelectItem value="success">Apenas sucessos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Quando</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>
                ) : filtered.map(l => (
                  <TableRow key={l.id} className={!l.acknowledged && l.status === "error" ? "bg-destructive/5" : ""}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{l.client_name || "—"}</TableCell>
                    <TableCell>{l.reference_month || "—"}</TableCell>
                    <TableCell>{Number(l.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>
                      {l.status === "error" ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Erro</Badge>
                      ) : (
                        <Badge className="bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" />Sucesso</Badge>
                      )}
                      {!l.acknowledged && l.status === "error" && <span className="ml-2 text-[10px] text-destructive">novo</span>}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm" title={l.error_message}>
                      {l.error_message || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setDetail(l)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!l.acknowledged && l.status === "error" && (
                          <Button variant="ghost" size="icon" title="Marcar como vista" onClick={() => ackOne(l.id)}>
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Excluir" onClick={() => deleteOne(l.id)}>
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

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{detail.client_name || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Quando</p><p className="font-medium">{new Date(detail.created_at).toLocaleString("pt-BR")}</p></div>
                <div><p className="text-xs text-muted-foreground">Mês de referência</p><p className="font-medium">{detail.reference_month || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor</p><p className="font-medium">{Number(detail.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
                <div><p className="text-xs text-muted-foreground">Origem</p><p className="font-medium">{detail.source === "auto" ? "Automática (cron)" : "Manual"}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{detail.status}</p></div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mensagem</p>
                <p className="font-medium">{detail.error_message || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Detalhes técnicos</p>
                <pre className="bg-muted p-3 rounded text-[11px] overflow-auto max-h-80">
                  {JSON.stringify(detail.error_details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
