import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { DollarSign, Package, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Wrench } from "lucide-react";
import { motion } from "framer-motion";

const Dashboard = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [prodRes, transRes, osRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("service_orders").select("id, status, paid, budget_total"),
      ]);
      setProducts(prodRes.data || []);
      setTransactions(transRes.data || []);
      setServiceOrders(osRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const totalRevenue = transactions.filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const lowStock = products.filter(p => p.stock <= p.min_stock).length;
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Receita Total" value={formatCurrency(totalRevenue)} icon={TrendingUp} variant="success" />
        <StatCard title="Despesas" value={formatCurrency(totalExpenses)} icon={DollarSign} variant="destructive" />
        <StatCard title="Produtos" value={String(products.length)} subtitle="cadastrados" icon={Package} />
        <StatCard title="Estoque Baixo" value={String(lowStock)} subtitle="produtos abaixo do mínimo" icon={AlertTriangle} variant="warning" />
        <StatCard
          title="Ordens de Serviço"
          value={String(serviceOrders.filter(o => o.status === "aberta" || o.status === "em_andamento").length)}
          subtitle={`${serviceOrders.length} no total · ${serviceOrders.filter(o => !o.paid).length} a receber`}
          icon={Wrench}
          variant="default"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border">
          <div className="p-5 border-b"><h2 className="font-semibold">Últimas Movimentações</h2></div>
          <div className="divide-y">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                    {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.date} · {t.payment_method}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                  {t.type === "entrada" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                </span>
              </div>
            ))}
            {transactions.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação ainda</div>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg shadow-card border">
          <div className="p-5 border-b"><h2 className="font-semibold">Alertas de Estoque</h2></div>
          <div className="divide-y">
            {products.filter(p => p.stock <= p.min_stock).map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-destructive">{p.stock} {p.unit}</p>
                  <p className="text-xs text-muted-foreground">Mín: {p.min_stock}</p>
                </div>
              </div>
            ))}
            {products.filter(p => p.stock <= p.min_stock).length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum produto com estoque baixo</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
