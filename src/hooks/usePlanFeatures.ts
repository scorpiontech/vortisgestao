import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface PlanFeatures {
  tier: string;
  planName: string;
  planId: string | null;
  monthlyValue: number;
  features: Record<string, any>;
  isFree: boolean;
  isPro: boolean;
  canEmitNFCe: boolean;
  loading: boolean;
}

export function usePlanFeatures(): PlanFeatures {
  const { effectiveUserId } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["plan-features", effectiveUserId],
    enabled: !!effectiveUserId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: acc } = await supabase
        .from("client_accounts")
        .select("plan_id, subscription_plans:plan_id(id, name, tier, monthly_value, features)")
        .eq("user_id", effectiveUserId!)
        .maybeSingle();

      const plan = (acc as any)?.subscription_plans;
      return {
        tier: plan?.tier ?? "free",
        planName: plan?.name ?? "Free",
        planId: plan?.id ?? null,
        monthlyValue: Number(plan?.monthly_value ?? 0),
        features: (plan?.features as Record<string, any>) ?? {},
      };
    },
  });

  const features = data?.features ?? {};
  const tier = data?.tier ?? "free";
  const canEmitNFCe = Boolean(features.nfce);

  return {
    tier,
    planName: data?.planName ?? "Free",
    planId: data?.planId ?? null,
    monthlyValue: data?.monthlyValue ?? 0,
    features,
    isFree: tier === "free",
    isPro: tier === "pro" || canEmitNFCe,
    canEmitNFCe,
    loading: isLoading,
  };
}
