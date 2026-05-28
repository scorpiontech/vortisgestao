import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Calendar, CheckCircle, AlertTriangle, Clock, ExternalLink, Ban, Sparkles, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useFiscalQuota } from "@/hooks/useFiscalQuota";

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
  plan_id: string | null;
  monthly_value: number;
  status: string;
  blocked: boolean;
  due_day: number;
  billing_type: string;
  subscription_plans?: { id: string; name: string; monthly_value: number; description: string; tier: string; nfe_quota: number | null } | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_value: number;
  tier: string;
  nfe_quota: number | null;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "destructive" | "secondary"; icon: any; color: string }> = {
  paid: { label: "Pago", variant: "default", icon: CheckCircle, color: "text-green-500 dark:text-green-400" },
  pending: { label: "Pendente", variant: "secondary", icon: Clock, color: "text-yellow-500 dark:text-yellow-400" },
  overdue: { label: "Atrasado", variant: "destructive", icon: AlertTriangle, color: "text-destructive" },
  failed: { label: "Falhou", variant: "destructive", icon: AlertTriangle, color: "text-destructive" },
};

export default function Cobrancas() {
  const { user } = useAuth();
  const { quota, usagePct, nearLimit, blocked: quotaBlocked } = useFiscalQuota();
  const [account, setAccount] = useState<Account | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: acc } = await supabase
      .from("client_accounts")
      .select("*, subscription_plans(id, name, monthly_value, description, tier, nfe_quota)")
      .eq("user_id", user.id)
      .maybeSingle();
    setAccount(acc as unknown as Account | null);

    const { data: pls } = await supabase
      .from("subscription_plans")
      .select("id, name, description, monthly_value, tier, nfe_quota")
      .eq("active", true)
      .order("monthly_value", { ascending: true });
    setPlans((pls || []) as Plan[]);

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

  const requestUpgrade = async (plan: Plan) => {
    setRequesting(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("request-plan-upgrade", {
        body: { target_plan_id: plan.id },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Falha ao gerar fatura");
        return;
      }
      const link = (data as any).payment_link;
      if ((data as any).downgrade) {
        toast.success((data as any).message || "Downgrade agendado");
      } else if (link) {
        toast.success(`Fatura proporcional de ${Number((data as any).amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} criada. Abrindo checkout...`);
        window.open(link, "_blank", "noopener,noreferrer");
      }
      await load();
    } catch (err: any) {
      toast.error(err.message || "Não foi possível processar o upgrade.");
    } finally {
      setRequesting(null);
    }
  };

  useEffect(() => { load(); }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const currentTier = account?.subscription_plans?.tier ?? "basico";
  const currentPlanId = account?.subscription_plans?.id ?? account?.plan_id ?? null;
  const planName = account?.subscription_plans?.name || account?.plan || "—";
  const planValue = account?.subscription_plans?.monthly_value || account?.monthly_value || 0;
  const planQuota = account?.subscription_plans?.nfe_quota ?? null;
  const hasNfe = currentTier.startsWith("pro");
  const upgradePlans = plans.filter(p => p.id !== currentPlanId && p.tier.startsWith("pro"));
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
            <div className="text-2xl font-bold flex items-center gap-2">
              {planName}
              {hasNfe && <Badge className="bg-primary text-primary-foreground gap-1"><Sparkles className="h-3 w-3" />Pro</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{Number(planValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / mês</p>
            {hasNfe && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {planQuota === null ? "NF-e ilimitada" : `Até ${planQuota} NF-e/mês`}
              </p>
            )}
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
            {account?.blocked ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
          </CardHeader>
          <CardContent>
            <Badge variant={account?.blocked ? "destructive" : "default"} className={account?.blocked ? "" : "bg-green-600"}>
              {account?.blocked ? "Bloqueado" : "Ativo"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{account?.blocked ? "Pagamento em atraso" : "Pagamento em dia"}</p>
          </CardContent>
        </Card>
      </div>

      {upgradePlans.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {hasNfe ? "Mude de plano" : "Faça upgrade para o Pro"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasNfe
                ? "Precisa de mais cota de notas? Escolha um tier maior."
                : "Os planos Pro liberam a emissão de NFC-e direto do PDV. Escolha quantas notas você precisa por mês."}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {upgradePlans.map((p) => {
                const isCurrent = p.id === currentPlanId;
                const isHigher = Number(p.monthly_value) > Number(planValue);
                return (
                  <Card key={p.id} className={isHigher ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        {isHigher && <Badge className="bg-primary text-primary-foreground text-[10px]">Upgrade</Badge>}
                      </div>
                      <p className="text-2xl font-bold mt-1">
                        {Number(p.monthly_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        <span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="space-y-1.5 text-sm">
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" />
                          {p.nfe_quota === null ? "NF-e ilimitada" : `Até ${p.nfe_quota} NFC-e/mês`}
                        </li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" />Tudo do plano Básico</li>
                        <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary" />Impressão DANFE no PDV</li>
                      </ul>
                      <Button
                        className="w-full"
                        variant={isHigher ? "default" : "outline"}
                        disabled={isCurrent || requesting === p.id}
                        onClick={() => requestUpgrade(p)}
                      >
                        {requesting === p.id ? "Enviando..." : isCurrent ? "Plano atual" : "Solicitar upgrade"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Precisa de mais de 20 notas por mês? Entre em contato — temos plano <strong>Pro+</strong> com valor negociado.
            </p>
          </CardContent>
        </Card>
      )}

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
