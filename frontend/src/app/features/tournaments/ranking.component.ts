import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiError } from '../../core/error.interceptor';
import { NotifyService } from '../../core/notify.service';
import { RankingTableComponent } from './ranking-table.component';
import { TournamentApi } from './tournament-api.service';
import { Prediction, RankingResponse, Team, Tournament } from './tournament.models';
import { TeamBadgeComponent } from './tournament-ui';

/** Page Classement & pronostics : alimentée par le microservice Python stats-service. */
@Component({
  selector: 'app-ranking',
  imports: [FormsModule, RankingTableComponent, TeamBadgeComponent],
  templateUrl: './ranking.component.html',
})
export class RankingComponent implements OnInit {
  private api = inject(TournamentApi);
  private notify = inject(NotifyService);

  tournaments = signal<Tournament[]>([]);
  teams = signal<Team[]>([]);
  tournamentId: number | null = null;
  orderBy: 'elo' | 'points' = 'elo';

  data = signal<RankingResponse | null>(null);
  loading = signal(true);
  error = signal<ApiError | null>(null);
  syncing = signal(false);

  team1: number | null = null;
  team2: number | null = null;
  prediction = signal<Prediction | null>(null);
  predicting = signal(false);

  podium = computed(() => {
    const rows = this.data()?.ranking ?? [];
    // Ordre visuel : 2e, 1er, 3e
    return [rows[1], rows[0], rows[2]].filter((r) => !!r);
  });

  ngOnInit() {
    forkJoin({ t: this.api.tournaments(), teams: this.api.teams() }).subscribe({
      next: ({ t, teams }) => {
        this.tournaments.set(t);
        this.teams.set(teams);
      },
      error: () => { /* listes déroulantes vides : le classement reste utilisable */ },
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.ranking(this.tournamentId, this.orderBy).subscribe({
      next: (r) => {
        this.data.set(r);
        this.loading.set(false);
      },
      error: (e: ApiError) => {
        this.error.set(e);
        this.loading.set(false);
      },
    });
  }

  /** Recopie les résultats via REST (utile si RabbitMQ était arrêté). */
  sync() {
    this.syncing.set(true);
    this.api.syncStats().subscribe({
      next: (r) => {
        this.syncing.set(false);
        this.notify.success(`${r.finished_matches} match(s) terminé(s) synchronisé(s) sur ${r.matches_received}.`);
        this.load();
      },
      error: (e) => {
        this.syncing.set(false);
        this.notify.error(e);
      },
    });
  }

  predict() {
    if (!this.team1 || !this.team2) return;
    this.predicting.set(true);
    this.api.predict(Number(this.team1), Number(this.team2), this.tournamentId).subscribe({
      next: (p) => {
        this.prediction.set(p);
        this.predicting.set(false);
      },
      error: (e) => {
        this.predicting.set(false);
        this.notify.error(e);
      },
    });
  }

  pct(p: number) {
    return Math.round(p * 100);
  }

  name(id: number | null | undefined, fallback?: string | null) {
    return fallback ?? this.teams().find((t) => t.id === id)?.name ?? `Équipe #${id}`;
  }
}
