import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, CalendarRange, CheckCircle2, Clock, Ban, Receipt, ExternalLink } from "lucide-react";

interface Invoice {
  id: string;
  client_account_id: string;
  amount: number;
  due_date: string;
  status: string;
  reference_month: string;
  payment_link: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Account {
  id: string;
  name: string;
  email: string;
  blocked: boolean;
  blocked_at: string | null;
  monthly_value: number;
  due_day: number;
  status: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const lastDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const fmtBRL = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s?: string | null) =>
  s ? new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

export default function AdminFaturasAutomaticas() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(lastDayOfMonth());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [blocked, setBlocked] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [invRes, accRes, blkRes] = await Promise.all([
      supabase
        .from("subscription_invoices")
        .select("*")
        .gte("due_date", from)
        .lte("due_date", to)
        .order("due_date", { ascending: true }),
      supabase.from("client_accounts").select("id,name,email,blocked,blocked_at,monthly_value,due_day,status"),
      supabase
        .from("client_accounts")
        .select("id,name,email,blocked,blocked_at,monthly_value,due_day,status")
        .eq("blocked", true)
        .order("blocked_at", { ascending: false }),
    ]);
    if (invRes.error) toast.error("Erro ao carregar faturas");
    if (accRes.error) toast.error("Erro ao carregar contas");
    if (blkRes.error) toast.error("Erro ao carregar bloqueados");

    setInvoices((invRes.data as Invoice[]) || []);
    const map: Record<string, Account> = {};
    (accRes.data as Account[] | null)?.forEach((a) => (map[a.id] = a));
    setAccounts(map);
    setBlocked((blkRes.data as Account[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const setPreset = (preset: "this_month" | "last_30" | "next_30") => {
    const d = new Date();
    if (preset === "this_month") {
      setFrom(firstDayOfMonth());
      setTo(lastDayOfMonth());
    } else if (preset === "last_30") {
      const past = new Date(d);
      past.setDate(d.getDate() - 30);
      setFrom(past.toISOString().slice(0, 10));
      setTo(todayISO());
    } else {
      const fut = new Date(d);
      fut.setDate(d.getDate() + 30);
      setFrom(todayISO());
      setTo(fut.toISOString().slice(0, 10));
    }
  };

  const today = todayISO();
  const generated = invoices; // todas geradas no período
  const pending = invoices.filter((i) => i.status === "pending");
  const overdue = invoices.filter((i) => i.status === "pending" && i.due_date < today);
  const paid = invoices.filter((i) => i.status === "paid" || i.paid_at);

  const totals = useMemo(
    () => ({
      generated: generated.reduce((s, i) => s + Number(i.amount), 0),
      pending: pending.reduce((s, i) => s + Number(i.amount), 0),
      overdue: overdue.reduce((s, i) => s + Number(i.amount), 0),
      paid: paid.reduce((s, i) => s + Number(i.amount), 0),
    }),
    [generated, pending, overdue, paid]
  );

  const renderTable = (rows: Invoice[]) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gerada em</TableHead>
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
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma fatura no período
                </TableCell>
              </TableRow>
            ) : (
              rows.map((i) => {
                const acc = accounts[i.client_account_id];
                const isOverdue = i.status === "pending" && i.due_date < today;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      {acc?.name || "—"}
                      <div className="text-xs text-muted-foreground">{acc?.email}</div>
                    </TableCell>
                    <TableCell>{i.reference_month}</TableCell>
                    <TableCell className={isOverdue ? "text-destructive font-medium" : ""}>
                      {fmtDate(i.due_date)}
                    </TableCell>
                    <TableCell>{fmtBRL(Number(i.amount))}</TableCell>
                    <TableCell>
                      {i.status === "paid" || i.paid_at ? (
                        <Badge className="bg-green-600 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Paga
                        </Badge>
                      ) : isOverdue ? (
                        <Badge variant="destructive" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Vencida
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(i.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {i.payment_link && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Abrir link de pagamento"
                          onClick={() => window.open(i.payment_link!, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Receipt className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Faturas Automáticas</h1>
            <p className="text-xs text-muted-foreground">
              Visão consolidada de geradas, pendentes e clientes bloqueados
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Filtro de período */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              Período (por data de vencimento)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreset("this_month")}>
                Este mês
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreset("last_30")}>
                Últimos 30 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreset("next_30")}>
                Próximos 30 dias
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Geradas no período</p>
              <p className="text-2xl font-bold">{generated.length}</p>
              <p className="text-xs text-muted-foreground">{fmtBRL(totals.generated)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pending.length}</p>
              <p className="text-xs text-muted-foreground">{fmtBRL(totals.pending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Vencidas</p>
              <p className="text-2xl font-bold text-destructive">{overdue.length}</p>
              <p className="text-xs text-muted-foreground">{fmtBRL(totals.overdue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Clientes bloqueados</p>
              <p className="text-2xl font-bold text-destructive">{blocked.length}</p>
              <p className="text-xs text-muted-foreground">por inadimplência</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="generated">
          <TabsList>
            <TabsTrigger value="generated">Geradas ({generated.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
            <TabsTrigger value="overdue">Vencidas ({overdue.length})</TabsTrigger>
            <TabsTrigger value="blocked">Bloqueados ({blocked.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="generated" className="mt-4">{renderTable(generated)}</TabsContent>
          <TabsContent value="pending" className="mt-4">{renderTable(pending)}</TabsContent>
          <TabsContent value="overdue" className="mt-4">{renderTable(overdue)}</TabsContent>
          <TabsContent value="blocked" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Mensalidade</TableHead>
                      <TableHead>Dia vencimento</TableHead>
                      <TableHead>Bloqueado em</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : blocked.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum cliente bloqueado
                        </TableCell>
                      </TableRow>
                    ) : (
                      blocked.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{b.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{b.email}</TableCell>
                          <TableCell>{fmtBRL(Number(b.monthly_value))}</TableCell>
                          <TableCell>Dia {b.due_day}</TableCell>
                          <TableCell>{fmtDate(b.blocked_at)}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Bloqueado
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
