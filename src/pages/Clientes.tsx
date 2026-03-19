import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit2, Trash2, Printer } from "lucide-react";
import { printA4 } from "@/lib/printA4";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { formatCPF, formatCNPJ, formatPhone, formatCEP, validateCPF, validateCNPJ } from "@/lib/validators";

interface Customer {
  id: string;
  name: string;
  document_type: string;
  document: string;
  email: string;
  phone: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  observation: string;
}

const emptyForm = {
  name: "", document_type: "cpf", document: "", email: "", phone: "",
  zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", observation: "",
};

const Clientes = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [docError, setDocError] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) toast({ title: "Erro ao carregar clientes", description: error.message, variant: "destructive" });
    else setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.document.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditItem(null); setForm(emptyForm); setDocError(""); setDialogOpen(true); };

  const openEdit = (c: Customer) => {
    setEditItem(c);
    setForm({
      name: c.name, document_type: c.document_type, document: c.document, email: c.email, phone: c.phone,
      zip_code: c.zip_code, street: c.street, number: c.number, complement: c.complement,
      neighborhood: c.neighborhood, city: c.city, state: c.state, observation: c.observation,
    });
    setDocError("");
    setDialogOpen(true);
  };

  const handleDocChange = (value: string) => {
    const formatted = form.document_type === "cpf" ? formatCPF(value) : formatCNPJ(value);
    setForm({ ...form, document: formatted });
    setDocError("");
  };

  const handlePhoneChange = (value: string) => {
    setForm({ ...form, phone: formatPhone(value) });
  };

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value);
    setForm(f => ({ ...f, zip_code: formatted }));
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm(f => ({ ...f, zip_code: formatted, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" }));
        }
      } catch {}
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" }); return; }
    if (form.document) {
      const valid = form.document_type === "cpf" ? validateCPF(form.document) : validateCNPJ(form.document);
      if (!valid) { setDocError(form.document_type === "cpf" ? "CPF inválido" : "CNPJ inválido"); return; }
    }

    const payload = { ...form, user_id: user!.id };

    if (editItem) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editItem.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Cliente atualizado!" });
    } else {
      const { error } = await supabase.from("customers").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Cliente cadastrado!" });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Cliente removido" });
    fetchData();
  };

  const handlePrint = (c: Customer) => {
    const content = `
      <div class="section">
        <div class="section-title">Dados Pessoais</div>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">Nome:</span><span class="info-value">${c.name}</span></div>
          <div class="info-row"><span class="info-label">${c.document_type.toUpperCase()}:</span><span class="info-value">${c.document || "—"}</span></div>
          <div class="info-row"><span class="info-label">E-mail:</span><span class="info-value">${c.email || "—"}</span></div>
          <div class="info-row"><span class="info-label">Telefone:</span><span class="info-value">${c.phone || "—"}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Endereço</div>
        <div class="info-grid">
          <div class="info-row"><span class="info-label">Logradouro:</span><span class="info-value">${c.street || "—"}${c.number ? ", " + c.number : ""}${c.complement ? " - " + c.complement : ""}</span></div>
          <div class="info-row"><span class="info-label">Bairro:</span><span class="info-value">${c.neighborhood || "—"}</span></div>
          <div class="info-row"><span class="info-label">Cidade/UF:</span><span class="info-value">${c.city || "—"}${c.state ? "/" + c.state : ""}</span></div>
          <div class="info-row"><span class="info-label">CEP:</span><span class="info-value">${c.zip_code || "—"}</span></div>
        </div>
      </div>
      ${c.observation ? `<div class="section"><div class="section-title">Observações</div><p style="font-size:11px">${c.observation}</p></div>` : ""}
    `;
    printA4({ title: "Ficha Cadastral de Cliente", subtitle: c.name, content });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{customers.length} clientes cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo ou razão social" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo Documento</Label>
                  <Select value={form.document_type} onValueChange={v => setForm({ ...form, document_type: v, document: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{form.document_type.toUpperCase()}</Label>
                  <Input value={form.document} onChange={e => handleDocChange(e.target.value)} placeholder={form.document_type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"} />
                  {docError && <p className="text-xs text-destructive">{docError}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input value={form.zip_code} onChange={e => handleCEPChange(e.target.value)} placeholder="00000-000" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Rua</Label>
                  <Input value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Complemento</Label>
                  <Input value={form.complement} onChange={e => setForm({ ...form, complement: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observação</Label>
                <Textarea value={form.observation} onChange={e => setForm({ ...form, observation: e.target.value })} rows={3} />
              </div>
              <Button onClick={handleSave} className="w-full">{editItem ? "Salvar Alterações" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, documento ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Documento</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Cidade/UF</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.document}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{c.city}{c.state ? `/${c.state}` : ""}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(c)}><Printer className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Clientes;
