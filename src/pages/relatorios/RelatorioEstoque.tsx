import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useReportData } from "@/hooks/reports/useReportData";
import { ReportDefinition } from "@/lib/reportExport";
import {
  CHART_COLORS,
  ChartEmpty,
  ReportActions,
  ReportPageShell,
  ReportSection,
  SelectFilter,
  commonMeta,
  fmt,
} from "./shared";
import { buildFilterLines } from "@/lib/reportPeriod";

const RelatorioEstoque = () => {
  const { data, company, sellerName, loading } = useReportData(["products"]);
  const products = data.products;
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState("");
  const chartRef = useRef<HTMLDivElement>(null);

  const categorias = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products]
  );

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (categoria && p.category !== categoria) return false;
        if (situacao === "falta" && Number(p.stock) > 0) return false;
        if (situacao === "baixo" && !(Number(p.stock) > 0 && Number(p.stock) <= Number(p.min_stock))) return false;
        if (situacao === "ok" && Number(p.stock) <= Number(p.min_stock)) return false;
        return true;
      }),
    [products, categoria, situacao]
  );

  const valorVenda = filtered.reduce((s, p) => s + Number(p.stock) * Number(p.price), 0);
  const valorCusto = filtered.reduce((s, p) => s + Number(p.stock) * Number(p.cost || 0), 0);
  const emFalta = filtered.filter((p) => Number(p.stock) <= 0).length;
  const baixo = filtered.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.min_stock)).length;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((p) => {
      const k = p.category || "Sem categoria";
      map.set(k, (map.get(k) || 0) + Number(p.stock) * Number(p.price));
    });
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [filtered]);

  const def = (): ReportDefinition<any> => ({
    ...commonMeta(
      company,
      sellerName,
      "Relatório de Estoque",
      "relatorio_estoque",
      `${filtered.length} produtos`,
      buildFilterLines({ Categoria: categoria, Situação: situacao })
    ),
    columns: [
      { header: "Produto", value: (r) => r.name, width: 32 },
      { header: "SKU", value: (r) => r.sku || "—" },
      { header: "Categoria", value: (r) => r.category || "—" },
      { header: "Estoque", value: (r) => Number(r.stock) },
      { header: "Mínimo", value: (r) => Number(r.min_stock) },
      { header: "Custo", value: (r) => Number(r.cost || 0), currency: true },
      { header: "Preço", value: (r) => Number(r.price), currency: true },
      { header: "Total venda", value: (r) => Number(r.stock) * Number(r.price), currency: true },
    ],
    rows: filtered,
    summary: [
      ["Produtos", filtered.length],
      ["Valor de custo", valorCusto],
      ["Valor de venda", valorVenda],
    ],
  });

  return (
    <ReportPageShell
      title="Estoque"
      description="Quantidades, valores e itens em falta"
      loading={loading}
      actions={
        <ReportActions
          def={def}
          company={company}
          sellerName={sellerName}
          orientation="landscape"
          chartRefs={() => [chartRef.current]}
        />
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <SelectFilter
            label="Categoria"
            value={categoria}
            onChange={setCategoria}
            options={categorias.map((c) => ({ value: c, label: c }))}
          />
          <SelectFilter
            label="Situação"
            value={situacao}
            onChange={setSituacao}
            options={[
              { value: "falta", label: "Em falta" },
              { value: "baixo", label: "Estoque baixo" },
              { value: "ok", label: "Estoque normal" },
            ]}
          />
        </div>
      }
      kpis={[
        { label: "Produtos", value: String(filtered.length) },
        { label: "Valor de venda", value: fmt(valorVenda), tone: "success" },
        { label: "Valor de custo", value: fmt(valorCusto), tone: "primary" },
        { label: "Em falta / baixo", value: `${emFalta} / ${baixo}`, tone: "destructive" },
      ]}
    >
      <ReportSection title="Valor em estoque por categoria">
        <div ref={chartRef}>
          {byCategory.length ? (
            <ResponsiveContainer width="100%" height={Math.max(240, byCategory.length * 32)}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty text="Sem produtos" />
          )}
        </div>
      </ReportSection>

      <ReportSection title={`Produtos (${filtered.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Nenhum produto
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 300).map((p) => {
                  const falta = Number(p.stock) <= 0;
                  const low = !falta && Number(p.stock) <= Number(p.min_stock);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category || "—"}</TableCell>
                      <TableCell className="text-right">{Number(p.stock)}</TableCell>
                      <TableCell className="text-right">{fmt(Number(p.price))}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(p.stock) * Number(p.price))}</TableCell>
                      <TableCell>
                        <Badge variant={falta ? "destructive" : low ? "secondary" : "outline"}>
                          {falta ? "Em falta" : low ? "Baixo" : "Normal"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filtered.length > 300 && (
            <p className="text-xs text-muted-foreground mt-2">Mostrando 300 produtos. Exporte para ver a lista completa.</p>
          )}
        </div>
      </ReportSection>
    </ReportPageShell>
  );
};

export default RelatorioEstoque;
