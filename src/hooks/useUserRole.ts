import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CompanyRole = "master" | "vendedor";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<CompanyRole>("master");
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from("company_members")
        .select("role, owner_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (data) {
        setRole(data.role as CompanyRole);
        setEffectiveUserId(data.role === "vendedor" ? data.owner_id : user.id);
      } else {
        setRole("master");
        setEffectiveUserId(user.id);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isMaster = role === "master";
  const isVendedor = role === "vendedor";

  return { role, isMaster, isVendedor, effectiveUserId, loading };
}
