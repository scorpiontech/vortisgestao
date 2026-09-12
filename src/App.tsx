import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import MovimentacaoEstoque from "./pages/MovimentacaoEstoque";
import Financeiro from "./pages/Financeiro";
import Vendas from "./pages/Vendas";
import Relatorios from "./pages/Relatorios";
import RelatorioFinanceiro from "./pages/relatorios/RelatorioFinanceiro";
import RelatorioVendas from "./pages/relatorios/RelatorioVendas";
import RelatorioMaisVendidos from "./pages/relatorios/RelatorioMaisVendidos";
import RelatorioVendedores from "./pages/relatorios/RelatorioVendedores";
import RelatorioMargem from "./pages/relatorios/RelatorioMargem";
import RelatorioCurvaAbc from "./pages/relatorios/RelatorioCurvaAbc";
import RelatorioEstoque from "./pages/relatorios/RelatorioEstoque";
import RelatorioGiro from "./pages/relatorios/RelatorioGiro";
import RelatorioClientes from "./pages/relatorios/RelatorioClientes";
import RelatorioContas from "./pages/relatorios/RelatorioContas";
import RelatorioCobrancas from "./pages/relatorios/RelatorioCobrancas";
import RelatorioDre from "./pages/relatorios/RelatorioDre";
import RelatorioCaixa from "./pages/relatorios/RelatorioCaixa";
import HistoricoCliente from "./pages/HistoricoCliente";
import Clientes from "./pages/Clientes";
import Fornecedores from "./pages/Fornecedores";
import Caixa from "./pages/Caixa";
import Categorias from "./pages/Categorias";
import Unidades from "./pages/Unidades";
import OrdensServico from "./pages/OrdensServico";
import Cadastro from "./pages/Cadastro";
import Cobrancas from "./pages/Cobrancas";
import ContasPagar from "./pages/ContasPagar";
import ContasReceber from "./pages/ContasReceber";
import Usuarios from "./pages/Usuarios";
import Auditoria from "./pages/Auditoria";
import LogsLeituras from "./pages/LogsLeituras";
import Etiquetas from "./pages/Etiquetas";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPlanos from "./pages/AdminPlanos";
import AdminRelatorios from "./pages/AdminRelatorios";
import AdminFaturas from "./pages/AdminFaturas";
import AdminLogsFaturas from "./pages/AdminLogsFaturas";
import AdminFaturasAutomaticas from "./pages/AdminFaturasAutomaticas";
import ConfiguracoesFiscais from "./pages/ConfiguracoesFiscais";
import Orcamentos from "./pages/Orcamentos";
import NotasFiscais from "./pages/NotasFiscais";
import EmitirNotaFiscal from "./pages/EmitirNotaFiscal";
import { AdminProtectedRoute } from "@/components/auth/AdminProtectedRoute";
import Suporte from "./pages/Suporte";
import CobrancasClientes from "./pages/CobrancasClientes";
import ConfiguracoesAsaas from "./pages/ConfiguracoesAsaas";
import AdminConfiguracoesAsaas from "./pages/AdminConfiguracoesAsaas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    SplashScreen.hide().catch(() => {});
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/movimentacao-estoque" element={<MovimentacaoEstoque />} />
              <Route path="/etiquetas" element={<Etiquetas />} />
              <Route path="/categorias" element={<Categorias />} />
              <Route path="/unidades" element={<Unidades />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/movimentacao" element={<Financeiro />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/historico-cliente" element={<HistoricoCliente />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/relatorios/financeiro" element={<RelatorioFinanceiro />} />
              <Route path="/relatorios/dre" element={<RelatorioDre />} />
              <Route path="/relatorios/caixa" element={<RelatorioCaixa />} />
              <Route path="/relatorios/contas-pagar" element={<RelatorioContas type="pagar" />} />
              <Route path="/relatorios/contas-receber" element={<RelatorioContas type="receber" />} />
              <Route path="/relatorios/cobrancas" element={<RelatorioCobrancas />} />
              <Route path="/relatorios/vendas" element={<RelatorioVendas />} />
              <Route path="/relatorios/mais-vendidos" element={<RelatorioMaisVendidos />} />
              <Route path="/relatorios/vendedores" element={<RelatorioVendedores />} />
              <Route path="/relatorios/margem" element={<RelatorioMargem />} />
              <Route path="/relatorios/curva-abc" element={<RelatorioCurvaAbc />} />
              <Route path="/relatorios/estoque" element={<RelatorioEstoque />} />
              <Route path="/relatorios/giro" element={<RelatorioGiro />} />
              <Route path="/relatorios/clientes" element={<RelatorioClientes />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/fornecedores" element={<Fornecedores />} />
              <Route path="/caixa" element={<Caixa />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/cobrancas" element={<Cobrancas />} />
              <Route path="/contas-pagar" element={<ContasPagar />} />
              <Route path="/contas-receber" element={<ContasReceber />} />
              <Route path="/cobrancas-clientes" element={<CobrancasClientes />} />
              <Route path="/configuracoes-asaas" element={<ConfiguracoesAsaas />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/auditoria" element={<Auditoria />} />
              <Route path="/logs-leituras" element={<LogsLeituras />} />
              <Route path="/configuracoes-fiscais" element={<ConfiguracoesFiscais />} />
              <Route path="/orcamentos" element={<Orcamentos />} />
              <Route path="/notas-fiscais" element={<NotasFiscais />} />
              <Route path="/notas-fiscais/emitir" element={<EmitirNotaFiscal />} />
              <Route path="/suporte" element={<Suporte />} />
            </Route>
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
              <Route path="/admin/planos" element={<AdminProtectedRoute><AdminPlanos /></AdminProtectedRoute>} />
              <Route path="/admin/relatorios" element={<AdminProtectedRoute><AdminRelatorios /></AdminProtectedRoute>} />
              <Route path="/admin/faturas" element={<AdminProtectedRoute><AdminFaturas /></AdminProtectedRoute>} />
              <Route path="/admin/logs-faturas" element={<AdminProtectedRoute><AdminLogsFaturas /></AdminProtectedRoute>} />
              <Route path="/admin/faturas-automaticas" element={<AdminProtectedRoute><AdminFaturasAutomaticas /></AdminProtectedRoute>} />
              <Route path="/admin/configuracoes-asaas" element={<AdminProtectedRoute><AdminConfiguracoesAsaas /></AdminProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
