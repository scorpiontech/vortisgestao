import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, Plus, Trash2, UserCircle2, Pencil, FileSignature, Loader2, Send, FileText,
} from "lucide-react";
import { toast } from "sonner";
import NfeSettingsDialog from "@/components/fiscal/NfeSettingsDialog";

// ---- Types ----
type Modelo = "55" | "65";
interface Destinatario {
  tipo: "cnpj" | "cpf";
  documento: string;
  nome: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}
interface Item {
  id: string;
  product_id?: string;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
}
interface Payment {
  forma: string;
  valor: number;
}

const FORMAS_PAGAMENTO: Record<string, string> = {
  "01": "Dinheiro",
  "03": "Cartão de Crédito",
  "04": "Cartão de Débito",
  "05": "Crédito da Loja",
  "10": "Vale Alimentação",
  "11": "Vale Refeição",
  "12": "Vale Presente",
  "13": "Vale Combustível",
  "15": "Boleto Bancário",
  "16": "Depósito Bancário",
  "17": "Pagamento Instantâneo (PIX)",
  "18": "Transferência Bancária",
  "19": "Programa de fidelidade, Cashback, Crédito Virtual",
  "90": "Sem Pagamento",
  "99": "Outros",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EmitirNotaFiscal() {
  const navigate = useNavigate();
  const { effectiveUserId } = useUserRole();

  // Step 0: modelo selector
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Header options
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [emissaoPadrao] = useState(true);

  // Step 1
  const [naturezaOperacao, setNaturezaOperacao] = useState("Venda");
  const [finalidade, setFinalidade] = useState("1"); // 1 NFe normal
  const [tipoDocumento, setTipoDocumento] = useState("1"); // Saída
  const [consumidorFinal, setConsumidorFinal] = useState("1");
  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().slice(0, 16));
  const [dataSaida, setDataSaida] = useState(() => new Date().toISOString().slice(0, 16));
  const [movimentaEstoque, setMovimentaEstoque] = useState(true);
  const [informarChaveRef, setInformarChaveRef] = useState(false);
  const [chaveReferencia, setChaveReferencia] = useState("");
  const [indicadorPresenca, setIndicadorPresenca] = useState("0");
  const [destinatario, setDestinatario] = useState<Destinatario | null>(null);
  const [destOpen, setDestOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);

  // Step 2
  const [separarIguais, setSepararIguais] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [itemDialog, setItemDialog] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Step 3
  const [totalFrete, setTotalFrete] = useState(0);
  const [outrasDespesas, setOutrasDespesas] = useState(0);
  const [descontoTotal, setDescontoTotal] = useState(0);
  const [modFrete, setModFrete] = useState("9");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pForma, setPForma] = useState("01");
  const [pValor, setPValor] = useState(0);

  // Step 4
  const [infoComplementares, setInfoComplementares] = useState("");
  const [infoFisco, setInfoFisco] = useState("");
  const [emitting, setEmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Search filters
  const [destSearch, setDestSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proximoNumero, setProximoNumero] = useState<number | null>(null);
  const [serie, setSerie] = useState<string>("1");

  const loadSettings = async () => {
    if (!effectiveUserId || !modelo) return;
    const { data } = await supabase.from("fiscal_settings").select("*").eq("owner_id", effectiveUserId).maybeSingle();
    const d: any = data || {};
    setProximoNumero(modelo === "55" ? (d.proximo_numero_nfe ?? 1) : (d.proximo_numero_nfce ?? 1));
    setSerie(modelo === "55" ? (d.serie_nfe ?? "1") : (d.serie_nfce ?? "1"));
    if (!infoFisco) setInfoFisco(d.informacoes_fisco ?? "");
  };

  useEffect(() => { loadSettings(); /* eslint-disable-next-line */ }, [effectiveUserId, modelo]);

  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      const [{ data: cs }, { data: ps }] = await Promise.all([
        supabase.from("customers").select("id, name, document, email, phone, street, number, neighborhood, city, state, zip_code").order("name"),
        supabase.from("products").select("id, name, sku, price, ncm").order("name"),
      ]);
      setCustomers(cs || []);
      setProducts(ps || []);
    })();
  }, [effectiveUserId]);

  // Totals
  const totalProdutos = useMemo(
    () => items.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0),
    [items]
  );
  const totalNota = Math.max(0, totalProdutos + Number(totalFrete) + Number(outrasDespesas) - Number(descontoTotal));
  const totalPago = payments.reduce((s, p) => s + Number(p.valor || 0), 0);
  const troco = Math.max(0, totalPago - totalNota);
  const valorAPagar = Math.max(0, totalNota - totalPago);

  const canGoStep2 = !!naturezaOperacao && (modelo === "65" || !!destinatario);
  const canGoStep3 = items.length > 0;
  const canEmit = totalPago >= totalNota && totalNota > 0;

  // ---- Step 0: escolher modelo ----
  if (!modelo) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/notas-fiscais")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Emitir Nota Fiscal</h1>
            <p className="text-sm text-muted-foreground">Escolha o tipo de documento fiscal a emitir.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setModelo("55")}>
            <CardContent className="p-6 space-y-2">
              <FileSignature className="h-8 w-8 text-primary" />
              <h3 className="font-bold">NF-e (modelo 55)</h3>
              <p className="text-sm text-muted-foreground">Nota Fiscal Eletrônica — venda para outra empresa ou pessoa física com destinatário identificado, frete e transporte.</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setModelo("65")}>
            <CardContent className="p-6 space-y-2">
              <FileText className="h-8 w-8 text-primary" />
              <h3 className="font-bold">NFC-e (modelo 65)</h3>
              <p className="text-sm text-muted-foreground">Nota Fiscal de Consumidor — venda no PDV, consumidor final presencial.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Wizard header ----
  const StepTab = ({ n, title, subtitle }: { n: 1 | 2 | 3 | 4; title: string; subtitle: string }) => {
    const active = step === n;
    return (
      <button
        onClick={() => setStep(n)}
        className={`flex-1 border-b-4 py-3 px-2 text-center transition-colors ${
          active ? "border-primary bg-primary/10" : "border-transparent bg-muted/40 hover:bg-muted"
        }`}
      >
        <div className={`text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{title}</div>
        <div className={`text-sm ${active ? "text-primary font-medium" : "text-foreground"}`}>{subtitle}</div>
      </button>
    );
  };

  // ---- Item dialog ----
  const openNewItem = () => { setEditingItem({ id: uid(), codigo: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN", quantidade: 1, valor_unitario: 0 }); setItemDialog(true); };
  const saveItem = () => {
    if (!editingItem) return;
    if (!editingItem.descricao || editingItem.quantidade <= 0 || editingItem.valor_unitario <= 0) {
      return toast.error("Descrição, quantidade e valor unitário são obrigatórios");
    }
    setItems((arr) => {
      const idx = arr.findIndex((i) => i.id === editingItem.id);
      if (idx >= 0) { const cp = [...arr]; cp[idx] = editingItem; return cp; }
      return [...arr, editingItem];
    });
    setItemDialog(false);
    setEditingItem(null);
  };

  const addPayment = () => {
    if (pValor <= 0) return toast.error("Informe o valor do pagamento");
    setPayments((arr) => [...arr, { forma: pForma, valor: Number(pValor) }]);
    setPValor(0);
  };

  const buildDoc = () => ({
    modelo,
    natureza_operacao: naturezaOperacao,
    finalidade,
    tipo_documento: tipoDocumento,
    consumidor_final: consumidorFinal,
    indicador_presenca: indicadorPresenca,
    data_emissao: new Date(dataEmissao).toISOString(),
    data_saida: dataSaida ? new Date(dataSaida).toISOString() : null,
    movimenta_estoque: movimentaEstoque,
    enviar_email: enviarEmail,
    chave_referencia: informarChaveRef ? chaveReferencia : null,
    frete_modalidade: modFrete,
    destinatario,
    items: items.map((i) => ({
      product_id: i.product_id,
      codigo: i.codigo || i.product_id,
      descricao: i.descricao,
      ncm: i.ncm,
      cfop: i.cfop,
      unidade: i.unidade,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
    })),
    payments,
    total_produtos: totalProdutos,
    total_frete: Number(totalFrete),
    outras_despesas: Number(outrasDespesas),
    desconto: Number(descontoTotal),
    total_pago: totalPago,
    troco,
    informacoes_complementares: infoComplementares,
    informacoes_fisco: infoFisco,
  });

  const handlePreview = async () => {
    if (items.length === 0) return toast.error("Adicione pelo menos um item para pré-visualizar");
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-emit-document", {
        body: { doc: buildDoc(), preview: true },
      });
      if (error) throw error;
      setPreviewData(data);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar pré-visualização");
    } finally {
      setPreviewing(false);
    }
  };

  const handleEmit = async () => {
    if (!canEmit) return toast.error("O valor pago deve cobrir o total da nota");
    setEmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-emit-document", { body: { doc: buildDoc() } });
      if (error) throw error;
      const res: any = data;
      if (res?.status === "authorized") {
        toast.success(`Nota autorizada! Nº ${res.numero}`);
        if (res.danfce_url) window.open(res.danfce_url, "_blank");
        navigate("/notas-fiscais");
      } else if (res?.status === "rejected") {
        toast.error(`Rejeitada: ${res.motivo_rejeicao || "Erro ao emitir"}`);
      } else {
        toast.info("Nota registrada. Aguardando retorno da SEFAZ.");
        navigate("/notas-fiscais");
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao emitir nota");
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/notas-fiscais")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Emitir {modelo === "55" ? "NF-e" : "NFC-e"}</h1>
          <p className="text-xs text-muted-foreground">Modelo {modelo} · Ambiente atual em Configurações Fiscais.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setModelo(null)}>Trocar modelo</Button>
      </div>

      {/* Emissão settings summary */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-1"><span className="text-primary font-semibold">Número da {modelo === "55" ? "NF-e" : "NFC-e"}:</span> {proximoNumero ?? "…"}</div>
        <div className="flex items-center gap-1"><span className="text-primary font-semibold">Série:</span> {serie}</div>
        <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} title="Configurações para emissão">
          <Pencil className="h-4 w-4 text-primary" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Checkbox checked={enviarEmail} onCheckedChange={(v) => setEnviarEmail(!!v)} id="chk-email" />
          <label htmlFor="chk-email" className="text-primary cursor-pointer">Enviar {modelo === "55" ? "NF-e" : "NFC-e"} para o email do Destinatário</label>
          <Badge variant="secondary">Emissão padrão</Badge>
        </div>
      </div>

      {/* Steps tabs */}
      <div className="flex border rounded-md overflow-hidden">
        <StepTab n={1} title="Passo 1" subtitle={`Detalhes da ${modelo === "55" ? "NF-e" : "NFC-e"}`} />
        <StepTab n={2} title="Passo 2" subtitle={`Itens da ${modelo === "55" ? "NF-e" : "NFC-e"}`} />
        <StepTab n={3} title="Passo 3" subtitle="Pagamentos e Frete" />
        <StepTab n={4} title="Passo 4" subtitle="Finalizar" />
      </div>

      {/* ---------- STEP 1 ---------- */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6 grid md:grid-cols-3 gap-6">
            <div className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>* Natureza da Operação</Label>
                  <Select value={naturezaOperacao} onValueChange={setNaturezaOperacao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Venda">Venda</SelectItem>
                      <SelectItem value="Venda de mercadoria">Venda de mercadoria</SelectItem>
                      <SelectItem value="Devolução">Devolução</SelectItem>
                      <SelectItem value="Remessa">Remessa</SelectItem>
                      <SelectItem value="Retorno">Retorno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>* Finalidade da {modelo === "55" ? "NF-e" : "NFC-e"}</Label>
                  <Select value={finalidade} onValueChange={setFinalidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 = {modelo === "55" ? "NF-e" : "NFC-e"} normal</SelectItem>
                      <SelectItem value="2">2 = Complementar</SelectItem>
                      <SelectItem value="3">3 = Ajuste</SelectItem>
                      <SelectItem value="4">4 = Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>* Tipo de Documento Fiscal</Label>
                  <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 = Entrada</SelectItem>
                      <SelectItem value="1">1 = Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Consumidor final</Label>
                  <Select value={consumidorFinal} onValueChange={setConsumidorFinal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 = Não</SelectItem>
                      <SelectItem value="1">1 = Consumidor final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data de emissão</Label>
                  <Input type="datetime-local" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de saída</Label>
                  <Input type="datetime-local" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={movimentaEstoque} onCheckedChange={(v) => setMovimentaEstoque(!!v)} />
                  <span>Movimentar Estoque</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={informarChaveRef} onCheckedChange={(v) => setInformarChaveRef(!!v)} />
                  <span>Informar chave de referência</span>
                </label>
                {informarChaveRef && (
                  <Input placeholder="Chave de referência (44 dígitos)" value={chaveReferencia} onChange={(e) => setChaveReferencia(e.target.value)} />
                )}
              </div>

              <div className="space-y-1.5 max-w-sm">
                <Label>* Indicador de Presença na {modelo === "55" ? "NF-e" : "NFC-e"}</Label>
                <Select value={indicadorPresenca} onValueChange={setIndicadorPresenca}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 = Não se aplica</SelectItem>
                    <SelectItem value="1">1 = Presencial</SelectItem>
                    <SelectItem value="2">2 = Internet</SelectItem>
                    <SelectItem value="3">3 = Teleatendimento</SelectItem>
                    <SelectItem value="4">4 = NFC-e em entrega em domicílio</SelectItem>
                    <SelectItem value="9">9 = Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Destinatário */}
            <div className="border rounded-lg p-4 space-y-3 text-center">
              <div className="text-sm text-primary font-semibold">Destinatário / Tomador (Cliente) {modelo === "55" ? "*" : ""}</div>
              <div className="flex justify-center"><UserCircle2 className="h-16 w-16 text-primary/70" /></div>
              {destinatario ? (
                <div className="text-sm space-y-1">
                  <div className="font-medium">{destinatario.nome}</div>
                  <div className="text-xs text-muted-foreground">{destinatario.tipo.toUpperCase()}: {destinatario.documento}</div>
                  {destinatario.email && <div className="text-xs">{destinatario.email}</div>}
                  <Button size="sm" variant="outline" onClick={() => setDestOpen(true)}>Alterar</Button>
                </div>
              ) : (
                <Button onClick={() => setDestOpen(true)}>Selecionar destinatário</Button>
              )}
              {modelo === "65" && !destinatario && (
                <p className="text-xs text-muted-foreground">Opcional em NFC-e. Deixe em branco para consumidor não identificado.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------- STEP 2 ---------- */}
      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <label className="flex items-center gap-2">
              <Checkbox checked={separarIguais} onCheckedChange={(v) => setSepararIguais(!!v)} />
              <span>Separar produtos iguais?</span>
            </label>
            <div className="text-center">
              <Button onClick={openNewItem}><Plus className="h-4 w-4 mr-1" /> Adicionar Item</Button>
            </div>
            {items.length === 0 ? (
              <div className="bg-primary/5 text-center py-3 rounded text-primary">Nenhum item na nota</div>
            ) : (
              <div className="border rounded overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
                        <TableCell>{i.descricao}</TableCell>
                        <TableCell className="text-right">{i.quantidade}</TableCell>
                        <TableCell className="text-right">{fmt(i.valor_unitario)}</TableCell>
                        <TableCell className="text-right">{fmt(i.quantidade * i.valor_unitario)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(i); setItemDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setItems((arr) => arr.filter((x) => x.id !== i.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="text-right font-semibold">Total: {fmt(totalProdutos)}</div>
          </CardContent>
        </Card>
      )}

      {/* ---------- STEP 3 ---------- */}
      {step === 3 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border rounded overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Total dos Produtos</TableHead>
                      <TableHead>Total Frete</TableHead>
                      <TableHead>Outras Despesas</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Total Pago</TableHead>
                      <TableHead>Total da Nota</TableHead>
                      <TableHead>Troco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{fmt(totalProdutos)}</TableCell>
                      <TableCell>{fmt(totalFrete)}</TableCell>
                      <TableCell>{fmt(outrasDespesas)}</TableCell>
                      <TableCell>{fmt(descontoTotal)}</TableCell>
                      <TableCell>{fmt(totalPago)}</TableCell>
                      <TableCell className="font-semibold">{fmt(totalNota)}</TableCell>
                      <TableCell>{fmt(troco)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-primary">Frete</div>
                <div className="space-y-1.5">
                  <Label>Modalidade do Frete</Label>
                  <Select value={modFrete} onValueChange={setModFrete}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 = Contratação por conta do Remetente (CIF)</SelectItem>
                      <SelectItem value="1">1 = Contratação por conta do Destinatário (FOB)</SelectItem>
                      <SelectItem value="2">2 = Contratação por conta de Terceiros</SelectItem>
                      <SelectItem value="3">3 = Transporte próprio por conta do Remetente</SelectItem>
                      <SelectItem value="4">4 = Transporte próprio por conta do Destinatário</SelectItem>
                      <SelectItem value="9">9 = Sem Ocorrência de Transporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Forma de Pagamento</Label>
                <Select value={pForma} onValueChange={setPForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor a pagar</Label>
                <Input type="number" step="0.01" min={0} value={pValor} onChange={(e) => setPValor(Number(e.target.value))} placeholder={fmt(valorAPagar)} />
              </div>
              <div className="space-y-1.5">
                <Label>Outras Despesas acessórias</Label>
                <Input type="number" step="0.01" value={outrasDespesas} onChange={(e) => setOutrasDespesas(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto</Label>
                <Input type="number" step="0.01" value={descontoTotal} onChange={(e) => setDescontoTotal(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Total do Frete</Label>
                <Input type="number" step="0.01" value={totalFrete} onChange={(e) => setTotalFrete(Number(e.target.value))} />
              </div>
              <div className="flex items-end">
                <Button onClick={addPayment} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar pagamento</Button>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="border rounded overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Forma</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{FORMAS_PAGAMENTO[p.forma] || p.forma}</TableCell>
                        <TableCell className="text-right">{fmt(p.valor)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setPayments((arr) => arr.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------- STEP 4 ---------- */}
      {step === 4 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Informações complementares (Opcional)</Label>
                <Textarea rows={6} value={infoComplementares} onChange={(e) => setInfoComplementares(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Informações de FISCO</Label>
                <Textarea rows={6} value={infoFisco} onChange={(e) => setInfoFisco(e.target.value)} />
              </div>
            </div>

            <div className="border rounded p-4 grid md:grid-cols-3 gap-4 bg-muted/30">
              <div><div className="text-xs text-muted-foreground">Total dos Produtos</div><div className="font-semibold">{fmt(totalProdutos)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total da Nota</div><div className="font-semibold text-primary">{fmt(totalNota)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total Pago</div><div className="font-semibold">{fmt(totalPago)}</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nav */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(1, (s - 1)) as any)} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < 4 ? (
          <Button
            onClick={() => setStep((s) => Math.min(4, (s + 1)) as any)}
            disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
          >
            Avançar <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={previewing || items.length === 0}>
              {previewing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Pré-visualizar
            </Button>
            <Button onClick={handleEmit} disabled={emitting || !canEmit}>
              {emitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Emitir {modelo === "55" ? "NF-e" : "NFC-e"}
            </Button>
          </div>
        )}
      </div>

      {/* Destinatário Dialog */}
      <Dialog open={destOpen} onOpenChange={(v) => { setDestOpen(v); if (!v) setDestSearch(""); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar destinatário</DialogTitle>
            <DialogDescription>Pesquise por nome, documento ou email.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Buscar cliente..."
            value={destSearch}
            onChange={(e) => setDestSearch(e.target.value)}
          />
          <div className="max-h-96 overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers
                  .filter((c: any) => {
                    const q = destSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      String(c.name || "").toLowerCase().includes(q) ||
                      String(c.document || "").toLowerCase().includes(q) ||
                      String(c.email || "").toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 100)
                  .map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.document}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => {
                        const doc = String(c.document || "").replace(/\D/g, "");
                        setDestinatario({
                          tipo: doc.length > 11 ? "cnpj" : "cpf",
                          documento: doc,
                          nome: c.name,
                          email: c.email,
                          telefone: c.phone,
                          logradouro: c.street,
                          numero: c.number,
                          bairro: c.neighborhood,
                          municipio: c.city,
                          uf: c.state,
                          cep: c.zip_code,
                        });
                        setDestOpen(false);
                        setDestSearch("");
                      }}>Selecionar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={(v) => { setItemDialog(v); if (!v) setItemSearch(""); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Item da nota</DialogTitle></DialogHeader>
          {editingItem && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Produto</Label>
                <Input
                  placeholder="Buscar produto por nome ou código..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
                {itemSearch.trim() && (
                  <div className="max-h-48 overflow-auto border rounded mt-1">
                    {products
                      .filter((p) => {
                        const q = itemSearch.trim().toLowerCase();
                        return (
                          String(p.name || "").toLowerCase().includes(q) ||
                          String(p.sku || "").toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 30)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                          onClick={() => {
                            setEditingItem({
                              ...editingItem!, product_id: p.id, codigo: p.sku || p.id.slice(0, 8),
                              descricao: p.name, ncm: (p.ncm ? String(p.ncm).replace(/\D/g, "").slice(0, 8).padStart(8, "0") : (editingItem!.ncm || "00000000")), valor_unitario: Number(p.price || 0),
                            });
                            setItemSearch("");
                          }}
                        >
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">SKU: {p.sku || "—"} · {fmt(Number(p.price || 0))}</div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Código</Label><Input value={editingItem.codigo} onChange={(e) => setEditingItem({ ...editingItem, codigo: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>NCM</Label><Input value={editingItem.ncm} onChange={(e) => setEditingItem({ ...editingItem, ncm: e.target.value })} /></div>
                <div className="space-y-1.5 col-span-2"><Label>Descrição</Label><Input value={editingItem.descricao} onChange={(e) => setEditingItem({ ...editingItem, descricao: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>CFOP</Label><Input value={editingItem.cfop} onChange={(e) => setEditingItem({ ...editingItem, cfop: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Unidade</Label><Input value={editingItem.unidade} onChange={(e) => setEditingItem({ ...editingItem, unidade: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Quantidade</Label><Input type="number" step="0.001" value={editingItem.quantidade} onChange={(e) => setEditingItem({ ...editingItem, quantidade: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Valor unitário</Label><Input type="number" step="0.01" value={editingItem.valor_unitario} onChange={(e) => setEditingItem({ ...editingItem, valor_unitario: Number(e.target.value) })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>Cancelar</Button>
            <Button onClick={saveItem}>Salvar item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emission Settings */}
      <NfeSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        modelo={modelo}
        ownerId={effectiveUserId}
        onSaved={loadSettings}
      />

      {/* Preview DANFE Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da {modelo === "55" ? "NF-e" : "NFC-e"}</DialogTitle>
            <DialogDescription>
              Confira os dados antes de enviar para a SEFAZ. Nenhum envio foi realizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm max-h-[60vh] overflow-auto">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Número: </span><strong>{previewData?.numero ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">Série: </span><strong>{serie}</strong></div>
              <div><span className="text-muted-foreground">Natureza: </span>{naturezaOperacao}</div>
              <div><span className="text-muted-foreground">Destinatário: </span>{destinatario?.nome || "Consumidor não identificado"}</div>
            </div>
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.descricao}</TableCell>
                      <TableCell className="text-right">{i.quantidade}</TableCell>
                      <TableCell className="text-right">{fmt(i.valor_unitario)}</TableCell>
                      <TableCell className="text-right">{fmt(i.quantidade * i.valor_unitario)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total da nota</span>
              <span className="text-primary">{fmt(totalNota)}</span>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Ver payload técnico</summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-64">{JSON.stringify(previewData?.payload ?? {}, null, 2)}</pre>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={() => { setPreviewOpen(false); handleEmit(); }} disabled={!canEmit}>
              <Send className="h-4 w-4 mr-1" /> Emitir agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
