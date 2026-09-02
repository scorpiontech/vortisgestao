/**
 * Impressão em impressora térmica: papel 80 mm, área útil 72 mm.
 */

export interface ThermalLine {
  label?: string;
  value?: string;
  bold?: boolean;
  /** Linha separadora */
  divider?: boolean;
}

interface PrintThermalOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  companyInfo?: string[];
  sellerName?: string;
  lines: ThermalLine[];
}

export function printThermal({ title, subtitle, companyName, companyInfo, sellerName, lines }: PrintThermalOptions) {
  const w = window.open("", "_blank", "width=380,height=700");
  if (!w) return;

  const body = lines
    .map((l) => {
      if (l.divider) return `<div class="divider"></div>`;
      if (l.value === undefined) return `<div class="row single${l.bold ? " b" : ""}">${l.label}</div>`;
      return `<div class="row${l.bold ? " b" : ""}"><span>${l.label}</span><span>${l.value}</span></div>`;
    })
    .join("");

  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>${title}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 72mm;
    margin: 0 auto;
    padding: 3mm 0 6mm;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #000;
    line-height: 1.35;
  }
  .center { text-align: center; }
  .head { font-weight: 700; font-size: 12px; text-transform: uppercase; }
  .sub { font-size: 9px; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 4px; word-break: break-word; }
  .row.single { display: block; }
  .row.b { font-weight: 700; }
  @media screen { body { border: 1px solid #ccc; padding: 6mm 3mm; } }
</style></head>
<body>
  <div class="center">
    ${companyName ? `<div class="head">${companyName}</div>` : ""}
    ${(companyInfo || []).map((i) => `<div class="sub">${i}</div>`).join("")}
    <div class="divider"></div>
    <div class="head">${title}</div>
    ${subtitle ? `<div class="sub">${subtitle}</div>` : ""}
  </div>
  <div class="divider"></div>
  ${body}
  <div class="divider"></div>
  <div class="center sub">
    ${sellerName ? `Emitido por: ${sellerName}<br/>` : ""}
    ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    <br/>Vortis Gestão
  </div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
