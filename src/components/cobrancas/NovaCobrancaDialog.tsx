import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { createAsaasCharge, formatBRL, type ChargeItemPayload } from "@/lib/asaas";
import { Search, Barcode, QrCode } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
}

export interface NovaCobrancaDefaults {
  customerId?: string | null;
  customerName?: string;
  description?: string;
  amount?: number;
  source?: "manual" | "pdv" | "bill";
  billId?: string | null;
  items?: ChargeItemPayload[];
  discount?: number;
  installments?: number;
  lockAmount?: boolean;
  createReceivables?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaults?: NovaCobrancaDefaults;
  onCreated?: (charge: any, installments: any[]) => void;
}

const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function NovaCobrancaDialog({ open, onOpenChange, defaults, onCreated }: Props) {
  const { effectiveUserId } = useUserRole();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [billingType, setBillingType] = useState<"BOLETO" | "PIX">("BOLETO");
  const [installments, setInstallments] = useState("1");
  const [dueDate, setDueDate] = useState(todayPlus(5));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("customers").select("id, name, document, email, phone").order("name");
      setCustomers((data as Customer[]) || []);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCustomerId(defaults?.customerId || "");
    setName(defaults?.customerName || "");
    setDescription(defaults?.description || "");
    setAmount(defaults?.amount ? String(defaults.amount.toFixed(2)) : "");
    setInstallments(String(defaults?.installments && defaults.installments > 1 ? defaults.installments : 1));
    setDueDate(todayPlus(5));
    setSearch("");
    setDocument("");
    setEmail("");
    setPhone("");
  }, [open, defaults]);

  useEffect(() => {
    if (!customerId) return;
    const c = customers.find(x => x.id === customerId);
    if (c) {
      setName(c.name || "");
      setDocument(c.document || "");
      setEmail(c.email || "");
      setPhone(c.phone || "");
    }
  }, [customerId, customers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.document || "").includes(q)).slice(0, 50);
  }, [customers, search]);

  const total = Number(amount) || 0;
  const parcelas = Math.max(1, Number(installments) || 1);

  const submit = async () => {
    if (!name.trim()) { toast({ title: "Informe o cliente", variant: "destructive" }); return; }
    if (!description.trim()) { toast({ title: "Informe a descrição da cobrança", variant: "destructive" }); return; }
    if (total <= 0) { toast({ title: "Informe um valor válido", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const res = await createAsaasCharge({
        customer_id: customerId || null,
        customer_name: name.trim(),
        customer_document: document,
        customer_email: email,
        customer_phone: phone,
        description: description.trim(),
        billing_type: billingType,
        total_amount: Math.round(total * 100) / 100,
        installment_count: parcelas,
        due_date: dueDate,
        source: defaults?.source || "manual",
        bill_id: defaults?.billId || null,
        items: defaults?.items || [],
        discount: defaults?.discount || 0,
        payment_method: billingType === "PIX" ? "PIX" : "Boleto",
        create_receivables: defaults?.createReceivables !== false,
      });
      toast({ title: "Cobrança gerada!", description: `${parcelas > 1 ? `${parcelas} parcelas` : "Cobrança única"} de ${formatBRL(total / parcelas)}` });
      onOpenChange(false);
      onCreated?.(res.charge, res.installments);
    } catch (e) {
      toast({ title: "Erro ao gerar cobrança", description: e instanceof Error ? e.message : "Erro inesperado", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cobrança</DialogTitle>
          <DialogDescription>Gere boleto ou PIX pela conta Asaas da sua empresa.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente cadastrado</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou documento..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>
                {filtered.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.document ? ` — ${c.document}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cob-nome">Nome</Label>
              <Input id="cob-nome" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cob-doc">CPF/CNPJ</Label>
              <Input id="cob-doc" value={document} onChange={e => setDocument(e.target.value)} placeholder="Obrigatório" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cob-email">E-mail</Label>
              <Input id="cob-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cob-fone">Telefone</Label>
              <Input id="cob-fone" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cob-desc">Descrição</Label>
            <Input id="cob-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Venda #1234" />
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={billingType === "BOLETO" ? "default" : "outline"} onClick={() => setBillingType("BOLETO")}>
                <Barcode className="h-4 w-4 mr-2" />Boleto
              </Button>
              <Button type="button" variant={billingType === "PIX" ? "default" : "outline"} onClick={() => setBillingType("PIX")}>
                <QrCode className="h-4 w-4 mr-2" />PIX
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cob-valor">Valor total (R$)</Label>
              <Input id="cob-valor" type="number" step="0.01" min="0" value={amount} disabled={defaults?.lockAmount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cob-venc">1º vencimento</Label>
              <Input id="cob-venc" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {parcelas > 1 && total > 0 && (
            <p className="text-xs text-muted-foreground">{parcelas}x de {formatBRL(total / parcelas)} — total {formatBRL(total)}</p>
          )}

          <Button className="w-full" onClick={submit} disabled={submitting || !effectiveUserId}>
            {submitting ? "Gerando cobrança..." : "Gerar cobrança"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
