import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, Info, Webhook, FileText, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InvoiceLog {
  id: string;
  client_name: string;
  reference_month: string;
  amount: number;
  status: string;
  error_message: string;
  error_details: any;
  created_at: string;
  source: string;
}

interface WebhookLog {
  id: string;
  event: string;
  payment_id: string;
  payload: any;
  status: string;
  error_message: string;
  created_at: string;
}

export default function AdminLogsFaturas() {
  const [invoiceLogs, setInvoiceLogs] = useState<InvoiceLog[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Buscar logs de geração
      const { data: invData, error: invError } = await supabase
        .from("invoice_generation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (invError) {
        toast.error("Erro ao carregar logs de geração");
      } else {
        setInvoiceLogs((invData as any) || []);
      }

      // Buscar logs de webhook - usando as any para evitar erro de cache do schema
      const { data: whData, error: whError } = await supabase
        .from("asaas_webhook_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!whError) {
        setWebhookLogs((whData as any) || []);
      }
    } catch (e) {
      console.error("fetchData error:", e);
    }
    
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "success":
      case "received":
      case "processed":
        return <Badge variant="default" className="bg-green-600 gap-1 text-white hover:bg-green-700"><CheckCircle className="h-3 w-3" /> Sucesso</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Info className="h-3 w-3" /> {status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Status da Integração Asaas</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </header>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" /> Geração de Faturas
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" /> Webhooks Recebidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Geração</CardTitle>
              <CardDescription>Tentativas de criação automática e manual de faturas via Asaas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Detalhes/Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
                  ) : invoiceLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum log encontrado</TableCell></TableRow>
                  ) : invoiceLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{log.client_name}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {log.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md">
                        {log.error_message && (
                          <div className="text-destructive font-medium mb-1">{log.error_message}</div>
                        )}
                        <pre className="text-[10px] whitespace-pre-wrap overflow-hidden bg-muted/50 p-2 rounded">
                          {JSON.stringify(log.error_details, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Log de Webhooks</CardTitle>
              <CardDescription>Eventos recebidos do Asaas (Pagamentos, Vencimentos, etc).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Pagamento ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
                  ) : webhookLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum webhook registrado</TableCell></TableRow>
                  ) : webhookLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs font-bold">{log.event}</TableCell>
                      <TableCell className="text-xs font-mono">{log.payment_id}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md">
                        <pre className="text-[10px] whitespace-pre-wrap overflow-hidden bg-muted/50 p-2 rounded">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
