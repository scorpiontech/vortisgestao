import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export interface FiscalQuotaState {
  allowed: boolean;
  used: number;
  quota: number | null;
  remaining: number | null;
  unlimited: boolean;
  year_month: string;
}

export function useFiscalQuota() {
  const { effectiveUserId } = useUserRole();
  const [state, setState] = useState<FiscalQuotaState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("check_nfce_quota", { _owner_id: effectiveUserId });
    if (!error && data) setState(data as unknown as FiscalQuotaState);
    setLoading(false);
  }, [effectiveUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const usagePct = state && !state.unlimited && state.quota
    ? Math.min(100, Math.round((state.used / state.quota) * 100))
    : 0;

  return {
    quota: state,
    loading,
    refresh,
    usagePct,
    nearLimit: usagePct >= 80 && usagePct < 100,
    blocked: state ? !state.allowed : false,
  };
}
