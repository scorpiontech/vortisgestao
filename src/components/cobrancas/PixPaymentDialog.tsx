import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cancelAsaasCharge, formatBRL, syncAsaasCharge } from "@/lib/asaas";
import type { ChargeInstallment } from "@/components/cobrancas/CobrancaLinksDialog";
import { Copy, ExternalLink, Loader2, CheckCircle2, RefreshCw, TimerOff, XCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chargeId: string | null;
  installment: ChargeInstallment | null;
  amount: number;
  /** Epoch em ms para expiração do QR Code. */
  expiresAt?: number | null;
  /** Recebe o id da venda já registrada no servidor (quando houver). */
  onPaid: (saleId: string | null) => void;
  /** Disparado quando a cobrança é cancelada ou expira e é cancelada. */
  onCancelled?: () => void;
}

export function PixPaymentDialog({ open, onOpenChange, chargeId, installment, amount, expiresAt, onPaid, onCancelled }: Props) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paid, setPaid] = useState(false);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const paidRef = useRef(false);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPaid(false);
      setExpired(false);
      setCancelling(false);
      paidRef.current = false;
      settledRef.current = false;
    }
  }, [open]);

  // Contagem regressiva de expiração
  useEffect(() => {
    if (!open || !expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !paidRef.current) setExpired(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, expiresAt]);

  const check = async (silent = true) => {
    if (!chargeId || paidRef.current || settledRef.current) return;
    setChecking(true);
    try {
      const res = await syncAsaasCharge(chargeId);
      if (res.status === "paid" || res.status === "partially_paid") {
        paidRef.current = true;
        settledRef.current = true;
        setPaid(true);
        setExpired(false);
        toast({ title: "Pagamento confirmado!", description: "Finalizando a venda..." });
        setTimeout(() => onPaid(res.sale_id ?? null), 800);
      } else if (res.status === "cancelled") {
        settledRef.current = true;
        toast({ title: "Cobrança cancelada", description: "A cobrança não está mais ativa." });
        onCancelled?.();
      } else if (!silent) {
        toast({ title: "Pagamento ainda não identificado", description: "Aguarde alguns instantes e tente novamente." });
      }
    } catch (e) {
      if (!silent) toast({ title: "Erro ao verificar pagamento", description: e instanceof Error ? e.message : "Erro inesperado", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  // Verificação automática a cada 6 segundos enquanto o QR Code estiver válido
  useEffect(() => {
    if (!open || !chargeId || expired || paid) return;
    const id = setInterval(() => check(true), 6000);
    return () => clearInterval(id);
  }, [open, chargeId, expired, paid]);

  const cancelCharge = async () => {
    if (!chargeId || paidRef.current) return;
    setCancelling(true);
    try {
      await cancelAsaasCharge(chargeId);
      settledRef.current = true;
      toast({ title: "Cobrança cancelada", description: "Os itens continuam no carrinho do PDV." });
      onCancelled?.();
    } catch (e) {
      toast({ title: "Erro ao cancelar cobrança", description: e instanceof Error ? e.message : "Erro inesperado", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

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
          ) : expired ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 py-4">
                <TimerOff className="h-12 w-12 text-destructive" />
                <p className="font-semibold">QR Code expirado</p>
                <p className="text-sm text-muted-foreground">
                  O tempo de pagamento terminou. Verifique novamente ou cancele para gerar uma nova cobrança.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => check(false)} disabled={checking}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />Verificar pagamento
                </Button>
                <Button variant="destructive" onClick={cancelCharge} disabled={cancelling}>
                  {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Cancelar cobrança
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              </div>
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
                Aguardando pagamento{expiresAt ? ` · expira em ${mm}:${ss}` : ""}
              </Badge>

              <div className="flex flex-wrap justify-center gap-2">
                {installment?.pix_payload && (
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(installment.pix_payload!); toast({ title: "PIX Copia e Cola copiado!" }); }}>
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

              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => check(false)} disabled={checking}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />Já paguei, verificar
                </Button>
                <div className="flex gap-2">
                  <Button className="flex-1" variant="destructive" onClick={cancelCharge} disabled={cancelling}>
                    {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Cancelar cobrança
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao fechar sem cancelar, a cobrança continua ativa e pode ser retomada no PDV.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
