import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NcmSearchProps {
  onSelect: (codigo: string) => void;
}

interface NcmItem {
  codigo: string;
  descricao: string;
}

export function NcmSearch({ onSelect }: NcmSearchProps) {
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NcmItem[]>([]);
  const { toast } = useToast();

  const handleSearch = async () => {
    const desc = descricao.trim();
    const cod = codigo.replace(/\D/g, "");
    if (!desc && !cod) {
      toast({ title: "Informe descrição ou código", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const params = new URLSearchParams();
      if (desc) params.set("descricao", desc);
      if (cod) params.set("codigo", cod);
      const { data, error } = await supabase.functions.invoke(
        `fiscal-consult-ncm?${params.toString()}`,
        { method: "GET" }
      );
      if (error) throw error;
      const payload = (data as any)?.data;
      const list: NcmItem[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.ncms)
        ? payload.ncms
        : Array.isArray(payload?.data)
        ? payload.data
        : [];
      const normalized = list
        .map((it: any) => ({
          codigo: String(it.codigo ?? it.code ?? "").replace(/\D/g, ""),
          descricao: String(it.descricao ?? it.description ?? ""),
        }))
        .filter((it) => it.codigo);
      if (normalized.length === 0) {
        toast({ title: "Nenhum NCM encontrado" });
      }
      setResults(normalized);
    } catch (e: any) {
      toast({
        title: "Erro ao consultar NCM",
        description: e?.message || "Falha na consulta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (c: string) => {
    onSelect(c.slice(0, 8));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        >
          <Search className="h-3 w-3" />
          Consultar
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-w-[calc(100vw-2rem)] max-h-[min(520px,var(--radix-popover-content-available-height))] overflow-y-auto p-4 z-[100]"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">Consultar NCM</h4>
            <p className="text-xs text-muted-foreground">
              Busque pelo nome ou parte do código do produto.
            </p>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: café torrado"
                className="h-9 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código (opcional)</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Ex.: 0901"
                inputMode="numeric"
                className="h-9 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
              />
            </div>
            <Button type="button" onClick={handleSearch} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
              {results.map((item, idx) => (
                <button
                  key={`${item.codigo}-${idx}`}
                  type="button"
                  onClick={() => handleApply(item.codigo)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 focus:bg-muted transition-colors"
                >
                  <div className="text-sm font-medium tabular-nums">{item.codigo}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {item.descricao || "—"}
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Fonte: Focus NFe. Requer token do provedor configurado em Configurações Fiscais.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
