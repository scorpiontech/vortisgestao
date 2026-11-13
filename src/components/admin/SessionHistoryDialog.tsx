import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ONLINE_WINDOW_MS } from "@/lib/presence";

interface Session {
  id: string; user_email: string; ip_address: string; device: string;
  started_at: string; last_seen_at: string; ended_at: string | null;
}

const fmt = (d: string) => new Date(d).toLocaleString("pt-BR");

export function SessionHistoryDialog({ ownerId, name, open, onOpenChange }: { ownerId: string | null; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [rows, setRows] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !ownerId) return;
    setLoading(true);
    supabase.from("user_session_logs").select("*").eq("owner_id", ownerId)
      .order("started_at", { ascending: false }).limit(200)
      .then(({ data }) => { setRows((data as Session[]) || []); setLoading(false); });
  }, [open, ownerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader><DialogTitle>Histórico de conexões — {name} (últimos 30 dias)</DialogTitle></DialogHeader>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Usuário</TableHead><TableHead>IP</TableHead><TableHead>Dispositivo</TableHead>
            <TableHead>Entrada</TableHead><TableHead>Último sinal</TableHead><TableHead>Situação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
            : rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma conexão registrada</TableCell></TableRow>
            : rows.map(r => {
              const on = !r.ended_at && Date.now() - new Date(r.last_seen_at).getTime() < ONLINE_WINDOW_MS;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.user_email}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ip_address || "—"}</TableCell>
                  <TableCell className="text-xs">{r.device}</TableCell>
                  <TableCell className="text-xs">{fmt(r.started_at)}</TableCell>
                  <TableCell className="text-xs">{fmt(r.last_seen_at)}</TableCell>
                  <TableCell>{on ? <Badge className="bg-green-600">Online</Badge> : r.ended_at ? <Badge variant="secondary">Saiu</Badge> : <Badge variant="outline">Expirada</Badge>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
