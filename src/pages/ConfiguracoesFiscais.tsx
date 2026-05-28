import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ShieldCheck, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { formatCNPJ, validateCNPJ } from "@/lib/validators";

interface FiscalSettings {
  cnpj: string;
  ie: string;
  regime_tributario: string;
  csc_id: string;
  csc_token: string;
  cfop_default: string;
  csosn_default: string;
  ambiente: string;
  provider: string;
  provider_token: string;
  certificate_filename: string;
  certificate_subject: string;
  certificate_expires_at: string | null;
  certificate_valid: boolean;
}

const empty: FiscalSettings = {
  cnpj: "",
  ie: "",
  regime_tributario: "simples_nacional",
  csc_id: "",
  csc_token: "",
  cfop_default: "5102",
  csosn_default: "102",
  ambiente: "homologacao",
  provider: "focusnfe",
  provider_token: "",
  certificate_filename: "",
  certificate_subject: "",
  certificate_expires_at: null,
  certificate_valid: false,
};

export default function ConfiguracoesFiscais() {
  const { isMaster, loading: roleLoading } = useUserRole();
  const [form, setForm] = useState<FiscalSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("fiscal_settings").select("*").eq("owner_id", user.id).maybeSingle();
      if (data) setForm({ ...empty, ...data });
      setLoading(false);
    })();
  }, []);

  if (roleLoading || loading) {
    return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!isMaster) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>Apenas o usuário Master pode acessar configurações fiscais.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const result = r.result as string;
        resolve(result.split(",")[1]);
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleSave = async () => {
    if (!validateCNPJ(form.cnpj)) {
      toast.error("CNPJ inválido");
      return;
    }

    setSaving(true);
    try {
      // If user selected a new certificate, validate + upload via edge function
      if (certFile) {
        if (!certPassword) {
          toast.error("Informe a senha do certificado");
          setSaving(false);
          return;
        }
        const ext = certFile.name.toLowerCase();
        if (!ext.endsWith(".pfx") && !ext.endsWith(".p12")) {
          toast.error("Arquivo deve ser .pfx ou .p12");
          setSaving(false);
          return;
        }
        if (certFile.size > 5 * 1024 * 1024) {
          toast.error("Certificado excede 5 MB");
          setSaving(false);
          return;
        }

        const cert_base64 = await fileToBase64(certFile);
        const { data, error } = await supabase.functions.invoke("fiscal-validate-certificate", {
          body: {
            cert_base64,
            filename: certFile.name,
            password: certPassword,
            settings: {
              cnpj: form.cnpj,
              ie: form.ie,
              regime_tributario: form.regime_tributario,
              csc_id: form.csc_id,
              csc_token: form.csc_token,
              cfop_default: form.cfop_default,
              csosn_default: form.csosn_default,
              ambiente: form.ambiente,
              provider: form.provider,
              provider_token: form.provider_token,
            },
          },
        });
        if (error || (data as any)?.error) {
          toast.error((data as any)?.error ?? error?.message ?? "Falha ao validar certificado");
          setSaving(false);
          return;
        }
        toast.success("Certificado validado e configurações salvas!");
        setForm((f) => ({
          ...f,
          certificate_filename: certFile.name,
          certificate_subject: (data as any).subject ?? "",
          certificate_expires_at: (data as any).expires_at ?? null,
          certificate_valid: true,
        }));
        setCertFile(null);
        setCertPassword("");
        if (fileRef.current) fileRef.current.value = "";
      } else {
        // Save only non-cert fields
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from("fiscal_settings").upsert({
          owner_id: user.id,
          cnpj: form.cnpj,
          ie: form.ie,
          regime_tributario: form.regime_tributario,
          csc_id: form.csc_id,
          csc_token: form.csc_token,
          cfop_default: form.cfop_default,
          csosn_default: form.csosn_default,
          ambiente: form.ambiente,
          provider: form.provider,
          provider_token: form.provider_token,
        }, { onConflict: "owner_id" });
        if (error) { toast.error("Erro ao salvar: " + error.message); return; }
        toast.success("Configurações salvas!");
      }
    } finally {
      setSaving(false);
    }
  };

  const certExpired = form.certificate_expires_at && new Date(form.certificate_expires_at) < new Date();
  const certExpiringSoon = form.certificate_expires_at && !certExpired &&
    new Date(form.certificate_expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Configurações Fiscais</h1>
        <p className="text-muted-foreground text-sm">Dados necessários para emissão de NFC-e (modelo 65).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Certificado Digital A1</CardTitle>
          <CardDescription>Arquivo .pfx emitido por autoridade certificadora ICP-Brasil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.certificate_valid && (
            <Alert className={certExpired ? "border-destructive" : certExpiringSoon ? "border-yellow-500" : "border-green-500"}>
              {certExpired ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle>
                {certExpired ? "Certificado vencido" : certExpiringSoon ? "Certificado próximo do vencimento" : "Certificado ativo"}
              </AlertTitle>
              <AlertDescription>
                <div><strong>Titular:</strong> {form.certificate_subject}</div>
                <div><strong>Arquivo:</strong> {form.certificate_filename}</div>
                <div><strong>Validade:</strong> {form.certificate_expires_at ? new Date(form.certificate_expires_at).toLocaleDateString("pt-BR") : "—"}</div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Arquivo do certificado (.pfx / .p12)</Label>
              <Input ref={fileRef} type="file" accept=".pfx,.p12" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-2">
              <Label>Senha do certificado</Label>
              <Input type="password" autoComplete="new-password" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} placeholder={form.certificate_valid ? "Mantém a atual se vazio" : ""} />
            </div>
          </div>
          {certFile && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" /> {certFile.name} ({(certFile.size / 1024).toFixed(0)} KB) será enviado e validado ao salvar.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dados da Empresa</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNPJ *</Label>
            <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-2">
            <Label>Inscrição Estadual</Label>
            <Input value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Regime Tributário</Label>
            <Select value={form.regime_tributario} onValueChange={(v) => setForm({ ...form, regime_tributario: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="simples_excesso">Simples Nacional — excesso</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CFOP padrão</Label>
            <Input value={form.cfop_default} onChange={(e) => setForm({ ...form, cfop_default: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CSOSN/CST padrão</Label>
            <Input value={form.csosn_default} onChange={(e) => setForm({ ...form, csosn_default: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSC — Código de Segurança do Contribuinte</CardTitle>
          <CardDescription>Token gerado no portal da SEFAZ do seu estado para NFC-e.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ID CSC</Label>
            <Input value={form.csc_id} onChange={(e) => setForm({ ...form, csc_id: e.target.value })} placeholder="000001" />
          </div>
          <div className="space-y-2">
            <Label>Token CSC</Label>
            <Input type="password" value={form.csc_token} onChange={(e) => setForm({ ...form, csc_token: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Provedor e Ambiente</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="focusnfe">Focus NFe</SelectItem>
                <SelectItem value="plugnotas">PlugNotas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={form.ambiente} onValueChange={(v) => setForm({ ...form, ambiente: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação (teste)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
            <div className="pt-1"><Badge variant={form.ambiente === "producao" ? "default" : "secondary"}>{form.ambiente === "producao" ? "Notas com valor fiscal" : "Notas sem valor fiscal"}</Badge></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {certFile ? "Validar e Salvar" : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
