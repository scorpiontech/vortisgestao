import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface OsPdfData {
  number: string;
  companyName?: string;
  sellerName?: string;
  customer_name: string;
  service_type: string;
  opened_at: string;
  status: string;
  problem_description: string;
  resolution_description?: string;
  budget_total: number;
  materials: { product_name: string; quantity: number; unit_price: number; total: number }[];
}

export function generateOsPdf(o: OsPdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const m = 15;
  doc.setFillColor(15, 43, 70);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(o.companyName || "VORTIS GESTÃO", m, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Ordem de Serviço ${o.number}`, m, 20);
  if (o.sellerName) doc.text(`Emitido por: ${o.sellerName}`, pageW - m, 20, { align: "right" });
  doc.setTextColor(33, 33, 33); doc.setFontSize(10);
  let y = 38;
  const line = (t: string) => { doc.text(t, m, y); y += 6; };
  line(`Cliente: ${o.customer_name}`);
  line(`Serviço: ${o.service_type}`);
  line(`Abertura: ${new Date(o.opened_at).toLocaleString("pt-BR")}`);
  line(`Status: ${o.status.toUpperCase()}`);
  y += 2;
  doc.setFont("helvetica", "bold"); line("Descrição do problema"); doc.setFont("helvetica", "normal");
  const p = doc.splitTextToSize(o.problem_description || "—", pageW - 2 * m);
  doc.text(p, m, y); y += p.length * 5 + 3;
  if (o.resolution_description) {
    doc.setFont("helvetica", "bold"); line("Resolução"); doc.setFont("helvetica", "normal");
    const r = doc.splitTextToSize(o.resolution_description, pageW - 2 * m);
    doc.text(r, m, y); y += r.length * 5 + 3;
  }
  autoTable(doc, {
    startY: y,
    head: [["Material / Serviço", "Qtd", "Valor Unit.", "Total"]],
    body: o.materials.map(x => [x.product_name, String(x.quantity), fmt(x.unit_price), fmt(x.total)]),
    foot: [["", "", "TOTAL", fmt(o.budget_total)]],
    theme: "grid",
    headStyles: { fillColor: [15, 43, 70] },
    footStyles: { fillColor: [240, 244, 248], textColor: [15, 43, 70] },
    margin: { left: m, right: m },
  });
  return doc;
}
