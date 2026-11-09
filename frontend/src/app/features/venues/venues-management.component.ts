import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VenuesApiService } from './venues-api.service';
import { Venue, Field } from './venues.models';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-venues-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <div>
        <p class="eyebrow">Administration & Gérance</p>
        <h1>Gestion des Espaces & Terrains</h1>
        <p class="muted">Consultez l'ensemble de votre parc sportif et gérez vos tarifications.</p>
      </div>

      <div class="actions">
        <a routerLink="/venues/catalog" class="btn ghost">
          👁️ Voir le catalogue public
        </a>
      </div>
    </div>

    <!-- ═════════ INDICATEURS CLÉS (KPIS) ═════════ -->
    <div class="kpi-grid">
      <div class="panel kpi-card">
        <span class="kpi-label">Total Complexes</span>
        <span class="kpi-value">{{ venues().length }}</span>
        <span class="kpi-hint">Salles et clubs répertoriés</span>
      </div>

      <div class="panel kpi-card">
        <span class="kpi-label">Total Terrains</span>
        <span class="kpi-value">{{ fields().length }}</span>
        <span class="kpi-hint">Terrains disponibles à la réservation</span>
      </div>

      <div class="panel kpi-card">
        <span class="kpi-label">Prix Moyen</span>
        <span class="kpi-value">{{ averagePrice() }} DT</span>
        <span class="kpi-hint">Tarif horaire moyen</span>
      </div>

      <div class="panel kpi-card">
        <span class="kpi-label">État du Microservice</span>
        <span class="kpi-value status-up">UP · 8082</span>
        <span class="kpi-hint">Eureka & Actuator actifs</span>
      </div>
    </div>

    <!-- ═════════ TABLEAU DES TERRAINS ═════════ -->
    <div class="panel">
      <div class="table-header-row">
        <div>
          <h2>Inventaire des Terrains</h2>
          <p class="muted small">Liste consolidée de tous les terrains rattachés aux complexes.</p>
        </div>

        <div class="search-input-wrap">
          <input
            type="text"
            placeholder="Filtrer les terrains..."
            [(ngModel)]="filterField"
          />
        </div>
      </div>

      @if (loading()) {
        <p class="empty">Chargement de l'inventaire...</p>
      } @else if (filteredFields().length === 0) {
        <p class="empty">Aucun terrain enregistré.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom du terrain</th>
                <th>Discipline</th>
                <th>Complexe sportif</th>
                <th>Prix / Heure</th>
                <th class="end">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (f of filteredFields(); track f.id) {
                <tr>
                  <td><code>#{{ f.id }}</code></td>
                  <td><strong>{{ f.name }}</strong></td>
                  <td>
                    <span class="sport-badge">{{ f.sport }}</span>
                  </td>
                  <td>{{ getVenueName(f.venue_id || f.venueId) }}</td>
                  <td><strong>{{ f.price }} DT</strong></td>
                  <td class="end">
                    <button class="btn danger small" (click)="deleteField(f)">
                      Supprimer
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      border-left: 4px solid var(--court);
    }
    .kpi-label {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .kpi-value {
      font-family: var(--font-head);
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--ink);
    }
    .kpi-value.status-up {
      color: var(--pitch);
      font-size: 1.3rem;
    }
    .kpi-hint {
      font-size: 0.78rem;
      color: var(--muted);
    }
    .table-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .table-header-row h2 {
      margin: 0;
    }
    .search-input-wrap input {
      max-width: 250px;
    }
    .sport-badge {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: var(--court-soft);
      color: var(--court-dark);
    }
  `]
})
export class VenuesManagementComponent implements OnInit {
  private api = inject(VenuesApiService);
  private notify = inject(NotifyService);

  venues = signal<Venue[]>([]);
  fields = signal<Field[]>([]);
  loading = signal(true);
  filterField = '';

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading.set(true);
    this.api.getVenues().subscribe({
      next: (venues) => {
        this.venues.set(Array.isArray(venues) ? venues : []);
        this.api.getFields().subscribe({
          next: (fields) => {
            this.fields.set(Array.isArray(fields) ? fields : []);
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  averagePrice = computed(() => {
    const fls = this.fields();
    if (fls.length === 0) return 0;
    const sum = fls.reduce((acc, f) => acc + (f.price || 0), 0);
    return Math.round(sum / fls.length);
  });

  filteredFields = computed(() => {
    const q = this.filterField.trim().toLowerCase();
    if (!q) return this.fields();
    return this.fields().filter(
      (f) => f.name.toLowerCase().includes(q) || f.sport.toLowerCase().includes(q)
    );
  });

  getVenueName(venueId?: number): string {
    if (!venueId) return 'Non attribué';
    const v = this.venues().find((item) => item.id === venueId);
    return v ? v.name : `Complexe #${venueId}`;
  }

  deleteField(f: Field) {
    if (!f.id) return;
    if (confirm(`Supprimer le terrain "${f.name}" ?`)) {
      this.api.deleteField(f.id).subscribe({
        next: () => {
          this.notify.success('Terrain supprimé.');
          this.loadAll();
        },
        error: () => this.notify.error('Erreur de suppression.')
      });
    }
  }
}
