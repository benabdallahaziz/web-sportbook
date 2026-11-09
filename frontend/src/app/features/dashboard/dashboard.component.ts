import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MODULES } from '../modules';
import { catchError, map, of } from 'rxjs';

type Health = 'checking' | 'up' | 'down';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <header class="page-head">
      <div><p class="eyebrow">Tableau de bord</p><h1>Bonjour {{ auth.fullName() }}</h1>
      <p class="muted">État des {{ modules().length }} modules reliés à la Gateway : {{ upCount() }} en ligne.</p></div>
      <div class="actions"><button class="btn ghost" (click)="check()">Vérifier les services</button></div>
    </header>
    <div class="module-grid">
      @for (m of modules(); track m.id) {
        <article class="panel module" [attr.data-module]="m.id" [attr.data-health]="health()[m.id]">
          <div class="module-top">
            <h2>{{ m.label }}</h2>
            <span class="badge" [class.bad]="health()[m.id] === 'down'" [class.pending]="health()[m.id] === 'checking'">
              {{ health()[m.id] === 'up' ? 'En ligne' : health()[m.id] === 'down' ? 'Hors ligne' : 'Test…' }}
            </span>
          </div>
          <p class="muted">{{ m.description }}</p>
          <code>{{ m.service }}</code>
          <div class="module-links">
            @for (l of m.links; track l.path) { <a class="btn small ghost" [routerLink]="l.path">{{ l.label }}</a> }
          </div>
        </article>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  modules = computed(() => MODULES.filter((m) => !m.roles || this.auth.hasRole(...m.roles)));
  health = signal<Record<string, Health>>({});
  upCount = computed(() => Object.values(this.health()).filter((h) => h === 'up').length);

  ngOnInit() { this.check(); }

  /** Un GET sur la première ressource de chaque module passe par la Gateway puis Eureka. */
  check() {
    const state: Record<string, Health> = {};
    this.modules().forEach((m) => (state[m.id] = 'checking'));
    this.health.set(state);
    for (const m of this.modules()) {
      this.api
        .list(m.links[0].endpoint)
        .pipe(map(() => 'up' as Health), catchError((e) => of((e.status >= 500 || e.status === 0 ? 'down' : 'up') as Health)))
        .subscribe((h) => this.health.update((s) => ({ ...s, [m.id]: h })));
    }
  }
}
