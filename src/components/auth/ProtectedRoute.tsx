import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Rotas permitidas mesmo quando a conta está bloqueada por inadimplência
const ALLOWED_WHEN_BLOCKED = ["/cobrancas"];

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(false);
  const [isPro, setIsPro] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }

    const check = async () => {
      // 1) Vendedor desativado pelo master => desloga
      const { data: member } = await supabase
        .from("company_members")
        .select("active, role, owner_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (member && !member.active) {
        setSignedOut(true);
        toast({
          title: "Acesso bloqueado",
          description: "Sua conta foi desativada pelo administrador. Entre em contato com o responsável.",
          variant: "destructive",
        });
        await signOut();
        setChecking(false);
        return;
      }

      // 2) Conta da empresa bloqueada por inadimplência
      const effectiveOwnerId = member?.role === "vendedor" ? member.owner_id : user.id;
      const { data: account } = await supabase
        .from("client_accounts")
        .select("blocked, plan_id, subscription_plans(tier)")
        .eq("user_id", effectiveOwnerId)
        .maybeSingle();

      const tier = (account as any)?.subscription_plans?.tier;
      setIsPro(tier?.startsWith("pro") || tier === "pro_custom");

      if (account?.blocked) {
        setAccountBlocked(true);
      }

      setChecking(false);
    };

    check();
  }, [user, loading, location.pathname]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || signedOut) return <Navigate to="/" replace />;

  if (accountBlocked && !ALLOWED_WHEN_BLOCKED.includes(location.pathname)) {
    return <Navigate to="/cobrancas" replace state={{ blockedRedirect: true }} />;
  }

  // Redirecionamento de upgrade para módulos Pro/Fiscais no plano Free
  const proRoutes = ["/cobrancas-clientes", "/configuracoes-asaas", "/configuracoes-fiscais"];
  if (proRoutes.includes(location.pathname) && isPro === false) {
    return <Navigate to="/cobrancas" replace />;
  }

  return <>{children}</>;
}
