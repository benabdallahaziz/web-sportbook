import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotifyService } from '../../../core/notify.service';
import { VenuesApiService } from '../venues-api.service';
import { DAYS, Field, Venue, amenity, hhmm, sportEmoji } from '../venues.models';

/** Fiche détaillée d'un complexe : infos, horaires de la semaine et terrains réservables. */
@Component({
  selector: 'app-venue-detail-modal',
  template: `
    <div class="modal-backdrop" (click)="close.emit()" role="presentation">
      <section class="modal wide" role="dialog" aria-modal="true" [attr.aria-label]="venue()?.name ?? 'Complexe'" (click)="$event.stopPropagation()">
        @if (loading()) {
          <div class="modal-body"><p class="empty">Chargement du complexe…</p></div>
        }
        @if (venue(); as v) {
          <div class="cover" [style.background-image]="cover(v)">
            <button class="modal-close on-cover" (click)="close.emit()" aria-label="Fermer">×</button>
            <div class="cover-text">
              <span class="pill ok-pill">📍 {{ v.city || 'Ville non précisée' }}</span>
              <h2>{{ v.name }}</h2>
            </div>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div>
                @if (v.description) { <p class="desc">{{ v.description }}</p> }
                <ul class="facts">
                  @if (v.address) { <li>🏠 {{ v.address }}</li> }
                  @if (v.phone) { <li>📞 <a [href]="'tel:' + v.phone">{{ v.phone }}</a></li> }
                </ul>
                @if (v.amenities_list.length) {
                  <div class="amen">@for (a of v.amenities_list; track a) { <span class="pill">{{ amenity(a).emoji }} {{ amenity(a).label }}</span> }</div>
                }
              </div>
              <aside class="hours" aria-label="Horaires d'ouverture">
                <h3>Horaires</h3>
                <ul>
                  @for (d of week(); track d.day) {
                    <li [class.today]="d.today"><span>{{ d.day }}</span>
                      <b>{{ d.hours ? hhmm(d.hours.opening_time) + ' – ' + hhmm(d.hours.closing_time) : 'Fermé' }}</b></li>
                  }
                </ul>
              </aside>
            </div>

            <h3 class="fields-title">Terrains ({{ v.fields?.length ?? 0 }})</h3>
            @if (!v.fields?.length) {
              <p class="empty small">Ce complexe n’a pas encore de terrain.</p>
            } @else {
              <ul class="field-list">
                @for (f of v.fields; track f.id) {
                  <li class="field-row" [class.off]="f.status === 'MAINTENANCE'">
                    <span class="sport-ico" aria-hidden="true">{{ sportEmoji(f.sport) }}</span>
                    <div class="field-main">
                      <strong>{{ f.name }}</strong>
                      <span class="muted small">{{ f.sport }} · {{ f.surface || 'Surface non précisée' }} · {{ f.is_indoor ? 'Couvert' : 'Plein air' }}</span>
                    </div>
                    <span class="price">{{ f.price }} DT<small>/h</small></span>
                    <div class="row-actions">
                      @if (f.status === 'MAINTENANCE') {
                        <span class="pill warn-pill">🛠️ En maintenance</span>
                        <button class="btn small" disabled>Indisponible</button>
                      } @else {
                        <button class="btn small primary" (click)="book(f)">Réserver ce terrain</button>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .cover { position: relative; min-height: 190px; background: var(--court-dark) center / cover no-repeat; display: flex; align-items: flex-end; }
    .cover::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(10,22,38,.8)); }
    .cover-text { position: relative; z-index: 1; padding: 1rem 1.25rem; color: #fff; }
    .cover-text h2 { font-size: 1.7rem; margin-top: .35rem; }
    .on-cover { position: absolute; top: .6rem; right: .6rem; z-index: 2; background: rgba(255,255,255,.9); }
    .detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 1.25rem; }
    .desc { margin: 0 0 .75rem; }
    .facts { list-style: none; padding: 0; margin: 0 0 .75rem; display: grid; gap: .3rem; }
    .amen { display: flex; flex-wrap: wrap; gap: .4rem; }
    .hours { background: var(--chalk); border-radius: 10px; padding: .85rem 1rem; }
    .hours h3 { font-size: 1rem; margin-bottom: .5rem; }
    .hours ul { list-style: none; margin: 0; padding: 0; font-size: .9rem; }
    .hours li { display: flex; justify-content: space-between; padding: .2rem 0; }
    .hours li.today { color: var(--court-dark); font-weight: 700; }
    .fields-title { margin: 1.4rem 0 .6rem; font-size: 1.1rem; }
    .field-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
    .field-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: .75rem;
      padding: .7rem .85rem; border: 1px solid var(--line-soft); border-radius: 10px; }
    .field-row.off { background: #fffaf0; }
    .sport-ico { font-size: 1.5rem; }
    .field-main { display: flex; flex-direction: column; min-width: 0; }
    .price { font-family: var(--font-head); font-weight: 700; white-space: nowrap; }
    .price small { font-weight: 500; color: var(--muted); }
    .row-actions { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; justify-content: flex-end; }
    @media (max-width: 720px) {
      .detail-grid { grid-template-columns: 1fr; }
      .field-row { grid-template-columns: auto minmax(0, 1fr) auto; }
      .row-actions { grid-column: 2 / -1; justify-content: flex-start; }
    }
  `],
})
export class VenueDetailModalComponent implements OnInit {
  private api = inject(VenuesApiService);
  private router = inject(Router);
  private notify = inject(NotifyService);

  venueId = input.required<number>();
  close = output<void>();

  venue = signal<Venue | null>(null);
  loading = signal(true);
  readonly amenity = amenity;
  readonly sportEmoji = sportEmoji;
  readonly hhmm = hhmm;

  /** Semaine complète, jours sans horaire = fermé ; le jour courant est mis en avant. */
  week = computed(() => {
    const hours = this.venue()?.opening_hours ?? [];
    const todayIdx = (new Date().getDay() + 6) % 7; // lundi = 0
    return DAYS.map((day, i) => ({ day, today: i === todayIdx, hours: hours.find((h) => h.day === day) ?? null }));
  });

  ngOnInit() {
    this.api.getVenue(this.venueId()).subscribe({
      next: (v) => { this.venue.set(v); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); this.close.emit(); },
    });
  }

  cover(v: Venue) {
    return v.image_url ? `url("${v.image_url}")` : 'linear-gradient(135deg, var(--court) 0%, var(--pitch) 100%)';
  }

  book(f: Field) {
    this.close.emit();
    this.router.navigate(['/bookings/list'], { queryParams: { fieldId: f.id, venueId: f.venue_id } });
  }
}
