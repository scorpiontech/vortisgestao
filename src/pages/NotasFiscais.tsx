import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { ProGate } from "@/components/ProGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, ExternalLink, RefreshCw, XCircle, Download } from "lucide-react";
import { toast } from "sonner";

interface NfceDoc {
  id: string;
  numero: string | null;
  serie: string | null;
  chave: string | null;
  status: string;
  valor_total: number;
  customer_name: string | null;
  customer_doc: string | null;
  motivo_rejeicao: string | null;
  xml_url: string | null;
  danfce_url: string | null;
  emitted_at: string | null;
  created_at: string;
  ambiente: string;
}

const statusVariant: Record<string, { label: string; color: string }> = {
  pending:      { label: "Processando",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  processing:   { label: "Em análise",   color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  authorized:   { label: "Autorizada",   color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  rejected:     { label: "Rejeitada",    color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  cancelled:    { label: "Cancelada",    color: "bg-muted text-muted-foreground" },
  contingency:  { label: "Contingência", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  error:        { label: "Erro",         color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
};

export default function NotasFiscais() {
  const { effectiveUserId } = useUserRole();
  const { canEmitNFCe, loading: planLoading } = usePlanFeatures();
  const [docs, setDocs] = useState<NfceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    let q = supabase
      .from("nfce_documents")
      .select("id, numero, serie, chave, status, valor_total, customer_name, customer_doc, motivo_rejeicao, xml_url, danfce_url, emitted_at, created_at, ambiente")
      .eq("owner_id", effectiveUserId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setDocs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [effectiveUserId, filter]);

  const refreshStatus = async (id: string) => {
    try {
      await supabase.functions.invoke("nfce-status", { body: { id } });
      await load();
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error("Erro ao consultar status", { description: e.message });
    }
  };

  const cancelNfce = async (id: string) => {
    const justificativa = window.prompt("Justificativa do cancelamento (mínimo 15 caracteres):");
    if (!justificativa || justificativa.length < 15) return;
    try {
      await supabase.functions.invoke("nfce-cancel", { body: { id, justificativa } });
      await load();
      toast.success("Cancelamento solicitado");
    } catch (e: any) {
      toast.error("Erro ao cancelar", { description: e.message });
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

  const filtered = docs.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (d.numero || "").includes(s)
      || (d.chave || "").toLowerCase().includes(s)
      || (d.customer_name || "").toLowerCase().includes(s)
      || (d.customer_doc || "").includes(s);
  });

  if (planLoading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Notas Fiscais (NFC-e)
          </h1>
          <p className="text-sm text-muted-foreground">Histórico de notas fiscais emitidas e seus status</p>
        </div>
      </div>

      <ProGate feature="nfce">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Buscar por nº, chave, cliente, CPF/CNPJ..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="authorized">Autorizadas</SelectItem>
                  <SelectItem value="pending">Processando</SelectItem>
                  <SelectItem value="rejected">Rejeitadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                  <SelectItem value="contingency">Contingência</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Nenhuma nota fiscal encontrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-2">Nº / Série</th>
                      <th className="text-left px-3 py-2">Cliente</th>
                      <th className="text-right px-3 py-2">Valor</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Emissão</th>
                      <th className="text-left px-3 py-2">Ambiente</th>
                      <th className="text-right px-3 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => {
                      const s = statusVariant[d.status] || { label: d.status, color: "bg-muted" };
                      return (
                        <tr key={d.id}>
                          <td className="px-3 py-2 font-mono">
                            {d.numero ? `${d.numero}/${d.serie || "1"}` : "—"}
                            {d.chave && <div className="text-[10px] text-muted-foreground break-all">{d.chave}</div>}
                          </td>
                          <td className="px-3 py-2">
                            {d.customer_name || "Consumidor"}
                            {d.customer_doc && <div className="text-[10px] text-muted-foreground">{d.customer_doc}</div>}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(Number(d.valor_total))}</td>
                          <td className="px-3 py-2">
                            <Badge className={s.color}>{s.label}</Badge>
                            {d.motivo_rejeicao && <div className="text-[10px] text-red-600 dark:text-red-300 mt-0.5 max-w-[220px]">{d.motivo_rejeicao}</div>}
                          </td>
                          <td className="px-3 py-2 text-xs">{fmtDate(d.emitted_at || d.created_at)}</td>
                          <td className="px-3 py-2"><Badge variant="outline">{d.ambiente === "producao" ? "Produção" : "Homolog."}</Badge></td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {(d.status === "pending" || d.status === "processing") && (
                              <Button size="sm" variant="ghost" onClick={() => refreshStatus(d.id)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                            )}
                            {d.danfce_url && (
                              <Button size="sm" variant="ghost" asChild><a href={d.danfce_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                            )}
                            {d.xml_url && (
                              <Button size="sm" variant="ghost" asChild><a href={d.xml_url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a></Button>
                            )}
                            {d.status === "authorized" && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelNfce(d.id)}><XCircle className="h-3.5 w-3.5" /></Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </ProGate>
    </div>
  );
}
