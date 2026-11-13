import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const KEY = "vortis:session_key";
function sessionKey() {
  let k = sessionStorage.getItem(KEY);
  if (!k) { k = crypto.randomUUID(); sessionStorage.setItem(KEY, k); }
  return k;
}

export function sendPresence(action: "ping" | "logout") {
  return supabase.functions
    .invoke("track-presence", { body: { action, session_key: sessionKey(), native: Capacitor.isNativePlatform() } })
    .catch(() => {});
}

export function usePresenceHeartbeat() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    sendPresence("ping");
    const id = setInterval(() => { if (document.visibilityState === "visible") sendPresence("ping"); }, 120_000);
    const onVis = () => { if (document.visibilityState === "visible") sendPresence("ping"); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [user?.id]);
}
