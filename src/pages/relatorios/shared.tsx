import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileSpreadsheet, FileText, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintCompanyInfo, printA4 } from "@/lib/printA4";
import { chartToDataUrl } from "@/lib/chartCapture";
import {
  ReportColumn,
  ReportDefinition,
  buildReportTableHtml,
  exportReportCsv,
  exportReportXlsx,
} from "@/lib/reportExport";
import { PERIOD_PRESETS, PeriodPresetKey, resolvePeriodPreset } from "@/lib/reportPeriod";

export const CHART_COLORS = [
  "hsl(215, 80%, 50%)",
  "hsl(152, 60%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 60%, 50%)",
];

export const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (v: number) => `${(v || 0).toFixed(1)}%`;
export const today = () => new Date().toISOString().slice(0, 10);

export interface PeriodState {
  from: string;
  to: string;
}

export const emptyPeriod: PeriodState = { from: "", to: "" };

export const inPeriod = (value: string | null | undefined, period: PeriodState) => {
  const d = value?.slice(0, 10);
  if (!d) return false;
  if (period.from && d < period.from) return false;
  if (period.to && d > period.to) return false;
  return true;
};

export const PeriodFilter = ({
  period,
  setPeriod,
  extra,
  onClearExtra,
}: {
  period: PeriodState;
  setPeriod: (p: PeriodState) => void;
  extra?: ReactNode;
  onClearExtra?: () => void;
}) => (
  <div className="space-y-2">
    <div className="flex flex-wrap gap-1.5">
      {PERIOD_PRESETS.map((p) => {
        const range = resolvePeriodPreset(p.key as PeriodPresetKey);
        const active = range.from === period.from && range.to === period.to;
        return (
          <Button
            key={p.key}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setPeriod(range)}
          >
            {p.label}
          </Button>
        );
      })}
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="text-xs">De</Label>
        <Input
          type="date"
          value={period.from}
          onChange={(e) => setPeriod({ ...period, from: e.target.value })}
          className="w-36 h-8 text-xs"
        />
      </div>
      <div>
        <Label className="text-xs">Até</Label>
        <Input
          type="date"
          value={period.to}
          onChange={(e) => setPeriod({ ...period, to: e.target.value })}
          className="w-36 h-8 text-xs"
        />
      </div>
      {extra}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={() => {
          setPeriod(emptyPeriod);
          onClearExtra?.();
        }}
      >
        <X className="h-3.5 w-3.5 mr-1" />Limpar filtros
      </Button>
    </div>
  </div>
);

export const SelectFilter = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <select
      className="h-8 text-xs border rounded px-2 bg-background block w-full min-w-[130px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Todos</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

export interface Kpi {
  label: string;
  value: string;
  tone?: "default" | "success" | "destructive" | "primary";
}

export const ReportKpis = ({ items }: { items: Kpi[] }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    {items.map((k, i) => (
      <motion.div
        key={k.label}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        className="bg-card border rounded-lg p-4 shadow-card"
      >
        <p className="text-xs text-muted-foreground">{k.label}</p>
        <p
          className={`text-lg font-bold mt-1 ${
            k.tone === "success"
              ? "text-success"
              : k.tone === "destructive"
              ? "text-destructive"
              : k.tone === "primary"
              ? "text-primary"
              : ""
          }`}
        >
          {k.value}
        </p>
      </motion.div>
    ))}
  </div>
);

export const ReportSection = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="bg-card border rounded-lg shadow-card p-5">
    {title && <h2 className="font-semibold mb-3">{title}</h2>}
    {children}
  </div>
);

export const ChartEmpty = ({ text = "Sem dados no período" }: { text?: string }) => (
  <p className="text-sm text-muted-foreground text-center py-16">{text}</p>
);

export const printReport = async (
  def: ReportDefinition<any>,
  company: PrintCompanyInfo | null,
  sellerName: string,
  opts?: { orientation?: "portrait" | "landscape"; chartRefs?: (HTMLElement | null)[] }
) => {
  const charts = opts?.chartRefs ? await Promise.all(opts.chartRefs.map((r) => chartToDataUrl(r))) : [];
  const summaryHtml = def.summary?.length
    ? `<div class="highlight-box">${def.summary
        .map(
          ([label, value], i) =>
            `<div class="summary-row${i === def.summary!.length - 1 ? " total" : ""}"><span>${label}:</span><span>${
              typeof value === "number" ? fmt(value) : value
            }</span></div>`
        )
        .join("")}</div>`
    : "";
  printA4({
    title: def.title,
    subtitle: def.subtitle,
    sellerName,
    company,
    filters: def.filters,
    charts,
    orientation: opts?.orientation,
    content: summaryHtml + buildReportTableHtml(def.columns as ReportColumn<any>[], def.rows, fmt),
  });
};

export const ReportActions = ({
  def,
  company,
  sellerName,
  orientation,
  chartRefs,
  extra,
}: {
  def: () => ReportDefinition<any>;
  company: PrintCompanyInfo | null;
  sellerName: string;
  orientation?: "portrait" | "landscape";
  chartRefs?: () => (HTMLElement | null)[];
  extra?: ReactNode;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {extra}
    <Button variant="outline" size="sm" onClick={() => printReport(def(), company, sellerName, { orientation, chartRefs: chartRefs?.() })}>
      <Printer className="h-3.5 w-3.5 mr-1.5" />PDF
    </Button>
    <Button variant="outline" size="sm" onClick={() => exportReportXlsx(def())}>
      <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Excel
    </Button>
    <Button variant="outline" size="sm" onClick={() => exportReportCsv(def())}>
      <FileText className="h-3.5 w-3.5 mr-1.5" />CSV
    </Button>
  </div>
);

export const ReportLoading = () => (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

export const ReportPageShell = ({
  title,
  description,
  actions,
  filters,
  kpis,
  loading,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  kpis?: Kpi[];
  loading?: boolean;
  children?: ReactNode;
}) => (
  <div className="space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0">
          <Link to="/relatorios" aria-label="Voltar para relatórios">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>

    {filters && <div className="bg-card border rounded-lg p-4 shadow-card">{filters}</div>}

    {loading ? (
      <ReportLoading />
    ) : (
      <>
        {kpis && kpis.length > 0 && <ReportKpis items={kpis} />}
        {children}
      </>
    )}
  </div>
);

export const commonMeta = (
  company: PrintCompanyInfo | null,
  sellerName: string,
  title: string,
  filename: string,
  subtitle: string,
  filters: string[]
) => ({
  title,
  filename,
  subtitle,
  filters,
  companyName: company?.name,
  sellerName,
});
