import { mockProducts, mockTransactions } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";

const COLORS = ["hsl(215, 80%, 50%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)"];

const Relatorios = () => {
  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Category stock data
  const categoryMap = new Map<string, number>();
  mockProducts.forEach(p => categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + p.stock));
  const categoryData = Array.from(categoryMap, ([name, value]) => ({ name, value }));

  // Financial by day
  const dayMap = new Map<string, { entradas: number; saidas: number }>();
  mockTransactions.forEach(t => {
    const d = dayMap.get(t.date) || { entradas: 0, saidas: 0 };
    if (t.type === "entrada") d.entradas += t.amount;
    else d.saidas += t.amount;
    dayMap.set(t.date, d);
  });
  const financialData = Array.from(dayMap, ([date, data]) => ({ date: date.slice(5), ...data })).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Análise de estoque e financeiro</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg shadow-card border p-5">
          <h2 className="font-semibold mb-4">Movimentação Financeira</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={financialData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="entradas" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} name="Entradas" />
              <Bar dataKey="saidas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Saídas" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border p-5">
          <h2 className="font-semibold mb-4">Estoque por Categoria</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Products */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg shadow-card border">
        <div className="p-5 border-b"><h2 className="font-semibold">Produtos com Maior Margem</h2></div>
        <div className="divide-y">
          {[...mockProducts].sort((a, b) => (b.price - b.cost) - (a.price - a.cost)).slice(0, 5).map((p, i) => {
            const margin = p.price - p.cost;
            const pct = ((margin / p.price) * 100).toFixed(1);
            return (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Venda: {formatCurrency(p.price)} · Custo: {formatCurrency(p.cost)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-success">{formatCurrency(margin)}</p>
                  <p className="text-xs text-muted-foreground">{pct}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default Relatorios;
