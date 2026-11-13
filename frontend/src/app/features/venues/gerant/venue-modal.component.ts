import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth.service';
import { NotifyService } from '../../../core/notify.service';
import { VenuesApiService } from '../venues-api.service';
import { AMENITIES, CITIES, DAYS, Venue, VenueInput, VenueStatus, hhmm } from '../venues.models';

interface DayRow { day: string; open: boolean; from: string; to: string }

/** Création / modification d'un complexe : informations, équipements et horaires de la semaine. */
@Component({
  selector: 'app-venue-modal',
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()" role="presentation">
      <form class="modal wide" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" (ngSubmit)="save()">
        <div class="modal-head">
          <div>
            <p class="eyebrow">{{ venue() ? 'Modifier le complexe' : 'Nouveau complexe' }}</p>
            <h2>{{ venue()?.name || 'Votre complexe sportif' }}</h2>
          </div>
          <button type="button" class="modal-close" (click)="close.emit()" aria-label="Fermer">×</button>
        </div>

        <div class="modal-body">
          <div class="seg tabs" role="tablist">
            <button type="button" class="seg-btn" [class.on]="tab() === 'info'" (click)="tab.set('info')">📋 Informations</button>
            <button type="button" class="seg-btn" [class.on]="tab() === 'hours'" (click)="tab.set('hours')">🕒 Horaires</button>
          </div>

          @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }

          <div class="form-grid" [hidden]="tab() !== 'info'">
            <label class="wide"><span>Nom du complexe <b>*</b></span>
              <input name="name" [(ngModel)]="m.name" required maxlength="120" placeholder="Ex. Padel Club du Lac" /></label>
            <label><span>Ville <b>*</b></span>
              <select name="city" [(ngModel)]="m.city" required>
                <option value="" disabled>Choisir…</option>
                @for (c of cities; track c) { <option [value]="c">{{ c }}</option> }
              </select></label>
            <label><span>Téléphone</span><input name="phone" [(ngModel)]="m.phone" maxlength="30" placeholder="+216 71 000 000" /></label>
            <label class="wide"><span>Adresse</span><input name="address" [(ngModel)]="m.address" maxlength="255" placeholder="Rue, quartier" /></label>
            <label class="wide"><span>Photo de couverture (URL)</span>
              <input name="image" type="url" [(ngModel)]="m.image_url" maxlength="500" placeholder="https://…/photo.jpg" /></label>
            @if (m.image_url) { <div class="preview wide" [style.background-image]="'url(' + m.image_url + ')'" aria-label="Aperçu de la photo"></div> }
            <label class="wide"><span>Description</span>
              <textarea name="desc" rows="3" [(ngModel)]="m.description" placeholder="Terrains, ambiance, services…"></textarea></label>
            <fieldset class="wide amen">
              <legend>Commodités</legend>
              @for (a of amenities; track a.id) {
                <label class="chip-check" [class.on]="m.amenities.includes(a.id)">
                  <input type="checkbox" [checked]="m.amenities.includes(a.id)" (change)="toggleAmenity(a.id)" />{{ a.emoji }} {{ a.label }}
                </label>
              }
            </fieldset>
            <label><span>Statut</span>
              <select name="status" [(ngModel)]="m.status">
                <option value="ACTIVE">Actif (visible dans le catalogue)</option>
                <option value="INACTIVE">Inactif (masqué)</option>
              </select></label>
            @if (isAdmin()) {
              <label><span>Gérant propriétaire (id)</span>
                <input name="owner" type="number" min="1" [(ngModel)]="m.owner_id" placeholder="id du gérant" /></label>
            }
          </div>

          <div [hidden]="tab() !== 'hours'">
            <div class="hours-tools">
              <span class="muted small">Cochez les jours d’ouverture. Un jour décoché = fermé.</span>
              <button type="button" class="btn small ghost" (click)="copyFirst()">Appliquer le lundi à toute la semaine</button>
            </div>
            <ul class="hours">
              @for (d of days; track d.day; let i = $index) {
                <li [class.closed]="!d.open">
                  <label class="chip-check" [class.on]="d.open">
                    <input type="checkbox" [name]="'open' + i" [(ngModel)]="d.open" /> {{ d.day }}</label>
                  @if (d.open) {
                    <input type="time" [name]="'from' + i" [(ngModel)]="d.from" required aria-label="Ouverture" />
                    <span aria-hidden="true">→</span>
                    <input type="time" [name]="'to' + i" [(ngModel)]="d.to" required aria-label="Fermeture" />
                  } @else { <span class="muted">Fermé</span> }
                </li>
              }
            </ul>
          </div>
        </div>

        <div class="modal-foot">
          <button type="button" class="btn ghost" (click)="close.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="saving()">{{ saving() ? 'Enregistrement…' : venue() ? 'Enregistrer' : 'Créer le complexe' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .tabs { margin-bottom: 1rem; }
    .preview { height: 140px; border-radius: 10px; background: var(--chalk) center / cover no-repeat; border: 1px solid var(--line-soft); }
    .amen { border: 0; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .4rem; }
    .amen legend { font-weight: 600; margin-bottom: .4rem; }
    .hours-tools { display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .hours { list-style: none; margin: 0; padding: 0; display: grid; gap: .45rem; }
    .hours li { display: grid; grid-template-columns: 9rem 8rem auto 8rem; align-items: center; gap: .6rem; }
    .hours li.closed { opacity: .75; }
    .hours input[type=time] { width: 100%; }
    @media (max-width: 640px) { .hours li { grid-template-columns: 1fr 1fr; } .hours li > span[aria-hidden] { display: none; } }
  `],
})
export class VenueModalComponent implements OnInit {
  private api = inject(VenuesApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  venue = input<Venue | null>(null);
  startTab = input<'info' | 'hours'>('info');
  saved = output<Venue>();
  close = output<void>();

  readonly cities = [...CITIES];
  readonly amenities = AMENITIES;
  isAdmin = () => this.auth.hasRole('ADMIN');
  tab = signal<'info' | 'hours'>('info');
  saving = signal(false);
  error = signal('');

  m: { name: string; city: string; address: string; phone: string; image_url: string; description: string;
       amenities: string[]; status: VenueStatus; owner_id: number | null } = {
    name: '', city: '', address: '', phone: '', image_url: '', description: '', amenities: [], status: 'ACTIVE', owner_id: null,
  };
  days: DayRow[] = DAYS.map((day) => ({ day, open: day !== 'Dimanche', from: '08:00', to: '23:00' }));

  ngOnInit() {
    this.tab.set(this.startTab());
    const v = this.venue();
    if (!v) return;
    this.m = {
      name: v.name, city: v.city, address: v.address ?? '', phone: v.phone ?? '', image_url: v.image_url ?? '',
      description: v.description ?? '', amenities: [...v.amenities_list], status: v.status, owner_id: v.owner_id,
    };
    if (v.city && !this.cities.includes(v.city)) this.cities.push(v.city);
    const hours = v.opening_hours ?? [];
    this.days = DAYS.map((day) => {
      const h = hours.find((x) => x.day === day);
      return h ? { day, open: true, from: hhmm(h.opening_time), to: hhmm(h.closing_time) } : { day, open: false, from: '08:00', to: '23:00' };
    });
  }

  toggleAmenity(id: string) {
    this.m.amenities = this.m.amenities.includes(id) ? this.m.amenities.filter((a) => a !== id) : [...this.m.amenities, id];
  }

  copyFirst() {
    const first = this.days[0];
    this.days = this.days.map((d) => ({ ...d, open: first.open, from: first.from, to: first.to }));
  }

  save() {
    this.error.set('');
    if (!this.m.name.trim() || !this.m.city) {
      this.tab.set('info');
      this.error.set('Le nom et la ville sont obligatoires.');
      return;
    }
    const bad = this.days.find((d) => d.open && (!d.from || !d.to || d.to <= d.from));
    if (bad) {
      this.tab.set('hours');
      this.error.set(`${bad.day} : l’heure de fermeture doit être après l’heure d’ouverture.`);
      return;
    }
    const body: VenueInput = {
      name: this.m.name.trim(),
      city: this.m.city,
      address: this.m.address.trim() || null,
      phone: this.m.phone.trim() || null,
      image_url: this.m.image_url.trim() || null,
      description: this.m.description.trim() || null,
      amenities: this.m.amenities,
      status: this.m.status,
      opening_hours: this.days.filter((d) => d.open).map((d) => ({ day: d.day, opening_time: d.from, closing_time: d.to })),
    };
    if (this.isAdmin()) body.owner_id = this.m.owner_id || null;

    this.saving.set(true);
    const v = this.venue();
    const req$ = v ? this.api.updateVenue(v.id, body) : this.api.createVenue(body);
    req$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.notify.success(v ? `Complexe « ${res.name} » mis à jour.` : `Complexe « ${res.name} » créé.`);
        this.saved.emit(res);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e.message ?? 'Enregistrement impossible.');
        this.notify.error(e);
      },
    });
  }
}
