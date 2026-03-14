import { Product, Transaction } from "@/types";

export const mockProducts: Product[] = [
  { id: "1", name: "Arroz Integral 1kg", sku: "ARR001", category: "Alimentos", price: 8.90, cost: 5.50, stock: 150, minStock: 30, unit: "un" },
  { id: "2", name: "Feijão Preto 1kg", sku: "FEI001", category: "Alimentos", price: 7.50, cost: 4.80, stock: 80, minStock: 20, unit: "un" },
  { id: "3", name: "Óleo de Soja 900ml", sku: "OLE001", category: "Alimentos", price: 6.99, cost: 4.20, stock: 5, minStock: 15, unit: "un" },
  { id: "4", name: "Detergente 500ml", sku: "DET001", category: "Limpeza", price: 2.49, cost: 1.30, stock: 200, minStock: 50, unit: "un" },
  { id: "5", name: "Sabonete Líquido 250ml", sku: "SAB001", category: "Higiene", price: 12.90, cost: 7.00, stock: 45, minStock: 10, unit: "un" },
  { id: "6", name: "Café Torrado 500g", sku: "CAF001", category: "Alimentos", price: 15.90, cost: 9.80, stock: 60, minStock: 15, unit: "un" },
  { id: "7", name: "Açúcar Refinado 1kg", sku: "ACU001", category: "Alimentos", price: 4.50, cost: 2.80, stock: 120, minStock: 25, unit: "un" },
  { id: "8", name: "Papel Higiênico 12un", sku: "PAP001", category: "Higiene", price: 18.90, cost: 12.00, stock: 8, minStock: 10, unit: "pct" },
];

export const mockTransactions: Transaction[] = [
  { id: "1", type: "entrada", description: "Venda balcão", amount: 354.50, category: "Vendas", date: "2026-03-14", paymentMethod: "Dinheiro" },
  { id: "2", type: "entrada", description: "Venda cartão", amount: 892.30, category: "Vendas", date: "2026-03-14", paymentMethod: "Cartão Crédito" },
  { id: "3", type: "saida", description: "Fornecedor - Alimentos", amount: 1250.00, category: "Compras", date: "2026-03-13", paymentMethod: "Boleto" },
  { id: "4", type: "entrada", description: "Venda PIX", amount: 156.80, category: "Vendas", date: "2026-03-13", paymentMethod: "PIX" },
  { id: "5", type: "saida", description: "Conta de Luz", amount: 380.00, category: "Despesas Fixas", date: "2026-03-12", paymentMethod: "Débito Automático" },
  { id: "6", type: "saida", description: "Fornecedor - Limpeza", amount: 450.00, category: "Compras", date: "2026-03-12", paymentMethod: "PIX" },
  { id: "7", type: "entrada", description: "Venda balcão", amount: 678.90, category: "Vendas", date: "2026-03-11", paymentMethod: "Dinheiro" },
  { id: "8", type: "saida", description: "Aluguel", amount: 2500.00, category: "Despesas Fixas", date: "2026-03-10", paymentMethod: "Transferência" },
];
