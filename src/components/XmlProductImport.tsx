import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileUp, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ParsedProduct {
  name: string;
  sku: string;
  price: number;
  cost: number;
  unit: string;
  quantity: number;
  selected: boolean;
}

interface XmlProductImportProps {
  onImported: () => void;
}

export function XmlProductImport({ onImported }: XmlProductImportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseXml = (text: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");

    // NF-e XML structure: nfeProc > NFe > infNFe > det (product items)
    const dets = doc.querySelectorAll("det");
    const parsed: ParsedProduct[] = [];

    dets.forEach((det) => {
      const prod = det.querySelector("prod");
      if (!prod) return;

      const name = prod.querySelector("xProd")?.textContent || "";
      const sku = prod.querySelector("cEAN")?.textContent || prod.querySelector("cProd")?.textContent || "";
      const price = parseFloat(prod.querySelector("vUnCom")?.textContent || "0");
      const cost = parseFloat(prod.querySelector("vUnCom")?.textContent || "0");
      const unit = prod.querySelector("uCom")?.textContent || "un";
      const quantity = parseFloat(prod.querySelector("qCom")?.textContent || "0");

      if (name) {
        parsed.push({ name, sku: sku === "SEM GTIN" ? "" : sku, price, cost, unit: unit.toLowerCase(), quantity: Math.round(quantity), selected: true });
      }
    });

    return parsed;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xml")) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo XML de nota fiscal.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseXml(text);
      if (parsed.length === 0) {
        toast({ title: "Nenhum produto encontrado", description: "O XML não contém itens de produto válidos.", variant: "destructive" });
      }
      setProducts(parsed);
    };
    reader.readAsText(file);
  };

  const toggleProduct = (idx: number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p))
    );
  };

  const handleImport = async () => {
    const selected = products.filter((p) => p.selected);
    if (selected.length === 0) {
      toast({ title: "Nenhum produto selecionado", variant: "destructive" });
      return;
    }

    setLoading(true);
    const payload = selected.map((p) => ({
      name: p.name,
      sku: p.sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      price: p.price,
      cost: p.cost,
      unit: p.unit,
      stock: p.quantity,
      min_stock: 0,
      category: "",
      user_id: user!.id,
    }));

    const { error } = await supabase.from("products").insert(payload);
    setLoading(false);

    if (error) {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `${selected.length} produto(s) importado(s) com sucesso!` });
    setProducts([]);
    setOpen(false);
    if (fileRef.current) fileRef.current.value = "";
    onImported();
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setProducts([]); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileUp className="h-4 w-4 mr-2" />Importar XML</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Produtos via XML (NF-e)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-1.5">
            <Label>Arquivo XML da Nota Fiscal</Label>
            <Input ref={fileRef} type="file" accept=".xml" onChange={handleFile} />
          </div>

          {products.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {products.filter((p) => p.selected).length} de {products.length} produtos selecionados
              </p>
              <div className="overflow-auto flex-1 border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 w-10"></th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Custo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((p, i) => (
                      <tr
                        key={i}
                        className={`cursor-pointer transition-colors ${p.selected ? "hover:bg-muted/30" : "opacity-50 hover:opacity-70"}`}
                        onClick={() => toggleProduct(i)}
                      >
                        <td className="px-3 py-2 text-center">
                          {p.selected ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium truncate max-w-[200px]">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.sku || "Sem código"} · {p.unit}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleImport} disabled={loading} className="w-full">
                {loading ? "Importando..." : `Importar ${products.filter((p) => p.selected).length} Produto(s)`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}