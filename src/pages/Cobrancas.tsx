import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, CheckCircle, AlertTriangle, Clock, ExternalLink, Ban } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Invoice {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  payment_link: string | null;
  paid_at: string | null;
  reference_month: string;
}

interface Account {
  id: string;
  plan: string;
  monthly_value: number;
  status: string;
  blocked: boolean;
  due_day: number;
  billing_type: string;
  subscription_plans?: { name: string; monthly_value: number; description: string } | null;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "destructive" | "secondary"; icon: any; color: string }> = {
  paid: { label: "Pago", variant: "default", icon: CheckCircle, color: "text-green-500" },
  pending: { label: "Pendente", variant: "secondary", icon: Clock, color: "text-yellow-500" },
  overdue: { label: "Atrasado", variant: "destructive", icon: AlertTriangle, color: "text-destructive" },
  failed: { label: "Falhou", variant: "destructive", icon: AlertTriangle, color: "text-destructive" },
};

export default function Cobrancas() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: acc } = await supabase
      .from("client_accounts")
      .select("*, subscription_plans(name, monthly_value, description)")
      .eq("user_id", user.id)
      .maybeSingle();
    setAccount(acc as Account | null);

    if (acc?.id) {
      const { data: inv } = await supabase
        .from("subscription_invoices")
        .select("*")
        .eq("client_account_id", acc.id)
        .order("due_date", { ascending: false });
      setInvoices((inv || []) as Invoice[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const planName = account?.subscription_plans?.name || account?.plan || "—";
  const planValue = account?.subscription_plans?.monthly_value || account?.monthly_value || 0;
  const pendingInvoice = invoices.find(i => i.status === "pending" || i.status === "overdue");
  const nextDue = pendingInvoice?.due_date;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
        <p className="text-muted-foreground">Gerencie os pagamentos da mensalidade do sistema.</p>
      </div>

      {account?.blocked && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-start gap-3">
            <Ban className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Acesso bloqueado por inadimplência</p>
              <p className="text-sm text-muted-foreground">Regularize o pagamento da fatura em aberto para reativar sua conta.</p>
            </div>
            {pendingInvoice?.payment_link && (
              <Button asChild>
                <a href={pendingInvoice.payment_link} target="_blank" rel="noopener noreferrer">Pagar agora <ExternalLink className="h-4 w-4 ml-2" /></a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planName}</div>
            <p className="text-xs text-muted-foreground">{Number(planValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próximo Vencimento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nextDue ? format(parseISO(nextDue), "dd/MM/yyyy") : "—"}</div>
            <p className="text-xs text-muted-foreground">{pendingInvoice ? "Aguardando pagamento" : "Sem faturas em aberto"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {account?.blocked ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
          </CardHeader>
          <CardContent>
            <Badge variant={account?.blocked ? "destructive" : "default"} className={account?.blocked ? "" : "bg-green-600"}>
              {account?.blocked ? "Bloqueado" : "Ativo"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{account?.blocked ? "Pagamento em atraso" : "Pagamento em dia"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Faturas</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma fatura registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => {
                const meta = STATUS_LABEL[inv.status] || STATUS_LABEL.pending;
                const Icon = meta.icon;
                return (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                      <div>
                        <p className="text-sm font-medium">{inv.reference_month}</p>
                        <p className="text-xs text-muted-foreground">
                          Vence em {format(parseISO(inv.due_date), "dd/MM/yyyy")}
                          {inv.paid_at && ` • Pago em ${format(parseISO(inv.paid_at), "dd/MM/yyyy")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{Number(inv.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                        <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                      </div>
                      {(inv.status === "pending" || inv.status === "overdue") && inv.payment_link && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={inv.payment_link} target="_blank" rel="noopener noreferrer">Pagar <ExternalLink className="h-3 w-3 ml-1" /></a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
