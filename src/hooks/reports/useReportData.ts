import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PrintCompanyInfo } from "@/lib/printA4";
import { useSellerName } from "@/hooks/useSellerName";
import { useUserRole } from "@/hooks/useUserRole";

export type ReportTable =
  | "products"
  | "transactions"
  | "sales"
  | "sale_items"
  | "stock_movements"
  | "customers"
  | "suppliers"
  | "bills"
  | "cash_registers"
  | "customer_charges";

const QUERY: Record<ReportTable, { select: string; order?: { column: string; ascending: boolean } }> = {
  products: { select: "*" },
  transactions: { select: "*", order: { column: "date", ascending: false } },
  sales: { select: "*", order: { column: "date", ascending: false } },
  sale_items: { select: "*" },
  stock_movements: { select: "*", order: { column: "created_at", ascending: false } },
  customers: { select: "*", order: { column: "name", ascending: true } },
  suppliers: { select: "id, name", order: { column: "name", ascending: true } },
  bills: { select: "*", order: { column: "due_date", ascending: false } },
  cash_registers: { select: "*", order: { column: "opened_at", ascending: false } },
  customer_charges: { select: "*", order: { column: "created_at", ascending: false } },
};

export interface ReportDataResult {
  data: Record<ReportTable, any[]>;
  company: PrintCompanyInfo | null;
  members: any[];
  sellerName: string;
  isMaster: boolean;
  effectiveUserId: string | null | undefined;
  memberName: (userId?: string | null) => string;
  loading: boolean;
}

const EMPTY = {} as Record<ReportTable, any[]>;

/**
 * Carrega apenas as tabelas necessárias para o relatório atual,
 * junto dos dados da empresa e dos usuários (para nome do vendedor).
 */
export function useReportData(tables: ReportTable[]): ReportDataResult {
  const key = tables.slice().sort().join(",");
  const sellerName = useSellerName();
  const { isMaster, effectiveUserId } = useUserRole();

  const [data, setData] = useState<Record<ReportTable, any[]>>(EMPTY);
  const [company, setCompany] = useState<PrintCompanyInfo | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const list = key ? (key.split(",") as ReportTable[]) : [];
      const results = await Promise.all(
        list.map((t) => {
          const cfg = QUERY[t];
          let q = supabase.from(t as any).select(cfg.select);
          if (cfg.order) q = q.order(cfg.order.column, { ascending: cfg.order.ascending });
          return q;
        })
      );
      if (!active) return;
      const next = {} as Record<ReportTable, any[]>;
      list.forEach((t, i) => {
        next[t] = ((results[i] as any)?.data as any[]) || [];
      });
      setData(next);
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    if (!effectiveUserId) return;
    let active = true;
    const loadCompany = async () => {
      const [{ data: reg }, { data: mem }] = await Promise.all([
        supabase.from("company_registrations").select("*").eq("user_id", effectiveUserId).maybeSingle(),
        supabase.from("company_members").select("user_id, name, email").eq("owner_id", effectiveUserId),
      ]);
      if (!active) return;
      if (reg) {
        const address = [reg.street, reg.number, reg.neighborhood, reg.city && `${reg.city}/${reg.state}`, reg.zip_code]
          .filter(Boolean)
          .join(", ");
        setCompany({ name: reg.name, document: reg.document, address, phone: reg.phone });
      }
      setMembers(mem || []);
    };
    loadCompany();
    return () => {
      active = false;
    };
  }, [effectiveUserId]);

  const memberName = useMemo(
    () => (userId?: string | null) =>
      members.find((m) => m.user_id === userId)?.name || (userId === effectiveUserId ? sellerName : "—"),
    [members, effectiveUserId, sellerName]
  );

  const safeData = useMemo(() => {
    const out = { ...EMPTY } as Record<ReportTable, any[]>;
    (Object.keys(QUERY) as ReportTable[]).forEach((t) => {
      out[t] = data[t] || [];
    });
    return out;
  }, [data]);

  return { data: safeData, company, members, sellerName, isMaster, effectiveUserId, memberName, loading };
}
