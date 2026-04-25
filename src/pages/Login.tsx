import { useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FieldErrors = { displayName?: string; email?: string; password?: string };

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const emailId = useId();
  const passwordId = useId();
  const displayNameId = useId();
  const formErrorId = useId();

  const validate = (isSignup: boolean): boolean => {
    const next: FieldErrors = {};
    if (isSignup && !displayName.trim()) next.displayName = "Informe seu nome";
    if (!email.trim()) next.email = "Informe seu e-mail";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "E-mail inválido";
    if (!password) next.password = "Informe sua senha";
    else if (isSignup && password.length < 6) next.password = "Mínimo de 6 caracteres";
    setErrors(next);
    if (Object.keys(next).length) {
      // Move focus to the first invalid field
      const firstKey = Object.keys(next)[0] as keyof FieldErrors;
      const id = firstKey === "displayName" ? displayNameId : firstKey === "email" ? emailId : passwordId;
      requestAnimationFrame(() => document.getElementById(id)?.focus());
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!validate(false)) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setFormError(error.message || "Não foi possível entrar. Verifique suas credenciais.");
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
      return;
    }

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
    setFormError("");
    if (!validate(true)) return;
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
      setFormError(error.message || "Não foi possível criar a conta.");
      toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar ou faça login." });
    }
  };

  const formFields = (isSignup: boolean) => (
    <>
      {isSignup && (
        <div className="space-y-2">
          <Label htmlFor={displayNameId}>
            Nome <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id={displayNameId}
            placeholder="Seu nome"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11"
            autoComplete="name"
            required
            aria-required="true"
            aria-invalid={!!errors.displayName}
            aria-describedby={errors.displayName ? `${displayNameId}-error` : undefined}
          />
          {errors.displayName && (
            <p id={`${displayNameId}-error`} role="alert" className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {errors.displayName}
            </p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={emailId}>
          E-mail <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Input
          id={emailId}
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          autoComplete="email"
          required
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
        />
        {errors.email && (
          <p id={`${emailId}-error`} role="alert" className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {errors.email}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={passwordId}>
          Senha <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <div className="relative">
          <Input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pr-10"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            aria-required="true"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {errors.password && (
          <p id={`${passwordId}-error`} role="alert" className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {errors.password}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Skip link for keyboard users */}
      <a
        href="#login-form"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Ir para o formulário
      </a>

      <div
        className="relative w-full lg:w-1/2 aspect-[16/9] sm:aspect-[2/1] lg:aspect-auto lg:min-h-screen overflow-hidden bg-muted"
        role="img"
        aria-label="Vortis Gestão"
      >
        <motion.img
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          src="/logo-transparente.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      </div>

      <main
        id="login-form"
        className="flex-1 flex items-center justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-12 bg-background"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="w-full max-w-[clamp(20rem,28vw,26rem)]"
        >
          <div className="mb-6 sm:mb-8 text-center lg:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bem-vindo</h1>
            <p className="text-sm text-muted-foreground mt-1">Acesse sua conta para continuar</p>
          </div>

          {formError && (
            <div
              id={formErrorId}
              role="alert"
              aria-live="assertive"
              className="mb-5 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6" aria-label="Selecione entrar ou criar conta">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-5" noValidate aria-label="Formulário de login">
                {formFields(false)}
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading} aria-busy={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Pressione <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono text-[10px]">Enter</kbd> para enviar
                </p>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5" noValidate aria-label="Formulário de cadastro">
                {formFields(true)}
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading} aria-busy={loading}>
                  {loading ? "Criando..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground mt-8">Vortis Gestão © 2026</p>
        </motion.div>
      </main>
    </div>
  );
};

export default Login;
