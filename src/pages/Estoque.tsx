import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  supplier_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

const Estoque = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", category: "", price: "", cost: "", stock: "", min_stock: "", unit: "un", supplier_id: "" });

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) { toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive" }); }
    else setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
    supabase.from("suppliers").select("id, name").order("name").then(({ data }) => setSuppliers(data || []));
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditProduct(null);
    setForm({ name: "", sku: "", category: "", price: "", cost: "", stock: "", min_stock: "", unit: "un", supplier_id: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, sku: p.sku, category: p.category, price: String(p.price), cost: String(p.cost), stock: String(p.stock), min_stock: String(p.min_stock), unit: p.unit });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.sku) {
      toast({ title: "Erro", description: "Preencha nome e SKU", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      unit: form.unit,
      user_id: user!.id,
    };

    if (editProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editProduct.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Produto atualizado!" });
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Produto cadastrado!" });
    }
    setDialogOpen(false);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Produto removido" });
    fetchProducts();
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground">{products.length} produtos cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Categoria</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Unidade</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Preço Venda</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Custo</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Estoque Atual</Label><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Estoque Mínimo</Label><Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full">{editProduct ? "Salvar Alterações" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produto</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Preço</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Estoque</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.sku}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><Badge variant="secondary">{p.category}</Badge></td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.stock <= p.min_stock ? "text-destructive font-bold" : ""}>{p.stock} {p.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Estoque;
