import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, DollarSign, TrendingDown, AlertCircle, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

interface Invoice {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  reference_month: string;
  client_account_id: string;
  created_at: string;
}

interface Account {
  id: string;
  blocked: boolean;
  status: string;
  monthly_value: number;
  created_at: string;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function AdminRelatorios() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: inv }, { data: acc }] = await Promise.all([
        supabase.from("subscription_invoices").select("*").order("due_date", { ascending: false }),
        supabase.from("client_accounts").select("id, blocked, status, monthly_value, created_at"),
      ]);
      setInvoices(inv || []);
      setAccounts(acc || []);
      setLoading(false);
    };
    load();
  }, []);

  // KPIs
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthlyRevenue = invoices
    .filter((i) => i.status === "paid" && i.paid_at?.startsWith(currentMonth))
    .reduce((s, i) => s + Number(i.amount), 0);

  const totalAccounts = accounts.length;
  const blockedAccounts = accounts.filter((a) => a.blocked).length;
  const inadimplenciaRate = totalAccounts > 0 ? (blockedAccounts / totalAccounts) * 100 : 0;

  const inactiveAccounts = accounts.filter((a) => a.status === "inativo").length;
  const churnRate = totalAccounts > 0 ? (inactiveAccounts / totalAccounts) * 100 : 0;

  const overdueInvoices = invoices.filter((i) => i.status === "overdue" || i.status === "pending").length;

  // Chart: payments by month (last 12 months)
  const monthlyData = Array.from({ length: 12 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    const paid = invoices
      .filter((i) => i.status === "paid" && i.paid_at?.startsWith(key))
      .reduce((s, i) => s + Number(i.amount), 0);
    const pending = invoices
      .filter((i) => (i.status === "pending" || i.status === "overdue") && i.due_date?.startsWith(key))
      .reduce((s, i) => s + Number(i.amount), 0);
    return { month: label, Pago: paid, Pendente: pending };
  });

  // Chart: count of invoices by status per month
  const statusData = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    const monthInvoices = invoices.filter((i) => i.due_date?.startsWith(key));
    return {
      month: label,
      Pagas: monthInvoices.filter((i) => i.status === "paid").length,
      Pendentes: monthInvoices.filter((i) => i.status === "pending").length,
      Vencidas: monthInvoices.filter((i) => i.status === "overdue").length,
    };
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Relatório Financeiro</h1>
            <p className="text-xs text-muted-foreground">Visão geral de receita e inadimplência</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{fmt(monthlyRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Pagamentos confirmados</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Inadimplência</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{inadimplenciaRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">{blockedAccounts} contas bloqueadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Churn</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{churnRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">{inactiveAccounts} contas inativas</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Faturas em Aberto</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overdueInvoices}</div>
                  <p className="text-xs text-muted-foreground mt-1">Pendentes ou vencidas</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pagamentos por Mês (últimos 12 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip
                        formatter={(v: number) => fmt(v)}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Legend />
                      <Bar dataKey="Pago" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Pendente" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quantidade de Faturas por Status (últimos 6 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Pagas" stroke="hsl(142 71% 45%)" strokeWidth={2} />
                      <Line type="monotone" dataKey="Pendentes" stroke="hsl(38 92% 50%)" strokeWidth={2} />
                      <Line type="monotone" dataKey="Vencidas" stroke="hsl(0 84% 60%)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
