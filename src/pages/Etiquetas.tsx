import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tags, Search, Printer, Barcode as BarcodeIcon } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { BarcodeSvg, buildBarcodeSvgMarkup } from "@/components/BarcodeLabel";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  category: string;
  stock: number;
}

type LayoutType = "a4" | "thermal";
type PrintMode = "screen" | "direct";

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Etiquetas = () => {
  const { effectiveUserId } = useUserRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [layout, setLayout] = useState<LayoutType>("a4");
  const [printMode, setPrintMode] = useState<PrintMode>("screen");
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      const [{ data: prods, error }, { data: company }] = await Promise.all([
        supabase.from("products").select("id,name,sku,price,category,stock").order("name"),
        supabase
          .from("company_registrations")
          .select("name")
          .eq("user_id", effectiveUserId)
          .maybeSingle(),
      ]);
      if (error) toast.error("Erro ao carregar produtos: " + error.message);
      setProducts((prods || []) as Product[]);
      setCompanyName(company?.name || "");
      setLoading(false);
    };
    load();
  }, [effectiveUserId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const selectedIds = Object.keys(quantities).filter((id) => (quantities[id] ?? 0) > 0);
  const totalLabels = selectedIds.reduce((s, id) => s + (quantities[id] || 0), 0);

  const toggle = (id: string, checked: boolean) =>
    setQuantities((prev) => {
      const next = { ...prev };
      if (checked) next[id] = prev[id] && prev[id] > 0 ? prev[id] : 1;
      else delete next[id];
      return next;
    });

  const setQty = (id: string, value: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, Math.min(200, Math.round(value || 1))) }));

  const selectAllVisible = () => {
    const next = { ...quantities };
    filtered.forEach((p) => {
      if (!next[p.id]) next[p.id] = 1;
    });
    setQuantities(next);
  };

  const clearSelection = () => setQuantities({});

  const labelList = useMemo(() => {
    const list: Product[] = [];
    products.forEach((p) => {
      const qty = quantities[p.id] || 0;
      for (let i = 0; i < qty; i++) list.push(p);
    });
    return list;
  }, [products, quantities]);

  const handlePrint = () => {
    if (labelList.length === 0) {
      toast.error("Selecione ao menos um produto");
      return;
    }
    const missing = labelList.filter((p) => !p.sku);
    if (missing.length > 0) {
      toast.error("Alguns produtos não possuem código de barras cadastrado");
      return;
    }

    const isThermal = layout === "thermal";
    const labelsHtml = labelList
      .map((p) => {
        const svg = buildBarcodeSvgMarkup(p.sku, {
          height: isThermal ? 45 : 38,
          width: isThermal ? 1.5 : 1.4,
          fontSize: isThermal ? 13 : 11,
        });
        return `<div class="label">
          ${showName ? `<div class="name">${p.name}</div>` : ""}
          <div class="bc">${svg}</div>
          ${showPrice ? `<div class="price">${currency(Number(p.price) || 0)}</div>` : ""}
        </div>`;
      })
      .join("");

    const css = isThermal
      ? `@page { size: 80mm auto; margin: 2mm; }
         body { width: 72mm; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; color: #000; }
         .header { text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 3mm; }
         .sheet { display: block; }
         .label { width: 72mm; text-align: center; padding: 2mm 0; border-bottom: 1px dashed #999; page-break-inside: avoid; }
         .name { font-size: 11px; font-weight: bold; margin-bottom: 1mm; word-break: break-word; }
         .price { font-size: 13px; font-weight: bold; margin-top: 1mm; }
         .bc svg { max-width: 68mm; height: auto; }`
      : `@page { size: A4; margin: 8mm; }
         body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
         .header { text-align: center; font-size: 12px; font-weight: bold; margin-bottom: 4mm; }
         .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
         .label { border: 1px solid #ccc; border-radius: 2px; padding: 2mm; text-align: center; page-break-inside: avoid; }
         .name { font-size: 9px; font-weight: bold; margin-bottom: 1mm; height: 22px; overflow: hidden; }
         .price { font-size: 11px; font-weight: bold; margin-top: 1mm; }
         .bc svg { max-width: 100%; height: auto; }`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast.error("Permita pop-ups para imprimir as etiquetas");
      return;
    }

    const toolbarCss = `
      .toolbar { position: sticky; top: 0; display: flex; gap: 8px; align-items: center; justify-content: center;
        background: #111827; color: #fff; padding: 10px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; }
      .toolbar button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 0; cursor: pointer; }
      .toolbar .primary { background: #2563eb; color: #fff; }
      .toolbar .ghost { background: transparent; color: #fff; border: 1px solid #4b5563; }
      @media print { .toolbar { display: none !important; } }`;

    const toolbarHtml =
      printMode === "screen"
        ? `<div class="toolbar">
             <span>${labelList.length} etiqueta(s) · ${isThermal ? "Térmica 80mm" : "A4"}</span>
             <button class="primary" onclick="window.print()">Escolher impressora e imprimir</button>
             <button class="ghost" onclick="window.close()">Fechar</button>
           </div>`
        : "";

    const autoPrint =
      printMode === "direct"
        ? `<script>window.onload = function(){ window.focus(); window.print(); };<\/script>`
        : "";

    win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
      <title>Etiquetas de Produtos</title><style>${css}${toolbarCss}</style></head>
      <body>
        ${toolbarHtml}
        <div class="header">${companyName || "Vortis Gestão"}</div>
        <div class="sheet">${labelsHtml}</div>
        ${autoPrint}
      </body></html>`);
    win.document.close();
    win.focus();
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tags className="h-6 w-6" />
            Etiquetas de Produtos
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize e imprima etiquetas com o código de barras dos produtos cadastrados.
          </p>
        </div>
        <Button onClick={handlePrint} className="gap-2" disabled={totalLabels === 0}>
          <Printer className="h-4 w-4" />
          Imprimir {totalLabels > 0 ? `(${totalLabels})` : ""}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Produtos</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou categoria"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                Selecionar visíveis
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Limpar seleção
              </Button>
              <Badge variant="secondary" className="self-center">
                {selectedIds.length} produto(s) · {totalLabels} etiqueta(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum produto encontrado.</p>
            )}
            {filtered.map((p) => {
              const checked = (quantities[p.id] ?? 0) > 0;
              return (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle(p.id, Boolean(v))}
                      aria-label={`Selecionar ${p.name}`}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <BarcodeIcon className="h-3 w-3" />
                        {p.sku || "sem código"} · {currency(Number(p.price) || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:w-32">
                    <Label htmlFor={`qty-${p.id}`} className="text-xs text-muted-foreground">
                      Qtd
                    </Label>
                    <Input
                      id={`qty-${p.id}`}
                      type="number"
                      min={1}
                      max={200}
                      inputMode="numeric"
                      value={quantities[p.id] ?? 1}
                      disabled={!checked}
                      onChange={(e) => setQty(p.id, Number(e.target.value))}
                      className="h-10"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Layout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Formato de impressão</Label>
                <Select value={layout} onValueChange={(v) => setLayout(v as LayoutType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 — 3 colunas por folha</SelectItem>
                    <SelectItem value="thermal">Térmica 80mm (72mm útil)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modo de impressão</Label>
                <Select value={printMode} onValueChange={(v) => setPrintMode(v as PrintMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screen">Tela de impressão (escolher impressora)</SelectItem>
                    <SelectItem value="direct">Abrir diálogo de impressão direto</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Na tela de impressão você confere as etiquetas e clica em imprimir para selecionar a impressora no
                  diálogo do navegador.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="show-name" checked={showName} onCheckedChange={(v) => setShowName(Boolean(v))} />
                <Label htmlFor="show-name">Exibir nome do produto</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="show-price" checked={showPrice} onCheckedChange={(v) => setShowPrice(Boolean(v))} />
                <Label htmlFor="show-price">Exibir preço de venda</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pré-visualização</CardTitle>
            </CardHeader>
            <CardContent>
              {labelList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Selecione produtos para visualizar as etiquetas.
                </p>
              ) : (
                <div
                  className={
                    layout === "thermal"
                      ? "space-y-2 max-h-[420px] overflow-y-auto"
                      : "grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto"
                  }
                >
                  {labelList.slice(0, 24).map((p, i) => (
                    <motion.div
                      key={`${p.id}-${i}`}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-md border bg-white p-2 text-center text-black"
                    >
                      {showName && (
                        <p className="text-[10px] font-semibold leading-tight line-clamp-2">{p.name}</p>
                      )}
                      {p.sku ? (
                        <BarcodeSvg value={p.sku} height={34} width={1.3} fontSize={10} className="mx-auto max-w-full" />
                      ) : (
                        <p className="text-[10px] text-red-600">sem código</p>
                      )}
                      {showPrice && (
                        <p className="text-[11px] font-bold">{currency(Number(p.price) || 0)}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
              {labelList.length > 24 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Mostrando 24 de {labelList.length} etiquetas na pré-visualização.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Etiquetas;
