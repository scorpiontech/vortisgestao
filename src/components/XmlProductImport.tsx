import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUp, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateProductBarcode } from "@/lib/barcodeGenerator";

interface ParsedProduct {
  name: string;
  sku: string;
  cost: number;
  unit: string;
  quantity: number;
  ncm: string;
  selected: boolean;
  existingId: string | null;
  existingStock: number;
  currentPrice: number | null;
  price: string; // preço de venda editável
}

type PricingMode = "markup" | "margin";

export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Markup: preço = custo × (1 + %). Margem: preço = custo ÷ (1 − %). */
export function calcSalePrice(cost: number, percent: number, mode: PricingMode): number {
  if (!(cost > 0) || !(percent >= 0)) return round2(cost || 0);
  if (mode === "markup") return round2(cost * (1 + percent / 100));
  if (percent >= 100) return round2(cost);
  return round2(cost / (1 - percent / 100));
}

/** Margem de lucro sobre o preço de venda (%). */
export function calcMargin(cost: number, price: number): number | null {
  if (!(price > 0)) return null;
  return round2(((price - cost) / price) * 100);
}

interface XmlProductImportProps {
  onImported: () => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function XmlProductImport({ onImported }: XmlProductImportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(false);
  const [mode, setMode] = useState<PricingMode>("markup");
  const [percent, setPercent] = useState("30");
  const [applyTo, setApplyTo] = useState<"all" | "new" | "selected">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseXml = (text: string) => {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const parsed: Omit<ParsedProduct, "existingId" | "existingStock" | "currentPrice" | "price">[] = [];
    doc.querySelectorAll("det").forEach((det) => {
      const prod = det.querySelector("prod");
      if (!prod) return;
      const name = (prod.querySelector("xProd")?.textContent || "").trim();
      const sku = (prod.querySelector("cEAN")?.textContent || prod.querySelector("cProd")?.textContent || "").trim();
      const cost = parseFloat(prod.querySelector("vUnCom")?.textContent || "0");
      const unit = prod.querySelector("uCom")?.textContent || "un";
      const quantity = parseFloat(prod.querySelector("qCom")?.textContent || "0");
      const ncm = (prod.querySelector("NCM")?.textContent || "").replace(/\D/g, "").slice(0, 8);
      if (name) parsed.push({ name, sku: sku === "SEM GTIN" ? "" : sku, cost: round2(cost), unit: unit.toLowerCase(), quantity: Math.round(quantity), ncm, selected: true });
    });
    return parsed;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo XML de nota fiscal.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const parsed = parseXml(ev.target?.result as string);
      if (parsed.length === 0) {
        toast({ title: "Nenhum produto encontrado", description: "O XML não contém itens de produto válidos.", variant: "destructive" });
        setProducts([]);
        return;
      }
      setReading(true);
      const names = parsed.map((p) => p.name);
      const skus = parsed.map((p) => p.sku).filter(Boolean);
      const filters: string[] = [];
      if (names.length) filters.push(`name.in.(${names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",")})`);
      if (skus.length) filters.push(`sku.in.(${skus.map((s) => `"${s}"`).join(",")})`);
      const { data } = await supabase.from("products").select("id, name, sku, stock, price").or(filters.join(","));
      const existing = data || [];
      setProducts(parsed.map((p) => {
        const db = existing.find((e) => (p.sku && e.sku === p.sku)) || existing.find((e) => e.name === p.name);
        return {
          ...p,
          existingId: db?.id ?? null,
          existingStock: db?.stock ?? 0,
          currentPrice: db ? Number(db.price) : null,
          price: db ? String(Number(db.price)) : String(p.cost),
        };
      }));
      setReading(false);
    };
    reader.readAsText(file);
  };

  const update = (idx: number, patch: Partial<ParsedProduct>) =>
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const applyPricing = () => {
    const pct = Number(percent.replace(",", "."));
    if (!(pct >= 0) || (mode === "margin" && pct >= 100)) {
      toast({ title: "Percentual inválido", description: mode === "margin" ? "A margem deve ser menor que 100%." : "Informe um percentual válido.", variant: "destructive" });
      return;
    }
    let count = 0;
    setProducts((prev) => prev.map((p) => {
      const ok = applyTo === "all" || (applyTo === "new" && !p.existingId) || (applyTo === "selected" && p.selected);
      if (!ok) return p;
      count++;
      return { ...p, price: String(calcSalePrice(p.cost, pct, mode)) };
    }));
    toast({ title: "Preços calculados", description: `Preço de venda recalculado para ${count} item(ns).` });
  };

  const totals = useMemo(() => {
    const sel = products.filter((p) => p.selected);
    const cost = sel.reduce((s, p) => s + p.cost * p.quantity, 0);
    const sale = sel.reduce((s, p) => s + (Number(p.price) || 0) * p.quantity, 0);
    return { count: sel.length, cost, sale, margin: calcMargin(cost, sale) };
  }, [products]);

  const handleImport = async () => {
    const selected = products.filter((p) => p.selected);
    if (selected.length === 0) {
      toast({ title: "Nenhum produto selecionado", variant: "destructive" });
      return;
    }
    const invalid = selected.find((p) => !(Number(p.price) > 0));
    if (invalid) {
      toast({ title: "Preço de venda obrigatório", description: `Informe o preço de venda de "${invalid.name}".`, variant: "destructive" });
      return;
    }
    setLoading(true);
    let importedCount = 0;
    let updatedCount = 0;
    const rejectedDetails: any[] = [];
    const newItems = selected.filter((p) => !p.existingId);
    const existingItems = selected.filter((p) => p.existingId);

    if (newItems.length) {
      const { error } = await supabase.from("products").insert(newItems.map((p) => ({
        name: p.name,
        sku: p.sku || generateProductBarcode(),
        price: round2(Number(p.price)),
        cost: p.cost,
        unit: p.unit,
        stock: p.quantity,
        min_stock: 0,
        category: "",
        ncm: p.ncm || null,
        user_id: user!.id,
      })));
      if (!error) importedCount = newItems.length;
      else rejectedDetails.push({ error: "Erro ao inserir novos itens", message: error.message });
    }

    for (const p of existingItems) {
      const { error } = await supabase.from("products").update({
        stock: (p.existingStock || 0) + p.quantity,
        cost: p.cost,
        price: round2(Number(p.price)),
      }).eq("id", p.existingId!);
      if (!error) updatedCount++;
      else rejectedDetails.push({ product: p.name, error: "Erro ao atualizar", message: error.message });
    }

    await supabase.from("xml_import_logs").insert({
      owner_id: user!.id,
      user_id: user!.id,
      filename: fileRef.current?.files?.[0]?.name || "unknown.xml",
      total_items: selected.length,
      imported_items: importedCount,
      rejected_items: existingItems.length - updatedCount,
      details: { updated: updatedCount, new: importedCount, rejected: rejectedDetails },
    });

    setLoading(false);
    toast({
      title: rejectedDetails.length ? "Importação concluída com erros" : "Importação concluída",
      description: `${importedCount} novos, ${updatedCount} atualizados (estoque somado, custo e preço de venda gravados).`,
      variant: rejectedDetails.length ? "destructive" : undefined,
    });
    setProducts([]);
    setOpen(false);
    if (fileRef.current) fileRef.current.value = "";
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setProducts([]); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileUp className="h-4 w-4 mr-2" />Importar XML</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl w-[calc(100vw-1rem)] max-h-[92vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Importar Produtos via XML (NF-e)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="space-y-1.5">
            <Label>Arquivo XML da Nota Fiscal</Label>
            <Input ref={fileRef} type="file" accept=".xml" onChange={handleFile} />
          </div>

          {reading && <p className="text-sm text-muted-foreground">Conferindo produtos com o estoque...</p>}

          {products.length > 0 && !reading && (
            <>
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium"><Calculator className="h-4 w-4" />Calculadora de precificação</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Método</Label>
                    <Select value={mode} onValueChange={(v) => setMode(v as PricingMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="markup">Markup sobre o custo</SelectItem>
                        <SelectItem value="margin">Margem sobre a venda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Percentual (%)</Label>
                    <Input type="number" min="0" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Aplicar em</Label>
                    <Select value={applyTo} onValueChange={(v) => setApplyTo(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os itens</SelectItem>
                        <SelectItem value="new">Somente novos</SelectItem>
                        <SelectItem value="selected">Somente selecionados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={applyPricing}>Aplicar</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === "markup" ? "Venda = custo × (1 + %)." : "Venda = custo ÷ (1 − %)."} Exemplo com custo R$ 10,00: {fmt(calcSalePrice(10, Number(percent) || 0, mode))}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                {totals.count} de {products.length} selecionados · Custo {fmt(totals.cost)} · Venda {fmt(totals.sale)}
                {totals.margin !== null && ` · Margem ${totals.margin.toFixed(1)}%`}
              </p>

              <div className="overflow-auto flex-1 border rounded-md min-h-0">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr className="border-b">
                      <th className="px-2 py-2 w-8">
                        <input type="checkbox" aria-label="Selecionar todos" checked={products.every((p) => p.selected)}
                          onChange={(e) => setProducts((prev) => prev.map((p) => ({ ...p, selected: e.target.checked })))} />
                      </th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground">Custo (NF-e)</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground">Venda atual</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground">Preço de venda</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((p, i) => {
                      const margin = calcMargin(p.cost, Number(p.price) || 0);
                      return (
                        <tr key={i} className={p.selected ? "" : "opacity-50"}>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={p.selected} onChange={() => update(i, { selected: !p.selected })} />
                          </td>
                          <td className="px-2 py-2">
                            <div className="font-medium truncate max-w-[260px]" title={p.name}>{p.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Badge variant={p.existingId ? "secondary" : "default"} className="text-[10px] px-1.5 py-0">{p.existingId ? "Existente" : "Novo"}</Badge>
                              {p.sku || "Sem código"} · {p.unit}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {p.quantity}
                            {p.existingId && <div className="text-xs text-muted-foreground">estoque → {p.existingStock + p.quantity}</div>}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{fmt(p.cost)}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{p.currentPrice !== null ? fmt(p.currentPrice) : "—"}</td>
                          <td className="px-2 py-2 text-right">
                            <Input type="number" min="0" step="0.01" value={p.price} aria-label={`Preço de venda de ${p.name}`}
                              onChange={(e) => update(i, { price: e.target.value })} className="h-8 w-28 ml-auto text-right tabular-nums" />
                          </td>
                          <td className={`px-2 py-2 text-right tabular-nums ${margin !== null && margin < 0 ? "text-destructive" : ""}`}>
                            {margin !== null ? `${margin.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleImport} disabled={loading} className="w-full">
                {loading ? "Importando..." : `Importar ${totals.count} produto(s)`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
