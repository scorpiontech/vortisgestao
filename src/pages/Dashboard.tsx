import { StatCard } from "@/components/dashboard/StatCard";
import { DollarSign, Package, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { mockProducts, mockTransactions } from "@/data/mockData";
import { motion } from "framer-motion";

const Dashboard = () => {
  const totalRevenue = mockTransactions.filter(t => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = mockTransactions.filter(t => t.type === "saida").reduce((s, t) => s + t.amount, 0);
  const totalProducts = mockProducts.length;
  const lowStock = mockProducts.filter(p => p.stock <= p.minStock).length;

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita Total" value={formatCurrency(totalRevenue)} icon={TrendingUp} trend={{ value: "+12.5% este mês", positive: true }} variant="success" />
        <StatCard title="Despesas" value={formatCurrency(totalExpenses)} icon={DollarSign} trend={{ value: "+3.2% este mês", positive: false }} variant="destructive" />
        <StatCard title="Produtos" value={String(totalProducts)} subtitle="cadastrados" icon={Package} />
        <StatCard title="Estoque Baixo" value={String(lowStock)} subtitle="produtos abaixo do mínimo" icon={AlertTriangle} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Últimas Movimentações</h2>
          </div>
          <div className="divide-y">
            {mockTransactions.slice(0, 5).map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                    {t.type === "entrada" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.date} · {t.paymentMethod}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                  {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Low Stock Alert */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg shadow-card border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Alertas de Estoque</h2>
          </div>
          <div className="divide-y">
            {mockProducts.filter(p => p.stock <= p.minStock).map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-destructive">{p.stock} {p.unit}</p>
                  <p className="text-xs text-muted-foreground">Mín: {p.minStock}</p>
                </div>
              </div>
            ))}
            {mockProducts.filter(p => p.stock <= p.minStock).length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum produto com estoque baixo</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
