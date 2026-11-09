import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/error.interceptor';
import { TournamentAccess } from '../tournaments/tournament-access.service';
import { TournamentApi } from '../tournaments/tournament-api.service';
import { Match, RankingRow, Team, Tournament } from '../tournaments/tournament.models';
import { FormDotsComponent, StatusPillComponent, TeamBadgeComponent, fmtDate } from '../tournaments/tournament-ui';

/**
 * Espace utilisateur (Sportif / Gérant) : tout ce qui concerne MES équipes,
 * MES matchs et MES propositions, sans les informations techniques du back-office.
 */
@Component({
  selector: 'app-player-home',
  imports: [RouterLink, StatusPillComponent, TeamBadgeComponent, FormDotsComponent],
  templateUrl: './player-home.component.html',
})
export class PlayerHomeComponent implements OnInit {
  private api = inject(TournamentApi);
  readonly auth = inject(AuthService);
  readonly access = inject(TournamentAccess);
  readonly fmtDate = fmtDate;

  tournaments = signal<Tournament[]>([]);
  teams = signal<Team[]>([]);
  matches = signal<Match[]>([]);
  ranking = signal<RankingRow[] | null>(null);
  loading = signal(true);
  loadError = signal<ApiError | null>(null);

  firstName = computed(() => this.auth.user()?.firstName || this.auth.fullName());
  isGerant = computed(() => this.auth.hasRole('GERANT'));

  myTeams = computed(() => this.teams().filter((t) => this.access.isOwner(t)));
  private myTeamIds = computed(() => new Set(this.myTeams().map((t) => t.id)));
  private myMatches = computed(() =>
    this.matches().filter((m) => this.myTeamIds().has(m.team1_id) || this.myTeamIds().has(m.team2_id)),
  );

  /** Matchs à venir de mes équipes, du plus proche au plus lointain. */
  upcoming = computed(() =>
    this.myMatches()
      .filter((m) => m.status !== 'FINISHED')
      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
      .slice(0, 5),
  );

  /** Derniers résultats de mes équipes (V / N / D du point de vue de mon équipe). */
  results = computed(() =>
    this.myMatches()
      .filter((m) => m.status === 'FINISHED' && /^\d+-\d+$/.test(m.score ?? ''))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .slice(0, 5)
      .map((m) => {
        const [g1, g2] = m.score!.split('-').map(Number);
        const mineIsHome = this.myTeamIds().has(m.team1_id);
        const [mine, other] = mineIsHome ? [g1, g2] : [g2, g1];
        return { m, outcome: mine > other ? 'V' : mine === other ? 'N' : 'D' };
      }),
  );

  wins = computed(() => this.results().filter((r) => r.outcome === 'V').length);

  /** Le prochain match est mis en avant dans le bandeau d'accueil. */
  nextMatch = computed(() => this.upcoming()[0] ?? null);
  laterMatches = computed(() => this.upcoming().slice(1));

  /** "dans 3 jours", "aujourd'hui", "demain"… */
  countdown(date: string | null): string {
    if (!date) return 'date à venir';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return 'en attente du résultat';
    if (days === 0) return 'aujourd’hui';
    if (days === 1) return 'demain';
    return `dans ${days} jours`;
  }

  /** Mes propositions (tournois + matchs) non encore validées. */
  proposals = computed(() => [
    ...this.tournaments()
      .filter((t) => this.access.isOwner(t) && t.approval_status !== 'APPROVED')
      .map((t) => ({ kind: 'Tournoi', label: t.name, status: t.approval_status, reason: t.rejection_reason, link: ['/tournaments/list', t.id] })),
    ...this.matches()
      .filter((m) => this.access.isOwner(m) && m.approval_status !== 'APPROVED')
      .map((m) => ({ kind: 'Match', label: `${m.team1_name} – ${m.team2_name}`, status: m.approval_status, reason: m.rejection_reason, link: ['/tournaments/list', m.tournament_id] })),
  ]);

  /** Tournois validés et pas encore terminés : on peut s'y inscrire. */
  openTournaments = computed(() =>
    this.tournaments()
      .filter((t) => t.approval_status === 'APPROVED' && t.status !== 'FINISHED')
      .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))
      .slice(0, 4),
  );

  rankOf(teamId: number) {
    return this.ranking()?.find((r) => r.team_id === teamId) ?? null;
  }

  ngOnInit() {
    this.loading.set(true);
    forkJoin({
      t: this.api.tournaments(),
      teams: this.api.teams(),
      m: this.api.matches(),
      // Le classement vient d'un autre microservice : s'il est arrêté, l'accueil reste utilisable
      r: this.api.ranking(null, 'elo').pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ t, teams, m, r }) => {
        this.tournaments.set(t);
        this.teams.set(teams);
        this.matches.set(m);
        this.ranking.set(r ? r.ranking : null);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.loadError.set(e);
        this.loading.set(false);
      },
    });
  }
}
