import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modelo: "55" | "65";
  ownerId: string | null;
  onSaved?: () => void;
}

export default function NfeSettingsDialog({ open, onOpenChange, modelo, ownerId, onSaved }: Props) {
  const [numero, setNumero] = useState<number>(1);
  const [serie, setSerie] = useState<string>("1");
  const [infoFisco, setInfoFisco] = useState<string>("");
  const [ibsCst, setIbsCst] = useState<string>("000");
  const [ibsAliq, setIbsAliq] = useState<string>("0.1");
  const [cbsAliq, setCbsAliq] = useState<string>("0.9");
  const [ibsCbsEnabled, setIbsCbsEnabled] = useState<boolean>(false);
  const [icmsAliq, setIcmsAliq] = useState<string>("0");
  const [pisCst, setPisCst] = useState<string>("49");
  const [pisAliq, setPisAliq] = useState<string>("0");
  const [cofinsCst, setCofinsCst] = useState<string>("49");
  const [cofinsAliq, setCofinsAliq] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !ownerId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("fiscal_settings").select("*").eq("owner_id", ownerId).maybeSingle();
      const d: any = data || {};
      setNumero(modelo === "55" ? (d.proximo_numero_nfe ?? 1) : (d.proximo_numero_nfce ?? 1));
      setSerie(modelo === "55" ? (d.serie_nfe ?? "1") : (d.serie_nfce ?? "1"));
      setInfoFisco(d.informacoes_fisco ?? "");
      setIbsCst(d.ibs_cst ?? "000");
      setIbsAliq(String(d.ibs_aliquota ?? "0.1"));
      setCbsAliq(String(d.cbs_aliquota ?? "0.9"));
      setIbsCbsEnabled(Boolean(d.ibs_cbs_enabled));
      setIcmsAliq(String(d.icms_aliquota ?? "0"));
      setPisCst(d.pis_cst_default ?? "49");
      setPisAliq(String(d.pis_aliquota ?? "0"));
      setCofinsCst(d.cofins_cst_default ?? "49");
      setCofinsAliq(String(d.cofins_aliquota ?? "0"));
      setLoading(false);
    })();
  }, [open, ownerId, modelo]);

  const handleSave = async () => {
    if (!ownerId) return;
    setSaving(true);
    const patch: any = {
      informacoes_fisco: infoFisco,
      ibs_cst: ibsCst,
      ibs_aliquota: Number(ibsAliq) || 0,
      cbs_aliquota: Number(cbsAliq) || 0,
      ibs_cbs_enabled: ibsCbsEnabled,
      icms_aliquota: Number(icmsAliq) || 0,
      pis_cst_default: pisCst,
      pis_aliquota: Number(pisAliq) || 0,
      cofins_cst_default: cofinsCst,
      cofins_aliquota: Number(cofinsAliq) || 0,
    };
    if (modelo === "55") {
      patch.proximo_numero_nfe = Number(numero) || 1;
      patch.serie_nfe = serie;
    } else {
      patch.proximo_numero_nfce = Number(numero) || 1;
      patch.serie_nfce = serie;
    }
    const { error } = await supabase.from("fiscal_settings").update(patch).eq("owner_id", ownerId);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Configurações atualizadas!");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações para emissão de {modelo === "55" ? "NF-e" : "NFC-e"}</DialogTitle>
          <DialogDescription>Numeração, série e parâmetros da Reforma Tributária (IBS/CBS).</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Número da {modelo === "55" ? "NF-e" : "NFC-e"}</Label>
                <Input type="number" min={1} value={numero} onChange={(e) => setNumero(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Série</Label>
                <Input value={serie} onChange={(e) => setSerie(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Informações de FISCO</Label>
              <Textarea rows={4} value={infoFisco} onChange={(e) => setInfoFisco(e.target.value)} />
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-2">ICMS / PIS / COFINS (padrões do item)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota ICMS (%)</Label>
                  <Input type="number" step="0.01" value={icmsAliq} onChange={(e) => setIcmsAliq(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CST PIS</Label>
                  <Input value={pisCst} onChange={(e) => setPisCst(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota PIS (%)</Label>
                  <Input type="number" step="0.01" value={pisAliq} onChange={(e) => setPisAliq(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CST COFINS</Label>
                  <Input value={cofinsCst} onChange={(e) => setCofinsCst(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota COFINS (%)</Label>
                  <Input type="number" step="0.01" value={cofinsAliq} onChange={(e) => setCofinsAliq(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Simples Nacional: use CST 49 (sem tributação) para PIS/COFINS. Lucro Presumido/Real: normalmente CST 01 com alíquotas 0,65% (PIS) e 3% (COFINS).
              </p>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-medium">IBS e CBS (Reforma Tributária)</p>
                  <p className="text-xs text-muted-foreground">
                    Habilite apenas quando a SEFAZ da sua UF já aceitar o grupo IBS/CBS no schema.
                    Se habilitado antes disso, a nota será rejeitada com “Element gIBSCBS is not expected”.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs shrink-0">
                  <input
                    type="checkbox"
                    checked={ibsCbsEnabled}
                    onChange={(e) => setIbsCbsEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Habilitar
                </label>
              </div>
              <div className={`grid grid-cols-3 gap-3 ${ibsCbsEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                <div className="space-y-1.5">
                  <Label className="text-xs">CST Padrão IBS/CBS</Label>
                  <Input value={ibsCst} onChange={(e) => setIbsCst(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota IBS (%)</Label>
                  <Input type="number" step="0.01" value={ibsAliq} onChange={(e) => setIbsAliq(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota CBS (%)</Label>
                  <Input type="number" step="0.01" value={cbsAliq} onChange={(e) => setCbsAliq(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Atualizar configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
