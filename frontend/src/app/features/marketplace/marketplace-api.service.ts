import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/config';
import {
  Category,
  Product,
  ProductRecommendation,
  Cart,
  Order,
  OrderAnalytics,
} from './marketplace.models';

@Injectable({ providedIn: 'root' })
export class MarketplaceApiService {
  private http = inject(HttpClient);

  // ── PRODUITS & CATÉGORIES ─────────────────────────────────
  getProducts(categoryId?: number): Observable<Product[]> {
    const url = categoryId
      ? `${API_URL}/api/products?category_id=${categoryId}`
      : `${API_URL}/api/products`;
    return this.http.get<Product[]>(url);
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${API_URL}/api/products/${id}`);
  }

  createProduct(data: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${API_URL}/api/products`, data);
  }

  updateProduct(id: number, data: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${API_URL}/api/products/${id}`, data);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/api/products/${id}`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_URL}/api/products/categories`);
  }

  // ── IA RECOMMANDATION (MACHINE LEARNING) ───────────────────
  getProductRecommendations(productId: number, limit = 4): Observable<ProductRecommendation[]> {
    return this.http.get<ProductRecommendation[]>(
      `${API_URL}/api/products/${productId}/recommendations?limit=${limit}`
    );
  }

  getCartRecommendations(userId: number, limit = 4): Observable<ProductRecommendation[]> {
    return this.http.get<ProductRecommendation[]>(
      `${API_URL}/api/cart/${userId}/recommendations?limit=${limit}`
    );
  }

  // ── PANIER ────────────────────────────────────────────────
  getCart(userId: number): Observable<Cart> {
    return this.http.get<Cart>(`${API_URL}/api/cart/${userId}`);
  }

  addToCart(userId: number, productId: number, quantity = 1): Observable<Cart> {
    return this.http.post<Cart>(`${API_URL}/api/cart/${userId}/items`, {
      product_id: productId,
      quantity,
    });
  }

  removeFromCart(userId: number, productId: number): Observable<Cart> {
    return this.http.delete<Cart>(`${API_URL}/api/cart/${userId}/items/${productId}`);
  }

  clearCart(userId: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/api/cart/${userId}`);
  }

  // ── COMMANDES ─────────────────────────────────────────────
  getOrders(userId?: number): Observable<Order[]> {
    const url = userId ? `${API_URL}/api/orders?user_id=${userId}` : `${API_URL}/api/orders`;
    return this.http.get<Order[]>(url);
  }

  getOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${API_URL}/api/orders/${id}`);
  }

  createOrder(userId: number): Observable<Order> {
    return this.http.post<Order>(`${API_URL}/api/orders`, { user_id: userId });
  }

  confirmOrder(id: number): Observable<Order> {
    return this.http.put<Order>(`${API_URL}/api/orders/${id}/confirm`, {});
  }

  cancelOrder(id: number): Observable<Order> {
    return this.http.put<Order>(`${API_URL}/api/orders/${id}/cancel`, {});
  }

  // ── TABLEAU DE BORD GÉRANT (ANALYTICS) ─────────────────────
  getAnalytics(): Observable<OrderAnalytics> {
    return this.http.get<OrderAnalytics>(`${API_URL}/api/orders/analytics`);
  }
}
