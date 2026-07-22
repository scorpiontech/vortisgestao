import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useFiscalQuota } from "@/hooks/useFiscalQuota";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Lock, Rocket, CheckCircle2, ArrowRight, Sparkles, Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Plan {
  id: string;
  name: string;
  tier: string;
  monthly_value: number;
  nfe_quota: number | null;
  description: string;
  features: any;
}

interface NfceDoc {
  id: string;
  numero: string | null;
  status: string;
  customer_name: string | null;
  valor_total: number | null;
  emitted_at: string | null;
  created_at: string;
  danfce_url: string | null;
  xml_url: string | null;
}

const NotasFiscais = () => {
  const { effectiveUserId } = useUserRole();
  const { quota, loading: quotaLoading, usagePct, nearLimit } = useFiscalQuota();
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [proPlans, setProPlans] = useState<Plan[]>([]);
  const [docs, setDocs] = useState<NfceDoc[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canEmit = currentPlan?.features?.nfce === true;

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      // Plano atual via client_accounts
      const { data: acc } = await supabase
        .from("client_accounts")
        .select("plan_id, subscription_plans:plan_id(*)")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      const plan = (acc as any)?.subscription_plans as Plan | null;
      setCurrentPlan(plan);

      // Planos Pro disponíveis
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .like("tier", "pro%")
        .order("monthly_value");
      setProPlans((plans || []) as Plan[]);

      // Notas emitidas (se houver)
      const { data: nf } = await supabase
        .from("nfce_documents")
        .select("id, numero, status, customer_name, valor_total, emitted_at, created_at, danfce_url, xml_url")
        .order("created_at", { ascending: false })
        .limit(50);
      setDocs((nf || []) as NfceDoc[]);
      setLoading(false);
    })();
  }, [effectiveUserId]);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      const { data, error } = await supabase.functions.invoke("request-plan-upgrade", {
        body: { new_plan_id: planId },
      });
      if (error) throw error;
      if ((data as any)?.checkout_url) {
        window.open((data as any).checkout_url, "_blank");
        toast.success("Pagamento gerado! Conclua para ativar seu plano Pro.");
      } else {
        toast.success("Solicitação enviada.");
      }
      setUpgradeOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao iniciar upgrade");
    } finally {
      setUpgrading(null);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      authorized: "bg-green-600",
      pending: "bg-yellow-600",
      rejected: "bg-destructive",
      cancelled: "bg-muted",
    };
    return <Badge className={map[s] || ""}>{s}</Badge>;
  };

  // ---- LOCKED (Free) ----
  if (!loading && !canEmit) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2"><FileText className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Notas Fiscais</h1>
            <p className="text-sm text-muted-foreground">Emissão de NFC-e para o seu PDV e ordens de serviço.</p>
          </div>
        </div>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Módulo disponível no plano Pro</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Seu plano atual é o <strong>{currentPlan?.name || "Free"}</strong>. Faça upgrade para
              emitir NFC-e diretamente do sistema, com integração ao seu certificado A1.
            </p>
            <Button size="lg" onClick={() => setUpgradeOpen(true)}>
              <Rocket className="h-4 w-4 mr-2" /> Fazer upgrade para Pro
            </Button>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          {proPlans.map((p) => (
            <Card key={p.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  <Badge variant="secondary">{p.nfe_quota} NFC-e/mês</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold">
                  R$ {Number(p.monthly_value).toFixed(2).replace(".", ",")}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>
                <ul className="text-sm space-y-1.5 text-muted-foreground">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Tudo do Free</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Emissão de NFC-e</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Integração com certificado A1</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Até {p.nfe_quota} notas por mês</li>
                </ul>
                <Button className="w-full" disabled={upgrading === p.id} onClick={() => handleUpgrade(p.id)}>
                  {upgrading === p.id ? "Processando..." : <>Assinar <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Escolha seu plano Pro</DialogTitle>
              <DialogDescription>
                Será gerada uma fatura proporcional ao período restante e, após o pagamento, o seu plano será ativado automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {proPlans.map((p) => (
                <button
                  key={p.id}
                  disabled={!!upgrading}
                  onClick={() => handleUpgrade(p.id)}
                  className="w-full text-left border rounded-lg p-4 hover:border-primary transition-colors flex items-center justify-between disabled:opacity-50"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Até {p.nfe_quota} NFC-e/mês</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">R$ {Number(p.monthly_value).toFixed(2).replace(".", ",")}</div>
                    <div className="text-[10px] text-muted-foreground">/mês</div>
                  </div>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---- UNLOCKED (Pro) ----
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Notas Fiscais</h1>
            <p className="text-sm text-muted-foreground">NFC-e emitidas pela sua empresa.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/configuracoes-fiscais">Configurações fiscais</Link>
          </Button>
          <Button asChild>
            <Link to="/notas-fiscais/emitir"><Rocket className="h-4 w-4 mr-1" /> Emitir nota</Link>
          </Button>
        </div>
      </div>

      {quota && !quotaLoading && (
        <Card className={nearLimit ? "border-yellow-500/50" : ""}>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Cota mensal ({quota.year_month})</span>
              <span className="text-muted-foreground">
                {quota.used} / {quota.unlimited ? "∞" : quota.quota} usadas
              </span>
            </div>
            {!quota.unlimited && <Progress value={usagePct} />}
            {nearLimit && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Você está chegando ao limite mensal. Considere fazer upgrade.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma nota emitida ainda.</TableCell></TableRow>
              ) : docs.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.numero || "—"}</TableCell>
                  <TableCell>{d.customer_name || "Consumidor"}</TableCell>
                  <TableCell>{Number(d.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell className="text-xs">
                    {(d.emitted_at || d.created_at) ? new Date(d.emitted_at || d.created_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {d.status === "authorized" && d.danfce_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(d.danfce_url!, "_blank")}
                          title="Reimprimir DANFE (documento já autorizado, sem novo envio à SEFAZ)"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> DANFE
                        </Button>
                      )}
                      {d.status === "authorized" && d.xml_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(d.xml_url!, "_blank")}
                          title="Baixar XML autorizado"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotasFiscais;
