import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Login realizado!", description: "Bem-vindo ao Vortis Gestão" });
      navigate("/dashboard");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar ou faça login." });
    }
  };

  const formFields = (isSignup: boolean) => (
    <>
      {isSignup && (
        <div className="space-y-2">
          <Label htmlFor="displayName">Nome</Label>
          <Input id="displayName" placeholder="Seu nome" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden" style={{ background: "var(--gradient-sidebar)" }}>
        <div className="relative z-10 text-center px-12">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <img src="/logo-transparente.png" alt="Vortis Gestão" className="h-24 mx-auto mb-8" />
            <h1 className="text-4xl font-bold text-white mb-4">Vortis Gestão</h1>
            <p className="text-lg text-white/60 max-w-md">Sistema completo de controle de estoque e gestão financeira para o seu negócio.</p>
          </motion.div>
        </div>
        <div className="absolute top-20 -left-20 h-64 w-64 rounded-full bg-primary/10" />
        <div className="absolute bottom-20 -right-10 h-40 w-40 rounded-full bg-primary/5" />
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <img src="/logo-transparente.png" alt="Vortis Gestão" className="h-10" />
            <h1 className="text-xl font-bold">Vortis Gestão</h1>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-5">
                {formFields(false)}
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5">
                {formFields(true)}
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Criando..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground mt-8">StockFlow © 2026 — Gestão Inteligente</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
