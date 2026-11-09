import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { RankingTableComponent } from './ranking-table.component';
import { TournamentApi } from './tournament-api.service';
import {
  Match, RankingResponse, RegisteredTeam, Round, TOURNAMENT_STATUSES, Team, Tournament, TournamentStatus,
} from './tournament.models';
import { StatusPillComponent, TeamBadgeComponent, durationDays, fmtDate } from './tournament-ui';

type Tab = 'teams' | 'schedule' | 'ranking';
interface MatchDraft { team1_id: number | null; team2_id: number | null; date: string | null }

@Component({
  selector: 'app-tournament-detail',
  imports: [FormsModule, RouterLink, StatusPillComponent, TeamBadgeComponent, RankingTableComponent],
  templateUrl: './tournament-detail.component.html',
})
export class TournamentDetailComponent implements OnInit {
  /** Paramètre de route :id (withComponentInputBinding). */
  id = input.required<string>();

  private api = inject(TournamentApi);
  private notify = inject(NotifyService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly statuses = TOURNAMENT_STATUSES;
  readonly fmtDate = fmtDate;
  canWrite = computed(() => this.auth.hasRole('ADMIN', 'GERANT'));
  canRegister = computed(() => this.auth.hasRole('ADMIN', 'GERANT', 'SPORTIF'));
  tid = computed(() => Number(this.id()));

  tournament = signal<Tournament | null>(null);
  registered = signal<RegisteredTeam[]>([]);
  rounds = signal<Round[]>([]);
  matches = signal<Match[]>([]);
  allTeams = signal<Team[]>([]);
  loading = signal(true);
  loadError = signal<ApiError | null>(null);
  tab = signal<Tab>('teams');

  ranking = signal<RankingResponse | null>(null);
  rankingError = signal<ApiError | null>(null);
  rankingLoading = signal(false);

  // Formulaires
  teamToRegister: number | null = null;
  roundName = '';
  roundOrder: number | null = null;
  draftRound = signal<number | null>(null);
  draft: MatchDraft = { team1_id: null, team2_id: null, date: null };
  scores: Record<number, string> = {};

  duration = computed(() => {
    const t = this.tournament();
    return t ? durationDays(t.start_date, t.end_date) : null;
  });

  available = computed(() => {
    const ids = new Set(this.registered().map((t) => t.id));
    return this.allTeams().filter((t) => !ids.has(t.id));
  });

  /** Équipes proposées pour un match : les inscrites, ou toutes s'il y en a moins de 2. */
  matchTeams = computed<Team[]>(() => (this.registered().length >= 2 ? this.registered() : this.allTeams()));

  /** Calendrier : chaque tour avec ses matchs dans l'ordre chronologique. */
  schedule = computed(() =>
    this.rounds().map((r) => ({
      round: r,
      matches: this.matches()
        .filter((m) => m.round_id === r.id)
        .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id - b.id),
    })),
  );

  kpis = computed(() => ({
    teams: this.registered().length,
    rounds: this.rounds().length,
    matches: this.matches().length,
    played: this.matches().filter((m) => m.status === 'FINISHED').length,
  }));

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    const id = this.tid();
    forkJoin({
      t: this.api.tournament(id),
      reg: this.api.registeredTeams(id),
      rounds: this.api.rounds(id),
      matches: this.api.matches(id),
      teams: this.api.teams(),
    }).subscribe({
      next: ({ t, reg, rounds, matches, teams }) => {
        this.tournament.set(t);
        this.registered.set(reg);
        this.rounds.set(rounds);
        this.matches.set(matches);
        this.allTeams.set(teams);
        this.scores = Object.fromEntries(matches.map((m) => [m.id, m.score ?? '']));
        this.roundOrder = (rounds.at(-1)?.round_order ?? 0) + 1;
        this.loading.set(false);
        if (this.tab() === 'ranking') this.loadRanking();
      },
      error: (e: ApiError) => {
        this.loadError.set(e);
        this.loading.set(false);
      },
    });
  }

  selectTab(tab: Tab) {
    this.tab.set(tab);
    if (tab === 'ranking' && !this.ranking()) this.loadRanking();
  }

  // ── Statut (PATCH) ──
  changeStatus(status: TournamentStatus) {
    const t = this.tournament();
    if (!t) return;
    this.api.patchTournament(t.id, { status }).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.notify.success('Statut mis à jour.');
      },
      error: (e) => this.notify.error(e),
    });
  }

  removeTournament() {
    const t = this.tournament();
    if (!t || !confirm(`Supprimer « ${t.name} » et tout son contenu ?`)) return;
    this.api.deleteTournament(t.id).subscribe({
      next: () => {
        this.notify.success('Tournoi supprimé.');
        this.router.navigateByUrl('/tournaments/list');
      },
      error: (e) => this.notify.error(e),
    });
  }

  // ── Inscriptions ──
  register() {
    if (!this.teamToRegister) return;
    this.api.register(this.tid(), Number(this.teamToRegister)).subscribe({
      next: () => {
        this.notify.success('Équipe inscrite.');
        this.teamToRegister = null;
        this.load();
      },
      error: (e) => this.notify.error(e),
    });
  }

  unregister(team: RegisteredTeam) {
    if (!confirm(`Retirer « ${team.name} » du tournoi ?`)) return;
    this.api.unregister(this.tid(), team.id).subscribe({
      next: () => {
        this.notify.success(`« ${team.name} » retirée.`);
        this.load();
      },
      error: (e) => this.notify.error(e),
    });
  }

  // ── Tours ──
  addRound() {
    if (!this.roundName.trim() || !this.roundOrder) return;
    this.api.addRound(this.tid(), this.roundName.trim(), Number(this.roundOrder)).subscribe({
      next: (r) => {
        this.notify.success(`Tour « ${r.name} » ajouté.`);
        this.roundName = '';
        this.load();
      },
      error: (e) => this.notify.error(e),
    });
  }

  // ── Matchs ──
  openDraft(roundId: number) {
    this.draft = { team1_id: null, team2_id: null, date: this.tournament()?.start_date ?? null };
    this.draftRound.set(roundId);
  }

  createMatch(roundId: number) {
    this.api
      .saveMatch({
        round_id: roundId,
        team1_id: this.draft.team1_id ? Number(this.draft.team1_id) : null,
        team2_id: this.draft.team2_id ? Number(this.draft.team2_id) : null,
        date: this.draft.date || null,
        status: 'SCHEDULED',
        score: null,
      })
      .subscribe({
        next: (m) => {
          this.notify.success(`Match ${m.team1_name} – ${m.team2_name} programmé.`);
          this.draftRound.set(null);
          this.load();
        },
        error: (e) => this.notify.error(e),
      });
  }

  saveScore(m: Match) {
    const score = (this.scores[m.id] ?? '').trim();
    this.api.setScore(m.id, score).subscribe({
      next: (updated) => {
        this.matches.update((list) => list.map((x) => (x.id === m.id ? updated : x)));
        this.notify.success(`Score enregistré : ${updated.team1_name} ${updated.score} ${updated.team2_name}.`);
        this.ranking.set(null); // le classement sera recalculé à la prochaine ouverture
      },
      error: (e) => this.notify.error(e),
    });
  }

  deleteMatch(m: Match) {
    if (!confirm(`Supprimer le match ${m.team1_name} – ${m.team2_name} ?`)) return;
    this.api.deleteMatch(m.id).subscribe({
      next: () => {
        this.notify.success('Match supprimé.');
        this.load();
      },
      error: (e) => this.notify.error(e),
    });
  }

  // ── Classement (stats-service Python) ──
  loadRanking() {
    this.rankingLoading.set(true);
    this.rankingError.set(null);
    this.api.ranking(this.tid(), 'points').subscribe({
      next: (r) => {
        this.ranking.set(r);
        this.rankingLoading.set(false);
      },
      error: (e: ApiError) => {
        this.rankingError.set(e);
        this.rankingLoading.set(false);
      },
    });
  }

  syncAndReload() {
    this.api.syncStats().subscribe({
      next: (r) => {
        this.notify.success(`${r.finished_matches} match(s) terminé(s) synchronisé(s).`);
        this.loadRanking();
      },
      error: (e) => this.notify.error(e),
    });
  }
}
