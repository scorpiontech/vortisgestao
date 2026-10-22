import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

async function getOwnerId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("company_members").select("owner_id").eq("user_id", user.id).eq("active", true).maybeSingle();
  return data?.owner_id ?? user.id;
}

/** Envia o PDF para o armazenamento privado e devolve um link temporário (30 dias). */
export async function uploadSharedPdf(fileName: string, blob: Blob): Promise<string | null> {
  const owner = await getOwnerId();
  if (!owner) return null;
  const path = `${owner}/${fileName}`;
  const { error } = await supabase.storage.from("shared-docs").upload(path, blob, {
    contentType: "application/pdf", upsert: true,
  });
  if (error) { console.error("upload pdf", error); return null; }
  const { data } = await supabase.storage.from("shared-docs").createSignedUrl(path, 60 * 60 * 24 * 30);
  return data?.signedUrl ?? null;
}

/** Retorna se o envio por WhatsApp está habilitado para a empresa (padrão: sim). */
export function useWhatsappEnabled() {
  const [enabled, setEnabled] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const owner = await getOwnerId();
      if (!owner) return;
      setOwnerId(owner);
      const { data } = await supabase.from("company_settings").select("whatsapp_enabled").eq("owner_id", owner).maybeSingle();
      if (data) setEnabled(data.whatsapp_enabled);
    })();
  }, []);
  const save = async (value: boolean) => {
    if (!ownerId) return false;
    const { error } = await supabase.from("company_settings").upsert({ owner_id: ownerId, whatsapp_enabled: value, updated_at: new Date().toISOString() });
    if (!error) setEnabled(value);
    return !error;
  };
  return { enabled, save };
}
