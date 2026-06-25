import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly_value: number;
  tier: string;
  features: any;
}

const FREE_FEATURES = [
  "Clientes ilimitados",
  "Controle de estoque",
  "Financeiro (caixa, contas a pagar/receber)",
  "Ordens de serviço",
  "Relatórios gerenciais",
  "PDV com cupom não-fiscal",
];

const PRO_EXTRAS = [
  "Emissão de NFC-e ilimitada",
  "Integração com SEFAZ via provedor (Focus NFe / PlugNotas)",
  "Configuração de certificado A1",
  "Cancelamento e contingência",
  "Suporte prioritário",
];

export default function Planos() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const { tier, planName } = usePlanFeatures();

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("id, name, description, monthly_value, tier, features")
      .in("tier", ["free", "pro"])
      .eq("active", true)
      .order("monthly_value")
      .then(({ data }) => {
        setPlans((data as any) || []);
        setLoading(false);
      });
  }, []);

  const free = plans.find(p => p.tier === "free");
  const pro = plans.find(p => p.tier === "pro");

  const requestUpgrade = async () => {
    if (!pro) return;
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-plan-upgrade", {
        body: { target_plan_id: pro.id },
      });
      if (error) throw error;
      const url = (data as any)?.init_point || (data as any)?.payment_url;
      if (url) {
        window.open(url, "_blank");
        toast.success("Link de pagamento gerado", { description: "Conclua o pagamento para liberar o Pro." });
      } else {
        toast.success("Solicitação enviada", { description: "Em breve você receberá o link de pagamento." });
      }
    } catch (e: any) {
      toast.error("Não foi possível solicitar o upgrade", { description: e.message });
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planos</h1>
        <p className="text-sm text-muted-foreground">
          Plano atual: <Badge variant="outline">{planName}</Badge>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {free && (
          <Card className={tier === "free" ? "border-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{free.name}</CardTitle>
                {tier === "free" && <Badge>Plano atual</Badge>}
              </div>
              <CardDescription>{free.description}</CardDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold">{fmt(free.monthly_value)}</span>
                <span className="text-sm text-muted-foreground"> /mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {FREE_FEATURES.map(f => (
                <div key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {pro && (
          <Card className={tier === "pro" ? "border-primary" : "border-primary/40 shadow-md"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {pro.name}
                </CardTitle>
                {tier === "pro" ? <Badge>Plano atual</Badge> : <Badge variant="secondary">Recomendado</Badge>}
              </div>
              <CardDescription>{pro.description}</CardDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold">{fmt(pro.monthly_value)}</span>
                <span className="text-sm text-muted-foreground"> /mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Tudo do Free, mais:</p>
              {PRO_EXTRAS.map(f => (
                <div key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
              {tier !== "pro" && (
                <Button className="w-full mt-4" onClick={requestUpgrade} disabled={upgrading}>
                  {upgrading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Fazer upgrade para Pro
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Você pode mudar de plano a qualquer momento. Em caso de upgrade no meio do ciclo, será gerada
        uma fatura proporcional aos dias restantes.
      </p>
    </div>
  );
}
