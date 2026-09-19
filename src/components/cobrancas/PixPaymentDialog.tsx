import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatBRL, syncAsaasCharge } from "@/lib/asaas";
import type { ChargeInstallment } from "@/components/cobrancas/CobrancaLinksDialog";
import { Copy, ExternalLink, Loader2, CheckCircle2, RefreshCw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chargeId: string | null;
  installment: ChargeInstallment | null;
  amount: number;
  onPaid: () => void;
}

export function PixPaymentDialog({ open, onOpenChange, chargeId, installment, amount, onPaid }: Props) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const paidRef = useRef(false);

  useEffect(() => {
    if (!open) { setPaid(false); setElapsed(0); paidRef.current = false; }
  }, [open]);

  const check = async (silent = true) => {
    if (!chargeId || paidRef.current) return;
    setChecking(true);
    try {
      const res = await syncAsaasCharge(chargeId);
      if (res.status === "paid" || res.status === "partially_paid") {
        paidRef.current = true;
        setPaid(true);
        toast({ title: "Pagamento confirmado!", description: "Finalizando a venda..." });
        setTimeout(() => onPaid(), 800);
      } else if (!silent) {
        toast({ title: "Pagamento ainda não identificado", description: "Aguarde alguns instantes e tente novamente." });
      }
    } catch (e) {
      if (!silent) toast({ title: "Erro ao verificar pagamento", description: e instanceof Error ? e.message : "Erro inesperado", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  // Verificação automática a cada 6 segundos enquanto a tela estiver aberta
  useEffect(() => {
    if (!open || !chargeId) return;
    const id = setInterval(() => {
      setElapsed(e => e + 6);
      check(true);
    }, 6000);
    return () => clearInterval(id);
  }, [open, chargeId]);

  const copy = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast({ title: `${label} copiado!` });
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={v => { if (!paid) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagamento via PIX</DialogTitle>
          <DialogDescription>
            Mostre o QR Code ao cliente. A venda é finalizada automaticamente após a confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-center">
          <p className="text-3xl font-bold">{formatBRL(amount)}</p>

          {paid ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <CheckCircle2 className="h-14 w-14 text-primary" />
              <p className="font-semibold">Pagamento confirmado</p>
            </div>
          ) : (
            <>
              {installment?.pix_qrcode_image ? (
                <img
                  src={`data:image/png;base64,${installment.pix_qrcode_image}`}
                  alt="QR Code PIX para pagamento"
                  className="mx-auto h-56 w-56 rounded-lg border bg-card p-2"
                />
              ) : (
                <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                  QR Code indisponível — use o link da fatura
                </div>
              )}

              <Badge variant="secondary" className="gap-1.5">
                {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Aguardando pagamento · {mm}:{ss}
              </Badge>

              <div className="flex flex-wrap justify-center gap-2">
                {installment?.pix_payload && (
                  <Button size="sm" variant="outline" onClick={() => copy(installment.pix_payload!, "PIX Copia e Cola")}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />PIX Copia e Cola
                  </Button>
                )}
                {installment?.invoice_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={installment.invoice_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Abrir fatura
                    </a>
                  </Button>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={() => check(false)} disabled={checking}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />Já paguei, verificar
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
