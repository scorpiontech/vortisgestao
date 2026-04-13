import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }

    const checkActive = async () => {
      // Check if this user is a company member (vendedor) and if they're inactive
      const { data } = await supabase
        .from("company_members")
        .select("active, role")
        .eq("user_id", user.id)
        .maybeSingle();

      // If user is a company member and is inactive, block access
      if (data && !data.active) {
        setBlocked(true);
        toast({
          title: "Acesso bloqueado",
          description: "Sua conta foi desativada pelo administrador. Entre em contato com o responsável.",
          variant: "destructive",
        });
        await signOut();
      }
      setChecking(false);
    };

    checkActive();
  }, [user, loading]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || blocked) return <Navigate to="/" replace />;

  return <>{children}</>;
}
