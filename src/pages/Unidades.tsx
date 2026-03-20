import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  created_at: string;
}

const Unidades = () => {
  const { user } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Unit | null>(null);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUnits = async () => {
    const { data, error } = await supabase.from("units").select("*").order("name");
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setUnits(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUnits(); }, []);

  const openNew = () => { setEditItem(null); setName(""); setAbbreviation(""); setDialogOpen(true); };
  const openEdit = (u: Unit) => { setEditItem(u); setName(u.name); setAbbreviation(u.abbreviation); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const payload = { name: name.trim(), abbreviation: abbreviation.trim(), user_id: user!.id };
    if (editItem) {
      const { error } = await supabase.from("units").update({ name: name.trim(), abbreviation: abbreviation.trim() }).eq("id", editItem.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Unidade atualizada!" });
    } else {
      const { error } = await supabase.from("units").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Unidade cadastrada!" });
    }
    setDialogOpen(false);
    fetchUnits();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("units").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Unidade removida" });
    fetchUnits();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unidades de Medida</h1>
          <p className="text-sm text-muted-foreground">{units.length} unidades cadastradas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Unidade</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{editItem ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Quilograma" />
              </div>
              <div className="space-y-1.5">
                <Label>Abreviação</Label>
                <Input value={abbreviation} onChange={e => setAbbreviation(e.target.value)} placeholder="Ex: kg" />
              </div>
              <Button onClick={handleSave} className="w-full">{editItem ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg shadow-card border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Abreviação</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {units.map(u => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.abbreviation}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma unidade cadastrada</td></tr>
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default Unidades;
