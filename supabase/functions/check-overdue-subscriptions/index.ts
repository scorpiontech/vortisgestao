import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().slice(0, 10);

    // marca faturas vencidas como overdue
    await supabase
      .from("subscription_invoices")
      .update({ status: "overdue" })
      .eq("status", "pending")
      .lt("due_date", today);

    // busca contas com faturas overdue há mais que tolerance_days
    const { data: accounts } = await supabase.from("client_accounts").select("id, tolerance_days, blocked");

    const blockedList: string[] = [];
    for (const acc of accounts || []) {
      if (acc.blocked) continue;
      const tolerance = acc.tolerance_days || 15;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - tolerance);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data: overdueInvoices } = await supabase
        .from("subscription_invoices")
        .select("id")
        .eq("client_account_id", acc.id)
        .in("status", ["overdue", "pending"])
        .lte("due_date", cutoffStr)
        .limit(1);

      if (overdueInvoices && overdueInvoices.length > 0) {
        await supabase.from("client_accounts").update({ blocked: true, blocked_at: new Date().toISOString(), status: "inativo" }).eq("id", acc.id);
        blockedList.push(acc.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, blocked: blockedList.length, ids: blockedList }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
