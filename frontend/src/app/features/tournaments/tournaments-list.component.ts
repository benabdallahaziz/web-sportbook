import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiError } from '../../core/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { TournamentAccess } from './tournament-access.service';
import { TournamentApi } from './tournament-api.service';
import { Match, TOURNAMENT_STATUSES, Team, Tournament, TournamentInput, TournamentStatus } from './tournament.models';
import { StatusPillComponent, durationDays, fmtDate } from './tournament-ui';

@Component({
  selector: 'app-tournaments-list',
  imports: [FormsModule, RouterLink, StatusPillComponent],
  templateUrl: './tournaments-list.component.html',
})
export class TournamentsListComponent implements OnInit {
  private api = inject(TournamentApi);
  private notify = inject(NotifyService);
  readonly access = inject(TournamentAccess);

  readonly statuses = TOURNAMENT_STATUSES;
  readonly fmtDate = fmtDate;
  readonly durationDays = durationDays;
  /** Nombre de tournois proposés en attente (badge du bouton « À valider » de l'admin). */
  pendingCount = computed(() => this.tournaments().filter((t) => t.approval_status === 'PENDING').length);
  /** Mes propositions non encore validées (utilisateur). */
  myProposals = computed(() =>
    this.tournaments().filter((t) => this.access.isOwner(t) && t.approval_status !== 'APPROVED'),
  );
  myRejected = computed(() => this.myProposals().filter((t) => t.approval_status === 'REJECTED').length);

  tournaments = signal<Tournament[]>([]);
  teams = signal<Team[]>([]);
  matches = signal<Match[]>([]);
  loading = signal(true);
  loadError = signal<ApiError | null>(null);

  query = signal('');
  statusFilter = signal<TournamentStatus | ''>('');

  // Formulaire
  formOpen = signal(false);
  editingId = signal<number | null>(null);
  saving = signal(false);
  formError = signal<ApiError | null>(null);
  model: TournamentInput = this.blank();

  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const s = this.statusFilter();
    return this.tournaments().filter((t) => (!s || t.status === s) && (!q || t.name.toLowerCase().includes(q)));
  });

  kpis = computed(() => {
    const t = this.tournaments();
    const m = this.matches();
    return {
      total: t.length,
      ongoing: t.filter((x) => x.status === 'ONGOING').length,
      teams: this.teams().length,
      played: m.filter((x) => x.status === 'FINISHED').length,
      matches: m.length,
    };
  });

  /** Nombre de matchs par tournoi, pour l'afficher sur chaque carte. */
  matchCount = computed(() => {
    const counts = new Map<number, number>();
    for (const m of this.matches()) counts.set(m.tournament_id, (counts.get(m.tournament_id) ?? 0) + 1);
    return counts;
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ t: this.api.tournaments(), teams: this.api.teams(), m: this.api.matches() }).subscribe({
      next: ({ t, teams, m }) => {
        this.tournaments.set(t);
        this.teams.set(teams);
        this.matches.set(m);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.loadError.set(e);
        this.loading.set(false);
      },
    });
  }

  countFor(status: TournamentStatus | '') {
    return status ? this.tournaments().filter((t) => t.status === status).length : this.tournaments().length;
  }

  openCreate() {
    this.model = this.blank();
    this.editingId.set(null);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEdit(t: Tournament) {
    this.model = { name: t.name, start_date: t.start_date, end_date: t.end_date, status: t.status };
    this.editingId.set(t.id);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  save() {
    this.saving.set(true);
    this.formError.set(null);
    const body: TournamentInput = {
      ...this.model,
      start_date: this.model.start_date || null,
      end_date: this.model.end_date || null,
    };
    const id = this.editingId() ?? undefined;
    this.api.saveTournament(body, id).subscribe({
      next: (t) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (t.approval_status === 'APPROVED') {
          this.notify.success(id ? `Tournoi « ${t.name} » mis à jour.` : `Tournoi « ${t.name} » créé.`);
        } else {
          this.notify.info(`« ${t.name} » envoyé pour validation : il sera visible par tous après accord d’un administrateur.`);
        }
        this.load();
      },
      // Les erreurs 400 de validation s'affichent DANS le formulaire, avec le détail par champ
      error: (e: ApiError) => {
        this.saving.set(false);
        this.formError.set(e);
      },
    });
  }

  /** PATCH : on n'envoie que le statut. */
  changeStatus(t: Tournament, status: TournamentStatus) {
    const previous = t.status;
    this.tournaments.update((list) => list.map((x) => (x.id === t.id ? { ...x, status } : x)));
    this.api.patchTournament(t.id, { status }).subscribe({
      next: () => this.notify.success(`« ${t.name} » est maintenant ${TOURNAMENT_STATUSES.find((s) => s.value === status)?.label.toLowerCase()}.`),
      error: (e) => {
        this.tournaments.update((list) => list.map((x) => (x.id === t.id ? { ...x, status: previous } : x)));
        this.notify.error(e);
      },
    });
  }

  remove(t: Tournament) {
    if (!confirm(`Supprimer « ${t.name} » ? Ses tours, matchs et inscriptions seront aussi supprimés.`)) return;
    this.api.deleteTournament(t.id).subscribe({
      next: () => {
        this.notify.success(`Tournoi « ${t.name} » supprimé.`);
        this.load();
      },
      error: (e) => this.notify.error(e),
    });
  }

  private blank(): TournamentInput {
    return { name: '', start_date: null, end_date: null, status: 'PLANNED' };
  }
}
