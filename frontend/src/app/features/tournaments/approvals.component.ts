import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { ApiError } from '../../core/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { TournamentApi } from './tournament-api.service';
import { Match, PendingRegistration, Tournament } from './tournament.models';
import { TeamBadgeComponent, durationDays, fmtDate } from './tournament-ui';

type Tab = 'tournaments' | 'matches' | 'registrations';

/** File de validation de l'administrateur. */
@Component({
  selector: 'app-approvals',
  imports: [RouterLink, TeamBadgeComponent],
  templateUrl: './approvals.component.html',
})
export class ApprovalsComponent implements OnInit {
  private api = inject(TournamentApi);
  private notify = inject(NotifyService);

  readonly fmtDate = fmtDate;
  readonly durationDays = durationDays;

  tournaments = signal<Tournament[]>([]);
  matches = signal<Match[]>([]);
  registrations = signal<PendingRegistration[]>([]);
  approvedTournamentIds = signal<Set<number>>(new Set());
  loading = signal(true);
  loadError = signal<ApiError | null>(null);
  busy = signal<string | null>(null);
  tab = signal<Tab>('tournaments');

  total = computed(() => this.tournaments().length + this.matches().length + this.registrations().length);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      t: this.api.pendingTournaments(),
      m: this.api.pendingMatches(),
      r: this.api.pendingRegistrations(),
      all: this.api.tournaments(),
    }).subscribe({
      next: ({ t, m, r, all }) => {
        this.tournaments.set(t);
        this.matches.set(m);
        this.registrations.set(r);
        this.approvedTournamentIds.set(new Set(all.filter((x) => x.approval_status === 'APPROVED').map((x) => x.id)));
        this.loading.set(false);
        // Ouvre automatiquement le premier onglet qui contient quelque chose
        if (!t.length && m.length) this.tab.set('matches');
        else if (!t.length && !m.length && r.length) this.tab.set('registrations');
      },
      error: (e: ApiError) => {
        this.loadError.set(e);
        this.loading.set(false);
      },
    });
  }

  /** Un match ne peut être validé que si son tournoi l'est déjà. */
  tournamentApproved(m: Match) {
    return this.approvedTournamentIds().has(m.tournament_id);
  }

  approveTournament(t: Tournament) {
    this.run(`t${t.id}`, this.api.decideTournament(t.id, 'APPROVED'), () => {
      this.tournaments.update((l) => l.filter((x) => x.id !== t.id));
      this.approvedTournamentIds.update((s) => new Set(s).add(t.id));
      this.notify.success(`Tournoi « ${t.name} » validé : il est maintenant visible par tous.`);
    });
  }

  rejectTournament(t: Tournament) {
    const reason = prompt(`Motif du refus de « ${t.name} » (affiché à son auteur) :`, '');
    if (reason === null) return;
    this.run(`t${t.id}`, this.api.decideTournament(t.id, 'REJECTED', reason.trim()), () => {
      this.tournaments.update((l) => l.filter((x) => x.id !== t.id));
      this.notify.success(`Tournoi « ${t.name} » refusé.`);
    });
  }

  approveMatch(m: Match) {
    this.run(`m${m.id}`, this.api.decideMatch(m.id, 'APPROVED'), () => {
      this.matches.update((l) => l.filter((x) => x.id !== m.id));
      this.notify.success(`Match ${m.team1_name} – ${m.team2_name} validé.`);
    });
  }

  rejectMatch(m: Match) {
    const reason = prompt(`Motif du refus du match ${m.team1_name} – ${m.team2_name} :`, '');
    if (reason === null) return;
    this.run(`m${m.id}`, this.api.decideMatch(m.id, 'REJECTED', reason.trim()), () => {
      this.matches.update((l) => l.filter((x) => x.id !== m.id));
      this.notify.success('Match refusé.');
    });
  }

  decideRegistration(r: PendingRegistration, status: 'CONFIRMED' | 'REJECTED') {
    this.run(`r${r.id}`, this.api.decideRegistration(r.tournament_id, r.team_id, status), () => {
      this.registrations.update((l) => l.filter((x) => x.id !== r.id));
      this.notify.success(`Inscription de « ${r.team_name} » ${status === 'CONFIRMED' ? 'confirmée' : 'refusée'}.`);
    });
  }

  /** Envoie une décision ; le bouton concerné est désactivé pendant l'appel. */
  private run(key: string, req$: Observable<unknown>, done: () => void) {
    this.busy.set(key);
    req$.subscribe({
      next: () => {
        this.busy.set(null);
        done();
      },
      error: (e) => {
        this.busy.set(null);
        this.notify.error(e);
      },
    });
  }
}
