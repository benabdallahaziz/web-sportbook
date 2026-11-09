import { Component, computed, input } from '@angular/core';

export interface BarRow {
  label: string;
  value: number;
  /** Texte secondaire affiché à côté de la valeur (ex. "Elo 1542"). */
  hint?: string;
}

/**
 * Barres horizontales (une seule série → une seule couleur, pas de légende).
 * Les valeurs sont écrites en clair à côté de chaque barre : la couleur ne
 * porte jamais l'information seule. Une infobulle reprend la valeur au survol.
 */
@Component({
  selector: 'app-bar-list',
  template: `
    @if (rows().length === 0) {
      <p class="empty small">{{ emptyText() }}</p>
    } @else {
      <ul class="bar-list" role="list" [attr.aria-label]="ariaLabel()">
        @for (r of rows(); track r.label) {
          <li [attr.title]="r.label + ' : ' + r.value + (unit() ? ' ' + unit() : '')">
            <span class="bar-label">{{ r.label }}</span>
            <span class="bar-track">
              <span class="bar-fill" [style.width.%]="width(r.value)"></span>
            </span>
            <span class="bar-value">{{ r.value }}@if (r.hint) { <small>{{ r.hint }}</small> }</span>
          </li>
        }
      </ul>
    }
  `,
})
export class BarListComponent {
  rows = input.required<BarRow[]>();
  unit = input<string>('');
  emptyText = input<string>('Aucune donnée.');
  /** Valeur de référence (100 %) ; par défaut, la plus grande valeur. */
  max = input<number | null>(null);

  private top = computed(() => this.max() ?? Math.max(1, ...this.rows().map((r) => r.value)));
  ariaLabel = computed(() => this.rows().map((r) => `${r.label} ${r.value}`).join(', '));

  /** Une valeur non nulle garde une barre visible (2 % minimum). */
  width(v: number) {
    return v <= 0 ? 0 : Math.max(2, (v / this.top()) * 100);
  }
}
