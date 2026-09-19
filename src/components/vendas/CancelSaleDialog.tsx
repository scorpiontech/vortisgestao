import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MOTIVOS = [
  "Venda duplicada",
  "Erro de digitação",
  "Desistência do cliente",
  "Problema no pagamento",
  "Devolução de mercadoria",
  "Outro",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleLabel: string;
  saleTotal: number;
  loading?: boolean;
  onConfirm: (reason: string) => void;
}

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CancelSaleDialog({ open, onOpenChange, saleLabel, saleTotal, loading, onConfirm }: Props) {
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalhe, setDetalhe] = useState("");

  useEffect(() => {
    if (open) {
      setMotivo(MOTIVOS[0]);
      setDetalhe("");
    }
  }, [open]);

  const needsDetail = motivo === "Outro";
  const canConfirm = !loading && (!needsDetail || detalhe.trim().length >= 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar venda {saleLabel}</DialogTitle>
          <DialogDescription>
            Valor {money(saleTotal)}. O estoque e a entrada no caixa serão revertidos e o cancelamento ficará
            registrado no histórico de auditoria com o seu nome.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo do cancelamento</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancel-detalhe">
              Observação {needsDetail ? "(obrigatória)" : "(opcional)"}
            </Label>
            <Textarea
              id="cancel-detalhe"
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              placeholder="Descreva o que aconteceu"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => onConfirm(detalhe.trim() ? `${motivo} — ${detalhe.trim()}` : motivo)}
          >
            {loading ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
