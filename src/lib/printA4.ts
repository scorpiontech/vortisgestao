/**
 * Utility to open a new window with A4-formatted print content.
 * Includes Vortis Gestão header with logo, dados do emitente, filtros
 * aplicados, gráficos opcionais e rodapé com numeração de páginas.
 */

export interface PrintCompanyInfo {
  name?: string;
  document?: string;
  address?: string;
  phone?: string;
}

interface PrintA4Options {
  title: string;
  subtitle?: string;
  content: string;
  orientation?: "portrait" | "landscape";
  sellerName?: string;
  company?: PrintCompanyInfo | null;
  /** Lista de filtros aplicados, exibida abaixo do título */
  filters?: string[];
  /** Imagens de gráficos (data URLs) inseridas antes do conteúdo */
  charts?: (string | null)[];
}

export function printA4({
  title,
  subtitle,
  content,
  orientation = "portrait",
  sellerName,
  company,
  filters,
  charts,
}: PrintA4Options) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const logoUrl = `${window.location.origin}/logo-transparente.png`;

  const companyLines = [
    company?.document ? `CNPJ/CPF: ${company.document}` : "",
    company?.address || "",
    company?.phone ? `Tel: ${company.phone}` : "",
  ].filter(Boolean);

  const chartsHtml = (charts || [])
    .filter(Boolean)
    .map((src) => `<div class="chart-block"><img src="${src}" alt="Gráfico" /></div>`)
    .join("");

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title} - Vortis Gestão</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 15mm 18mm 22mm 18mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Header */
    .print-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #1a6fb5;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .print-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .print-header-left img {
      height: 42px;
    }
    .print-header-left .brand {
      font-size: 18px;
      font-weight: 700;
      color: #0f2b46;
      letter-spacing: -0.3px;
    }
    .print-header-left .brand-sub {
      font-size: 10px;
      color: #1a6fb5;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .print-header-left .company-name {
      font-size: 12px;
      font-weight: 700;
      color: #0f2b46;
      margin-top: 3px;
    }
    .print-header-left .company-line {
      font-size: 9px;
      color: #666;
    }
    .print-header-right {
      text-align: right;
      font-size: 10px;
      color: #666;
      white-space: nowrap;
    }

    /* Title block */
    .print-title {
      text-align: center;
      margin-bottom: 12px;
    }
    .print-title h1 {
      font-size: 16px;
      font-weight: 700;
      color: #0f2b46;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .print-title p {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }

    .print-filters {
      border: 1px solid #d9e2ec;
      background: #f7fafc;
      border-radius: 5px;
      padding: 6px 10px;
      margin-bottom: 14px;
      font-size: 10px;
      color: #444;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
    }
    .print-filters strong { color: #0f2b46; }

    /* Charts */
    .chart-block {
      text-align: center;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .chart-block img {
      max-width: 100%;
      max-height: 70mm;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    table th {
      background: #f0f4f8;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #d0d8e0;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #333;
    }
    table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      font-size: 11px;
    }
    table tr:nth-child(even) {
      background: #fafbfc;
    }

    /* Section */
    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f2b46;
      border-bottom: 1px solid #d0d8e0;
      padding-bottom: 4px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Info grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
    }
    .info-row {
      display: flex;
      gap: 6px;
    }
    .info-label {
      font-weight: 600;
      color: #555;
      min-width: 90px;
      font-size: 10px;
      text-transform: uppercase;
    }
    .info-value {
      color: #1a1a2e;
    }

    /* Footer */
    .print-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #999;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      padding-bottom: 2px;
    }
    .page-counter:after {
      content: "Página " counter(page) " de " counter(pages);
    }

    /* Highlight box */
    .highlight-box {
      background: #f0f7ff;
      border: 1px solid #b3d4f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }

    /* Summary row */
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
    }
    .summary-row.total {
      font-weight: 700;
      font-size: 13px;
      border-top: 2px solid #0f2b46;
      margin-top: 4px;
      padding-top: 6px;
    }

    @media screen {
      body { padding: 20px; max-width: 210mm; margin: 0 auto; }
      .print-footer { position: static; margin-top: 20px; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="print-header-left">
      <img src="${logoUrl}" alt="Vortis Gestão" />
      <div>
        <div class="brand">Vortis</div>
        <div class="brand-sub">Gestão</div>
        ${company?.name ? `<div class="company-name">${company.name}</div>` : ""}
        ${companyLines.map((l) => `<div class="company-line">${l}</div>`).join("")}
      </div>
    </div>
    <div class="print-header-right">
      ${sellerName ? `<div style="margin-bottom:2px"><strong>Emitido por:</strong> ${sellerName}</div>` : ""}
      Emitido em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </div>
  </div>

  <div class="print-title">
    <h1>${title}</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ""}
  </div>

  ${
    filters && filters.length
      ? `<div class="print-filters"><strong>Filtros aplicados:</strong> ${filters
          .map((f) => `<span>${f}</span>`)
          .join("")}</div>`
      : ""
  }

  ${chartsHtml}

  ${content}

  <div class="print-footer">
    <span>Vortis Gestão © ${new Date().getFullYear()} — Documento gerado automaticamente</span>
    <span class="page-counter"></span>
  </div>
</body>
</html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
