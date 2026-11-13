import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface Session { id: number; date: string; startTime: string; status: string; programId: number; programName?: string | null }

const STATUS: Record<string, string> = { SCHEDULED: 'Planifiée', COMPLETED: 'Terminée', CANCELLED: 'Annulée' };

/** Séances réservées par le sportif connecté (GET /api/sessions/user/{id}). */
@Component({
  selector: 'app-my-sessions',
  imports: [RouterLink],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Coaching</p>
        <h1>Mes séances</h1>
        <p class="muted">Vos séances d’entraînement réservées.</p>
      </div>
      <div class="actions"><a class="btn primary" routerLink="/coaches/trouver">Trouver un coach</a></div>
    </header>

    @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }
    @if (loading()) { <p class="empty">Chargement…</p> }
    @else if (sessions().length === 0) {
      <div class="panel"><p class="empty">Aucune séance réservée.
        <a routerLink="/coaches/trouver">Obtenez des recommandations</a> pour réserver votre première séance.</p></div>
    } @else {
      @if (upcoming().length) {
        <h2 class="list-title">À venir</h2>
        <div class="panel table-wrap"><table>
          <thead><tr><th>Date</th><th>Heure</th><th>Programme</th><th>Statut</th></tr></thead>
          <tbody>@for (s of upcoming(); track s.id) {
            <tr><td>{{ fmt(s.date) }}</td><td>{{ s.startTime.slice(0, 5) }}</td><td>{{ s.programName || '#' + s.programId }}</td>
              <td><span class="badge" [class.bad]="s.status === 'CANCELLED'">{{ label(s.status) }}</span></td></tr>
          }</tbody>
        </table></div>
      }
      @if (past().length) {
        <h2 class="list-title">Historique</h2>
        <div class="panel table-wrap"><table>
          <thead><tr><th>Date</th><th>Heure</th><th>Programme</th><th>Statut</th></tr></thead>
          <tbody>@for (s of past(); track s.id) {
            <tr><td>{{ fmt(s.date) }}</td><td>{{ s.startTime.slice(0, 5) }}</td><td>{{ s.programName || '#' + s.programId }}</td>
              <td><span class="badge pending">{{ label(s.status) }}</span></td></tr>
          }</tbody>
        </table></div>
      }
    }
  `,
  styles: [`.list-title { font-size: 1.1rem; margin: 0 0 .6rem; }`],
})
export class MySessionsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  sessions = signal<Session[]>([]);
  loading = signal(true);
  error = signal('');

  private today = new Date().toISOString().slice(0, 10);
  upcoming = computed(() => this.sessions().filter((s) => s.date >= this.today && s.status === 'SCHEDULED')
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
  past = computed(() => this.sessions().filter((s) => !(s.date >= this.today && s.status === 'SCHEDULED'))
    .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)));

  ngOnInit() {
    const id = this.auth.user()?.id;
    if (!id) return;
    this.api.list<Session>(`/api/sessions/user/${id}`).subscribe({
      next: (s) => { this.sessions.set(s); this.loading.set(false); },
      error: (e) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  label = (s: string) => STATUS[s] ?? s;
  fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
