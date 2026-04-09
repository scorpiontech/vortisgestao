import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCPF, formatCNPJ, formatPhone, formatCEP, validateCPF, validateCNPJ } from "@/lib/validators";

interface Registration {
  id: string;
  person_type: string;
  name: string;
  document: string;
  state_registration: string;
  phone: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

const emptyForm: Omit<Registration, "id"> = {
  person_type: "pf",
  name: "",
  document: "",
  state_registration: "",
  phone: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
};

export default function Cadastro() {
  const { user } = useAuth();
  const { effectiveUserId } = useUserRole();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("company_registrations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setRegistrations(data as unknown as Registration[]);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleDocumentChange = (value: string) => {
    const formatted = form.person_type === "pf" ? formatCPF(value) : formatCNPJ(value);
    setForm({ ...form, document: formatted });
  };

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value);
    setForm(prev => ({ ...prev, zip_code: formatted }));
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev,
            zip_code: formatted,
            street: data.logradouro || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
          }));
        }
      } catch {}
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast({ title: "Erro", description: "Nome/Razão Social é obrigatório", variant: "destructive" });
      return;
    }
    const digits = form.document.replace(/\D/g, "");
    if (form.person_type === "pf" && digits.length > 0 && !validateCPF(form.document)) {
      toast({ title: "CPF inválido", description: "Verifique o CPF informado", variant: "destructive" });
      return;
    }
    if (form.person_type === "pj" && digits.length > 0 && !validateCNPJ(form.document)) {
      toast({ title: "CNPJ inválido", description: "Verifique o CNPJ informado", variant: "destructive" });
      return;
    }

    setLoading(true);
    const payload = { ...form, user_id: effectiveUserId! };

    if (editId) {
      await supabase.from("company_registrations").update(payload as any).eq("id", editId);
      toast({ title: "Cadastro atualizado" });
    } else {
      await supabase.from("company_registrations").insert(payload as any);
      toast({ title: "Cadastro criado" });
    }
    setLoading(false);
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm);
    fetchData();
  };

  const openEdit = (r: Registration) => {
    setForm({
      person_type: r.person_type,
      name: r.name,
      document: r.document,
      state_registration: r.state_registration,
      phone: r.phone,
      street: r.street,
      number: r.number,
      complement: r.complement,
      neighborhood: r.neighborhood,
      city: r.city,
      state: r.state,
      zip_code: r.zip_code,
    });
    setEditId(r.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este cadastro?")) return;
    await supabase.from("company_registrations").delete().eq("id", id);
    toast({ title: "Cadastro excluído" });
    fetchData();
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Cadastro</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cadastro</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Cadastros</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum cadastro encontrado</TableCell></TableRow>
              ) : registrations.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.person_type === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.document}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell>{r.city}{r.state ? ` - ${r.state}` : ""}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Cadastro" : "Novo Cadastro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Pessoa</Label>
              <Select value={form.person_type} onValueChange={v => setForm({ ...form, person_type: v, document: "", state_registration: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{form.person_type === "pf" ? "Nome" : "Razão Social"}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{form.person_type === "pf" ? "CPF" : "CNPJ"}</Label>
                <Input value={form.document} onChange={e => handleDocumentChange(e.target.value)} maxLength={form.person_type === "pf" ? 14 : 18} />
              </div>
              {form.person_type === "pj" && (
                <div>
                  <Label>Inscrição Estadual</Label>
                  <Input value={form.state_registration} onChange={e => setForm({ ...form, state_registration: e.target.value })} />
                </div>
              )}
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })} maxLength={15} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>CEP</Label>
                <Input value={form.zip_code} onChange={e => handleCEPChange(e.target.value)} maxLength={9} />
              </div>
              <div className="md:col-span-2">
                <Label>Rua</Label>
                <Input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Número</Label>
                <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} maxLength={2} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={loading}>{editId ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
