import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { asaasWebhookUrl } from "@/lib/asaas";
import { Copy, Save, Wallet, Eye, EyeOff } from "lucide-react";

const ConfiguracoesAsaas = () => {
  const { effectiveUserId, isMaster, isGerente, loading: roleLoading } = useUserRole();
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({
    api_key: "",
    ambiente: "sandbox",
    webhook_token: "",
    boleto_days: "5",
    active: true,
  });

  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
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
        .select("*")
        .eq("owner_id", effectiveUserId)
        .maybeSingle();
      if (data) {
        setForm({
          api_key: data.api_key || "",
          ambiente: data.ambiente || "sandbox",
          webhook_token: data.webhook_token || "",
          boleto_days: String(data.boleto_days ?? 5),
          active: !!data.active,
        });
      }
      setLoading(false);
    };
    load();
  }, [effectiveUserId]);

  const generateToken = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    setForm(f => ({ ...f, webhook_token: token }));
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: `${label} copiado!` });
  };

  const save = async () => {
    if (!effectiveUserId) return;
    if (!form.api_key.trim()) {
      toast({ title: "Informe a chave de API do Asaas", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      owner_id: effectiveUserId,
      api_key: form.api_key.trim(),
      ambiente: form.ambiente,
      webhook_token: form.webhook_token.trim(),
      boleto_days: Math.max(0, Number(form.boleto_days) || 5),
      active: form.active,
    };
    const { error } = await (supabase as any)
      .from("asaas_settings")
      .upsert(payload, { onConflict: "owner_id" });
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Configurações salvas!" });
  };

  if (roleLoading || loading) {
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
              ? "As configurações de cobranças via Asaas estão disponíveis exclusivamente para assinantes dos planos Pro. Faça o upgrade agora para liberar esta integração."
              : "Você não possui permissão de Master ou Gerente para configurar este módulo."}
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Cobranças (Asaas)</h1>
          <p className="text-sm text-muted-foreground">Configure a conta Asaas da sua empresa para emitir boletos e PIX</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais</CardTitle>
          <CardDescription>
            Crie sua conta em asaas.com e gere a chave de API em <strong>Configurações da conta &gt; Integrações &gt; API</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api_key">Chave de API</Label>
            <div className="flex gap-2">
              <Input
                id="api_key"
                type={showKey ? "text" : "password"}
                value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })}
                placeholder="$aact_..."
                autoComplete="off"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(v => !v)} aria-label="Mostrar chave">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ambiente</Label>
              <Select value={form.ambiente} onValueChange={v => setForm({ ...form, ambiente: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="boleto_days">Prazo padrão de vencimento (dias)</Label>
              <Input id="boleto_days" type="number" min="0" value={form.boleto_days} onChange={e => setForm({ ...form, boleto_days: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Integração ativa</p>
              <p className="text-xs text-muted-foreground">Desative para bloquear novas cobranças</p>
            </div>
            <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook de pagamentos</CardTitle>
          <CardDescription>
            No Asaas, acesse <strong>Integrações &gt; Webhooks</strong>, cadastre a URL abaixo com o token de autenticação e marque os eventos de cobrança.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>URL do webhook</Label>
            <div className="flex gap-2">
              <Input readOnly value={asaasWebhookUrl()} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => copy(asaasWebhookUrl(), "URL")} aria-label="Copiar URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhook_token">Token de autenticação</Label>
            <div className="flex gap-2">
              <Input id="webhook_token" value={form.webhook_token} onChange={e => setForm({ ...form, webhook_token: e.target.value })} className="font-mono text-xs" placeholder="Gere um token e informe o mesmo valor no Asaas" />
              <Button type="button" variant="outline" size="icon" onClick={() => copy(form.webhook_token, "Token")} aria-label="Copiar token">
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={generateToken}>Gerar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Eventos recomendados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>
        <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar configurações"}
      </Button>
    </div>
  );
};

export default ConfiguracoesAsaas;
