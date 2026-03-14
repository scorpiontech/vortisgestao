export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
}

export interface Transaction {
  id: string;
  type: 'entrada' | 'saida';
  description: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  date: string;
  customerName?: string;
}
