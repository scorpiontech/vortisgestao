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
  selected: boolean;
}

const TEMPLATE_HEADERS = ["Nome", "SKU / Código de Barras", "Categoria", "Preço Venda", "Custo", "Estoque Atual", "Estoque Mínimo", "Unidade", "Fornecedor", "NCM"];

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
    }],
    { header: TEMPLATE_HEADERS }
  );
  ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 10 }];
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
          selected: true,
        } as ParsedProduct;
      })
      .filter((p): p is ParsedProduct => p !== null);

    return parsed;
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
        const parsed = parseSheet(data);
        if (parsed.length === 0) {
          toast({ title: "Nenhum produto encontrado", description: "Verifique se a planilha tem a coluna 'Nome' preenchida.", variant: "destructive" });
        }
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
      const { data: supData } = await supabase.from("suppliers").select("id, name");
      (supData || []).forEach((s: any) => {
        supplierMap[s.name.trim().toLowerCase()] = s.id;
      });
    }

    const withSupplier = selected.map((p) => ({
      ...p,
      supplier_id: p.supplier_name ? supplierMap[p.supplier_name.trim().toLowerCase()] || null : null,
    }));

    // Check duplicates by name and sku (same logic as XML import)
    const names = withSupplier.map((p) => p.name);
    const skus = withSupplier.map((p) => p.sku).filter((s) => s !== "");

    let existing: any[] = [];
    const filters: string[] = [];
    if (names.length > 0) filters.push(`name.in.(${names.map((n) => `"${n.replace(/"/g, "")}"`).join(",")})`);
    if (skus.length > 0) filters.push(`sku.in.(${skus.map((s) => `"${s.replace(/"/g, "")}"`).join(",")})`);

    if (filters.length > 0) {
      const { data } = await supabase.from("products").select("id, name, sku, stock").or(filters.join(","));
      existing = data || [];
    }

    const duplicates = withSupplier.filter((p) =>
      existing.some((e) => e.name === p.name || (p.sku && e.sku === p.sku))
    );
    const newItems = withSupplier.filter(
      (p) => !existing.some((e) => e.name === p.name || (p.sku && e.sku === p.sku))
    );

    let importedCount = 0;
    let updatedCount = 0;
    const rejectedDetails: any[] = [];

    // 1. Insert new items
    if (newItems.length > 0) {
      const payload = newItems.map((p) => ({
        name: p.name,
        sku: p.sku || generateProductBarcode(),
        price: p.price,
        cost: p.cost,
        unit: p.unit,
        stock: p.stock,
        min_stock: p.min_stock,
        category: p.category,
        supplier_id: p.supplier_id,
        ncm: p.ncm || null,
        user_id: effectiveUserId,
      }));
      const { error } = await supabase.from("products").insert(payload);
      if (!error) importedCount = newItems.length;
      else rejectedDetails.push({ error: "Erro ao inserir novos itens", message: error.message });
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
        else rejectedDetails.push({ product: dup.name, error: "Erro ao atualizar estoque", message: error.message });
      }
    }

    // 3. Log
    await supabase.from("xml_import_logs").insert({
      owner_id: effectiveUserId,
      user_id: effectiveUserId,
      filename: fileRef.current?.files?.[0]?.name || "importacao.xlsx",
      total_items: selected.length,
      imported_items: importedCount,
      rejected_items: duplicates.length - updatedCount,
      details: { updated: updatedCount, new: importedCount, rejected: rejectedDetails },
    });

    setLoading(false);
    toast({
      title: "Importação concluída",
      description: `${importedCount} novos, ${updatedCount} atualizados. Os existentes tiveram o estoque somado.`,
    });

    setProducts([]);
    setOpen(false);
    if (fileRef.current) fileRef.current.value = "";
    onImported();
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setProducts([]); }}>
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
              Colunas: Nome (obrigatório), SKU, Categoria, Preço Venda, Custo, Estoque Atual, Estoque Mínimo, Unidade, Fornecedor, NCM.
              Baixe o <button type="button" className="text-primary underline" onClick={downloadTemplate}>modelo</button>.
            </p>

          </div>

          {products.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {products.filter((p) => p.selected).length} de {products.length} produtos selecionados
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
