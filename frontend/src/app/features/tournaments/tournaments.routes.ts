import { Routes } from '@angular/router';

/**
 * Module Tournois : pages dédiées (et non plus le CRUD générique), car ce
 * module exploite des sous-ressources (inscriptions, tours), les noms joints
 * des équipes et le microservice Python de statistiques.
 */
export const TOURNAMENTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  { path: 'list', title: 'Tournois · SportBook', loadComponent: () => import('./tournaments-list.component').then((m) => m.TournamentsListComponent) },
  { path: 'list/:id', title: 'Tournoi · SportBook', loadComponent: () => import('./tournament-detail.component').then((m) => m.TournamentDetailComponent) },
  { path: 'teams', title: 'Équipes · SportBook', loadComponent: () => import('./teams.component').then((m) => m.TeamsComponent) },
  { path: 'matches', title: 'Matchs · SportBook', loadComponent: () => import('./matches.component').then((m) => m.MatchesComponent) },
  { path: 'ranking', title: 'Classement · SportBook', loadComponent: () => import('./ranking.component').then((m) => m.RankingComponent) },
];
