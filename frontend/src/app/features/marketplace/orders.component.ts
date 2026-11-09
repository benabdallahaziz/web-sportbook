import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { MarketplaceApiService } from './marketplace-api.service';
import { Order } from './marketplace.models';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Boutique Sportive · SportBook</p>
        <h1>{{ isManager() ? 'Gestion des Commandes' : 'Mes Commandes d’Équipements' }}</h1>
        <p class="muted">
          {{ isManager() ? 'Suivez et traitez les commandes passées par les sportifs.' : 'Consultez l’historique de vos achats et leur statut.' }}
        </p>
      </div>
      <div class="actions">
        <a class="btn ghost" routerLink="/marketplace/products">Catalogue</a>
        <a class="btn ghost" routerLink="/marketplace/cart">Panier</a>
        @if (isManager()) {
          <a class="btn ghost" routerLink="/marketplace/analytics">📊 Chiffre d'Affaires</a>
        }
      </div>
    </header>

    <!-- BARRE DE FILTRES PAR STATUT -->
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filtrer par statut">
        <button class="seg-btn" [class.on]="statusFilter() === ''" (click)="statusFilter.set('')">
          Toutes <i>{{ orders().length }}</i>
        </button>
        <button class="seg-btn" [class.on]="statusFilter() === 'PENDING'" (click)="statusFilter.set('PENDING')">
          En attente <i>{{ countStatus('PENDING') }}</i>
        </button>
        <button class="seg-btn" [class.on]="statusFilter() === 'CONFIRMED'" (click)="statusFilter.set('CONFIRMED')">
          Confirmées <i>{{ countStatus('CONFIRMED') }}</i>
        </button>
        <button class="seg-btn" [class.on]="statusFilter() === 'CANCELLED'" (click)="statusFilter.set('CANCELLED')">
          Annulées <i>{{ countStatus('CANCELLED') }}</i>
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="card-grid">
        @for (i of [1, 2]; track i) {
          <div class="t-card skeleton" style="height: 180px;"></div>
        }
      </div>
    } @else if (filteredOrders().length === 0) {
      <div class="panel empty-state">
        <p class="empty-title">Aucune commande trouvée.</p>
        <a class="btn primary" routerLink="/marketplace/products" style="margin-top: 1rem;">
          Accéder à la boutique
        </a>
      </div>
    } @else {
      <div class="orders-list">
        @for (o of filteredOrders(); track o.id) {
          <article class="panel order-panel">
            <div class="order-header">
              <div class="order-meta">
                <span class="order-id">Commande #{{ o.id }}</span>
                <span class="order-date">{{ o.created_at || 'Aujourd’hui' }}</span>
                @if (isManager()) {
                  <span class="client-badge">Client #{{ o.user_id }}</span>
                }
              </div>
              <div class="order-status-box">
                <span class="status-badge" [attr.data-status]="o.status">
                  {{ o.status === 'PENDING' ? '⏳ En attente' : (o.status === 'CONFIRMED' ? '✓ Confirmée' : '✕ Annulée') }}
                </span>
                <span class="order-total">{{ o.total | number:'1.2-2' }} DT</span>
              </div>
            </div>

            <div class="order-body">
              <table class="order-items-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Prix unitaire</th>
                    <th>Quantité</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of o.items; track item.id) {
                    <tr>
                      <td>{{ item.product?.name || ('Produit #' + item.product_id) }}</td>
                      <td>{{ item.unit_price | number:'1.2-2' }} DT</td>
                      <td>x {{ item.quantity }}</td>
                      <td class="bold">{{ (item.unit_price * item.quantity) | number:'1.2-2' }} DT</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

                        <!-- ACTIONS COMMANDE -->
            @if (o.status === 'PENDING') {
              <div class="order-actions">
                @if (isManager()) {
                  <button
                    class="btn primary small"
                    (click)="confirmOrder(o.id)"
                    [disabled]="acting() === o.id"
                  >
                    ? Confirmer la commande
                  </button>
                }
                <button
                  class="btn danger small"
                  (click)="cancelOrder(o.id)"
                  [disabled]="acting() === o.id"
                >
                  {{ isManager() ? 'Annuler & restituer le stock' : '? Annuler ma commande' }}
                </button>
              </div>
            }
          </article>
        }
      </div>
    }
  `,
  styles: [`
    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .order-panel {
      border: 1px solid var(--line-soft, #e8eef3);
      border-radius: var(--radius, 12px);
      padding: 1.25rem;
      background: var(--panel, #ffffff);
      box-shadow: var(--shadow);
    }
    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--line-soft, #e8eef3);
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .order-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .order-id {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--ink, #16222e);
    }
    .order-date {
      color: var(--muted, #5b6b79);
      font-size: 0.85rem;
    }
    .client-badge {
      background: var(--court-soft, #eaf1fb);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      color: var(--court, #1d4f91);
      font-weight: 600;
    }
    .order-status-box {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .status-badge {
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .status-badge[data-status="PENDING"] {
      background: var(--amber-soft, #fbf3e2);
      color: var(--amber, #b7791f);
    }
    .status-badge[data-status="CONFIRMED"] {
      background: var(--pitch-soft, #e6f4ec);
      color: var(--pitch, #1e8e5a);
    }
    .status-badge[data-status="CANCELLED"] {
      background: var(--danger-soft, #fbeceb);
      color: var(--danger, #b3372d);
    }
    .order-total {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--court, #1d4f91);
    }
    .order-items-table {
      width: 100%;
      margin-top: 0.75rem;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .order-items-table th, .order-items-table td {
      padding: 0.5rem 0.4rem;
      border-bottom: 1px solid var(--line-soft, #e8eef3);
      text-align: left;
    }
    .order-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--line, #d5dee6);
    }
  `],
})
export class OrdersComponent implements OnInit {
  private api = inject(MarketplaceApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly acting = signal<number | null>(null);
  readonly statusFilter = signal('');

  readonly isManager = computed(() => this.auth.hasRole('ADMIN', 'GERANT'));

  readonly filteredOrders = computed(() => {
    const f = this.statusFilter();
    if (!f) return this.orders();
    return this.orders().filter((o) => o.status === f);
  });

  countStatus(status: string): number {
    return this.orders().filter((o) => o.status === status).length;
  }

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    const user = this.auth.user();
    const userId = this.isManager() ? undefined : (user ? user.id : 1);

    this.api.getOrders(userId).subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }

  confirmOrder(orderId: number) {
    this.acting.set(orderId);
    this.api.confirmOrder(orderId).subscribe({
      next: () => {
        this.acting.set(null);
        this.notify.success(`Commande #${orderId} confirmée.`);
        this.loadOrders();
      },
      error: (err) => {
        this.acting.set(null);
        this.notify.error(err);
      },
    });
  }

  cancelOrder(orderId: number) {
    if (!confirm('Annuler cette commande et réintégrer le stock des articles ?')) return;
    this.acting.set(orderId);
    this.api.cancelOrder(orderId).subscribe({
      next: () => {
        this.acting.set(null);
        this.notify.info(`Commande #${orderId} annulée. Stock restitué en base.`);
        this.loadOrders();
      },
      error: (err) => {
        this.acting.set(null);
        this.notify.error(err);
      },
    });
  }
}
