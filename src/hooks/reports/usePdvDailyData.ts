import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type PdvReportSale } from "@/lib/pdvDailyReport";

export interface ReportCash { id: string; user_id: string; opened_at: string; }

export function usePdvDailyData(ownerId: string | null | undefined) {
  const [sales, setSales] = useState<PdvReportSale[]>([]);
  const [cashRegisters, setCashRegisters] = useState<ReportCash[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const allSales: PdvReportSale[] = [];
        const allCash: ReportCash[] = [];
        await Promise.all([
          (async () => {
            for (let offset = 0; ; offset += 500) {
              const { data, error } = await supabase.from("sales").select("id,date,attendant_id,cash_register_id,sale_items(product_id,product_name,quantity,total)").eq("user_id", ownerId).order("id").range(offset, offset + 499);
              if (error) throw error;
              allSales.push(...(data || []));
              if (!data || data.length < 500) break;
            }
          })(),
          (async () => {
            for (let offset = 0; ; offset += 500) {
              const { data, error } = await supabase.from("cash_registers").select("id,user_id,opened_at").order("id").range(offset, offset + 499);
              if (error) throw error;
              allCash.push(...(data || []));
              if (!data || data.length < 500) break;
            }
          })(),
        ]);
        if (active) { setSales(allSales); setCashRegisters(allCash); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Não foi possível carregar as vendas");
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [ownerId, revision]);
  return { sales, cashRegisters, loading, error, retry: () => setRevision(v => v + 1) };
}