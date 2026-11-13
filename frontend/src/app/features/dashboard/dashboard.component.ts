import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { UserResponse } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { OrderAnalytics, Product } from '../marketplace/marketplace.models';
import { MODULES } from '../modules';
import { TournamentApi } from '../tournaments/tournament-api.service';
import { Match, PendingRegistration, RankingRow, Team, Tournament } from '../tournaments/tournament.models';
import { StatusPillComponent, fmtDate } from '../tournaments/tournament-ui';
import { Field, Venue } from '../venues/venues.models';
import { BarListComponent, BarRow } from './bar-list.component';

type Health = 'checking' | 'up' | 'down';

/** Une source indisponible (microservice arrêté) donne null au lieu de casser tout le tableau de bord. */
const safe = <T>(obs: Observable<T>) => obs.pipe(catchError(() => of(null)));

const countBy = <T>(rows: T[] | null, key: (r: T) => string, labels: Record<string, string>, order?: string[]): BarRow[] => {
  const counts: Record<string, number> = {};
  for (const r of rows ?? []) counts[key(r)] = (counts[key(r)] ?? 0) + 1;
  const keys = order ?? Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return keys.map((k) => ({ label: labels[k] ?? k, value: counts[k] ?? 0 }));
};

interface Coach { id: number; name: string; speciality?: string | null; rating: number }
interface Program { id: number; name: string; coachId: number }
interface Session { id: number; date: string; status: string; userId?: number | null }

/**
 * Back-office de l'ADMINISTRATEUR : une carte par microservice avec ses chiffres,
 * son état (via la Gateway + Eureka) et les actions d'administration du service.
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
  private notify = inject(NotifyService);
  readonly fmtDate = fmtDate;

  // ── État des services ──
  services = MODULES.filter((m) => m.deployed !== false);
  health = signal<Record<string, Health>>({});
  upCount = computed(() => Object.values(this.health()).filter((h) => h === 'up').length);
  state = (id: string) => this.health()[id] ?? 'checking';

  // ── Données de chaque microservice ──
  loading = signal(true);
  lastUpdate = signal<Date | null>(null);
  users = signal<UserResponse[] | null>(null);
  venues = signal<Venue[] | null>(null);
  fields = signal<Field[] | null>(null);
  products = signal<Product[] | null>(null);
  sales = signal<OrderAnalytics | null>(null);
  tournaments = signal<Tournament[] | null>(null);
  teams = signal<Team[] | null>(null);
  matches = signal<Match[] | null>(null);
  registrations = signal<PendingRegistration[] | null>(null);
  ranking = signal<RankingRow[] | null>(null);
  coaches = signal<Coach[] | null>(null);
  programs = signal<Program[] | null>(null);
  sessions = signal<Session[] | null>(null);
  syncing = signal(false);

  // ── Identity ──
  blockedUsers = computed(() => this.users()?.filter((u) => u.status !== 'ACTIVE').length ?? null);
  usersByRole = computed<BarRow[]>(() => {
    const u = this.users() ?? [];
    return [
      { label: 'Sportifs', value: u.filter((x) => x.roles.includes('SPORTIF')).length },
      { label: 'Gérants', value: u.filter((x) => x.roles.includes('GERANT')).length },
      { label: 'Admins', value: u.filter((x) => x.roles.includes('ADMIN')).length },
    ];
  });

  // ── Venue ──
  fieldsBySport = computed(() => countBy(this.fields(), (f) => f.sport || 'Autre', {}).slice(0, 5));

  // ── Marketplace ──
  outOfStock = computed(() => this.products()?.filter((p) => (p.stock ?? 0) <= 0).length ?? null);
  ordersByStatus = computed<BarRow[]>(() => {
    const s = this.sales();
    return s
      ? [
          { label: 'En attente', value: s.pending_orders },
          { label: 'Confirmées', value: s.confirmed_orders },
          { label: 'Annulées', value: s.cancelled_orders },
        ]
      : [];
  });

  // ── Tournament ──
  pendingTournaments = computed(() => (this.tournaments() ?? []).filter((t) => t.approval_status === 'PENDING'));
  pendingMatches = computed(() => (this.matches() ?? []).filter((m) => m.approval_status === 'PENDING'));
  pendingTotal = computed(
    () => this.pendingTournaments().length + this.pendingMatches().length + (this.registrations()?.length ?? 0),
  );
  playedMatches = computed(() => this.matches()?.filter((m) => m.status === 'FINISHED').length ?? null);
  tournamentsByStatus = computed(() =>
    countBy(this.tournaments(), (t) => t.status, { PLANNED: 'Planifiés', ONGOING: 'En cours', FINISHED: 'Terminés' },
      ['PLANNED', 'ONGOING', 'FINISHED']),
  );

  // ── Stats ──
  topTeams = computed<BarRow[]>(() =>
    (this.ranking() ?? []).slice(0, 5).map((r) => ({
      label: r.team_name ?? `Équipe #${r.team_id}`,
      value: r.points,
      hint: `· Elo ${r.elo.toFixed(0)}`,
    })),
  );

  // ── Coach ──
  sessionsByStatus = computed(() =>
    countBy(this.sessions(), (s) => s.status, { SCHEDULED: 'Planifiées', COMPLETED: 'Terminées', CANCELLED: 'Annulées' },
      ['SCHEDULED', 'COMPLETED', 'CANCELLED']),
  );
  avgRating = computed(() => {
    const c = this.coaches();
    if (!c || c.length === 0) return null;
    return (c.reduce((s, x) => s + (x.rating ?? 0), 0) / c.length).toFixed(1);
  });

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.load();
    this.check();
  }

  load() {
    this.loading.set(true);
    forkJoin({
      users: safe(this.api.list<UserResponse>('/api/users')),
      venues: safe(this.api.list<Venue>('/api/venues')),
      fields: safe(this.api.list<Field>('/api/fields')),
      products: safe(this.api.list<Product>('/api/products')),
      sales: safe(this.api.read<OrderAnalytics>('/api/orders/analytics')),
      tournaments: safe(this.tournamentApi.tournaments()),
      teams: safe(this.tournamentApi.teams()),
      matches: safe(this.tournamentApi.matches()),
      registrations: safe(this.tournamentApi.pendingRegistrations()),
      ranking: safe(this.tournamentApi.ranking(null, 'points').pipe(map((r) => r.ranking))),
      coaches: safe(this.api.list<Coach>('/api/coaches')),
      programs: safe(this.api.list<Program>('/api/programs')),
      sessions: safe(this.api.list<Session>('/api/sessions')),
    }).subscribe((d) => {
      this.users.set(d.users);
      this.venues.set(d.venues);
      this.fields.set(d.fields);
      this.products.set(d.products);
      this.sales.set(d.sales);
      this.tournaments.set(d.tournaments);
      this.teams.set(d.teams);
      this.matches.set(d.matches);
      this.registrations.set(d.registrations);
      this.ranking.set(d.ranking);
      this.coaches.set(d.coaches);
      this.programs.set(d.programs);
      this.sessions.set(d.sessions);
      this.loading.set(false);
      this.lastUpdate.set(new Date());
    });
  }

  /** Un GET sur la première ressource de chaque service passe par la Gateway puis Eureka. */
  check() {
    const s: Record<string, Health> = {};
    this.services.forEach((m) => (s[m.id] = 'checking'));
    this.health.set(s);
    for (const m of this.services) {
      this.api
        .list(m.links[0].endpoint)
        .pipe(map(() => 'up' as Health), catchError((e) => of((e.status >= 500 || e.status === 0 ? 'down' : 'up') as Health)))
        .subscribe((h) => this.health.update((x) => ({ ...x, [m.id]: h })));
    }
  }

  /** Recalcule le classement Elo à partir des matchs terminés (action ADMIN du stats-service). */
  syncStats() {
    this.syncing.set(true);
    this.tournamentApi.syncStats().subscribe({
      next: (r) => {
        this.syncing.set(false);
        this.notify.success(`Classement recalculé : ${r.finished_matches} match(s) terminé(s) pris en compte.`);
        this.load();
      },
      error: (e) => {
        this.syncing.set(false);
        this.notify.error(e);
      },
    });
  }

  money(v: number | null | undefined) {
    return v === null || v === undefined ? '—' : `${v.toFixed(0)} DT`;
  }
}
