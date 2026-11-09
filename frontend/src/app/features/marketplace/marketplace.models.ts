export interface Category {
  id: number;
  name: string;
  description?: string | null;
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  category_id?: number | null;
}

export interface ProductRecommendation {
  product: Product;
  similarity_score: number;
  match_percentage: string;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export interface Cart {
  id: number;
  user_id: number;
  created_at?: string | null;
  items: CartItem[];
  total: number;
}

export interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export interface Order {
  id: number;
  user_id: number;
  cart_id?: number | null;
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  created_at?: string | null;
  items: OrderItem[];
}

export interface TopSellingProduct {
  product_id: number;
  product_name: string;
  total_quantity_sold: number;
  total_revenue: number;
}

export interface OrderAnalytics {
  total_revenue: number;
  total_orders: number;
  confirmed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  average_order_value: number;
  top_selling_products: TopSellingProduct[];
}
