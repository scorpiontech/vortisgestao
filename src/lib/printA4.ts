/**
 * Utility to open a new window with A4-formatted print content.
 * Includes Vortis Gestão header with logo and footer.
 */

interface PrintA4Options {
  title: string;
  subtitle?: string;
  content: string;
  orientation?: "portrait" | "landscape";
  sellerName?: string;
}

export function printA4({ title, subtitle, content, orientation = "portrait", sellerName }: PrintA4Options) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const logoUrl = `${window.location.origin}/logo-transparente.png`;

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${title} - Vortis Gestão</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 15mm 18mm 20mm 18mm;
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
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #1a6fb5;
      padding-bottom: 12px;
      margin-bottom: 20px;
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
    .print-header-right {
      text-align: right;
      font-size: 10px;
      color: #666;
    }

    /* Title block */
    .print-title {
      text-align: center;
      margin-bottom: 18px;
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

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
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
      text-align: center;
      font-size: 9px;
      color: #999;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      padding-bottom: 2px;
    }

    /* Highlight box */
    .highlight-box {
      background: #f0f7ff;
      border: 1px solid #b3d4f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
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

  ${content}

  <div class="print-footer">
    Vortis Gestão © ${new Date().getFullYear()} — Documento gerado automaticamente
  </div>
</body>
</html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
