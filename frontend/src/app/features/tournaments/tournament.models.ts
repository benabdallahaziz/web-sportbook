/**
 * Types alignés sur les réponses JSON réelles des microservices :
 *   - tournament-events-service (Node.js) : champs en snake_case
 *   - stats-service (Python)              : /api/stats/**
 */
export type TournamentStatus = 'PLANNED' | 'ONGOING' | 'FINISHED';
export type MatchStatus = 'SCHEDULED' | 'ONGOING' | 'FINISHED';

/** Circuit de validation : proposition d'un utilisateur → décision de l'admin. */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface Approvable {
  approval_status: ApprovalStatus;
  created_by: number | null;
  rejection_reason: string | null;
}

export interface Tournament extends Approvable {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: TournamentStatus;
}
export type TournamentInput = Omit<Tournament, 'id' | keyof Approvable>;

export interface Team {
  id: number;
  name: string;
  members: number;
  /** Propriétaire (null pour les équipes créées avant cette règle : admin seulement). */
  created_by: number | null;
}
export type TeamInput = Omit<Team, 'id' | 'created_by'>;

export interface RegisteredTeam extends Team {
  registration_date: string;
  registration_status: string;
}

export interface Round {
  id: number;
  name: string;
  round_order: number;
  tournament_id: number;
}

export interface Match extends Approvable {
  id: number;
  date: string | null;
  score: string | null;
  status: MatchStatus;
  round_id: number;
  team1_id: number;
  team2_id: number;
  team1_name: string;
  team2_name: string;
  round_name: string;
  tournament_id: number;
  tournament_name: string;
}

export interface MatchInput {
  date: string | null;
  score: string | null;
  status: MatchStatus;
  round_id: number | null;
  team1_id: number | null;
  team2_id: number | null;
}

/** Inscription en attente (file de l'administrateur). */
export interface PendingRegistration {
  id: number;
  tournament_id: number;
  tournament_name: string;
  team_id: number;
  team_name: string;
  members: number;
  registration_date: string;
  status: string;
}

// ─── stats-service (Python) ───────────────────────────────────────────────────

export interface RankingRow {
  position: number;
  team_id: number;
  team_name: string | null;
  elo: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string;
}

export interface RankingResponse {
  tournament_id: number | null;
  order_by: 'elo' | 'points';
  matches_counted: number;
  team_names_available: boolean;
  ranking: RankingRow[];
}

export interface EloPoint {
  match_id: number;
  date: string | null;
  opponent_id: number;
  opponent_name: string | null;
  score: string;
  rating_before: number;
  rating_after: number;
}

export interface TeamStats extends Omit<RankingRow, 'position'> {
  position: number | null;
  history: EloPoint[];
}

export interface PredictionSide {
  team_id: number;
  team_name: string | null;
  elo: number;
  win_probability: number;
}

export interface Prediction {
  team1: PredictionSide;
  team2: PredictionSide;
  favorite_team_id: number | null;
  explanation: string;
}

export interface SyncResult {
  matches_received: number;
  finished_matches: number;
  synced_at: string;
}

export const TOURNAMENT_STATUSES: { value: TournamentStatus; label: string }[] = [
  { value: 'PLANNED', label: 'Planifié' },
  { value: 'ONGOING', label: 'En cours' },
  { value: 'FINISHED', label: 'Terminé' },
];

export const MATCH_STATUSES: { value: MatchStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Programmé' },
  { value: 'ONGOING', label: 'En cours' },
  { value: 'FINISHED', label: 'Terminé' },
];
