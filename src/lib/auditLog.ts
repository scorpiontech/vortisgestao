import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
}

export async function logAudit({ action, entity, entityId, details }: AuditLogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get effective owner_id
    const { data: member } = await supabase
      .from("company_members")
      .select("owner_id, role")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    const ownerId = member?.role === "vendedor" ? member.owner_id : user.id;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      owner_id: ownerId,
      user_email: user.email || "",
      user_name: user.user_metadata?.display_name || user.email || "",
      action,
      entity,
      entity_id: entityId || null,
      details: details || {},
    } as any);
  } catch (e) {
    console.error("Audit log error:", e);
  }
}
