/**
 * Exportação padronizada de relatórios em XLSX e CSV.
 * As colunas são definidas uma única vez e reutilizadas na impressão,
 * no Excel e no CSV.
 */
import * as XLSX from "xlsx";

export interface ReportColumn<T = any> {
  header: string;
  value: (row: T) => string | number;
  align?: "left" | "right" | "center";
  /** Formata como moeda no Excel e na impressão */
  currency?: boolean;
  width?: number;
}

export interface ReportDefinition<T = any> {
  /** Nome base do arquivo, sem extensão */
  filename: string;
  title: string;
  subtitle?: string;
  filters?: string[];
  columns: ReportColumn<T>[];
  rows: T[];
  /** Linhas de resumo: [rótulo, valor] */
  summary?: [string, string | number][];
  companyName?: string;
  sellerName?: string;
}

const CURRENCY_FMT = 'R$ #,##0.00;[Red](R$ #,##0.00);"—"';

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportReportXlsx<T>(def: ReportDefinition<T>) {
  const aoa: (string | number)[][] = [];

  if (def.companyName) aoa.push([def.companyName]);
  aoa.push([def.title]);
  if (def.subtitle) aoa.push([def.subtitle]);
  (def.filters || []).forEach((f) => aoa.push([f]));
  if (def.sellerName) aoa.push([`Emitido por: ${def.sellerName}`]);
  aoa.push([
    `Emitido em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
  ]);
  aoa.push([]);

  const headerRowIndex = aoa.length;
  aoa.push(def.columns.map((c) => c.header));

  def.rows.forEach((row) => {
    aoa.push(def.columns.map((c) => c.value(row)));
  });

  if (def.summary?.length) {
    aoa.push([]);
    def.summary.forEach(([label, value]) => aoa.push([label, value]));
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // Larguras
  sheet["!cols"] = def.columns.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 4) }));

  // Formato de moeda e negrito no cabeçalho
  def.columns.forEach((col, colIdx) => {
    const headerCell = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIdx });
    if (sheet[headerCell]) sheet[headerCell].s = { font: { bold: true } };
    if (!col.currency) return;
    for (let r = headerRowIndex + 1; r <= headerRowIndex + def.rows.length; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: colIdx });
      const cell = sheet[ref];
      if (cell && typeof cell.v === "number") cell.z = CURRENCY_FMT;
    }
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, def.title.slice(0, 28) || "Relatório");
  XLSX.writeFile(book, `${def.filename}_${stamp()}.xlsx`);
}

export function exportReportCsv<T>(def: ReportDefinition<T>) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(esc(def.title));
  if (def.subtitle) lines.push(esc(def.subtitle));
  (def.filters || []).forEach((f) => lines.push(esc(f)));
  lines.push("");
  lines.push(def.columns.map((c) => esc(c.header)).join(";"));
  def.rows.forEach((row) => lines.push(def.columns.map((c) => esc(c.value(row))).join(";")));
  if (def.summary?.length) {
    lines.push("");
    def.summary.forEach(([label, value]) => lines.push(`${esc(label)};${esc(value)}`));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${def.filename}_${stamp()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

/** Gera o HTML de tabela usado na impressão a partir das mesmas colunas. */
export function buildReportTableHtml<T>(columns: ReportColumn<T>[], rows: T[], formatCurrency: (v: number) => string) {
  const head = columns
    .map((c) => `<th style="text-align:${c.align || (c.currency ? "right" : "left")}">${c.header}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => {
            const raw = c.value(row);
            const text = c.currency && typeof raw === "number" ? formatCurrency(raw) : String(raw ?? "—");
            return `<td style="text-align:${c.align || (c.currency ? "right" : "left")}">${text}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${
    body || `<tr><td colspan="${columns.length}" style="text-align:center">Sem dados</td></tr>`
  }</tbody></table>`;
}
