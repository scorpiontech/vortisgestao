import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/asaas";
import { Copy, ExternalLink } from "lucide-react";

export interface ChargeInstallment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_payload: string | null;
  pix_qrcode_image: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  billingType?: string;
  installments: ChargeInstallment[];
}

const statusLabel: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

export function CobrancaLinksDialog({ open, onOpenChange, title, description, billingType, installments }: Props) {
  const { toast } = useToast();
  const copy = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast({ title: `${label} copiado!` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Cobrança gerada"}</DialogTitle>
          <DialogDescription>{description || "Envie o link, boleto ou QR Code PIX ao cliente."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {installments.map(inst => (
            <div key={inst.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Parcela {inst.installment_number} — {formatBRL(Number(inst.amount))}
                </p>
                <Badge variant={inst.status === "paid" ? "default" : "secondary"}>{statusLabel[inst.status] || inst.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Vencimento: {new Date(inst.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>

              {inst.pix_qrcode_image && (
                <img
                  src={`data:image/png;base64,${inst.pix_qrcode_image}`}
                  alt={`QR Code PIX da parcela ${inst.installment_number}`}
                  className="h-40 w-40 rounded border bg-card p-1"
                  loading="lazy"
                />
              )}

              <div className="flex flex-wrap gap-2">
                {inst.invoice_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={inst.invoice_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Abrir fatura
                    </a>
                  </Button>
                )}
                {inst.bank_slip_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={inst.bank_slip_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Boleto PDF
                    </a>
                  </Button>
                )}
                {inst.invoice_url && (
                  <Button size="sm" variant="ghost" onClick={() => copy(inst.invoice_url!, "Link")}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />Copiar link
                  </Button>
                )}
                {inst.pix_payload && (
                  <Button size="sm" variant="ghost" onClick={() => copy(inst.pix_payload!, "PIX Copia e Cola")}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />PIX Copia e Cola
                  </Button>
                )}
              </div>
            </div>
          ))}
          {installments.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma parcela encontrada para esta cobrança.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
