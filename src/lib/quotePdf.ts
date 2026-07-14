import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface QuotePdfItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface QuotePdfNegLog {
  at: string;
  from: string;
  to: string;
  note?: string;
  by?: string;
}

export interface QuotePdfCompany {
  name?: string;
  document?: string;
  phone?: string;
  email?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface QuotePdfData {
  id: string;
  number: string; // friendly number e.g. ORC-00001
  status: string;
  customer_name?: string | null;
  customer_document?: string | null;
  payment_method?: string | null;
  installments?: number;
  valid_until?: string | null;
  notes?: string | null;
  subtotal: number;
  discount: number;
  tax_rate?: number;       // percentage e.g. 0
  tax_amount?: number;     // computed value
  total: number;
  created_at: string;
  items: QuotePdfItem[];
  negotiation_log: QuotePdfNegLog[];
  company?: QuotePdfCompany;
  sellerName?: string;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Convertido em Venda",
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (v: number) =>
  round2(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const date = d.length === 10 ? new Date(d + "T00:00:00") : new Date(d);
  return date.toLocaleDateString("pt-BR");
};

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function generateQuotePdf(q: QuotePdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // ===== Header =====
  doc.setFillColor(15, 43, 70);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("VORTIS GESTÃO", margin, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Orçamento / Pré-venda", margin, 19);

  doc.setFontSize(8);
  doc.text(
    `Emitido em ${fmtDateTime(new Date().toISOString())}`,
    pageW - margin,
    13,
    { align: "right" }
  );
  if (q.sellerName) {
    doc.text(`Por: ${q.sellerName}`, pageW - margin, 19, { align: "right" });
  }

  y = 36;
  doc.setTextColor(15, 43, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Orçamento Nº ${q.number}`, margin, y);

  // Status badge
  const statusLabel = STATUS_LABEL[q.status] || q.status;
  const colorMap: Record<string, [number, number, number]> = {
    rascunho: [148, 163, 184],
    enviado: [59, 130, 246],
    aprovado: [16, 185, 129],
    recusado: [239, 68, 68],
    expirado: [245, 158, 11],
    convertido: [26, 111, 181],
  };
  const [r, g, b] = colorMap[q.status] || [100, 100, 100];
  doc.setFillColor(r, g, b);
  const statusW = doc.getTextWidth(statusLabel) + 8;
  doc.roundedRect(pageW - margin - statusW, y - 5, statusW, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(statusLabel.toUpperCase(), pageW - margin - statusW / 2, y, {
    align: "center",
    baseline: "middle",
  });

  y += 6;
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Emitido em ${fmtDate(q.created_at)}`, margin, y);
  if (q.valid_until) {
    doc.text(`Válido até ${fmtDate(q.valid_until)}`, pageW - margin, y, {
      align: "right",
    });
  }

  // ===== Company =====
  y += 6;
  if (q.company?.name) {
    doc.setDrawColor(208, 216, 224);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 43, 70);
    doc.text("EMITENTE", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(33, 33, 33);
    doc.text(q.company.name, margin, y);
    if (q.company.document) {
      doc.text(`Doc: ${q.company.document}`, pageW - margin, y, {
        align: "right",
      });
    }
    y += 4;
    const addr = [
      q.company.street,
      q.company.number,
      q.company.neighborhood,
      q.company.city && q.company.state
        ? `${q.company.city}/${q.company.state}`
        : q.company.city || q.company.state,
      q.company.zip_code,
    ]
      .filter(Boolean)
      .join(", ");
    if (addr) {
      doc.text(addr, margin, y);
      y += 4;
    }
    if (q.company.phone || q.company.email) {
      doc.text(
        [q.company.phone, q.company.email].filter(Boolean).join(" • "),
        margin,
        y
      );
      y += 4;
    }
  }

  // ===== Customer =====
  y += 3;
  doc.setDrawColor(208, 216, 224);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 43, 70);
  doc.text("CLIENTE", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(33, 33, 33);
  doc.text(q.customer_name || "Não informado", margin, y);
  if (q.customer_document) {
    doc.text(`Doc: ${q.customer_document}`, pageW - margin, y, {
      align: "right",
    });
  }
  y += 6;

  // ===== Items =====
  autoTable(doc, {
    startY: y,
    head: [["#", "Produto / Serviço", "Qtd", "Valor Unit.", "Total"]],
    body: q.items.map((i, idx) => [
      String(idx + 1),
      i.product_name,
      String(i.quantity),
      fmt(Number(i.unit_price)),
      fmt(Number(i.total)),
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [15, 43, 70],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 32 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ===== Totals & taxes =====
  const taxRate = q.tax_rate ?? 0;
  const taxAmount = q.tax_amount ?? 0;

  const totalsX = pageW - margin - 70;
  const valuesX = pageW - margin;
  doc.setFontSize(10);
  doc.setTextColor(33, 33, 33);
  doc.setFont("helvetica", "normal");

  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, totalsX, y);
    doc.text(value, valuesX, y, { align: "right" });
    y += 5;
  };

  row("Subtotal", fmt(Number(q.subtotal)));
  row("Desconto", `- ${fmt(Number(q.discount))}`);
  row(
    `Impostos${taxRate ? ` (${taxRate}%)` : ""}`,
    fmt(Number(taxAmount))
  );
  doc.setDrawColor(15, 43, 70);
  doc.setLineWidth(0.4);
  doc.line(totalsX, y - 3, valuesX, y - 3);
  y += 1;
  doc.setFontSize(12);
  row("TOTAL", fmt(Number(q.total)), true);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${q.payment_method || "—"}${
      q.installments && q.installments > 1 ? ` em ${q.installments}x` : ""
    }`,
    valuesX,
    y,
    { align: "right" }
  );
  y += 8;

  // ===== Notes =====
  if (q.notes) {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 43, 70);
    doc.text("OBSERVAÇÕES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(33, 33, 33);
    const lines = doc.splitTextToSize(q.notes, pageW - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  // ===== Negotiation history =====
  if (q.negotiation_log && q.negotiation_log.length > 0) {
    if (y > pageH - 50) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 43, 70);
    doc.text("HISTÓRICO DE NEGOCIAÇÃO", margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Data", "De", "Para", "Por", "Nota"]],
      body: q.negotiation_log.map((l) => [
        fmtDateTime(l.at),
        STATUS_LABEL[l.from] || l.from,
        STATUS_LABEL[l.to] || l.to,
        l.by || "—",
        l.note || "—",
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [240, 244, 248],
        textColor: [15, 43, 70],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ===== Footer on every page =====
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
    doc.text(
      `Vortis Gestão © ${new Date().getFullYear()} — Orçamento ${q.number}`,
      margin,
      pageH - 6
    );
    doc.text(`Página ${p} de ${pageCount}`, pageW - margin, pageH - 6, {
      align: "right",
    });
  }

  return doc;
}

export function downloadQuotePdf(q: QuotePdfData) {
  const doc = generateQuotePdf(q);
  doc.save(`orcamento-${q.number}.pdf`);
}
