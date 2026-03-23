import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Financeiro from "./pages/Financeiro";
import Vendas from "./pages/Vendas";
import Relatorios from "./pages/Relatorios";
import HistoricoCliente from "./pages/HistoricoCliente";
import Clientes from "./pages/Clientes";
import Fornecedores from "./pages/Fornecedores";
import Caixa from "./pages/Caixa";
import Categorias from "./pages/Categorias";
import Unidades from "./pages/Unidades";
import OrdensServico from "./pages/OrdensServico";
import Cadastro from "./pages/Cadastro";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
              <Route path="/categorias" element={<Categorias />} />
              <Route path="/unidades" element={<Unidades />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/movimentacao" element={<Financeiro />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/historico-cliente" element={<HistoricoCliente />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/fornecedores" element={<Fornecedores />} />
              <Route path="/caixa" element={<Caixa />} />
              <Route path="/ordens-servico" element={<OrdensServico />} />
              <Route path="/cadastro" element={<Cadastro />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
