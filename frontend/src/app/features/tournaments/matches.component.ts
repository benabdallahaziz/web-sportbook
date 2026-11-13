import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiError } from '../../core/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { TournamentAccess } from './tournament-access.service';
import { TournamentApi } from './tournament-api.service';
import { ApprovalStatus, MATCH_STATUSES, Match, MatchInput, MatchStatus, Round, Team, Tournament } from './tournament.models';
import { StatusPillComponent, TeamBadgeComponent, fmtDate } from './tournament-ui';

@Component({
  selector: 'app-matches',
  imports: [FormsModule, RouterLink, StatusPillComponent, TeamBadgeComponent],
  templateUrl: './matches.component.html',
})
export class MatchesComponent implements OnInit {
  private api = inject(TournamentApi);
  private notify = inject(NotifyService);
  readonly access = inject(TournamentAccess);

  readonly statuses = MATCH_STATUSES;
  readonly fmtDate = fmtDate;
  /** Tournois où l'utilisateur peut planifier : validés, ou les siens, ou tous pour l'admin. */
  plannable = computed(() =>
    this.tournaments().filter((t) => this.access.isAdmin() || t.approval_status === 'APPROVED' || this.access.isOwner(t)),
  );

  tournaments = signal<Tournament[]>([]);
  teams = signal<Team[]>([]);
  matches = signal<Match[]>([]);
  loading = signal(true);
  loadError = signal<ApiError | null>(null);

  tournamentFilter: number | null = null;
  statusFilter = signal<MatchStatus | ''>('');
  scores: Record<number, string> = {};

  // Formulaire
  formOpen = signal(false);
  editingId = signal<number | null>(null);
  saving = signal(false);
  formError = signal<ApiError | null>(null);
  formTournament: number | null = null;
  formRounds = signal<Round[]>([]);
  model: MatchInput = this.blank();

  visible = computed(() => {
    const s = this.statusFilter();
    return this.matches().filter((m) => !s || m.status === s);
  });

  tournamentName = computed(() => new Map(this.tournaments().map((t) => [t.id, t.name])));

  ngOnInit() {
    forkJoin({ t: this.api.tournaments(), teams: this.api.teams() }).subscribe({
      next: ({ t, teams }) => {
        this.tournaments.set(t);
        this.teams.set(teams);
      },
      error: (e) => this.notify.error(e),
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.matches(this.tournamentFilter).subscribe({
      next: (m) => {
        this.matches.set(m);
        this.scores = Object.fromEntries(m.map((x) => [x.id, x.score ?? '']));
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.loadError.set(e);
        this.loading.set(false);
      },
    });
  }

  countFor(s: MatchStatus | '') {
    return s ? this.matches().filter((m) => m.status === s).length : this.matches().length;
  }

  /** Les tours dépendent du tournoi choisi dans le formulaire. */
  loadRounds(tournamentId: number | null, keepRound = false, selectRoundId: number | null = null) {
    this.formTournament = tournamentId;
    if (!keepRound) this.model.round_id = null;
    if (!tournamentId) {
      this.formRounds.set([]);
      return;
    }
    this.roundsLoading.set(true);
    this.api.rounds(tournamentId).subscribe({
      next: (r) => {
        this.formRounds.set(r);
        this.roundsLoading.set(false);
        // Un seul tour (ou tour tout juste créé) : on le sélectionne pour l'utilisateur
        if (selectRoundId) this.model.round_id = selectRoundId;
        else if (!this.model.round_id && r.length === 1) this.model.round_id = r[0].id;
      },
      error: (e) => {
        this.roundsLoading.set(false);
        this.notify.error(e);
      },
    });
  }

  // ── Création d'un tour sans quitter le formulaire ──
  roundsLoading = signal(false);
  creatingRound = signal(false);
  newRoundName = 'Tour 1';

  /** Seuls l'administrateur et l'organisateur du tournoi peuvent créer un tour (règle du backend). */
  canCreateRound(): boolean {
    const t = this.tournaments().find((x) => x.id === this.formTournament);
    return !!t && (this.access.isAdmin() || this.access.isOwner(t));
  }

  noRound(): boolean {
    return !!this.formTournament && !this.roundsLoading() && this.formRounds().length === 0;
  }

  createRoundInline() {
    const tid = this.formTournament;
    const name = this.newRoundName.trim();
    if (!tid || !name) return;
    this.creatingRound.set(true);
    const order = (this.formRounds().at(-1)?.round_order ?? 0) + 1;
    this.api.addRound(tid, name, order).subscribe({
      next: (r) => {
        this.creatingRound.set(false);
        this.notify.success(`Tour « ${r.name} » créé.`);
        this.formError.set(null);
        this.loadRounds(tid, true, r.id);
      },
      error: (e) => {
        this.creatingRound.set(false);
        this.notify.error(e);
      },
    });
  }

  openCreate() {
    this.model = this.blank();
    this.editingId.set(null);
    this.formError.set(null);
    this.loadRounds(this.tournamentFilter);
    this.formOpen.set(true);
  }

  openEdit(m: Match) {
    this.model = { date: m.date, score: m.score, status: m.status, round_id: m.round_id, team1_id: m.team1_id, team2_id: m.team2_id };
    this.editingId.set(m.id);
    this.formError.set(null);
    this.loadRounds(m.tournament_id, true);
    this.formOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  save() {
    this.saving.set(true);
    this.formError.set(null);
    const id = this.editingId() ?? undefined;
    const body: MatchInput = {
      ...this.model,
      date: this.model.date || null,
      score: this.model.score || null,
      round_id: this.model.round_id ? Number(this.model.round_id) : null,
      team1_id: this.model.team1_id ? Number(this.model.team1_id) : null,
      team2_id: this.model.team2_id ? Number(this.model.team2_id) : null,
    };
    this.api.saveMatch(body, id).subscribe({
      next: (m) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (m.approval_status === 'APPROVED') this.notify.success(`${id ? 'Match modifié' : 'Match programmé'} : ${m.team1_name} – ${m.team2_name}.`);
        else this.notify.info(`Match ${m.team1_name} – ${m.team2_name} envoyé pour validation.`);
        this.load();
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        this.formError.set(e);
      },
    });
  }

  saveScore(m: Match) {
    this.api.setScore(m.id, (this.scores[m.id] ?? '').trim()).subscribe({
      next: (u) => {
        this.matches.update((list) => list.map((x) => (x.id === m.id ? u : x)));
        this.notify.success(`Score enregistré : ${u.team1_name} ${u.score} ${u.team2_name}.`);
        this.refreshRanking();
      },
      error: (e) => this.notify.error(e),
    });
  }

  /**
   * Met le classement à jour tout de suite. Sans RabbitMQ, stats-service ne reçoit pas
   * l'événement "match.updated" : on déclenche sa synchronisation REST (action admin).
   */
  private refreshRanking() {
    if (!this.access.isAdmin()) return;
    this.api.syncStats().subscribe({
      next: () => this.notify.info('Classement mis à jour.'),
      error: () => this.notify.info('Score enregistré. Le classement sera mis à jour à la prochaine synchronisation.'),
    });
  }

  /** Décision de l'administrateur depuis la liste. */
  decide(m: Match, decision: Exclude<ApprovalStatus, 'PENDING'>) {
    const reason = decision === 'REJECTED' ? prompt('Motif du refus du match :', '') : '';
    if (reason === null) return;
    this.api.decideMatch(m.id, decision, reason).subscribe({
      next: (u) => {
        this.matches.update((list) => list.map((x) => (x.id === m.id ? u : x)));
        this.notify.success(decision === 'APPROVED' ? 'Match validé.' : 'Match refusé.');
      },
      error: (e) => this.notify.error(e),
    });
  }

  remove(m: Match) {
    if (!confirm(`Supprimer le match ${m.team1_name} – ${m.team2_name} ?`)) return;
    this.api.deleteMatch(m.id).subscribe({
      next: () => {
        this.notify.success('Match supprimé.');
        this.load();
      },
      error: (e) => this.notify.error(e),
    });
  }

  /** Score "3-1" → [3, 1] pour mettre le vainqueur en gras. */
  winner(m: Match): 1 | 2 | 0 | null {
    const s = /^(\d+)-(\d+)$/.exec(m.score ?? '');
    if (!s || m.status !== 'FINISHED') return null;
    const a = +s[1], b = +s[2];
    return a > b ? 1 : b > a ? 2 : 0;
  }

  private blank(): MatchInput {
    return { date: null, score: null, status: 'SCHEDULED', round_id: null, team1_id: null, team2_id: null };
  }
}
