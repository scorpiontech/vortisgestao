import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";

const COLORS = ["hsl(215, 80%, 50%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)"];

const Relatorios = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [p, t] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
      ]);
      setProducts(p.data || []);
      setTransactions(t.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const categoryMap = new Map<string, number>();
  products.forEach(p => categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + p.stock));
  const categoryData = Array.from(categoryMap, ([name, value]) => ({ name: name || "Sem categoria", value }));

  const dayMap = new Map<string, { entradas: number; saidas: number }>();
  transactions.forEach(t => {
    const d = dayMap.get(t.date) || { entradas: 0, saidas: 0 };
    if (t.type === "entrada") d.entradas += Number(t.amount);
    else d.saidas += Number(t.amount);
    dayMap.set(t.date, d);
  });
  const financialData = Array.from(dayMap, ([date, data]) => ({ date: date.slice(5), ...data })).reverse();

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Análise de estoque e financeiro</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg shadow-card border p-5">
          <h2 className="font-semibold mb-4">Movimentação Financeira</h2>
          {financialData.length > 0 ? (
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
          ) : <p className="text-sm text-muted-foreground text-center py-16">Sem dados ainda</p>}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-card border p-5">
          <h2 className="font-semibold mb-4">Estoque por Categoria</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">Sem produtos cadastrados</p>}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-lg shadow-card border">
        <div className="p-5 border-b"><h2 className="font-semibold">Produtos com Maior Margem</h2></div>
        <div className="divide-y">
          {[...products].sort((a, b) => (b.price - b.cost) - (a.price - a.cost)).slice(0, 5).map((p, i) => {
            const margin = p.price - p.cost;
            const pct = p.price > 0 ? ((margin / p.price) * 100).toFixed(1) : "0";
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
          {products.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum produto cadastrado</div>}
        </div>
      </motion.div>
    </div>
  );
};

export default Relatorios;
