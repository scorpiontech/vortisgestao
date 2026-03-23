import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Calendar, CheckCircle, AlertTriangle, Clock } from "lucide-react";

export default function Cobrancas() {
  // Placeholder for future billing/subscription management
  const [plano] = useState({ nome: "Plano Mensal", valor: 99.90, vencimento: "2026-04-23" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Cobranças</h1>
      <p className="text-muted-foreground">Gerencie os pagamentos da mensalidade de uso do sistema.</p>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plano.nome}</div>
            <p className="text-xs text-muted-foreground">
              R$ {plano.valor.toFixed(2).replace(".", ",")} / mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próximo Vencimento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(plano.vencimento).toLocaleDateString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">Renovação automática</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="bg-green-600">Ativo</Badge>
            <p className="text-xs text-muted-foreground mt-1">Pagamento em dia</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { mes: "Março/2026", status: "pago", data: "23/03/2026", valor: 99.90 },
              { mes: "Fevereiro/2026", status: "pago", data: "23/02/2026", valor: 99.90 },
              { mes: "Janeiro/2026", status: "pago", data: "23/01/2026", valor: 99.90 },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  {item.status === "pago" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : item.status === "pendente" ? (
                    <Clock className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{item.mes}</p>
                    <p className="text-xs text-muted-foreground">Pago em {item.data}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    R$ {item.valor.toFixed(2).replace(".", ",")}
                  </p>
                  <Badge variant={item.status === "pago" ? "default" : "destructive"} className="text-[10px]">
                    {item.status === "pago" ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" disabled>
          <CreditCard className="h-4 w-4 mr-2" />
          Alterar Forma de Pagamento
        </Button>
        <Button variant="outline" disabled>
          Alterar Plano
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Em breve: integração com gateway de pagamento para gestão automática de cobranças.
      </p>
    </div>
  );
}
