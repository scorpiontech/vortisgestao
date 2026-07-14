import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calculator } from "lucide-react";

interface PricingCalculatorProps {
  cost: number;
  onApply: (price: number) => void;
}

/**
 * Precificação por markup divisor:
 *   preço = custo / (1 - (impostos% + lucro%) / 100)
 * Também soma despesas operacionais (%) e frete (R$) opcionais.
 */
export function PricingCalculator({ cost, onApply }: PricingCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [localCost, setLocalCost] = useState(cost);
  const [taxes, setTaxes] = useState(10);
  const [profit, setProfit] = useState(30);
  const [expenses, setExpenses] = useState(0);
  const [freight, setFreight] = useState(0);

  useEffect(() => {
    if (open) setLocalCost(cost);
  }, [open, cost]);

  const totalPct = taxes + profit + expenses;
  const divisor = 1 - totalPct / 100;
  const baseCost = Number(localCost) + Number(freight);
  const price = divisor > 0 ? baseCost / divisor : 0;
  const margin = price > 0 ? ((price - baseCost) / price) * 100 : 0;
  const valid = divisor > 0 && baseCost > 0;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        >
          <Calculator className="h-3 w-3" />
          Calcular
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-w-[calc(100vw-2rem)] max-h-[min(520px,var(--radix-popover-content-available-height))] overflow-y-auto p-4 z-[100]"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">Calcular Preço de Venda</h4>
            <p className="text-xs text-muted-foreground">custo ÷ (1 − impostos − lucro)</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Custo (R$)</Label>
              <Input type="number" step="0.01" value={localCost} onChange={e => setLocalCost(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frete (R$)</Label>
              <Input type="number" step="0.01" value={freight} onChange={e => setFreight(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Impostos (%)</Label>
              <Input type="number" step="0.01" value={taxes} onChange={e => setTaxes(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lucro (%)</Label>
              <Input type="number" step="0.01" value={profit} onChange={e => setProfit(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Despesas operacionais (%)</Label>
              <Input type="number" step="0.01" value={expenses} onChange={e => setExpenses(Number(e.target.value))} className="h-9 text-sm" />
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            {!valid && divisor <= 0 && (
              <p className="text-xs text-destructive">Soma de impostos + lucro + despesas deve ser menor que 100%.</p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Custo base</span>
              <span className="tabular-nums">{fmt(baseCost)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Margem sobre venda</span>
              <span className="tabular-nums">{margin.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between pt-0.5 border-t">
              <span className="text-sm font-medium">Preço sugerido</span>
              <span className="text-base font-bold text-primary tabular-nums">{fmt(price)}</span>
            </div>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={!valid}
            onClick={() => { onApply(Number(price.toFixed(2))); setOpen(false); }}
          >
            Aplicar preço
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
