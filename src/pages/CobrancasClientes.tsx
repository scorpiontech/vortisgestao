import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { NovaCobrancaDialog } from "@/components/cobrancas/NovaCobrancaDialog";
import { CobrancaLinksDialog, type ChargeInstallment } from "@/components/cobrancas/CobrancaLinksDialog";
import { cancelAsaasCharge, formatBRL, syncAsaasCharge } from "@/lib/asaas";
import { Plus, RefreshCw, Search, Eye, Ban, Wallet, Barcode, QrCode, Download, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Charge {
  id: string;
  customer_name: string;
  description: string;
  billing_type: string;
  total_amount: number;
  installment_count: number;
  status: string;
  source: string;
  ambiente: string;
  created_at: string;
  sale_id: string | null;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Aberta", variant: "secondary" },
  partially_paid: { label: "Parcial", variant: "outline" },
  paid: { label: "Paga", variant: "default" },
  overdue: { label: "Vencida", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

const CobrancasClientes = () => {
  const { effectiveUserId, isMaster, isGerente, role, loading: roleLoading } = useUserRole();
  const canManage = isMaster || isGerente;
  const { toast } = useToast();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [novaOpen, setNovaOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [linksData, setLinksData] = useState<ChargeInstallment[]>([]);
  const [linksTitle, setLinksTitle] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Charge | null>(null);
  const [hasSettings, setHasSettings] = useState(true);
  const [isPro, setIsPro] = useState<boolean | null>(null);

  const fetchCharges = async () => {
    const { data, error } = await (supabase as any)
      .from("customer_charges")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar cobranças", description: error.message, variant: "destructive" });
    else setCharges((data as Charge[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCharges();
  }, []);

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      // Check subscription plan tier
      const { data: accountData } = await supabase
        .from("client_accounts")
        .select("plan_id, subscription_plans(tier)")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      const tier = (accountData as any)?.subscription_plans?.tier;
      setIsPro(tier?.startsWith("pro") || tier === "pro_custom");

      const { data } = await (supabase as any)
        .from("asaas_settings")
        .select("api_key, active")
        .eq("owner_id", effectiveUserId)
        .maybeSingle();
      setHasSettings(!!data?.api_key && !!data?.active);
    })();
  }, [effectiveUserId]);

  const openLinks = async (charge: Charge) => {
    const { data } = await (supabase as any)
      .from("customer_charge_installments")
      .select("*")
      .eq("charge_id", charge.id)
      .order("installment_number");
    setLinksData((data as ChargeInstallment[]) || []);
    setLinksTitle(`${charge.description} — ${charge.customer_name}`);
    setLinksOpen(true);
  };

  const sync = async (charge: Charge) => {
    setSyncingId(charge.id);
    try {
      const res = await syncAsaasCharge(charge.id);
      toast({ title: "Cobrança sincronizada", description: statusMap[res.status]?.label || res.status });
      fetchCharges();
    } catch (e) {
      toast({ title: "Erro ao sincronizar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelAsaasCharge(cancelTarget.id);
      toast({ title: "Cobrança cancelada" });
      fetchCharges();
    } catch (e) {
      toast({ title: "Erro ao cancelar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setCancelTarget(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return charges.filter(c => {
      const matchSearch = !q || c.customer_name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [charges, search, statusFilter]);

  const exportCSV = () => {
    const headers = ["Data", "Cliente", "Descricao", "Tipo", "Valor", "Status"];
    const rows = filtered.map(c => [
      c.created_at.slice(0, 10),
      c.customer_name,
      c.description,
      c.billing_type,
      c.total_amount,
      statusMap[c.status]?.label || c.status
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cobrancas_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Relatório de Cobranças de Clientes", 14, 15);
    const tableData = filtered.map(c => [
      c.created_at.slice(0, 10),
      c.customer_name,
      c.billing_type,
      c.total_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      statusMap[c.status]?.label || c.status
    ]);
    autoTable(doc, {
      head: [["Data", "Cliente", "Tipo", "Valor", "Status"]],
      body: tableData,
      startY: 20,
    });
    doc.save(`cobrancas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const totalRecebido = charges.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.total_amount), 0);
  const totalAberto = charges.filter(c => ["pending", "partially_paid", "overdue"].includes(c.status)).reduce((s, c) => s + Number(c.total_amount), 0);

  if (loading || roleLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (isPro === false || (!isMaster && !isGerente)) {
    const isPlanRestricted = isPro === false;
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="bg-destructive/10 p-4 rounded-full">
          <Ban className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {isPlanRestricted ? "Módulo restrito ao Plano Pro" : "Acesso Negado"}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-balance">
            {isPlanRestricted 
              ? "A gestão de cobranças via Asaas está disponível exclusivamente para assinantes dos planos Pro. Faça o upgrade agora para começar a emitir boletos e PIX diretamente pelo sistema."
              : "Você não possui permissão de Master ou Gerente para acessar este módulo."}
          </p>
        </div>
        {isPlanRestricted && (
          <div className="flex flex-col gap-3">
            <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={() => window.location.href = "/suporte"}>
              Fazer Upgrade para Pro
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()}>
              Voltar
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cobranças de Clientes</h1>
          <p className="text-sm text-muted-foreground">Boletos e PIX emitidos pela sua conta Asaas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
          <Button variant="outline" onClick={exportPDF}><FileText className="h-4 w-4 mr-2" />PDF</Button>
          <Button variant="outline" onClick={fetchCharges}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
          {canManage && <Button onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Cobrança</Button>}
        </div>
      </div>

      {!hasSettings && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 flex items-start gap-3">
            <Wallet className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium">Integração Asaas não configurada</p>
              <p className="text-xs text-muted-foreground">
                Cadastre a chave de API da sua conta Asaas em Configurações &gt; Cobranças (Asaas) para emitir boletos e PIX.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Cobranças</p>
          <p className="text-xl font-bold">{charges.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Recebido</p>
          <p className="text-xl font-bold text-success">{formatBRL(totalRecebido)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Em aberto</p>
          <p className="text-xl font-bold text-destructive">{formatBRL(totalAberto)}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Abertas</SelectItem>
            <SelectItem value="partially_paid">Parcial</SelectItem>
            <SelectItem value="paid">Pagas</SelectItem>
            <SelectItem value="overdue">Vencidas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma cobrança encontrada</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.customer_name}</TableCell>
                  <TableCell className="text-sm">{c.description}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      {c.billing_type === "PIX" ? <QrCode className="h-3.5 w-3.5" /> : <Barcode className="h-3.5 w-3.5" />}
                      {c.billing_type === "PIX" ? "PIX" : "Boleto"}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{formatBRL(Number(c.total_amount))}</TableCell>
                  <TableCell>{c.installment_count}x</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.source === "pdv" ? "PDV" : c.source === "bill" ? "Conta a receber" : "Manual"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusMap[c.status]?.variant || "secondary"}>{statusMap[c.status]?.label || c.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Ver links / QR Code" onClick={() => openLinks(c)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Sincronizar status" disabled={syncingId === c.id} onClick={() => sync(c)}>
                        <RefreshCw className={`h-4 w-4 ${syncingId === c.id ? "animate-spin" : ""}`} />
                      </Button>
                      {canManage && c.status !== "paid" && c.status !== "cancelled" && (
                        <Button variant="ghost" size="icon" title="Cancelar cobrança" onClick={() => setCancelTarget(c)}>
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NovaCobrancaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        onCreated={(_charge, installments) => {
          setLinksData(installments as ChargeInstallment[]);
          setLinksTitle("Cobrança gerada");
          setLinksOpen(true);
          fetchCharges();
        }}
      />

      <CobrancaLinksDialog open={linksOpen} onOpenChange={setLinksOpen} title={linksTitle} installments={linksData} />

      <AlertDialog open={!!cancelTarget} onOpenChange={o => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              As parcelas em aberto de <strong>{cancelTarget?.customer_name}</strong> serão canceladas no Asaas. Caso a venda já tenha sido finalizada ou o estoque/caixa alterado, estas ações serão estornadas automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel} className="bg-destructive text-destructive-foreground">Cancelar cobrança</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CobrancasClientes;
