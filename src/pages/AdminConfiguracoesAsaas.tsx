import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, Shield, AlertTriangle, ExternalLink, Save, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminConfiguracoesAsaas() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    api_key: "",
    ambiente: "sandbox",
    webhook_token: "",
    active: false,
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Usaremos uma tabela específica para configurações admin ou metadados.
      // Como o projeto usa RLS e owner_id, para configurações "globais" do admin, 
      // podemos usar uma tabela 'admin_settings' ou similar se existir.
      // Se não, vamos procurar na tabela 'asaas_settings' associada ao user admin.
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("asaas_settings")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        toast.error("Erro ao carregar configurações");
      } else if (data) {
        setSettings({
          api_key: data.api_key || "",
          ambiente: data.ambiente || "sandbox",
          webhook_token: data.webhook_token || "",
          active: data.active ?? false,
        });
      }
    } catch (err) {
      toast.error("Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        owner_id: user.id,
        api_key: settings.api_key,
        ambiente: settings.ambiente,
        webhook_token: settings.webhook_token,
        active: settings.active,
        boleto_days: 3, // Default para admin
      };

      const { error } = await supabase
        .from("asaas_settings")
        .upsert(payload, { onConflict: "owner_id" });

      if (error) {
        toast.error("Erro ao salvar: " + error.message);
      } else {
        toast.success("Configurações salvas com sucesso!");
      }
    } catch (err) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Configuração Asaas (Global Admin)</h1>
            <p className="text-muted-foreground">Configure as credenciais do Asaas para cobranças administrativas B2B.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin/dashboard")}>
          Voltar ao Painel
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Credenciais da API</CardTitle>
                <CardDescription>
                  Essas chaves são usadas para gerar as faturas de mensalidade dos seus clientes.
                </CardDescription>
              </div>
              <Badge variant={settings.active ? "default" : "secondary"}>
                {settings.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ambiente">Ambiente</Label>
                <Select 
                  value={settings.ambiente} 
                  onValueChange={(v) => setSettings({ ...settings, ambiente: v })}
                >
                  <SelectTrigger id="ambiente">
                    <SelectValue placeholder="Selecione o ambiente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                    <SelectItem value="producao">Produção (Real)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Integração Ativa</Label>
                  <Switch 
                    id="active" 
                    checked={settings.active} 
                    onCheckedChange={(v) => setSettings({ ...settings, active: v })} 
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ative para permitir a geração de faturas administrativas.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_key">API Key (Token de Acesso)</Label>
              <div className="relative">
                <Input 
                  id="api_key" 
                  type="password"
                  placeholder="$aach_..." 
                  value={settings.api_key}
                  onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                  className="pr-10"
                />
                <Shield className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Disponível no painel do Asaas em Configurações > Integrações.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_token">Webhook Token</Label>
              <Input 
                id="webhook_token" 
                placeholder="Token de segurança do Webhook" 
                value={settings.webhook_token}
                onChange={(e) => setSettings({ ...settings, webhook_token: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Use este token para validar os eventos recebidos do Asaas.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-base">Atenção</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Certifique-se de configurar a URL do Webhook no painel do Asaas para que o sistema reconheça os pagamentos automaticamente.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="text-[10px] bg-white dark:bg-black/20 p-1 rounded border flex-1 break-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook
              </code>
              <Button size="sm" variant="ghost" onClick={() => {
                navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`);
                toast.success("URL copiada!");
              }}>
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={fetchSettings} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Configurações
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links Úteis</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a 
              href="https://sandbox.asaas.com" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium">Painel Asaas Sandbox</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
            <a 
              href="https://www.asaas.com" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium">Painel Asaas Produção</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
