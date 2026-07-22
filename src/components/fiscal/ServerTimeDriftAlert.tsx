import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Loader2 } from "lucide-react";

interface DriftResult {
  server_utc: string;
  reference_utc: string | null;
  reference_source?: string;
  drift_seconds: number | null;
  status: "ok" | "warn" | "critical" | "unknown";
  message: string;
}

interface Props {
  /** Se true, só renderiza quando houver alerta (warn/critical). */
  onlyWhenIssue?: boolean;
}

export default function ServerTimeDriftAlert({ onlyWhenIssue = false }: Props) {
  const [data, setData] = useState<DriftResult | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("check-server-time", {
        body: {},
      });
      if (error) throw error;
      setData(res as DriftResult);
    } catch (e) {
      setData({
        server_utc: new Date().toISOString(),
        reference_utc: null,
        drift_seconds: null,
        status: "unknown",
        message: e instanceof Error ? e.message : "Falha ao consultar horário.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data && loading && onlyWhenIssue) return null;
  if (!data) {
    if (onlyWhenIssue) return null;
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Verificando horário do servidor…</AlertTitle>
      </Alert>
    );
  }

  if (onlyWhenIssue && (data.status === "ok" || data.status === "unknown")) return null;

  const variant =
    data.status === "critical" ? "destructive" : data.status === "warn" ? "default" : "default";

  const Icon =
    data.status === "critical" || data.status === "warn"
      ? AlertTriangle
      : data.status === "ok"
      ? CheckCircle2
      : Clock;

  return (
    <Alert variant={variant as "default" | "destructive"}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between gap-2">
        <span>
          {data.status === "critical" && "Relógio do servidor com desvio crítico"}
          {data.status === "warn" && "Relógio do servidor com pequeno desvio"}
          {data.status === "ok" && "Relógio do servidor sincronizado"}
          {data.status === "unknown" && "Não foi possível verificar o horário"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={check}
          disabled={loading}
          className="h-7 px-2"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </AlertTitle>
      <AlertDescription className="space-y-1 text-xs">
        <div>{data.message}</div>
        {data.drift_seconds !== null && (
          <div className="text-muted-foreground">
            Desvio: <strong>{data.drift_seconds}s</strong>
            {data.reference_source ? ` · fonte: ${data.reference_source}` : ""}
          </div>
        )}
        {(data.status === "critical" || data.status === "warn") && (
          <div className="text-muted-foreground">
            Ajuste o relógio do servidor (NTP) para evitar rejeições da SEFAZ do tipo
            "Data-Hora de Emissão posterior ao horário de recebimento".
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
