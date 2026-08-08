import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface Log {
  id: string;
  action: string;
  created_at: string;
  details: any;
  entity: string;
  entity_id: string | null;
  owner_id: string;
  user_email: string;
  user_id: string;
  user_name: string;
}

export default function AdminLogsFaturas() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity", "subscription_invoice")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Erro ao carregar logs");
    } else {
      setLogs((data as Log[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const getStatusBadge = (action: string) => {
    if (action.includes("erro") || action.includes("error") || action.includes("falha")) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Erro</Badge>;
    }
    if (action.includes("sucesso") || action.includes("success") || action.includes("criada")) {
      return <Badge variant="default" className="bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Sucesso</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Info className="h-3 w-3" /> Info</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Logs de Faturamento</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum log encontrado</TableCell></TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{getStatusBadge(log.action)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{log.user_name}</div>
                    <div className="text-muted-foreground">{log.user_email}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md">
                    <div className="font-medium text-foreground mb-1">{log.action}</div>
                    <pre className="whitespace-pre-wrap overflow-hidden">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
