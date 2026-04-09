import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSellerName() {
  const { user } = useAuth();
  const [sellerName, setSellerName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("company_members")
      .select("name")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) {
          setSellerName(data.name);
        } else {
          supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data: profile }) => {
              setSellerName(profile?.display_name || user.email || "");
            });
        }
      });
  }, [user]);

  return sellerName;
}
