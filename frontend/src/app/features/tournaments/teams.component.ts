import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { TournamentApi } from './tournament-api.service';
import { Team, TeamInput, TeamStats } from './tournament.models';
import { FormDotsComponent, TeamBadgeComponent, fmtDate } from './tournament-ui';

@Component({
  selector: 'app-teams',
  imports: [FormsModule, TeamBadgeComponent, FormDotsComponent],
  templateUrl: './teams.component.html',
})
export class TeamsComponent implements OnInit {
  private api = inject(TournamentApi);
  private notify = inject(NotifyService);
  private auth = inject(AuthService);

  readonly fmtDate = fmtDate;
  canWrite = computed(() => this.auth.hasRole('ADMIN', 'GERANT', 'SPORTIF'));

  teams = signal<Team[]>([]);
  loading = signal(true);
  loadError = signal<ApiError | null>(null);
  query = signal('');

  formOpen = signal(false);
  editingId = signal<number | null>(null);
  saving = signal(false);
  formError = signal<ApiError | null>(null);
  model: TeamInput = { name: '', members: 5 };

  // Fiche statistique (stats-service)
  selected = signal<Team | null>(null);
  stats = signal<TeamStats | null>(null);
  statsError = signal<ApiError | null>(null);

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.teams().filter((t) => !q || t.name.toLowerCase().includes(q));
  });

  /** Courbe Elo : points SVG (viewBox 300 × 80). */
  spark = computed(() => {
    const h = this.stats()?.history ?? [];
    if (!h.length) return null;
    const values = [h[0].rating_before, ...h.map((p) => p.rating_after)];
    const min = Math.min(...values) - 5;
    const max = Math.max(...values) + 5;
    const pts = values.map((v, i) => {
      const x = values.length === 1 ? 150 : (i / (values.length - 1)) * 290 + 5;
      const y = 75 - ((v - min) / (max - min)) * 70;
      return { x: +x.toFixed(1), y: +y.toFixed(1) };
    });
    return { line: pts.map((p) => `${p.x},${p.y}`).join(' '), last: pts.at(-1)!, min: Math.round(min + 5), max: Math.round(max - 5) };
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.teams().subscribe({
      next: (t) => {
        this.teams.set(t);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.loadError.set(e);
        this.loading.set(false);
      },
    });
  }

  openCreate() {
    this.model = { name: '', members: 5 };
    this.editingId.set(null);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEdit(t: Team) {
    this.model = { name: t.name, members: t.members };
    this.editingId.set(t.id);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  save() {
    this.saving.set(true);
    this.formError.set(null);
    const id = this.editingId() ?? undefined;
    this.api.saveTeam({ name: this.model.name, members: Number(this.model.members) || 0 }, id).subscribe({
      next: (t) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.notify.success(id ? `Équipe « ${t.name} » mise à jour.` : `Équipe « ${t.name} » créée.`);
        this.load();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.formError.set(e);
      },
    });
  }

  remove(t: Team) {
    if (!confirm(`Supprimer l’équipe « ${t.name} » ?`)) return;
    this.api.deleteTeam(t.id).subscribe({
      next: () => {
        this.notify.success(`Équipe « ${t.name} » supprimée.`);
        if (this.selected()?.id === t.id) this.closeStats();
        this.load();
      },
      // 409 si l'équipe joue un match : le message du serveur l'explique
      error: (e) => this.notify.error(e),
    });
  }

  openStats(t: Team) {
    this.selected.set(t);
    this.stats.set(null);
    this.statsError.set(null);
    this.api.teamStats(t.id).subscribe({
      next: (s) => this.stats.set(s),
      error: (e: ApiError) => this.statsError.set(e),
    });
  }

  closeStats() {
    this.selected.set(null);
  }
}
