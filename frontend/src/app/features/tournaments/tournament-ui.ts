import { Component, computed, input } from '@angular/core';

/** Petits éléments d'interface partagés par les pages du module Tournois. */

const LABELS: Record<string, string> = {
  PLANNED: 'Planifié',
  ONGOING: 'En cours',
  FINISHED: 'Terminé',
  SCHEDULED: 'Programmé',
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  APPROVED: 'Validé',
  REJECTED: 'Refusé',
};

export const statusLabel = (s: string | null | undefined) => (s ? LABELS[s] ?? s : '—');

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const SHORT_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** "2027-03-01" → "1 mars 2027" (sans décalage de fuseau horaire). */
export function fmtDate(value: string | null | undefined, short = false): string {
  if (!value) return '—';
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : (short ? SHORT_FMT : DATE_FMT).format(d);
}

/** Nombre de jours entre deux dates incluses (null si incomplet). */
export function durationDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Pastille de statut colorée. */
@Component({
  selector: 'app-status',
  template: `<span class="pill" [attr.data-status]="value()">{{ label() }}</span>`,
})
export class StatusPillComponent {
  value = input.required<string>();
  label = computed(() => statusLabel(this.value()));
}

/** Forme récente "VVNDV" sous forme de pastilles. */
@Component({
  selector: 'app-form-dots',
  template: `
    <span class="form-dots" [attr.aria-label]="'Forme : ' + (form() || 'aucun match')">
      @for (r of letters(); track $index) { <i [attr.data-r]="r">{{ r }}</i> }
      @if (!letters().length) { <span class="muted">—</span> }
    </span>`,
})
export class FormDotsComponent {
  form = input<string>('');
  letters = computed(() => [...(this.form() ?? '')]);
}

const SMALL_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'd', 'l', 'et']);

/** Initiales colorées d'une équipe (avatar). */
@Component({
  selector: 'app-team-badge',
  template: `<span class="team-badge" [style.--hue]="hue()" [attr.aria-hidden]="true">{{ initials() }}</span>`,
})
export class TeamBadgeComponent {
  name = input<string | null>('');
  /** "Lions de Tunis" → "LT" (on ignore les petits mots de liaison). */
  initials = computed(() => {
    const words = (this.name() || '?').split(/[\s'’-]+/).filter(Boolean);
    const main = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
    return (main.length ? main : words).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  });
  hue = computed(() => [...(this.name() || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
}
