import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { NotifyService } from '../../../core/notify.service';
import { VenuesApiService } from '../venues-api.service';
import { DAYS, Field, SPORTS, Venue, amenity, hhmm, sportEmoji } from '../venues.models';
import { FieldModalComponent } from './field-modal.component';
import { VenueModalComponent } from './venue-modal.component';

/**
 * Cockpit du gérant : ses complexes, ses terrains et leur disponibilité.
 * Les données viennent de GET /api/venues/my-venues (ADMIN : tous les complexes).
 */
@Component({
  selector: 'app-gerant-dashboard',
  imports: [FormsModule, RouterLink, VenueModalComponent, FieldModalComponent],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ isAdmin() ? 'Administration · Complexes' : 'Espace gérant' }}</p>
        <h1>{{ isAdmin() ? 'Tous les complexes' : 'Mes complexes & terrains' }}</h1>
        <p class="muted">Gérez vos complexes, vos horaires et la disponibilité de chaque terrain.</p>
      </div>
      <div class="actions">
        <a class="btn ghost" routerLink="/venues/catalog">👁️ Aperçu public</a>
        <button class="btn ghost" (click)="openField(null)" [disabled]="venues().length === 0"
                [title]="venues().length ? '' : 'Créez d’abord un complexe'">＋ Ajouter un terrain</button>
        <button class="btn primary" (click)="openVenue(null)">＋ Nouveau complexe</button>
      </div>
    </header>

    <section class="kpis" aria-label="Indicateurs">
      <div class="kpi"><span class="kpi-value">{{ venues().length }}</span><span class="kpi-label">complexe(s)</span></div>
      <div class="kpi"><span class="kpi-value">{{ fields().length }}</span><span class="kpi-label">terrain(s)</span></div>
      <div class="kpi">
        <span class="kpi-value">{{ availableCount() }}<small> / {{ maintenanceCount() }}</small></span>
        <span class="kpi-label">disponibles / en maintenance</span>
      </div>
      <div class="kpi accent"><span class="kpi-value">{{ avgPrice() }}</span><span class="kpi-label">tarif horaire moyen</span></div>
    </section>

    @if (error()) { <div class="alert" role="alert">{{ error() }} <button class="btn small ghost" (click)="load()">Réessayer</button></div> }

    <div class="seg tabs" role="tablist" aria-label="Sections">
      <button class="seg-btn" role="tab" [class.on]="tab() === 'venues'" (click)="tab.set('venues')">🏟️ Mes complexes <span class="pill">{{ venues().length }}</span></button>
      <button class="seg-btn" role="tab" [class.on]="tab() === 'fields'" (click)="tab.set('fields')">⚽ Gestion des terrains <span class="pill">{{ fields().length }}</span></button>
    </div>

    @if (loading()) {
      <div class="panel"><p class="empty">Chargement…</p></div>
    } @else if (tab() === 'venues') {
      <!-- ═════════ Onglet 1 : complexes ═════════ -->
      @if (venues().length === 0) {
        <div class="panel empty-state">
          <p class="empty-title">Vous n’avez encore aucun complexe.</p>
          <p class="muted">Créez votre premier complexe, ajoutez ses horaires puis ses terrains : ils apparaîtront dans le catalogue.</p>
          <button class="btn primary" (click)="openVenue(null)">＋ Créer mon premier complexe</button>
        </div>
      }
      <div class="venue-list">
        @for (v of venues(); track v.id) {
          <article class="panel venue-panel" [class.inactive]="v.status === 'INACTIVE'">
            <div class="thumb" [style.background-image]="cover(v)" aria-hidden="true"></div>
            <div class="info">
              <div class="title-row">
                <h2>{{ v.name }}</h2>
                <span class="pill" [class.ok-pill]="v.status === 'ACTIVE'" [class.warn-pill]="v.status !== 'ACTIVE'">
                  {{ v.status === 'ACTIVE' ? 'Visible au public' : 'Masqué' }}</span>
                @if (isAdmin()) { <span class="pill">Gérant #{{ v.owner_id ?? '—' }}</span> }
              </div>
              <p class="muted small">📍 {{ v.city }}@if (v.address) { · {{ v.address }} }@if (v.phone) { · 📞 {{ v.phone }} }</p>
              <div class="meta">
                <span>⚽ {{ v.fields_count }} terrain(s) · {{ v.available_fields }} disponible(s)</span>
                @if (v.sports.length) { <span>{{ sportsLabel(v) }}</span> }
              </div>
              <div class="amen">
                @for (a of v.amenities_list; track a) { <span class="pill">{{ amenity(a).emoji }} {{ amenity(a).label }}</span> }
                @if (!v.amenities_list.length) { <span class="muted small">Aucune commodité renseignée</span> }
              </div>
              <p class="hours small"><b>Horaires :</b> {{ hoursLabel(v) }}</p>
            </div>
            <div class="venue-actions">
              <button class="btn small ghost" (click)="openVenue(v)">✏️ Modifier le complexe</button>
              <button class="btn small ghost" (click)="openVenue(v, 'hours')">🕒 Gérer les horaires</button>
              <button class="btn small ghost" (click)="openField(null, v.id)">＋ Terrain</button>
              <button class="btn small danger" (click)="removeVenue(v)">Supprimer</button>
            </div>
          </article>
        }
      </div>
    } @else {
      <!-- ═════════ Onglet 2 : terrains ═════════ -->
      <div class="toolbar">
        <select aria-label="Filtrer par complexe" [ngModel]="venueFilter()" (ngModelChange)="venueFilter.set($event)">
          <option [ngValue]="null">Tous mes complexes</option>
          @for (v of venues(); track v.id) { <option [ngValue]="v.id">{{ v.name }}</option> }
        </select>
        <select aria-label="Filtrer par discipline" [ngModel]="sportFilter()" (ngModelChange)="sportFilter.set($event)">
          <option value="">Toutes les disciplines</option>
          @for (s of sportOptions(); track s) { <option [value]="s">{{ sportEmoji(s) }} {{ s }}</option> }
        </select>
        <input type="search" placeholder="Rechercher un terrain…" aria-label="Rechercher" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </div>
      <div class="panel table-wrap">
        @if (visibleFields().length === 0) {
          <p class="empty">Aucun terrain.@if (venues().length) { <button class="btn small ghost" (click)="openField(null)">＋ Ajouter un terrain</button> }</p>
        } @else {
          <table>
            <thead><tr><th>Terrain</th><th>Complexe</th><th>Discipline</th><th>Surface</th><th>Type</th><th>Prix / h</th><th>Statut</th><th class="end">Actions</th></tr></thead>
            <tbody>
              @for (f of visibleFields(); track f.id) {
                <tr [class.row-off]="f.status === 'MAINTENANCE'">
                  <td><strong>{{ f.name }}</strong></td>
                  <td>{{ f.venue_name }}</td>
                  <td>{{ sportEmoji(f.sport) }} {{ f.sport }}</td>
                  <td>{{ f.surface || '—' }}</td>
                  <td>{{ f.is_indoor ? '🏠 Couvert' : '☀️ Plein air' }}</td>
                  <td><b>{{ f.price }} DT</b></td>
                  <td>
                    <button class="switch" role="switch" [attr.aria-checked]="f.status === 'AVAILABLE'" [disabled]="toggling() === f.id"
                            (click)="toggle(f)" [attr.aria-label]="'Disponibilité de ' + f.name">
                      <span class="track"><span class="knob"></span></span>
                      <span class="lbl">{{ f.status === 'AVAILABLE' ? 'Disponible' : 'Maintenance' }}</span>
                    </button>
                  </td>
                  <td class="end">
                    <button class="btn small ghost" (click)="openField(f)">Modifier</button>
                    <button class="btn small danger" (click)="removeField(f)">Supprimer</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }

    @if (venueModal(); as vm) {
      <app-venue-modal [venue]="vm.venue" [startTab]="vm.tab" (saved)="onSaved()" (close)="venueModal.set(null)" />
    }
    @if (fieldModal(); as fm) {
      <app-field-modal [venues]="venues()" [field]="fm.field" [defaultVenueId]="fm.venueId" (saved)="onSaved()" (close)="fieldModal.set(null)" />
    }
  `,
  styles: [`
    .tabs { margin-bottom: 1rem; }
    .empty-state { text-align: center; padding: 2rem 1rem; }
    .venue-list { display: grid; gap: 1rem; }
    .venue-panel { margin: 0; display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 1.1rem; align-items: start; }
    .venue-panel.inactive { opacity: .8; }
    .thumb { width: 150px; height: 110px; border-radius: 10px; background: var(--court) center / cover no-repeat; }
    .title-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .title-row h2 { font-size: 1.15rem; }
    .info p { margin: .3rem 0; }
    .meta { display: flex; gap: 1rem; flex-wrap: wrap; font-size: .9rem; margin: .3rem 0 .5rem; }
    .amen { display: flex; flex-wrap: wrap; gap: .35rem; }
    .hours { color: var(--muted); }
    .venue-actions { display: flex; flex-direction: column; gap: .4rem; align-items: stretch; }
    .toolbar { display: flex; gap: .6rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .toolbar select, .toolbar input { width: auto; flex: 0 1 240px; }
    tr.row-off td { background: #fffaf0; }
    .switch { display: inline-flex; align-items: center; gap: .5rem; border: 0; background: transparent; cursor: pointer; font: inherit; padding: 0; }
    .switch .track { width: 2.6rem; height: 1.45rem; border-radius: 99px; background: var(--amber); position: relative; transition: background .15s; flex: none; }
    .switch .knob { position: absolute; top: .15rem; left: .15rem; width: 1.15rem; height: 1.15rem; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .15s; }
    .switch[aria-checked='true'] .track { background: var(--pitch); }
    .switch[aria-checked='true'] .knob { transform: translateX(1.15rem); }
    .switch .lbl { font-size: .85rem; font-weight: 600; min-width: 6.5rem; text-align: left; }
    .switch:disabled { opacity: .6; cursor: wait; }
    @media (max-width: 860px) {
      .venue-panel { grid-template-columns: 1fr; }
      .thumb { width: 100%; height: 140px; }
      .venue-actions { flex-direction: row; flex-wrap: wrap; }
    }
  `],
})
export class GerantDashboardComponent implements OnInit {
  private api = inject(VenuesApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  readonly amenity = amenity;
  readonly sportEmoji = sportEmoji;

  venues = signal<Venue[]>([]);
  loading = signal(true);
  error = signal('');
  tab = signal<'venues' | 'fields'>('venues');
  toggling = signal<number | null>(null);
  venueFilter = signal<number | null>(null);
  sportFilter = signal('');
  q = signal('');
  venueModal = signal<{ venue: Venue | null; tab: 'info' | 'hours' } | null>(null);
  fieldModal = signal<{ field: Field | null; venueId: number | null } | null>(null);

  isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  fields = computed(() => this.venues().flatMap((v) => (v.fields ?? []).map((f) => ({ ...f, venue_name: f.venue_name ?? v.name }))));
  availableCount = computed(() => this.fields().filter((f) => f.status === 'AVAILABLE').length);
  maintenanceCount = computed(() => this.fields().filter((f) => f.status === 'MAINTENANCE').length);
  avgPrice = computed(() => {
    const f = this.fields();
    return f.length ? `${Math.round(f.reduce((s, x) => s + x.price, 0) / f.length)} DT` : '—';
  });
  sportOptions = computed(() => [...new Set([...SPORTS.map((s) => s.id), ...this.fields().map((f) => f.sport)])]);
  visibleFields = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.fields().filter(
      (f) =>
        (this.venueFilter() === null || f.venue_id === this.venueFilter()) &&
        (!this.sportFilter() || f.sport === this.sportFilter()) &&
        (!q || `${f.name} ${f.sport} ${f.surface ?? ''}`.toLowerCase().includes(q)),
    );
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.getMyVenues().subscribe({
      next: (v) => { this.venues.set(v); this.loading.set(false); },
      error: (e) => { this.error.set(e.message ?? 'Service des complexes indisponible.'); this.loading.set(false); },
    });
  }

  openVenue(venue: Venue | null, tab: 'info' | 'hours' = 'info') {
    this.venueModal.set({ venue, tab });
  }

  openField(field: Field | null, venueId: number | null = null) {
    this.fieldModal.set({ field, venueId });
  }

  onSaved() {
    this.venueModal.set(null);
    this.fieldModal.set(null);
    this.load();
  }

  /** Bascule Disponible / Maintenance, mise à jour immédiate de la ligne. */
  toggle(f: Field) {
    this.toggling.set(f.id);
    this.api.toggleMaintenance(f.id).subscribe({
      next: (u) => {
        this.toggling.set(null);
        this.venues.update((list) =>
          list.map((v) => {
            if (v.id !== u.venue_id) return v;
            const fields = (v.fields ?? []).map((x) => (x.id === u.id ? u : x));
            return { ...v, fields, available_fields: fields.filter((x) => x.status === 'AVAILABLE').length };
          }),
        );
        this.notify.success(u.status === 'AVAILABLE' ? `« ${u.name} » est de nouveau réservable.` : `« ${u.name} » est passé en maintenance.`);
      },
      error: (e) => { this.toggling.set(null); this.notify.error(e); },
    });
  }

  removeVenue(v: Venue) {
    if (!confirm(`Supprimer le complexe « ${v.name} » et ses ${v.fields_count} terrain(s) ? Cette action est définitive.`)) return;
    this.api.deleteVenue(v.id).subscribe({
      next: () => { this.notify.success(`Complexe « ${v.name} » supprimé.`); this.load(); },
      error: (e) => this.notify.error(e),
    });
  }

  removeField(f: Field) {
    if (!confirm(`Supprimer le terrain « ${f.name} » ?`)) return;
    this.api.deleteField(f.id).subscribe({
      next: () => { this.notify.success(`Terrain « ${f.name} » supprimé.`); this.load(); },
      error: (e) => this.notify.error(e),
    });
  }

  cover(v: Venue) {
    return v.image_url ? `url("${v.image_url}")` : 'linear-gradient(135deg, var(--court) 0%, var(--pitch) 140%)';
  }

  sportsLabel(v: Venue) {
    return v.sports.map((s) => `${sportEmoji(s)} ${s}`).join(' · ');
  }

  /** "Lun–Ven 08:00–23:00 · Sam 09:00–20:00 · Dim fermé" (jours consécutifs regroupés). */
  hoursLabel(v: Venue): string {
    const hours = v.opening_hours ?? [];
    if (!hours.length) return 'non renseignés';
    const slot = (d: string) => {
      const h = hours.find((x) => x.day === d);
      return h ? `${hhmm(h.opening_time)}–${hhmm(h.closing_time)}` : 'fermé';
    };
    const groups: { from: string; to: string; slot: string }[] = [];
    for (const d of DAYS) {
      const s = slot(d);
      const last = groups.at(-1);
      if (last && last.slot === s) last.to = d;
      else groups.push({ from: d, to: d, slot: s });
    }
    const short = (d: string) => d.slice(0, 3);
    return groups.map((g) => `${short(g.from)}${g.from !== g.to ? '–' + short(g.to) : ''} ${g.slot}`).join(' · ');
  }
}
