import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotifyService } from '../../core/notify.service';
import { MarketplaceApiService } from './marketplace-api.service';
import { OrderAnalytics } from './marketplace.models';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Administration Boutique · SportBook</p>
        <h1>Tableau de Bord &amp; Chiffre d'Affaires</h1>
        <p class="muted">Indicateurs clés de performance et analyse décisionnelle des ventes en temps réel.</p>
      </div>
      <div class="actions">
        <a class="btn ghost" routerLink="/marketplace/products">Catalogue</a>
        <a class="btn ghost" routerLink="/marketplace/orders">Commandes</a>
        <button class="btn primary" (click)="loadAnalytics()" [disabled]="loading()">
          {{ loading() ? 'Calcul en cours...' : '↻ Actualiser' }}
        </button>
      </div>
    </header>

    @if (loading()) {
      <div class="card-grid">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="t-card skeleton" style="height: 120px;"></div>
        }
      </div>
    } @else if (data() !== null) {
      <!-- INDICATEURS CLÉS (KPIS) -->
      <section class="kpis" aria-label="Indicateurs clés">
        <div class="kpi accent">
          <span class="kpi-value">{{ data()!.total_revenue | number:'1.2-2' }} <small>DT</small></span>
          <span class="kpi-label">Chiffre d'affaires total</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ data()!.total_orders }}</span>
          <span class="kpi-label">Volume total commandes</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ data()!.average_order_value | number:'1.2-2' }} <small>DT</small></span>
          <span class="kpi-label">Panier moyen client</span>
        </div>
        <div class="kpi">
          <span class="kpi-value green-kpi">{{ data()!.confirmed_orders }}</span>
          <span class="kpi-label">Commandes honorées</span>
        </div>
      </section>

      <!-- ÉTAT DU FLUX DES COMMANDES -->
      <div class="panel status-breakdown">
        <h2>Flux des commandes de la boutique</h2>
        <div class="status-grid">
          <div class="status-box pending-box">
            <span class="status-count">{{ data()!.pending_orders }}</span>
            <span class="status-name">⏳ En attente de préparation</span>
          </div>
          <div class="status-box confirmed-box">
            <span class="status-count">{{ data()!.confirmed_orders }}</span>
            <span class="status-name">✓ Confirmées / Remises au client</span>
          </div>
          <div class="status-box cancelled-box">
            <span class="status-count">{{ data()!.cancelled_orders }}</span>
            <span class="status-name">✕ Annulées (stock restitué)</span>
          </div>
        </div>
      </div>

      <!-- LEADERBOARD TOP 5 DES VENTES -->
      <div class="panel leaderboard-panel">
        <div class="leaderboard-head">
          <h2>🏆 Top 5 des Équipements les Plus Vendus</h2>
          <span class="muted small">Classement calculé sur la base des commandes confirmées</span>
        </div>

        @if (data()!.top_selling_products.length === 0) {
          <p class="muted">Aucune vente enregistrée pour le moment.</p>
        } @else {
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th style="width: 70px;">Rang</th>
                <th>Désignation de l'article</th>
                <th style="text-align: center;">Quantités écoulées</th>
                <th style="text-align: right;">Revenu généré</th>
              </tr>
            </thead>
            <tbody>
              @for (item of data()!.top_selling_products; track item.product_id; let idx = $index) {
                <tr>
                  <td>
                    <span class="rank-badge" [class.gold]="idx === 0" [class.silver]="idx === 1" [class.bronze]="idx === 2">
                      #{{ idx + 1 }}
                    </span>
                  </td>
                  <td>
                    <strong>{{ item.product_name }}</strong>
                    <span class="muted small block">Réf Produit #{{ item.product_id }}</span>
                  </td>
                  <td style="text-align: center;">
                    <span class="qty-pill">{{ item.total_quantity_sold }} vendus</span>
                  </td>
                  <td style="text-align: right;" class="bold revenue-cell">
                    {{ item.total_revenue | number:'1.2-2' }} DT
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }
  `,
  styles: [`
    .green-kpi {
      color: var(--pitch, #1e8e5a) !important;
    }
    .status-breakdown {
      margin: 1.5rem 0;
      background: var(--panel, #ffffff);
      border: 1px solid var(--line-soft, #e8eef3);
      border-radius: var(--radius, 12px);
      padding: 1.25rem;
      box-shadow: var(--shadow);
    }
    .status-breakdown h2 {
      font-size: 1.15rem;
      margin-bottom: 1rem;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .status-box {
      display: flex;
      flex-direction: column;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }
    .status-count {
      font-size: 1.8rem;
      font-weight: 800;
      line-height: 1.2;
    }
    .status-name {
      font-size: 0.85rem;
      margin-top: 0.35rem;
      font-weight: 600;
    }
    .pending-box {
      background: var(--amber-soft, #fbf3e2);
      color: var(--amber, #b7791f);
      border: 1px solid #fed7aa;
    }
    .confirmed-box {
      background: var(--pitch-soft, #e6f4ec);
      color: var(--pitch, #1e8e5a);
      border: 1px solid #bbf7d0;
    }
    .cancelled-box {
      background: var(--danger-soft, #fbeceb);
      color: var(--danger, #b3372d);
      border: 1px solid #fecaca;
    }
    .leaderboard-panel {
      background: var(--panel, #ffffff);
      border: 1px solid var(--line-soft, #e8eef3);
      border-radius: var(--radius, 12px);
      padding: 1.5rem;
      box-shadow: var(--shadow);
    }
    .leaderboard-head {
      margin-bottom: 1.2rem;
    }
    .leaderboard-table {
      width: 100%;
      border-collapse: collapse;
    }
    .leaderboard-table th, .leaderboard-table td {
      padding: 0.85rem 0.6rem;
      border-bottom: 1px solid var(--line-soft, #e8eef3);
      text-align: left;
    }
    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--chalk, #f2f5f8);
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--muted, #5b6b79);
    }
    .rank-badge.gold {
      background: #fef08a;
      color: #854d0e;
    }
    .rank-badge.silver {
      background: #e2e8f0;
      color: #334155;
    }
    .rank-badge.bronze {
      background: #fed7aa;
      color: #9a3412;
    }
    .qty-pill {
      background: var(--chalk, #f2f5f8);
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-weight: 600;
      color: var(--ink, #16222e);
      font-size: 0.85rem;
    }
    .revenue-cell {
      color: var(--court, #1d4f91);
      font-size: 1.05rem;
    }
  `],
})
export class AnalyticsComponent implements OnInit {
  private api = inject(MarketplaceApiService);
  private notify = inject(NotifyService);

  readonly data = signal<OrderAnalytics | null>(null);
  readonly loading = signal(true);

  ngOnInit() {
    this.loadAnalytics();
  }

  loadAnalytics() {
    this.loading.set(true);
    this.api.getAnalytics().subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }
}
