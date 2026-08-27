import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileSpreadsheet, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { generateProductBarcode } from "@/lib/barcodeGenerator";
import * as XLSX from "xlsx";

interface ParsedProduct {
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  supplier_name: string;
  supplier_id: string | null;
  ncm: string;
  manufacturer: string;
  selected: boolean;
}

const TEMPLATE_HEADERS = ["Nome", "SKU / Código de Barras", "Categoria", "Preço Venda", "Custo", "Estoque Atual", "Estoque Mínimo", "Unidade", "Fornecedor", "NCM", "Fabricante"];

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet(
    [{
      "Nome": "Produto Exemplo",
      "SKU / Código de Barras": "",
      "Categoria": "Geral",
      "Preço Venda": 12.9,
      "Custo": 8.5,
      "Estoque Atual": 10,
      "Estoque Mínimo": 2,
      "Unidade": "un",
      "Fornecedor": "",
      "NCM": "",
      "Fabricante": "",
    }],
    { header: TEMPLATE_HEADERS }
  );
  ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "modelo-importacao-produtos.xlsx");
}

interface ExcelProductImportProps {
  onImported: () => void;
}


const HEADER_KEYS: Record<string, keyof ParsedProduct> = {
  nome: "name",
  name: "name",
  sku: "sku",
  "sku / código de barras": "sku",
  "codigo de barras": "sku",
  categoria: "category",
  category: "category",
  "preço venda": "price",
  "preco venda": "price",
  preco: "price",
  price: "price",
  custo: "cost",
  cost: "cost",
  "estoque atual": "stock",
  estoque: "stock",
  stock: "stock",
  "estoque mínimo": "min_stock",
  "estoque minimo": "min_stock",
  "min_stock": "min_stock",
  unidade: "unit",
  unit: "unit",
  fornecedor: "supplier_name",
  supplier: "supplier_name",
  ncm: "ncm",
  fabricante: "manufacturer",
  manufacturer: "manufacturer",
  marca: "manufacturer",
};

function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function ExcelProductImport({ onImported }: ExcelProductImportProps) {
  const { effectiveUserId } = useUserRole();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [mergedCount, setMergedCount] = useState(0);
  const [errors, setErrors] = useState<{ product: string; message: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseSheet = (data: Uint8Array) => {
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

    const parsed: ParsedProduct[] = rows
      .map((row) => {
        const obj: Record<string, any> = {};
        for (const k of Object.keys(row)) {
          const key = HEADER_KEYS[k.trim().toLowerCase()];
          if (key) obj[key] = row[k];
        }
        const name = String(obj.name ?? "").trim();
        if (!name) return null;
        const ncm = String(obj.ncm ?? "").replace(/\D/g, "").slice(0, 8);
        return {
          name,
          sku: String(obj.sku ?? "").trim(),
          category: String(obj.category ?? "").trim(),
          price: num(obj.price),
          cost: num(obj.cost),
          stock: Math.round(num(obj.stock)),
          min_stock: Math.round(num(obj.min_stock)),
          unit: String(obj.unit ?? "").trim().toLowerCase() || "un",
          supplier_name: String(obj.supplier_name ?? "").trim(),
          supplier_id: null,
          ncm,
          manufacturer: String(obj.manufacturer ?? "").trim(),
          selected: true,
        } as ParsedProduct;
      })
      .filter((p): p is ParsedProduct => p !== null);

    // Consolida linhas repetidas dentro da própria planilha (mesmo SKU ou mesmo nome)
    const map = new Map<string, ParsedProduct>();
    let merged = 0;
    for (const p of parsed) {
      const key = p.sku ? `sku:${p.sku}` : `name:${p.name.toLowerCase()}`;
      const prev = map.get(key);
      if (prev) {
        merged++;
        prev.stock += p.stock;
        prev.min_stock = Math.max(prev.min_stock, p.min_stock);
        if (p.price) prev.price = p.price;
        if (p.cost) prev.cost = p.cost;
        if (p.category) prev.category = p.category;
        if (p.manufacturer) prev.manufacturer = p.manufacturer;
        if (p.supplier_name) prev.supplier_name = p.supplier_name;
        if (p.ncm) prev.ncm = p.ncm;
      } else {
        map.set(key, { ...p });
      }
    }

    // Segunda passada: nomes repetidos com SKUs diferentes também violam a unicidade por nome
    const byName = new Map<string, ParsedProduct>();
    for (const p of map.values()) {
      const key = p.name.toLowerCase();
      const prev = byName.get(key);
      if (prev) {
        merged++;
        prev.stock += p.stock;
        prev.min_stock = Math.max(prev.min_stock, p.min_stock);
        if (p.price) prev.price = p.price;
        if (p.cost) prev.cost = p.cost;
      } else {
        byName.set(key, p);
      }
    }

    return { products: Array.from(byName.values()), merged };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast({ title: "Formato inválido", description: "Selecione um arquivo .xlsx ou .xls.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      try {
        const { products: parsed, merged } = parseSheet(data);
        if (parsed.length === 0) {
          toast({ title: "Nenhum produto encontrado", description: "Verifique se a planilha tem a coluna 'Nome' preenchida.", variant: "destructive" });
        } else if (merged > 0) {
          toast({ title: "Linhas unificadas", description: `${merged} linha(s) repetida(s) na planilha foram unificadas (estoque somado).` });
        }
        setMergedCount(merged);
        setProducts(parsed);
      } catch (err) {
        toast({ title: "Erro ao ler planilha", description: "Arquivo inválido ou corrompido.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleProduct = (idx: number) => {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)));
  };

  const handleImport = async () => {
    const selected = products.filter((p) => p.selected);
    if (selected.length === 0) {
      toast({ title: "Nenhum produto selecionado", variant: "destructive" });
      return;
    }
    if (!effectiveUserId) {
      toast({ title: "Erro", description: "Usuário não identificado.", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Resolve supplier names -> ids
    const supplierNames = Array.from(new Set(selected.map((p) => p.supplier_name).filter(Boolean)));
    const supplierMap: Record<string, string> = {};
    if (supplierNames.length > 0) {
      const { data: supData } = await supabase.from("suppliers").select("id, name").eq("user_id", effectiveUserId);
      (supData || []).forEach((s: any) => {
        supplierMap[s.name.trim().toLowerCase()] = s.id;
      });
    }

    const withSupplier = selected.map((p) => ({
      ...p,
      supplier_id: p.supplier_name ? supplierMap[p.supplier_name.trim().toLowerCase()] || null : null,
    }));

    // Duplicidade em blocos usando filtros nativos (evita quebra por vírgulas/parênteses nos nomes)
    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const names = withSupplier.map((p) => p.name);
    const skus = withSupplier.map((p) => p.sku).filter((s) => s !== "");

    const existingMap = new Map<string, any>();
    for (const part of chunk(names, 100)) {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, stock")
        .eq("user_id", effectiveUserId)
        .in("name", part);
      (data || []).forEach((r) => existingMap.set(r.id, r));
    }
    for (const part of chunk(skus, 100)) {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku, stock")
        .eq("user_id", effectiveUserId)
        .in("sku", part);
      (data || []).forEach((r) => existingMap.set(r.id, r));
    }
    const existing = Array.from(existingMap.values());
    const existingSkus = new Set(existing.map((e) => e.sku).filter(Boolean));


    const duplicates = withSupplier.filter((p) =>
      existing.some((e) => e.name === p.name || (p.sku && e.sku === p.sku))
    );
    const newItems = withSupplier.filter(
      (p) => !existing.some((e) => e.name === p.name || (p.sku && e.sku === p.sku))
    );

    let importedCount = 0;
    let updatedCount = 0;
    const rejectedDetails: { product: string; message: string }[] = [];

    // 1. Insert new items — em lotes, com fallback item a item
    if (newItems.length > 0) {
      const usedSkus = new Set(existingSkus);
      newItems.forEach((p) => p.sku && usedSkus.add(p.sku));
      const nextSku = () => {
        let code = generateProductBarcode();
        let guard = 0;
        while (usedSkus.has(code) && guard < 20) {
          code = generateProductBarcode();
          guard++;
        }
        usedSkus.add(code);
        return code;
      };
      const skuCache = new Map<string, string>();
      const skuFor = (p: { name: string; sku: string }) => {
        if (p.sku) return p.sku;
        const cached = skuCache.get(p.name);
        if (cached) return cached;
        const code = nextSku();
        skuCache.set(p.name, code);
        return code;
      };

      const toPayload = (p: typeof newItems[number]) => ({
        name: p.name,
        sku: skuFor(p),
        price: p.price,
        cost: p.cost,
        unit: p.unit,
        stock: p.stock,
        min_stock: p.min_stock,
        category: p.category,
        supplier_id: p.supplier_id,
        ncm: p.ncm || null,
        manufacturer: p.manufacturer,
        user_id: effectiveUserId,
      });

      for (const batch of chunk(newItems, 50)) {
        const { error } = await supabase.from("products").insert(batch.map(toPayload));
        if (!error) {
          importedCount += batch.length;
          continue;
        }
        // Um item ruim derruba o lote inteiro: tenta um por um
        for (const item of batch) {
          const { error: singleError } = await supabase.from("products").insert(toPayload(item));
          if (!singleError) importedCount++;
          else rejectedDetails.push({ product: item.name, message: singleError.message });
        }
      }
    }


    // 2. Update existing items (sum stock, update cost)
    for (const dup of duplicates) {
      const dbItem = existing.find((e) => e.name === dup.name || (dup.sku && e.sku === dup.sku));
      if (dbItem) {
        const { error } = await supabase
          .from("products")
          .update({
            stock: (dbItem.stock || 0) + dup.stock,
            cost: dup.cost || undefined,
          })
          .eq("id", dbItem.id);
        if (!error) updatedCount++;
        else rejectedDetails.push({ product: dup.name, message: `Erro ao atualizar estoque: ${error.message}` });
      }
    }

    // 3. Log
    await supabase.from("xml_import_logs").insert({
      owner_id: effectiveUserId,
      user_id: effectiveUserId,
      filename: fileRef.current?.files?.[0]?.name || "importacao.xlsx",
      total_items: selected.length,
      imported_items: importedCount,
      rejected_items: rejectedDetails.length,
      details: { updated: updatedCount, new: importedCount, rejected: rejectedDetails },
    });

    setLoading(false);
    setErrors(rejectedDetails);
    toast({
      title: rejectedDetails.length > 0 ? "Importação concluída com falhas" : "Importação concluída",
      description: `${importedCount} novos, ${updatedCount} atualizados, ${rejectedDetails.length} rejeitados.`,
      variant: rejectedDetails.length > 0 ? "destructive" : undefined,
    });

    onImported();

    if (rejectedDetails.length === 0) {
      setProducts([]);
      setMergedCount(0);
      setOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setProducts([]); setErrors([]); setMergedCount(0); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileSpreadsheet className="h-4 w-4 mr-2" />Importar Excel</Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Produtos via Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-1.5">
            <Label>Arquivo Excel (.xlsx)</Label>
            <Input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} />
            <p className="text-xs text-muted-foreground">
              Colunas: Nome (obrigatório), SKU, Categoria, Preço Venda, Custo, Estoque Atual, Estoque Mínimo, Unidade, Fornecedor, NCM, Fabricante.
              Baixe o <button type="button" className="text-primary underline" onClick={downloadTemplate}>modelo</button>.
            </p>

          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 max-h-40 overflow-auto space-y-1">
              <p className="text-sm font-medium text-destructive">{errors.length} produto(s) não importado(s)</p>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{e.product}</span>: {e.message}
                </p>
              ))}
            </div>
          )}

          {products.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {products.filter((p) => p.selected).length} de {products.length} produtos selecionados
                {mergedCount > 0 && ` · ${mergedCount} linha(s) repetida(s) unificada(s)`}
              </p>
              <div className="overflow-auto flex-1 border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 w-10"></th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Produto</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Custo</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Preço</th>
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
                        <td className="px-3 py-2 text-right tabular-nums">{p.stock}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.cost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.price)}</td>
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
