import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    setLoading(false);
    toast({ title: "Login realizado!", description: "Bem-vindo ao Vortis Gestão" });
    logAudit({ action: "login", entity: "auth", details: { email } });
    navigate(roleData ? "/admin/dashboard" : "/dashboard");
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel — full width on mobile (aspect-locked), half width on desktop */}
      <div className="relative w-full lg:w-1/2 aspect-[16/9] sm:aspect-[2/1] lg:aspect-auto lg:min-h-screen overflow-hidden bg-muted">
        <motion.img
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          src="/logo-transparente.png"
          alt="Vortis Gestão"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      </div>

      {/* Form panel — fluid padding scales with viewport */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="w-full max-w-[clamp(20rem,28vw,26rem)]"
        >
          <div className="mb-6 sm:mb-8 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Bem-vindo</h2>
            <p className="text-sm text-muted-foreground mt-1">Acesse sua conta para continuar</p>
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

          <p className="text-center text-xs text-muted-foreground mt-8">Vortis Gestão © 2026</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
