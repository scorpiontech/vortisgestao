import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, AlertCircle, ShieldCheck, Upload, Loader2, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { formatCNPJ, validateCNPJ } from "@/lib/validators";
import ServerTimeDriftAlert from "@/components/fiscal/ServerTimeDriftAlert";
import {
  CSOSN_CODES,
  CST_CODES,
  defaultTributacaoCode,
  isSimplesRegime,
  validateTributacaoForRegime,
} from "@/lib/fiscalCst";

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
    const cstErr = validateTributacaoForRegime(form.csosn_default, form.regime_tributario);
    if (cstErr) {
      toast.error(cstErr);
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

  const readyToEmit =
    validateCNPJ(form.cnpj) &&
    !!form.ie &&
    !!form.provider_token &&
    form.certificate_valid &&
    !certExpired;

  const missing: string[] = [];
  if (!validateCNPJ(form.cnpj)) missing.push("CNPJ");
  if (!form.ie) missing.push("Inscrição Estadual");
  if (!form.provider_token) missing.push("Token do provedor fiscal");
  if (!form.certificate_valid) missing.push("Certificado A1");
  if (certExpired) missing.push("Certificado vencido");

  const handleRemoveCertificate = async () => {
    if (!confirm("Remover o certificado digital atual? Você precisará enviar um novo para voltar a emitir notas.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("fiscal_settings").update({
      certificate_path: null,
      certificate_filename: "",
      certificate_subject: "",
      certificate_expires_at: null,
      certificate_valid: false,
      certificate_password_encrypted: null,
    }).eq("owner_id", user.id);
    if (error) { toast.error("Erro ao remover: " + error.message); return; }
    setForm((f) => ({
      ...f,
      certificate_filename: "",
      certificate_subject: "",
      certificate_expires_at: null,
      certificate_valid: false,
    }));
    setCertFile(null);
    setCertPassword("");
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Certificado removido. Envie o novo arquivo.");
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Configurações Fiscais</h1>
          <p className="text-muted-foreground text-sm">Dados necessários para emissão de NFC-e (modelo 65).</p>
        </div>
        <Badge variant={readyToEmit ? "default" : "secondary"} className={readyToEmit ? "bg-green-600 hover:bg-green-700 gap-1" : "gap-1"}>
          {readyToEmit ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {readyToEmit ? "Pronto para emitir" : "Configuração pendente"}
        </Badge>
      </div>

      <ServerTimeDriftAlert />



      {!readyToEmit && missing.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Faltam itens para habilitar a emissão</AlertTitle>
          <AlertDescription>{missing.join(" • ")}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Certificado Digital A1</CardTitle>
          <CardDescription>Arquivo .pfx emitido por autoridade certificadora ICP-Brasil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.certificate_valid && (
            <Alert className={certExpired ? "border-destructive" : certExpiringSoon ? "border-yellow-500" : "border-green-500"}>
              {certExpired ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle className="flex items-center justify-between gap-2">
                <span>{certExpired ? "Certificado vencido" : certExpiringSoon ? "Certificado próximo do vencimento" : "Certificado ativo"}</span>
                <Button type="button" size="sm" variant="outline" onClick={handleRemoveCertificate} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </Button>
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
            <Select
              value={form.regime_tributario}
              onValueChange={(v) => {
                setForm((f) => {
                  const wasSimples = isSimplesRegime(f.regime_tributario);
                  const nowSimples = isSimplesRegime(v);
                  const shouldReset = wasSimples !== nowSimples;
                  return {
                    ...f,
                    regime_tributario: v,
                    csosn_default: shouldReset ? defaultTributacaoCode(v) : f.csosn_default,
                  };
                });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="simples_excesso">Simples Nacional — excesso</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors flex-row items-center justify-between gap-2 [&>svg]:data-[state=open]:rotate-180">
              <div>
                <CardTitle className="text-base">Configurações avançadas (opcional)</CardTitle>
                <CardDescription>CSC, CFOP e CSOSN — só preencha se o seu contador informar. Na dúvida, deixe em branco: o provedor fiscal usa os valores padrão.</CardDescription>
              </div>
              <ChevronDown className="h-5 w-5 transition-transform text-muted-foreground" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid md:grid-cols-2 gap-4 pt-0">
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs text-muted-foreground">
                  <strong>CSC</strong> é gerado no portal da SEFAZ do seu estado apenas para emissão direta de NFC-e. A maioria dos provedores fiscais dispensa este campo — pergunte ao seu contador antes de preencher.
                </p>
              </div>
              <div className="space-y-2">
                <Label>ID CSC</Label>
                <Input value={form.csc_id} onChange={(e) => setForm({ ...form, csc_id: e.target.value })} placeholder="Ex.: 000001 (deixe em branco se não tiver)" />
              </div>
              <div className="space-y-2">
                <Label>Token CSC</Label>
                <Input type="password" value={form.csc_token} onChange={(e) => setForm({ ...form, csc_token: e.target.value })} placeholder="Deixe em branco se não tiver" />
              </div>
              <div className="space-y-2">
                <Label>CFOP padrão</Label>
                <Input value={form.cfop_default} onChange={(e) => setForm({ ...form, cfop_default: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{isSimplesRegime(form.regime_tributario) ? "CSOSN padrão" : "CST de ICMS padrão"}</Label>
                <Select
                  value={form.csosn_default}
                  onValueChange={(v) => setForm({ ...form, csosn_default: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(isSimplesRegime(form.regime_tributario) ? CSOSN_CODES : CST_CODES).map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isSimplesRegime(form.regime_tributario)
                    ? "Empresas do Simples Nacional devem informar CSOSN."
                    : "Empresas fora do Simples (Lucro Presumido/Real) devem informar CST de ICMS."}
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader>
          <CardTitle>Provedor Fiscal e Ambiente</CardTitle>
          <CardDescription>API terceirizada que assina e transmite as notas para a SEFAZ.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="focusnfe">Focus NFe</SelectItem>
                <SelectItem value="plugnotas">PlugNotas</SelectItem>
                <SelectItem value="nfeio">NFe.io</SelectItem>
                <SelectItem value="enotas">eNotas</SelectItem>
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
          <div className="space-y-2 md:col-span-2">
            <Label>Token / API Key do provedor</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.provider_token}
              onChange={(e) => setForm({ ...form, provider_token: e.target.value })}
              placeholder="Token gerado no painel do provedor"
            />
            <p className="text-xs text-muted-foreground">
              Encontrado no painel do provedor: Focus NFe → "Tokens"; PlugNotas → "Integrações"; NFe.io → "API Keys".
            </p>
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
