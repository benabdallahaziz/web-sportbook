import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { MarketplaceApiService } from './marketplace-api.service';
import { Cart, Product, ProductRecommendation } from './marketplace.models';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Boutique Sportive · SportBook</p>
        <h1>Mon Panier d'Équipements</h1>
        <p class="muted">Vérifiez vos articles, ajustez vos quantités et validez votre commande.</p>
      </div>
      <div class="actions">
        <a class="btn ghost" routerLink="/marketplace/products">← Continuer mes achats</a>
        <a class="btn ghost" routerLink="/marketplace/orders">📦 Mes commandes</a>
      </div>
    </header>

    @if (loading()) {
      <div class="panel skeleton" style="height: 200px;"></div>
    } @else if (!cart() || cart()!.items.length === 0) {
      <div class="panel empty-state">
        <p class="empty-title">Votre panier est actuellement vide. 🛒</p>
        <p class="muted">Découvrez nos ballons, raquettes et accessoires dans le catalogue.</p>
        <a class="btn primary" routerLink="/marketplace/products" style="margin-top: 1rem;">
          Explorer les équipements
        </a>
      </div>
    } @else {
      <div class="cart-layout">
        <!-- LISTE DES ARTICLES DU PANIER -->
        <div class="panel items-panel">
          <div class="items-head">
            <h2>Articles sélectionnés ({{ cart()!.items.length }})</h2>
            <button class="btn ghost small danger-text" (click)="clearCart()">Vider le panier</button>
          </div>

          <table class="cart-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Prix unitaire</th>
                <th style="text-align: center;">Quantité</th>
                <th>Sous-total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of cart()!.items; track item.product_id) {
                <tr>
                  <td>
                    <strong>{{ item.product?.name || ('Produit #' + item.product_id) }}</strong>
                    @if (item.product?.category_id) {
                      <span class="muted small block">Réf: #{{ item.product_id }}</span>
                    }
                  </td>
                  <td>{{ item.unit_price | number:'1.2-2' }} DT</td>
                  <td style="text-align: center;">
                    <div class="qty-control">
                      <button class="qty-btn" (click)="updateQuantity(item.product_id, -1)" [disabled]="updating()">-</button>
                      <span class="qty-val">{{ item.quantity }}</span>
                      <button class="qty-btn" (click)="updateQuantity(item.product_id, 1)" [disabled]="updating()">+</button>
                    </div>
                  </td>
                  <td class="bold">{{ (item.unit_price * item.quantity) | number:'1.2-2' }} DT</td>
                  <td>
                    <button class="btn ghost small trash-btn" (click)="removeItem(item.product_id)" title="Retirer">
                      ✕
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- RÉSUMÉ COMMANDE -->
        <div class="panel summary-panel">
          <h2>Récapitulatif</h2>
          <div class="summary-line">
            <span>Sous-total articles</span>
            <span>{{ cart()!.total | number:'1.2-2' }} DT</span>
          </div>
          <div class="summary-line">
            <span>Retrait au complexe sportif</span>
            <span class="free-tag">Gratuit</span>
          </div>
          <hr />
          <div class="summary-line total-line">
            <span>Total à payer</span>
            <span class="total-price">{{ cart()!.total | number:'1.2-2' }} DT</span>
          </div>

          <button
            class="btn primary wide checkout-btn"
            [disabled]="ordering()"
            (click)="checkout()"
          >
            {{ ordering() ? 'Validation en cours...' : 'Valider la commande' }}
          </button>
          <p class="muted small text-center" style="margin-top: 0.75rem;">
            Paiement sécurisé · Décrémentation automatique des stocks.
          </p>
        </div>
      </div>
    }

    <!-- RECOMMANDATIONS BASÉES SUR LE PANIER (IA) -->
    @if (cart() && cart()!.items.length > 0) {
      <section class="cart-recs-section">
        <div class="section-title">
          <h2>💡 Complétez votre panier (Recommandations IA)</h2>
          <p class="muted">Sélection intelligente calculée par l'algorithme TF-IDF selon vos articles en cours.</p>
        </div>

        @if (loadingRecs()) {
          <div class="card-grid">
            @for (i of [1, 2, 3]; track i) {
              <div class="t-card skeleton" style="height: 160px;"></div>
            }
          </div>
        } @else if (cartRecs().length > 0) {
          <div class="card-grid">
            @for (r of cartRecs(); track r.product.id) {
              <article class="t-card rec-card">
                <div class="t-card-top">
                  <span class="badge ai-badge">{{ r.match_percentage }} pertinent</span>
                  <span class="stock-tag">{{ r.product.stock > 0 ? 'En stock' : 'Rupture' }}</span>
                </div>
                <h3>{{ r.product.name }}</h3>
                <div class="product-footer">
                  <span class="price-val">{{ r.product.price | number:'1.2-2' }} DT</span>
                  <button class="btn primary small" (click)="addQuick(r.product)">+ Ajouter</button>
                </div>
              </article>
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    .cart-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 900px) {
      .cart-layout {
        grid-template-columns: 1fr;
      }
    }
    .items-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--line-soft, #e8eef3);
      padding-bottom: 0.75rem;
    }
    .danger-text {
      color: var(--danger, #b3372d);
    }
    .danger-text:hover {
      background: var(--danger-soft, #fbeceb);
    }
    .cart-table {
      width: 100%;
      border-collapse: collapse;
    }
    .cart-table th, .cart-table td {
      padding: 0.85rem 0.6rem;
      border-bottom: 1px solid var(--line-soft, #e8eef3);
      text-align: left;
    }
    .qty-control {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: var(--chalk, #f2f5f8);
      border: 1px solid var(--line, #d5dee6);
      border-radius: 6px;
      padding: 0.15rem 0.3rem;
    }
    .qty-btn {
      border: none;
      background: #ffffff;
      border-radius: 4px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-weight: bold;
      color: var(--ink, #16222e);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line, #d5dee6);
    }
    .qty-val {
      min-width: 24px;
      text-align: center;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .trash-btn {
      color: var(--muted, #5b6b79);
    }
    .trash-btn:hover {
      color: var(--danger, #b3372d);
      background: var(--danger-soft, #fbeceb);
    }
    .summary-panel {
      background: #ffffff;
      border: 1px solid var(--line-soft, #e8eef3);
      border-radius: var(--radius, 12px);
      padding: 1.5rem;
      box-shadow: var(--shadow);
    }
    .summary-line {
      display: flex;
      justify-content: space-between;
      margin: 0.75rem 0;
      font-size: 0.95rem;
      color: var(--muted, #5b6b79);
    }
    .free-tag {
      color: var(--pitch, #1e8e5a);
      font-weight: 600;
    }
    .total-line {
      margin-top: 1rem;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--ink, #16222e);
    }
    .total-price {
      color: var(--court, #1d4f91);
      font-size: 1.35rem;
    }
    .checkout-btn {
      width: 100%;
      margin-top: 1.25rem;
      padding: 0.85rem;
      font-size: 1rem;
    }
    .cart-recs-section {
      margin-top: 3rem;
    }
    .section-title {
      margin-bottom: 1.25rem;
    }
    .ai-badge {
      background: #f3e8ff;
      color: #7e22ce;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .rec-card h3 {
      font-size: 1rem;
      margin: 0.5rem 0 1rem 0;
    }
    .product-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.5rem;
    }
  `],
})
export class CartComponent implements OnInit {
  private api = inject(MarketplaceApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly cart = signal<Cart | null>(null);
  readonly loading = signal(true);
  readonly updating = signal(false);
  readonly ordering = signal(false);

  readonly cartRecs = signal<ProductRecommendation[]>([]);
  readonly canBuy = computed(() => !this.auth.hasRole('ADMIN', 'GERANT'));
  readonly loadingRecs = signal(false);

  private get userId(): number {
    const u = this.auth.user();
    return u ? u.id : 1;
  }

  ngOnInit() {
    if (!this.canBuy()) {
      this.router.navigate(['/marketplace/products']);
      return;
    }
    this.loadCart();
  }

  loadCart() {
    this.loading.set(true);
    this.api.getCart(this.userId).subscribe({
      next: (c) => {
        this.cart.set(c);
        this.loading.set(false);
        if (c.items.length > 0) {
          this.loadRecs();
        }
      },
      error: (err) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }

  loadRecs() {
    this.loadingRecs.set(true);
    this.api.getCartRecommendations(this.userId, 3).subscribe({
      next: (recs) => {
        this.cartRecs.set(recs);
        this.loadingRecs.set(false);
      },
      error: () => this.loadingRecs.set(false),
    });
  }

  updateQuantity(productId: number, delta: number) {
    const currentItem = this.cart()?.items.find((i) => i.product_id === productId);
    if (!currentItem) return;

    if (delta < 0 && currentItem.quantity <= 1) {
      this.removeItem(productId);
      return;
    }

    this.updating.set(true);
    this.api.addToCart(this.userId, productId, delta).subscribe({
      next: (updatedCart) => {
        this.cart.set(updatedCart);
        this.updating.set(false);
      },
      error: (err) => {
        this.updating.set(false);
        this.notify.error(err);
      },
    });
  }

  removeItem(productId: number) {
    this.updating.set(true);
    this.api.removeFromCart(this.userId, productId).subscribe({
      next: (updatedCart) => {
        this.cart.set(updatedCart);
        this.updating.set(false);
        this.notify.info('Article retiré du panier.');
        if (updatedCart.items.length > 0) {
          this.loadRecs();
        } else {
          this.cartRecs.set([]);
        }
      },
      error: (err) => {
        this.updating.set(false);
        this.notify.error(err);
      },
    });
  }

  clearCart() {
    if (!confirm('Vider complètement votre panier ?')) return;
    this.api.clearCart(this.userId).subscribe({
      next: () => {
        this.notify.info('Panier vidé.');
        this.loadCart();
      },
      error: (err) => this.notify.error(err),
    });
  }

  addQuick(product: Product) {
    this.api.addToCart(this.userId, product.id, 1).subscribe({
      next: (c) => {
        this.cart.set(c);
        this.notify.success(`"${product.name}" ajouté au panier ! 🛒`);
        this.loadRecs();
      },
      error: (err) => this.notify.error(err),
    });
  }

  checkout() {
    this.ordering.set(true);
    this.api.createOrder(this.userId).subscribe({
      next: (order) => {
        this.ordering.set(false);
        this.notify.success(`Commande #${order.id} validée avec succès ! 🎉`);
        this.router.navigate(['/marketplace/orders']);
      },
      error: (err) => {
        this.ordering.set(false);
        this.notify.error(err);
      },
    });
  }
}
