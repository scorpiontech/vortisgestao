import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, DollarSign, Search, Printer, X } from "lucide-react";
import { printA4 } from "@/lib/printA4";
import { useSellerName } from "@/hooks/useSellerName";

interface ServiceOrder {
  id: string;
  customer_id: string | null;
  customer_name: string;
  service_type: string;
  opened_at: string;
  closed_at: string | null;
  problem_description: string;
  resolution_description: string;
  status: string;
  budget_total: number;
  paid: boolean;
  paid_at: string | null;
  payment_method: string;
}

interface Material {
  id?: string;
  service_order_id?: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const SERVICE_TYPES = [
  "Manutenção",
  "Instalação",
  "Reparo",
  "Consultoria",
  "Suporte Técnico",
  "Outro",
];

const emptyOrder: Omit<ServiceOrder, "id"> = {
  customer_id: null,
  customer_name: "",
  service_type: "",
  opened_at: new Date().toISOString().slice(0, 16),
  closed_at: null,
  problem_description: "",
  resolution_description: "",
  status: "aberta",
  budget_total: 0,
  paid: false,
  paid_at: null,
  payment_method: "",
};

export default function OrdensServico() {
  const { user } = useAuth();
  const { effectiveUserId } = useUserRole();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceOrder | null>(null);
  const [viewing, setViewing] = useState<ServiceOrder | null>(null);
  const [viewMaterials, setViewMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState(emptyOrder);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [payMethod, setPayMethod] = useState("");
  const [payingOrder, setPayingOrder] = useState<ServiceOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState("todas");
  const [hasCaixaAberto, setHasCaixaAberto] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    const [ordersRes, custRes, prodRes] = await Promise.all([
      supabase.from("service_orders").select("*").eq("user_id", user.id).order("opened_at", { ascending: false }),
      supabase.from("customers").select("id, name").eq("user_id", user.id).order("name"),
      supabase.from("products").select("id, name, price").eq("user_id", user.id).order("name"),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as ServiceOrder[]);
    if (custRes.data) setCustomers(custRes.data);
    if (prodRes.data) setProducts(prodRes.data);
  };

  const checkCaixa = async () => {
    if (!user) return;
    const { data } = await supabase.from("cash_registers").select("id").eq("user_id", user.id).eq("status", "open").limit(1);
    setHasCaixaAberto(!!(data && data.length > 0));
  };

  useEffect(() => { fetchAll(); checkCaixa(); }, [user]);

  const budgetTotal = useMemo(() => materials.reduce((s, m) => s + m.total, 0), [materials]);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "todas") list = list.filter(o => o.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o => o.customer_name.toLowerCase().includes(q) || o.service_type.toLowerCase().includes(q));
    }
    return list;
  }, [orders, search, statusFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyOrder, opened_at: new Date().toISOString().slice(0, 16) });
    setMaterials([]);
    setDialogOpen(true);
  };

  const openEdit = async (order: ServiceOrder) => {
    if (order.paid) {
      toast.error("OS já paga não pode ser alterada");
      return;
    }
    setEditing(order);
    setForm({
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      service_type: order.service_type,
      opened_at: order.opened_at.slice(0, 16),
      closed_at: order.closed_at,
      problem_description: order.problem_description,
      resolution_description: order.resolution_description,
      status: order.status,
      budget_total: order.budget_total,
      paid: order.paid,
      paid_at: order.paid_at,
      payment_method: order.payment_method,
    });
    const { data } = await supabase.from("service_order_materials").select("*").eq("service_order_id", order.id);
    setMaterials((data as Material[]) || []);
    setDialogOpen(true);
  };

  const openView = async (order: ServiceOrder) => {
    setViewing(order);
    const { data } = await supabase.from("service_order_materials").select("*").eq("service_order_id", order.id);
    setViewMaterials((data as Material[]) || []);
    setViewDialogOpen(true);
  };

  const addMaterial = () => {
    setMaterials([...materials, { product_id: null, product_name: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const updateMaterial = (idx: number, field: string, value: any) => {
    const updated = [...materials];
    const m = { ...updated[idx], [field]: value };
    if (field === "product_id" && value) {
      const prod = products.find(p => p.id === value);
      if (prod) {
        m.product_name = prod.name;
        m.unit_price = prod.price;
      }
    }
    m.total = m.quantity * m.unit_price;
    updated[idx] = m;
    setMaterials(updated);
  };

  const removeMaterial = (idx: number) => setMaterials(materials.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!user) return;
    if (!form.customer_name) { toast.error("Selecione um cliente"); return; }
    if (!form.service_type) { toast.error("Informe o tipo de serviço"); return; }
    if (!form.problem_description) { toast.error("Descreva o problema"); return; }

    const total = materials.reduce((s, m) => s + m.total, 0);
    const payload = {
      user_id: effectiveUserId!,
      customer_id: form.customer_id,
      customer_name: form.customer_name,
      service_type: form.service_type,
      opened_at: form.opened_at,
      problem_description: form.problem_description,
      resolution_description: form.resolution_description,
      status: form.status,
      budget_total: total,
      payment_method: form.payment_method,
    };

    let orderId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("service_orders").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar OS"); return; }
      // Restore stock from old materials before deleting them
      const { data: oldMats } = await supabase.from("service_order_materials").select("*").eq("service_order_id", editing.id);
      if (oldMats) {
        for (const m of oldMats) {
          if (m.product_id) {
            const { data: prod } = await supabase.from("products").select("stock").eq("id", m.product_id).single();
            if (prod) {
              await supabase.from("products").update({ stock: prod.stock + m.quantity }).eq("id", m.product_id);
            }
          }
        }
      }
      await supabase.from("service_order_materials").delete().eq("service_order_id", editing.id);
    } else {
      const { data, error } = await supabase.from("service_orders").insert(payload).select("id").single();
      if (error || !data) { toast.error("Erro ao criar OS"); return; }
      orderId = data.id;
    }

    // Insert materials and deduct stock
    if (materials.length > 0 && orderId) {
      const rows = materials.map(m => ({
        service_order_id: orderId!,
        product_id: m.product_id,
        product_name: m.product_name,
        quantity: m.quantity,
        unit_price: m.unit_price,
        total: m.total,
      }));
      await supabase.from("service_order_materials").insert(rows);
      // Deduct stock for each material with product_id
      for (const m of materials) {
        if (m.product_id) {
          const { data: prod } = await supabase.from("products").select("stock").eq("id", m.product_id).single();
          if (prod) {
            await supabase.from("products").update({ stock: prod.stock - m.quantity }).eq("id", m.product_id);
          }
        }
      }
    }

    toast.success(editing ? "OS atualizada!" : "OS criada!");
    logAudit({ action: editing ? "update" : "create", entity: "service_order", details: { customer: form.customer_name, service_type: form.service_type } });
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta ordem de serviço?")) return;
    // Restore stock from materials before deleting
    const { data: mats } = await supabase.from("service_order_materials").select("*").eq("service_order_id", id);
    if (mats) {
      for (const m of mats) {
        if (m.product_id) {
          const { data: prod } = await supabase.from("products").select("stock").eq("id", m.product_id).single();
          if (prod) {
            await supabase.from("products").update({ stock: prod.stock + m.quantity }).eq("id", m.product_id);
          }
        }
      }
    }
    await supabase.from("service_orders").delete().eq("id", id);
    toast.success("OS excluída!");
    fetchAll();
  };

  const openPay = (order: ServiceOrder) => {
    if (!hasCaixaAberto) {
      toast.error("É necessário abrir o caixa antes de registrar pagamentos");
      return;
    }
    setPayingOrder(order);
    setPayMethod("");
    setPayDialogOpen(true);
  };

  const handlePay = async () => {
    if (!payingOrder || !payMethod) { toast.error("Selecione a forma de pagamento"); return; }
    const { error } = await supabase.from("service_orders").update({
      paid: true,
      paid_at: new Date().toISOString(),
      payment_method: payMethod,
    }).eq("id", payingOrder.id);
    if (error) { toast.error("Erro ao registrar pagamento"); return; }

    // Registrar entrada na movimentação financeira
    await supabase.from("transactions").insert({
      user_id: effectiveUserId!,
      type: "entrada",
      description: `OS - ${payingOrder.customer_name} - ${payingOrder.service_type}`,
      amount: payingOrder.budget_total,
      category: "Ordem de Serviço",
      payment_method: payMethod,
    });

    toast.success("Pagamento registrado!");
    logAudit({ action: "payment", entity: "service_order", entityId: payingOrder.id, details: { amount: payingOrder.budget_total, payment_method: payMethod } });
    setPayDialogOpen(false);
    fetchAll();
  };

  const handleFinalize = async (order: ServiceOrder) => {
    if (!order.paid) { toast.error("É necessário realizar o pagamento antes de finalizar a OS"); return; }
    const { error } = await supabase.from("service_orders").update({
      status: "finalizada",
      closed_at: new Date().toISOString(),
    }).eq("id", order.id);
    if (error) { toast.error("Erro ao finalizar"); return; }
    toast.success("OS finalizada!");
    fetchAll();
  };

  const handlePrint = (order: ServiceOrder, mats: Material[]) => {
    const matsRows = mats.map(m => `
      <tr>
        <td style="border:1px solid #ddd;padding:6px">${m.product_name}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:center">${m.quantity}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right">R$ ${Number(m.unit_price).toFixed(2)}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right">R$ ${Number(m.total).toFixed(2)}</td>
      </tr>
    `).join("");

    printA4({
      title: "Ordem de Serviço",
      content: `
      <div style="margin-bottom:20px">
        <p><strong>Cliente:</strong> ${order.customer_name}</p>
        <p><strong>Tipo de Serviço:</strong> ${order.service_type}</p>
        <p><strong>Data Abertura:</strong> ${new Date(order.opened_at).toLocaleString("pt-BR")}</p>
        <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
        ${order.closed_at ? `<p><strong>Data Fechamento:</strong> ${new Date(order.closed_at).toLocaleString("pt-BR")}</p>` : ""}
      </div>
      <h3 style="margin:16px 0 8px">Descrição do Problema</h3>
      <p style="white-space:pre-wrap">${order.problem_description}</p>
      ${order.resolution_description ? `<h3 style="margin:16px 0 8px">Resolução</h3><p style="white-space:pre-wrap">${order.resolution_description}</p>` : ""}
      <h3 style="margin:16px 0 8px">Materiais / Orçamento</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f3f4f6">
          <th style="border:1px solid #ddd;padding:6px;text-align:left">Material</th>
          <th style="border:1px solid #ddd;padding:6px;text-align:center">Qtd</th>
          <th style="border:1px solid #ddd;padding:6px;text-align:right">Valor Un.</th>
          <th style="border:1px solid #ddd;padding:6px;text-align:right">Total</th>
        </tr></thead>
        <tbody>${matsRows || '<tr><td colspan="4" style="padding:6px;text-align:center">Nenhum material</td></tr>'}</tbody>
        <tfoot><tr style="font-weight:bold;background:#f3f4f6">
          <td colspan="3" style="border:1px solid #ddd;padding:6px;text-align:right">TOTAL</td>
          <td style="border:1px solid #ddd;padding:6px;text-align:right">R$ ${Number(order.budget_total).toFixed(2)}</td>
        </tr></tfoot>
      </table>
      <div style="margin-top:16px">
        <p><strong>Pagamento:</strong> ${order.paid ? `Pago via ${order.payment_method} em ${order.paid_at ? new Date(order.paid_at).toLocaleString("pt-BR") : ""}` : "Pendente"}</p>
      </div>
    `,
    });
  };

  const statusBadge = (s: string, paid: boolean) => {
    if (s === "finalizada") return <Badge className="bg-green-600">Finalizada</Badge>;
    if (paid) return <Badge className="bg-blue-600">Paga</Badge>;
    return <Badge variant="outline" className="text-amber-600 border-amber-600">Aberta</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova OS</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente ou tipo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="aberta">Abertas</SelectItem>
                <SelectItem value="finalizada">Finalizadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Abertura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Orçamento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma OS encontrada</TableCell></TableRow>
                ) : filtered.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.customer_name}</TableCell>
                    <TableCell className="hidden md:table-cell">{order.service_type}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(order.opened_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{statusBadge(order.status, order.paid)}</TableCell>
                    <TableCell className="text-right">R$ {Number(order.budget_total).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openView(order)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                        {order.status !== "finalizada" && !order.paid && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(order)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => openPay(order)} title="Registrar Pagamento"><DollarSign className="h-4 w-4 text-green-600" /></Button>
                          </>
                        )}
                        {order.status !== "finalizada" && order.paid && (
                          <Button size="sm" variant="outline" onClick={() => handleFinalize(order)}>Finalizar</Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(order.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar OS" : "Nova Ordem de Serviço"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={form.customer_id || ""} onValueChange={v => {
                  const c = customers.find(c => c.id === v);
                  setForm({ ...form, customer_id: v, customer_name: c?.name || "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Serviço *</Label>
                <Select value={form.service_type} onValueChange={v => setForm({ ...form, service_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição do Problema *</Label>
              <Textarea rows={3} value={form.problem_description} onChange={e => setForm({ ...form, problem_description: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Descrição da Resolução</Label>
              <Textarea rows={3} value={form.resolution_description} onChange={e => setForm({ ...form, resolution_description: e.target.value })} />
            </div>

            {/* Materials */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Materiais Utilizados</Label>
                <Button type="button" size="sm" variant="outline" onClick={addMaterial}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
              </div>
              {materials.length > 0 && (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-20">Qtd</TableHead>
                        <TableHead className="w-28">Valor Un.</TableHead>
                        <TableHead className="w-28 text-right">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Select value={m.product_id || "manual"} onValueChange={v => {
                              if (v === "manual") updateMaterial(i, "product_id", null);
                              else updateMaterial(i, "product_id", v);
                            }}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manual">Digitar manualmente</SelectItem>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {!m.product_id && (
                              <Input className="mt-1 h-8" placeholder="Nome do material" value={m.product_name} onChange={e => updateMaterial(i, "product_name", e.target.value)} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={1} className="h-8" value={m.quantity} onChange={e => updateMaterial(i, "quantity", parseInt(e.target.value) || 1)} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" min={0} className="h-8" value={m.unit_price} onChange={e => updateMaterial(i, "unit_price", parseFloat(e.target.value) || 0)} />
                          </TableCell>
                          <TableCell className="text-right font-medium">R$ {m.total.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeMaterial(i)}><X className="h-3 w-3" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="text-right font-bold text-lg">Orçamento Total: R$ {budgetTotal.toFixed(2)}</div>
            </div>

            <Button onClick={handleSave} className="w-full">{editing ? "Atualizar OS" : "Criar OS"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Detalhes da OS</span>
              {viewing && <Button size="sm" variant="outline" onClick={() => handlePrint(viewing, viewMaterials)}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <strong>{viewing.customer_name}</strong></div>
                <div><span className="text-muted-foreground">Tipo:</span> <strong>{viewing.service_type}</strong></div>
                <div><span className="text-muted-foreground">Abertura:</span> <strong>{new Date(viewing.opened_at).toLocaleString("pt-BR")}</strong></div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(viewing.status, viewing.paid)}</div>
                {viewing.closed_at && <div><span className="text-muted-foreground">Fechamento:</span> <strong>{new Date(viewing.closed_at).toLocaleString("pt-BR")}</strong></div>}
                <div><span className="text-muted-foreground">Pagamento:</span> <strong>{viewing.paid ? `Pago (${viewing.payment_method})` : "Pendente"}</strong></div>
              </div>
              <div>
                <Label className="text-muted-foreground">Descrição do Problema</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm">{viewing.problem_description}</p>
              </div>
              {viewing.resolution_description && (
                <div>
                  <Label className="text-muted-foreground">Resolução</Label>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{viewing.resolution_description}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Materiais</Label>
                <div className="rounded-md border mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Valor Un.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewMaterials.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum material</TableCell></TableRow>
                      ) : viewMaterials.map(m => (
                        <TableRow key={m.id}>
                          <TableCell>{m.product_name}</TableCell>
                          <TableCell className="text-center">{m.quantity}</TableCell>
                          <TableCell className="text-right">R$ {Number(m.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {Number(m.total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="text-right font-bold mt-2">Total: R$ {Number(viewing.budget_total).toFixed(2)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          {payingOrder && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Valor do orçamento: <strong className="text-foreground">R$ {Number(payingOrder.budget_total).toFixed(2)}</strong></p>
              <div className="space-y-2">
                <Label>Forma de Pagamento *</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                    <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePay} className="w-full">Confirmar Pagamento</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
