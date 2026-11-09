import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { UserResponse } from '../../core/models';
import { MODULES, ModuleInfo } from '../modules';
import { TournamentApi } from '../tournaments/tournament-api.service';
import { Match, PendingRegistration, RankingRow, Team, Tournament } from '../tournaments/tournament.models';
import { StatusPillComponent, fmtDate } from '../tournaments/tournament-ui';
import { BarListComponent, BarRow } from './bar-list.component';

type Health = 'checking' | 'up' | 'down';

/** Une source indisponible (microservice arrêté) donne null au lieu de casser tout le tableau de bord. */
const safe = <T>(obs: Observable<T>) => obs.pipe(catchError(() => of(null)));

/**
 * Tableau de bord de l'ADMINISTRATEUR : statistiques de la plateforme,
 * file de validation et état des microservices.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, BarListComponent, StatusPillComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private tournamentApi = inject(TournamentApi);
  readonly fmtDate = fmtDate;

  // ── État des services ──
  modules = computed(() => MODULES.filter((m) => !m.roles || this.auth.hasRole(...m.roles)));
  health = signal<Record<string, Health>>({});
  visibleLinks = (m: ModuleInfo) => m.links.filter((l) => !l.roles || this.auth.hasRole(...l.roles));
  upCount = computed(() => Object.values(this.health()).filter((h) => h === 'up').length);

  // ── Données ──
  loading = signal(true);
  users = signal<UserResponse[] | null>(null);
  tournaments = signal<Tournament[] | null>(null);
  teams = signal<Team[] | null>(null);
  matches = signal<Match[] | null>(null);
  registrations = signal<PendingRegistration[] | null>(null);
  ranking = signal<RankingRow[] | null>(null);

  // ── Chiffres clés ──
  kpi = computed(() => {
    const m = this.matches();
    return {
      users: this.users()?.length ?? null,
      tournaments: this.tournaments()?.length ?? null,
      teams: this.teams()?.length ?? null,
      played: m ? m.filter((x) => x.status === 'FINISHED').length : null,
      matches: m?.length ?? null,
    };
  });

  pendingTournaments = computed(() => (this.tournaments() ?? []).filter((t) => t.approval_status === 'PENDING'));
  pendingMatches = computed(() => (this.matches() ?? []).filter((m) => m.approval_status === 'PENDING'));
  pendingTotal = computed(
    () => this.pendingTournaments().length + this.pendingMatches().length + (this.registrations()?.length ?? 0),
  );

  // ── Graphiques ──
  tournamentsByStatus = computed<BarRow[]>(() => {
    const t = this.tournaments() ?? [];
    return [
      { label: 'Planifiés', value: t.filter((x) => x.status === 'PLANNED').length },
      { label: 'En cours', value: t.filter((x) => x.status === 'ONGOING').length },
      { label: 'Terminés', value: t.filter((x) => x.status === 'FINISHED').length },
    ];
  });

  usersByRole = computed<BarRow[]>(() => {
    const u = this.users() ?? [];
    return [
      { label: 'Sportifs', value: u.filter((x) => x.roles.includes('SPORTIF')).length },
      { label: 'Gérants', value: u.filter((x) => x.roles.includes('GERANT')).length },
      { label: 'Admins', value: u.filter((x) => x.roles.includes('ADMIN')).length },
    ];
  });

  approvals = computed<BarRow[]>(() => {
    const all = [...(this.tournaments() ?? []), ...(this.matches() ?? [])];
    return [
      { label: 'Validés', value: all.filter((x) => x.approval_status === 'APPROVED').length },
      { label: 'En attente', value: all.filter((x) => x.approval_status === 'PENDING').length },
      { label: 'Refusés', value: all.filter((x) => x.approval_status === 'REJECTED').length },
    ];
  });

  topTeams = computed<BarRow[]>(() =>
    (this.ranking() ?? []).slice(0, 5).map((r) => ({
      label: r.team_name ?? `Équipe #${r.team_id}`,
      value: r.points,
      hint: `· Elo ${r.elo.toFixed(0)}`,
    })),
  );

  ngOnInit() {
    this.load();
    this.check();
  }

  load() {
    this.loading.set(true);
    forkJoin({
      users: safe(this.api.list<UserResponse>('/api/users')),
      tournaments: safe(this.tournamentApi.tournaments()),
      teams: safe(this.tournamentApi.teams()),
      matches: safe(this.tournamentApi.matches()),
      registrations: safe(this.tournamentApi.pendingRegistrations()),
      ranking: safe(this.tournamentApi.ranking(null, 'points').pipe(map((r) => r.ranking))),
    }).subscribe((d) => {
      this.users.set(d.users);
      this.tournaments.set(d.tournaments);
      this.teams.set(d.teams);
      this.matches.set(d.matches);
      this.registrations.set(d.registrations);
      this.ranking.set(d.ranking);
      this.loading.set(false);
    });
  }

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

  refresh() {
    this.load();
    this.check();
  }
}
