import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotifyService } from '../../../core/notify.service';
import { VenuesApiService } from '../venues-api.service';
import { Field, FieldInput, FieldStatus, SPORTS, SURFACES, Venue } from '../venues.models';

/** Création / modification d'un terrain dans l'un des complexes du gérant. */
@Component({
  selector: 'app-field-modal',
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()" role="presentation">
      <form class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" (ngSubmit)="save()">
        <div class="modal-head">
          <div>
            <p class="eyebrow">{{ field() ? 'Modifier le terrain' : 'Nouveau terrain' }}</p>
            <h2>{{ field()?.name || 'Ajouter un terrain' }}</h2>
          </div>
          <button type="button" class="modal-close" (click)="close.emit()" aria-label="Fermer">×</button>
        </div>
        <div class="modal-body">
          @if (venues().length === 0) {
            <p class="alert">Créez d’abord un complexe : chaque terrain est rattaché à un complexe.</p>
          } @else {
            @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }
            <div class="form-grid">
              <label class="wide"><span>Complexe <b>*</b></span>
                <select name="venue" [(ngModel)]="m.venue_id" required>
                  @for (v of venues(); track v.id) { <option [ngValue]="v.id">{{ v.name }} · {{ v.city }}</option> }
                </select></label>
              <label class="wide"><span>Nom du terrain <b>*</b></span>
                <input name="name" [(ngModel)]="m.name" required maxlength="100" placeholder="Ex. Court Central, Terrain A (5x5)" /></label>
              <label><span>Sport <b>*</b></span>
                <select name="sport" [(ngModel)]="m.sport" required>
                  @for (s of sports; track s.id) { <option [value]="s.id">{{ s.emoji }} {{ s.label }}</option> }
                </select></label>
              <label><span>Prix par heure (DT) <b>*</b></span>
                <input name="price" type="number" min="0" step="5" [(ngModel)]="m.price" required /></label>
              <label><span>Surface</span>
                <select name="surface" [(ngModel)]="m.surface">
                  <option [ngValue]="null">Non précisée</option>
                  @for (s of surfaces; track s) { <option [value]="s">{{ s }}</option> }
                </select></label>
              <label><span>Statut</span>
                <select name="status" [(ngModel)]="m.status">
                  <option value="AVAILABLE">✅ Disponible à la réservation</option>
                  <option value="MAINTENANCE">🛠️ En maintenance</option>
                </select></label>
              <label class="chip-check wide indoor" [class.on]="m.is_indoor">
                <input type="checkbox" name="indoor" [(ngModel)]="m.is_indoor" /> 🏠 Terrain couvert (indoor)
              </label>
            </div>
          }
        </div>
        <div class="modal-foot">
          <button type="button" class="btn ghost" (click)="close.emit()">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="saving() || venues().length === 0">
            {{ saving() ? 'Enregistrement…' : field() ? 'Enregistrer' : 'Ajouter le terrain' }}</button>
        </div>
      </form>
    </div>
  `,
  styles: [`.indoor { justify-self: start; }`],
})
export class FieldModalComponent implements OnInit {
  private api = inject(VenuesApiService);
  private notify = inject(NotifyService);

  venues = input.required<Venue[]>();
  field = input<Field | null>(null);
  defaultVenueId = input<number | null>(null);
  saved = output<Field>();
  close = output<void>();

  readonly sports = [...SPORTS];
  readonly surfaces = [...SURFACES];
  saving = signal(false);
  error = signal('');
  m: { name: string; sport: string; price: number; surface: string | null; is_indoor: boolean; status: FieldStatus; venue_id: number | null } = {
    name: '', sport: 'Football', price: 60, surface: null, is_indoor: false, status: 'AVAILABLE', venue_id: null,
  };

  ngOnInit() {
    const f = this.field();
    if (f) {
      this.m = { name: f.name, sport: f.sport, price: f.price, surface: f.surface, is_indoor: f.is_indoor, status: f.status, venue_id: f.venue_id };
      if (f.surface && !this.surfaces.includes(f.surface)) this.surfaces.push(f.surface);
      if (!this.sports.some((s) => s.id === f.sport)) this.sports.push({ id: f.sport, label: f.sport, emoji: '🏟️' });
    } else {
      this.m.venue_id = this.defaultVenueId() ?? this.venues()[0]?.id ?? null;
    }
  }

  save() {
    this.error.set('');
    if (!this.m.venue_id || !this.m.name.trim() || this.m.price === null || this.m.price < 0) {
      this.error.set('Complexe, nom et prix (positif) sont obligatoires.');
      return;
    }
    const body: FieldInput = {
      name: this.m.name.trim(), sport: this.m.sport, price: Number(this.m.price), surface: this.m.surface,
      is_indoor: this.m.is_indoor, status: this.m.status, venue_id: Number(this.m.venue_id),
    };
    this.saving.set(true);
    const f = this.field();
    const req$ = f ? this.api.updateField(f.id, body) : this.api.createField(body);
    req$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.notify.success(f ? `Terrain « ${res.name} » mis à jour.` : `Terrain « ${res.name} » ajouté.`);
        this.saved.emit(res);
      },
      error: (e) => { this.saving.set(false); this.error.set(e.message ?? 'Enregistrement impossible.'); this.notify.error(e); },
    });
  }
}
