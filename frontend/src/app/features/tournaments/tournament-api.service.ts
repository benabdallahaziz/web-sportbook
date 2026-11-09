import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/api.service';
import {
  ApprovalStatus, Match, MatchInput, PendingRegistration, Prediction, RankingResponse, RegisteredTeam, Round, SyncResult,
  Team, TeamInput, TeamStats, Tournament, TournamentInput,
} from './tournament.models';

/**
 * Accès typé aux deux microservices du module, toujours via la Gateway :
 *   /api/tournaments, /api/teams, /api/matches → tournament-events-service (Node.js)
 *   /api/stats/**                               → stats-service (Python)
 */
@Injectable({ providedIn: 'root' })
export class TournamentApi {
  private api = inject(ApiService);

  // ── Tournois ──
  tournaments() { return this.api.list<Tournament>('/api/tournaments'); }
  tournament(id: number) { return this.api.get<Tournament>('/api/tournaments', id); }
  saveTournament(body: TournamentInput, id?: number) {
    return id ? this.api.update<Tournament>('/api/tournaments', id, body) : this.api.create<Tournament>('/api/tournaments', body);
  }
  /** PATCH : modification partielle (ex. seulement le statut). */
  patchTournament(id: number, body: Partial<TournamentInput>) { return this.api.patch<Tournament>(`/api/tournaments/${id}`, body); }
  deleteTournament(id: number) { return this.api.remove('/api/tournaments', id); }

  // ── Validation (administrateur) ──
  pendingTournaments() { return this.api.list<Tournament>('/api/tournaments?approval=PENDING'); }
  pendingMatches() { return this.api.list<Match>('/api/matches?approval=PENDING'); }
  pendingRegistrations() { return this.api.list<PendingRegistration>('/api/tournaments/registrations?status=PENDING'); }
  decideTournament(id: number, decision: Exclude<ApprovalStatus, 'PENDING'>, reason?: string) {
    return this.api.patch<Tournament>(`/api/tournaments/${id}/approval`, { decision, reason: reason || null });
  }
  decideMatch(id: number, decision: Exclude<ApprovalStatus, 'PENDING'>, reason?: string) {
    return this.api.patch<Match>(`/api/matches/${id}/approval`, { decision, reason: reason || null });
  }
  decideRegistration(tournamentId: number, teamId: number, status: 'CONFIRMED' | 'REJECTED') {
    return this.api.patch(`/api/tournaments/${tournamentId}/teams/${teamId}`, { status });
  }

  // ── Inscriptions (sous-ressource) ──
  registeredTeams(tournamentId: number) { return this.api.list<RegisteredTeam>(`/api/tournaments/${tournamentId}/teams`); }
  register(tournamentId: number, teamId: number) { return this.api.post(`/api/tournaments/${tournamentId}/teams`, { team_id: teamId }); }
  unregister(tournamentId: number, teamId: number) { return this.api.remove(`/api/tournaments/${tournamentId}/teams`, teamId); }

  // ── Tours (sous-ressource) ──
  rounds(tournamentId: number) { return this.api.list<Round>(`/api/tournaments/${tournamentId}/rounds`); }
  addRound(tournamentId: number, name: string, roundOrder: number) {
    return this.api.post<Round>(`/api/tournaments/${tournamentId}/rounds`, { name, round_order: roundOrder });
  }

  // ── Équipes ──
  teams() { return this.api.list<Team>('/api/teams'); }
  saveTeam(body: TeamInput, id?: number) {
    return id ? this.api.update<Team>('/api/teams', id, body) : this.api.create<Team>('/api/teams', body);
  }
  deleteTeam(id: number) { return this.api.remove('/api/teams', id); }

  // ── Matchs ──
  matches(tournamentId?: number | null) {
    return this.api.list<Match>(`/api/matches${tournamentId ? `?tournament_id=${tournamentId}` : ''}`);
  }
  saveMatch(body: MatchInput, id?: number) {
    return id ? this.api.update<Match>('/api/matches', id, body) : this.api.create<Match>('/api/matches', body);
  }
  setScore(id: number, score: string) { return this.api.patch<Match>(`/api/matches/${id}/score`, { score }); }
  deleteMatch(id: number) { return this.api.remove('/api/matches', id); }

  // ── Statistiques (stats-service Python) ──
  ranking(tournamentId?: number | null, orderBy: 'elo' | 'points' = 'elo') {
    const q = new URLSearchParams({ order_by: orderBy });
    if (tournamentId) q.set('tournament_id', String(tournamentId));
    return this.api.read<RankingResponse>(`/api/stats/ranking?${q}`);
  }
  teamStats(teamId: number) { return this.api.read<TeamStats>(`/api/stats/teams/${teamId}`); }
  predict(team1: number, team2: number, tournamentId?: number | null) {
    const q = new URLSearchParams({ team1: String(team1), team2: String(team2) });
    if (tournamentId) q.set('tournament_id', String(tournamentId));
    return this.api.read<Prediction>(`/api/stats/predict?${q}`);
  }
  syncStats() { return this.api.post<SyncResult>('/api/stats/sync', {}); }
}
