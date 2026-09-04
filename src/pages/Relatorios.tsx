import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  ClipboardList,
  DollarSign,
  Layers,
  Percent,
  PieChart,
  Receipt,
  Repeat,
  Search,
  ShoppingCart,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

interface ReportLinkItem {
  to: string;
  title: string;
  description: string;
  icon: typeof BarChart3;
  group: string;
}

const REPORTS: ReportLinkItem[] = [
  {
    to: "/relatorios/financeiro",
    title: "Movimentação Financeira",
    description: "Entradas, saídas e saldo por dia",
    icon: DollarSign,
    group: "Financeiro",
  },
  { to: "/relatorios/dre", title: "DRE Simplificado", description: "Receitas, custos, despesas e resultado", icon: Calculator, group: "Financeiro" },
  { to: "/relatorios/caixa", title: "Resumo de Caixa", description: "Abertura, vendas e diferença de fechamento", icon: Wallet, group: "Financeiro" },
  { to: "/relatorios/contas-pagar", title: "Contas a Pagar", description: "Pagas, pendentes e atrasadas", icon: ClipboardList, group: "Financeiro" },
  { to: "/relatorios/contas-receber", title: "Contas a Receber", description: "Recebidas, pendentes e atrasadas", icon: ClipboardList, group: "Financeiro" },
  { to: "/relatorios/cobrancas", title: "Cobranças", description: "Boletos e PIX por status", icon: Receipt, group: "Financeiro" },

  { to: "/relatorios/vendas", title: "Vendas", description: "Faturamento, ticket médio e formas de pagamento", icon: ShoppingCart, group: "Vendas" },
  { to: "/relatorios/mais-vendidos", title: "Produtos Mais Vendidos", description: "Ranking por faturamento e quantidade", icon: Trophy, group: "Vendas" },
  { to: "/relatorios/vendedores", title: "Vendas por Vendedor", description: "Total, ticket médio e participação", icon: Users, group: "Vendas" },
  { to: "/relatorios/margem", title: "Margem de Lucro", description: "Margem em reais e percentual por produto", icon: Percent, group: "Vendas" },
  { to: "/relatorios/curva-abc", title: "Curva ABC", description: "Classificação A, B e C por faturamento", icon: Layers, group: "Vendas" },

  { to: "/relatorios/estoque", title: "Estoque", description: "Quantidades, valores e itens em falta", icon: Boxes, group: "Estoque" },
  { to: "/relatorios/giro", title: "Giro de Estoque", description: "Saídas, cobertura em dias e itens parados", icon: Repeat, group: "Estoque" },

  { to: "/relatorios/clientes", title: "Clientes", description: "Cadastro completo com contatos", icon: Users, group: "Clientes" },
];

const GROUPS = ["Financeiro", "Vendas", "Estoque", "Clientes"];

const Relatorios = () => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return REPORTS;
    return REPORTS.filter((r) => `${r.title} ${r.description} ${r.group}`.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um relatório para ver números, gráficos e exportar em PDF, Excel ou CSV
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar relatório..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Buscar relatório"
        />
      </div>

      {GROUPS.map((group) => {
        const items = filtered.filter((r) => r.group === group);
        if (!items.length) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r, i) => {
                const Icon = r.icon;
                return (
                  <motion.div key={r.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Link
                      to={r.to}
                      className="group flex items-start gap-3 bg-card border rounded-lg p-4 shadow-card h-full transition-colors hover:border-primary hover:bg-accent/40"
                    >
                      <span className="rounded-md bg-primary/10 text-primary p-2 shrink-0">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{r.title}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{r.description}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <PieChart className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum relatório encontrado para "{search}"</p>
        </div>
      )}
    </div>
  );
};

export default Relatorios;
