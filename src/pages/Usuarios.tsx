import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Shield, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";

interface CompanyMember {
  id: string;
  owner_id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

export default function Usuarios() {
  const { user } = useAuth();
  const { isMaster } = useUserRole();
  const { toast } = useToast();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("vendedor");

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("company_members")
      .select("*")
      .order("created_at", { ascending: true });
    setMembers(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!name || !email || !password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-company-user", {
        body: { email, password, name, role },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao criar usuário");
      }

      toast({ title: "Usuário criado com sucesso!" });
      setDialogOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("vendedor");
      fetchMembers();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member: CompanyMember) => {
    await supabase
      .from("company_members")
      .update({ active: !member.active })
      .eq("id", member.id);
    fetchMembers();
  };

  if (!isMaster) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6 p-4 md:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Usuários da Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os usuários e suas permissões
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do usuário" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <Label>Função</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
                <p className="font-medium">Permissões por função:</p>
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <span className="font-medium">Master:</span> Acesso completo ao sistema
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ShoppingCart className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Vendedor:</span> PDV, Vendas, Clientes, Produtos e Fornecedores
                  </div>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={saving} className="w-full">
                {saving ? "Criando..." : "Criar Usuário"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current user as master */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Owner row */}
            <TableRow>
              <TableCell className="font-medium">{user?.user_metadata?.display_name || user?.email}</TableCell>
              <TableCell>{user?.email}</TableCell>
              <TableCell>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Shield className="h-3 w-3 mr-1" /> Master (Proprietário)
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>
            </TableRow>

            {members.map(member => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={member.role === "master" ? "bg-primary/10 text-primary border-primary/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20"}>
                    {member.role === "master" ? (
                      <><Shield className="h-3 w-3 mr-1" /> Master</>
                    ) : (
                      <><ShoppingCart className="h-3 w-3 mr-1" /> Vendedor</>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={member.active ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}>
                    {member.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Label className="text-xs text-muted-foreground">{member.active ? "Ativo" : "Inativo"}</Label>
                    <Switch checked={member.active} onCheckedChange={() => toggleActive(member)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}
