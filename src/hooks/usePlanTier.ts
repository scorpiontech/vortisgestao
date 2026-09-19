import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

/** Retorna o plano (tier) da empresa do usuário logado. */
export function usePlanTier() {
  const { effectiveUserId } = useUserRole();
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("client_accounts")
        .select("plan_id, subscription_plans(tier)")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      if (!active) return;
      setTier(((data as any)?.subscription_plans?.tier as string) ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [effectiveUserId]);

  const isPro = !!tier && (tier.startsWith("pro") || tier === "pro_custom");
  return { tier, isPro, loading };
}
