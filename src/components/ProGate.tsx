import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

interface ProGateProps {
  feature: "nfce";
  children: ReactNode;
  fallback?: ReactNode;
  /** quando true (default), renderiza um card de upgrade ao bloquear */
  showUpgrade?: boolean;
}

export function ProGate({ feature, children, fallback, showUpgrade = true }: ProGateProps) {
  const { features, loading } = usePlanFeatures();
  if (loading) return null;
  const allowed = Boolean(features?.[feature]);
  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  if (!showUpgrade) return null;
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Disponível no plano Pro</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          A emissão de NFC-e está disponível apenas para assinantes Pro. Faça upgrade
          para emitir notas fiscais diretamente do PDV.
        </p>
        <Button asChild>
          <Link to="/planos"><Sparkles className="h-4 w-4 mr-2" />Conhecer o Pro</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProLockedButton({ feature, label }: { feature: "nfce"; label: string }) {
  return (
    <Button asChild variant="outline" className="border-dashed">
      <Link to="/planos">
        <Lock className="h-4 w-4 mr-2" />
        {label} <span className="ml-2 text-xs text-primary">PRO</span>
      </Link>
    </Button>
  );
}
