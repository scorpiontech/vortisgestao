import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScanBarcode, Search, CheckCircle2, XCircle, Settings2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface ScanLog {
  id: string;
  created_at: string;
  user_name: string;
  user_email: string;
  code: string;
  format: string;
  product_name: string;
  matched: boolean;
  context: string;
}

const LogsLeituras = () => {
  const { effectiveUserId } = useUserRole();
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched">("all");

  const fetchLogs = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from("barcode_scan_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs((data || []) as ScanLog[]);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [effectiveUserId]);

  const formatDate = (d: string) => new Date(d).toLocaleString("pt-BR");

  const filtered = logs.filter(l => {
    if (filter === "matched" && !l.matched) return false;
    if (filter === "unmatched" && l.matched) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.code.toLowerCase().includes(q) ||
      l.product_name.toLowerCase().includes(q) ||
      l.user_name.toLowerCase().includes(q) ||
      l.user_email.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: logs.length,
    matched: logs.filter(l => l.matched).length,
    unmatched: logs.filter(l => !l.matched).length,
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScanBarcode className="h-6 w-6" />Logs de Leituras</h1>
        <p className="text-sm text-muted-foreground">Auditoria de códigos de barras lidos no PDV</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de leituras</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Com produto</p>
          <p className="text-2xl font-bold text-success">{stats.matched}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Sem correspondência</p>
          <p className="text-2xl font-bold text-destructive">{stats.unmatched}</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, produto, usuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs rounded-md border ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Todos</button>
            <button onClick={() => setFilter("matched")} className={`px-3 py-1.5 text-xs rounded-md border ${filter === "matched" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Com produto</button>
            <button onClick={() => setFilter("unmatched")} className={`px-3 py-1.5 text-xs rounded-md border ${filter === "unmatched" ? "bg-primary text-primary-foreground" : "bg-background"}`}>Sem produto</button>
          </div>
        </div>
        <div className="divide-y max-h-[calc(100vh-320px)] overflow-auto">
          {filtered.map(l => (
            <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${l.matched ? "bg-success/10" : "bg-destructive/10"}`}>
                  {l.matched
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-mono font-medium truncate">{l.code}</p>
                    {l.format && <Badge variant="outline" className="text-[10px] h-4">{l.format}</Badge>}
                    <Badge variant="secondary" className="text-[10px] h-4">{l.context.toUpperCase()}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>{l.matched ? l.product_name : "Produto não encontrado"}</span>
                    <span>•</span>
                    <span>{l.user_name || l.user_email}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground shrink-0">{formatDate(l.created_at)}</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhuma leitura registrada
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LogsLeituras;
