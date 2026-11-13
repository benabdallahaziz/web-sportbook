import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';

interface SessionSlot { id: number; date: string; startTime: string }
interface ProgramSuggestion {
  id: number; name: string; description?: string | null; durationWeeks?: number | null;
  coachId: number; coachName?: string | null; availableSessions: SessionSlot[];
}
interface CoachScore {
  coachId: number; name: string; speciality: string; rating: number;
  compatibilityScore: number; compatibilityPercent: string; reasons: string[]; programs: ProgramSuggestion[];
}
interface RecommendationResponse {
  userId: number; totalCandidates: number; recommendations: CoachScore[];
  recommendedProgram?: ProgramSuggestion | null; message?: string | null; algorithm: string;
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/**
 * Espace sportif : le recommendation-service (Python, similarité cosinus) propose les coachs
 * et l'entraînement idéal ; la réservation passe par coach-training-service
 * (POST /api/sessions/{id}/register → vérification Identity + événement RabbitMQ).
 */
@Component({
  selector: 'app-coach-finder',
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Coaching · recommandation IA</p>
        <h1>Trouver mon coach</h1>
        <p class="muted">Décrivez votre profil : nous calculons les coachs et l’entraînement qui vous correspondent le mieux.</p>
      </div>
      <div class="actions"><a class="btn ghost" routerLink="/coaches/mes-seances">Mes séances</a></div>
    </header>

    <form class="panel finder" (ngSubmit)="search()">
      <label><span>Objectif</span>
        <select name="goal" [(ngModel)]="goal">
          @for (g of goals; track g.value) { <option [value]="g.value">{{ g.label }}</option> }
        </select>
      </label>
      <label><span>Niveau</span>
        <select name="level" [(ngModel)]="level">
          <option value="debutant">Débutant</option>
          <option value="intermediaire">Intermédiaire</option>
          <option value="avance">Avancé</option>
        </select>
      </label>
      <label><span>Créneau préféré</span>
        <select name="time" [(ngModel)]="time">
          <option value="matin">Matin</option>
          <option value="apres-midi">Après-midi</option>
          <option value="soir">Soir</option>
        </select>
      </label>
      <label><span>Budget max / séance (DT)</span>
        <input type="number" name="budget" min="0" [(ngModel)]="budget" />
      </label>
      <fieldset class="days wide">
        <legend>Jours disponibles</legend>
        @for (d of days; track d) {
          <label class="day" [class.on]="selectedDays.has(d)">
            <input type="checkbox" [checked]="selectedDays.has(d)" (change)="toggleDay(d)" />{{ d.slice(0, 3) }}
          </label>
        }
      </fieldset>
      <div class="form-actions wide">
        <button class="btn primary" type="submit" [disabled]="loading()">{{ loading() ? 'Calcul…' : 'Voir mes recommandations' }}</button>
      </div>
    </form>

    @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }

    @if (result(); as r) {
      @if (r.message) { <p class="notice">{{ r.message }}</p> }

      @if (r.recommendedProgram; as best) {
        <section class="panel best">
          <p class="eyebrow">Entraînement recommandé pour vous</p>
          <h2>{{ best.name }}</h2>
          <p class="muted">
            avec {{ best.coachName }}@if (best.durationWeeks) { · {{ best.durationWeeks }} semaine(s) }
            @if (best.description) { · {{ best.description }} }
          </p>
          <ng-container *ngTemplateOutlet="slots; context: { $implicit: best }" />
        </section>
      }

      <div class="reco-grid">
        @for (c of r.recommendations; track c.coachId; let i = $index) {
          <article class="panel reco">
            <div class="reco-head">
              <span class="rank">#{{ i + 1 }}</span>
              <div><h2>{{ c.name }}</h2><span class="muted small">{{ c.speciality || 'Polyvalent' }} · ★ {{ c.rating.toFixed(1) }}</span></div>
              <span class="match" [attr.title]="'Similarité cosinus : ' + c.compatibilityScore">{{ c.compatibilityPercent }}</span>
            </div>
            <div class="meter" aria-hidden="true"><span [style.width.%]="c.compatibilityScore * 100"></span></div>
            <ul class="reasons">@for (x of c.reasons; track x) { <li>{{ x }}</li> }</ul>
            @if (c.programs.length === 0) { <p class="muted small">Ce coach n’a pas encore publié de programme.</p> }
            @for (p of c.programs; track p.id) {
              <div class="program">
                <strong>{{ p.name }}</strong>@if (p.durationWeeks) { <span class="muted small"> · {{ p.durationWeeks }} sem.</span> }
                <ng-container *ngTemplateOutlet="slots; context: { $implicit: p }" />
              </div>
            }
          </article>
        }
      </div>
      <p class="muted small">Algorithme : {{ r.algorithm }} · {{ r.totalCandidates }} coach(s) analysé(s).</p>
    }

    <ng-template #slots let-p>
      @if (p.availableSessions.length === 0) {
        <p class="muted small">Aucune séance libre pour le moment.</p>
      } @else {
        <div class="slots">
          @for (s of p.availableSessions; track s.id) {
            <button class="btn small ghost" (click)="book(s, p)" [disabled]="booking() === s.id">
              {{ booking() === s.id ? 'Réservation…' : 'Réserver · ' + fmt(s) }}</button>
          }
        </div>
      }
    </ng-template>
  `,
  styles: [`
    .finder { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: .9rem 1rem; }
    .finder .wide { grid-column: 1 / -1; }
    .days { border: 0; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .4rem; }
    .days legend { font-weight: 600; margin-bottom: .4rem; }
    .day { display: inline-flex; align-items: center; gap: .3rem; padding: .25rem .7rem; border: 1px solid var(--line);
      border-radius: 99px; cursor: pointer; text-transform: capitalize; margin: 0; font-weight: 600; color: var(--muted); }
    .day.on { background: var(--court-soft); border-color: #bccfe6; color: var(--court-dark); }
    .day input { width: auto; margin: 0; }
    .form-actions { display: flex; justify-content: flex-end; }
    .best { border-top: 4px solid var(--ball); }
    .best h2 { margin: .2rem 0; }
    .reco-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 1.25rem; }
    .reco { margin: 0; display: flex; flex-direction: column; gap: .7rem; }
    .reco-head { display: grid; grid-template-columns: auto 1fr auto; gap: .7rem; align-items: center; }
    .reco-head h2 { font-size: 1.1rem; }
    .rank { font-family: var(--font-head); font-weight: 700; color: var(--muted); }
    .match { font-family: var(--font-head); font-weight: 700; font-size: 1.25rem; color: var(--pitch); }
    .meter { height: 6px; background: var(--line-soft); border-radius: 99px; overflow: hidden; }
    .meter span { display: block; height: 100%; background: var(--pitch); border-radius: 99px; }
    .reasons { margin: 0; padding-left: 1.1rem; font-size: .9rem; }
    .program { border-top: 1px solid var(--line-soft); padding-top: .6rem; }
    .slots { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .4rem; }
  `],
})
export class CoachFinderComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  readonly days = DAYS;
  readonly goals = [
    { value: 'football', label: 'Football' }, { value: 'tennis', label: 'Tennis' }, { value: 'padel', label: 'Padel' },
    { value: 'basketball', label: 'Basketball' }, { value: 'musculation', label: 'Musculation' },
    { value: 'perte_de_poids', label: 'Perte de poids / remise en forme' }, { value: 'endurance', label: 'Endurance / cardio' },
    { value: 'yoga', label: 'Yoga / bien-être' }, { value: 'nutrition', label: 'Nutrition' },
  ];
  goal = 'football';
  level = 'debutant';
  time = 'soir';
  budget = 150;
  selectedDays = new Set<string>(['lundi', 'mercredi']);

  loading = signal(false);
  booking = signal<number | null>(null);
  error = signal('');
  result = signal<RecommendationResponse | null>(null);

  toggleDay(d: string) {
    if (this.selectedDays.has(d)) this.selectedDays.delete(d);
    else this.selectedDays.add(d);
  }

  search() {
    const userId = this.auth.user()?.id ?? 0;
    const q = new URLSearchParams({
      userId: String(userId), goal: this.goal, level: this.level, preferredTime: this.time,
      maxBudgetPerSession: String(this.budget ?? 200), preferredDays: [...this.selectedDays].join(','),
    });
    this.loading.set(true);
    this.error.set('');
    this.api.read<RecommendationResponse>(`/api/recommendations/coaches?${q}`).subscribe({
      next: (r) => { this.result.set(r); this.loading.set(false); },
      error: (e) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  /** Inscription : coach-training-service vérifie le sportif auprès d'Identity puis publie sur RabbitMQ. */
  book(s: SessionSlot, p: ProgramSuggestion) {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this.booking.set(s.id);
    this.api.post(`/api/sessions/${s.id}/register`, { userId }).subscribe({
      next: () => {
        this.booking.set(null);
        this.notify.success(`Séance réservée : ${p.name}, ${this.fmt(s)}.`);
        this.search();
      },
      error: (e) => { this.booking.set(null); this.notify.error(e); },
    });
  }

  fmt(s: SessionSlot) {
    const d = new Date(s.date + 'T00:00:00');
    return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ${s.startTime.slice(0, 5)}`;
  }
}
