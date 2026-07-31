import { supabase } from "@/integrations/supabase/client";

const FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export interface ChargeItemPayload {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CreateChargeInput {
  customer_id?: string | null;
  customer_name: string;
  customer_document: string;
  customer_email?: string;
  customer_phone?: string;
  description: string;
  billing_type: "BOLETO" | "PIX";
  total_amount: number;
  installment_count: number;
  due_date?: string;
  source?: "manual" | "pdv" | "bill";
  bill_id?: string | null;
  items?: ChargeItemPayload[];
  discount?: number;
  payment_method?: string;
  create_receivables?: boolean;
}

async function callFn<T>(name: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
  return json as T;
}

export const createAsaasCharge = (input: CreateChargeInput) =>
  callFn<{ charge: any; installments: any[] }>("asaas-create-charge", input);

export const syncAsaasCharge = (charge_id: string) =>
  callFn<{ synced: boolean; status: string }>("asaas-sync-charge", { charge_id });

export const cancelAsaasCharge = (charge_id: string) =>
  callFn<{ cancelled: boolean }>("asaas-sync-charge", { charge_id, action: "cancel" });

export const asaasWebhookUrl = () => `${FN_BASE}/asaas-webhook`;

export const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
