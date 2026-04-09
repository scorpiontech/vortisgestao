import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollText, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  logout: { label: "Logout", color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
  create: { label: "Criação", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  update: { label: "Edição", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  delete: { label: "Exclusão", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  sale: { label: "Venda", color: "bg-primary/10 text-primary border-primary/20" },
  payment: { label: "Pagamento", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cash_open: { label: "Abertura Caixa", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  cash_close: { label: "Fechamento Caixa", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  mark_paid: { label: "Marcou Pago", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
};

const ENTITY_LABELS: Record<string, string> = {
  sale: "Venda",
  customer: "Cliente",
  product: "Produto",
  supplier: "Fornecedor",
  service_order: "Ordem de Serviço",
  cash_register: "Caixa",
  transaction: "Movimentação",
  bill_pagar: "Conta a Pagar",
  bill_receber: "Conta a Receber",
  category: "Categoria",
  unit: "Unidade",
  company: "Cadastro Empresa",
  auth: "Autenticação",
};

const PAGE_SIZE = 20;

export default function Auditoria() {
  const { user } = useAuth();
  const { isMaster } = useUserRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (user) fetchLogs();
  }, [user, page, filterAction, filterEntity]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterAction !== "all") query = query.eq("action", filterAction);
    if (filterEntity !== "all") query = query.eq("entity", filterEntity);

    const { data, count } = await query;
    setLogs((data as any) || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const filteredLogs = search
    ? logs.filter(l =>
        l.user_name.toLowerCase().includes(search.toLowerCase()) ||
        l.user_email.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.entity.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!isMaster) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6 p-4 md:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          Log de Auditoria
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de todas as atividades dos usuários
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, ação, detalhes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={v => { setFilterEntity(v); setPage(0); }}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as entidades</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell>
              </TableRow>
            ) : (
              filteredLogs.map(log => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "bg-muted text-muted-foreground" };
                const entityLabel = ENTITY_LABELS[log.entity] || log.entity;
                const detailStr = log.details && Object.keys(log.details).length > 0
                  ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(", ")
                  : "—";

                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{log.user_name}</p>
                        <p className="text-xs text-muted-foreground">{log.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={actionInfo.color}>
                        {actionInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{entityLabel}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {detailStr}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} registros • Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
