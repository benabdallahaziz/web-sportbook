import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { NotifyService } from '../../../core/notify.service';
import { VenuesApiService } from '../venues-api.service';
import { CITIES, SPORTS, Venue, amenity, sportEmoji } from '../venues.models';
import { VenueDetailModalComponent } from './venue-detail-modal.component';

/**
 * Catalogue public des complexes (sportif / visiteur), façon Playtomic :
 * recherche, filtres instantanés (ville, sport, prix, couvert) et fiche détaillée en modal.
 */
@Component({
  selector: 'app-venues-catalog',
  imports: [FormsModule, RouterLink, VenueDetailModalComponent],
  template: `
    <section class="hero">
      <div class="hero-text">
        <p class="eyebrow light">Terrains & salles</p>
        <h1>Trouvez votre terrain,<br />réservez en un clic.</h1>
        <p>{{ venues().length }} complexe(s) · {{ totalFields() }} terrain(s) partout en Tunisie.</p>
      </div>
      @if (isManager()) {
        <a class="btn hero-btn" routerLink="/venues/gerant">⚙️ Mon espace gérant</a>
      }
    </section>

    <!-- ═════════ Recherche & filtres ═════════ -->
    <section class="panel filters" aria-label="Filtres">
      <div class="filter-row">
        <input class="search" type="search" placeholder="🔍 Nom du complexe, ville, adresse…" aria-label="Rechercher"
               [ngModel]="search()" (ngModelChange)="search.set($event)" />
        <select aria-label="Ville" [ngModel]="city()" (ngModelChange)="city.set($event)">
          <option value="">📍 Toutes les villes</option>
          @for (c of cityOptions(); track c) { <option [value]="c">{{ c }}</option> }
        </select>
        <select aria-label="Prix maximum" [ngModel]="maxPrice()" (ngModelChange)="maxPrice.set($event)">
          <option [ngValue]="null">💰 Tous les prix</option>
          @for (p of prices; track p) { <option [ngValue]="p">≤ {{ p }} DT / h</option> }
        </select>
      </div>
      <div class="filter-row">
        <div class="sport-chips" role="group" aria-label="Sport">
          <button class="chip" [class.on]="!sport()" (click)="sport.set('')">Tous</button>
          @for (s of sports; track s.id) {
            <button class="chip" [class.on]="sport() === s.id" (click)="sport.set(sport() === s.id ? '' : s.id)">{{ s.emoji }} {{ s.label }}</button>
          }
        </div>
        <label class="chip-check indoor" [class.on]="indoorOnly()">
          <input type="checkbox" [ngModel]="indoorOnly()" (ngModelChange)="indoorOnly.set($event)" /> 🏠 Terrains couverts uniquement
        </label>
        @if (activeFilters()) { <button class="btn small ghost" (click)="reset()">Effacer les filtres</button> }
      </div>
    </section>

    @if (error()) { <div class="alert" role="alert">{{ error() }} <button class="btn small ghost" (click)="load()">Réessayer</button></div> }

    @if (loading()) {
      <div class="venue-grid">@for (i of [1, 2, 3]; track i) { <div class="panel skeleton card-skel"></div> }</div>
    } @else if (filtered().length === 0) {
      <div class="panel"><p class="empty">Aucun complexe ne correspond à votre recherche.
        @if (activeFilters()) { <button class="btn small ghost" (click)="reset()">Effacer les filtres</button> }</p></div>
    } @else {
      <p class="muted small result-count">{{ filtered().length }} résultat(s)</p>
      <div class="venue-grid">
        @for (v of filtered(); track v.id) {
          <article class="venue-card">
            <div class="photo" [style.background-image]="cover(v)">
              <span class="pill city">📍 {{ v.city || '—' }}</span>
              <span class="pill open" [class.full]="v.available_fields === 0">
                {{ v.available_fields > 0 ? '● Ouvert' : v.fields_count ? 'Terrains en maintenance' : 'Bientôt' }}</span>
            </div>
            <div class="body">
              <h2>{{ v.name }}</h2>
              @if (v.address) { <p class="muted small addr">{{ v.address }}</p> }
              @if (v.sports.length) {
                <div class="tags">@for (s of v.sports; track s) { <span class="tag" [attr.data-sport]="s">{{ sportEmoji(s) }} {{ s }}</span> }</div>
              }
              @if (v.amenities_list.length) {
                <div class="amen" aria-label="Équipements">
                  @for (a of v.amenities_list; track a) { <span [attr.title]="amenity(a).label">{{ amenity(a).emoji }}</span> }
                  @if (v.has_indoor) { <span title="Terrains couverts">🏠</span> }
                </div>
              }
              <div class="foot">
                <span class="from">
                  @if (v.min_price !== null) { À partir de <b>{{ v.min_price }} DT</b> / heure } @else { <span class="muted">Tarif non disponible</span> }
                </span>
                <button class="btn primary small" (click)="openId.set(v.id)">Explorer les terrains</button>
              </div>
            </div>
          </article>
        }
      </div>
    }

    @if (openId(); as id) { <app-venue-detail-modal [venueId]="id" (close)="openId.set(null)" /> }
  `,
  styles: [`
    .hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap;
      background: linear-gradient(120deg, var(--court-dark) 0%, var(--court) 55%, var(--pitch) 130%); color: #fff;
      border-radius: var(--radius); padding: 2rem 1.75rem; margin-bottom: 1.25rem; }
    .hero h1 { font-size: clamp(1.6rem, 3.5vw, 2.4rem); color: #fff; }
    .hero p { margin: .5rem 0 0; color: #d5e2f3; }
    .eyebrow.light { color: var(--ball); }
    .hero-btn { background: #fff; color: var(--court-dark); }
    .filters { display: grid; gap: .8rem; }
    .filter-row { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }
    .filter-row .search { flex: 1 1 260px; }
    .filter-row select { flex: 0 1 200px; width: auto; }
    .sport-chips { display: flex; flex-wrap: wrap; gap: .4rem; flex: 1 1 auto; }
    .chip { font: inherit; font-size: .88rem; font-weight: 600; padding: .3rem .8rem; border-radius: 99px; border: 1px solid var(--line);
      background: #fff; color: var(--muted); cursor: pointer; }
    .chip.on { background: var(--court-dark); border-color: var(--court-dark); color: #fff; }
    .result-count { margin: 0 0 .6rem; }
    .venue-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 1.25rem; }
    .card-skel { height: 330px; margin: 0; }
    .venue-card { background: var(--panel); border: 1px solid var(--line-soft); border-radius: var(--radius); overflow: hidden;
      box-shadow: var(--shadow); display: flex; flex-direction: column; transition: transform .15s, box-shadow .15s; }
    .venue-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lift); }
    .photo { height: 170px; background: var(--court) center / cover no-repeat; position: relative; }
    .photo .pill { position: absolute; top: .6rem; background: rgba(255,255,255,.95); color: var(--ink); }
    .photo .city { left: .6rem; }
    .photo .open { right: .6rem; color: #14633f; }
    .photo .open.full { color: var(--amber); }
    .body { padding: 1rem 1.1rem 1.1rem; display: flex; flex-direction: column; gap: .55rem; flex: 1; }
    .body h2 { font-size: 1.15rem; }
    .addr { margin: -.3rem 0 0; }
    .tags { display: flex; flex-wrap: wrap; gap: .35rem; }
    .tag { font-size: .78rem; font-weight: 600; padding: .12rem .55rem; border-radius: 99px; background: var(--court-soft); color: var(--court-dark); }
    .tag[data-sport='Football'] { background: var(--pitch-soft); color: #14633f; }
    .tag[data-sport='Tennis'], .tag[data-sport='Padel'] { background: #fbf6d9; color: #7a6a00; }
    .tag[data-sport='Basketball'], .tag[data-sport='Handball'] { background: var(--amber-soft); color: var(--amber); }
    .amen { display: flex; gap: .45rem; font-size: 1.1rem; }
    .foot { margin-top: auto; padding-top: .5rem; border-top: 1px solid var(--line-soft); display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .from b { font-family: var(--font-head); font-size: 1.05rem; color: var(--ink); }
  `],
})
export class VenuesCatalogComponent implements OnInit {
  private api = inject(VenuesApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  readonly sports = SPORTS;
  readonly prices = [30, 50, 80, 120, 200];
  readonly amenity = amenity;
  readonly sportEmoji = sportEmoji;

  venues = signal<Venue[]>([]);
  loading = signal(true);
  error = signal('');
  openId = signal<number | null>(null);

  // Filtres (instantanés, côté client)
  search = signal('');
  city = signal('');
  sport = signal('');
  maxPrice = signal<number | null>(null);
  indoorOnly = signal(false);

  isManager = computed(() => this.auth.hasRole('GERANT', 'ADMIN'));
  totalFields = computed(() => this.venues().reduce((n, v) => n + v.fields_count, 0));
  /** Villes connues + villes réellement présentes en base. */
  cityOptions = computed(() => [...new Set([...CITIES, ...this.venues().map((v) => v.city).filter(Boolean)])].sort((a, b) => a.localeCompare(b)));
  activeFilters = computed(() => !!(this.search().trim() || this.city() || this.sport() || this.maxPrice() !== null || this.indoorOnly()));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const max = this.maxPrice();
    return this.venues().filter(
      (v) =>
        (!q || `${v.name} ${v.city} ${v.address ?? ''}`.toLowerCase().includes(q)) &&
        (!this.city() || v.city.toLowerCase() === this.city().toLowerCase()) &&
        (!this.sport() || v.sports.includes(this.sport())) &&
        (max === null || (v.min_price !== null && v.min_price <= max)) &&
        (!this.indoorOnly() || v.has_indoor),
    );
  });

  ngOnInit() {
    const sport = this.route.snapshot.queryParamMap.get('sport');
    if (sport) this.sport.set(sport);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.getVenues().subscribe({
      next: (v) => { this.venues.set(v); this.loading.set(false); },
      error: (e) => { this.error.set(e.message ?? 'Service des complexes indisponible.'); this.loading.set(false); this.notify.error(e); },
    });
  }

  reset() {
    this.search.set('');
    this.city.set('');
    this.sport.set('');
    this.maxPrice.set(null);
    this.indoorOnly.set(false);
  }

  cover(v: Venue) {
    return v.image_url
      ? `url("${v.image_url}")`
      : 'linear-gradient(135deg, var(--court) 0%, var(--court-dark) 60%, var(--pitch) 140%)';
  }
}
