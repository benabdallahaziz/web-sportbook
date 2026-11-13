import { Routes } from '@angular/router';
import { CrudPageComponent } from '../../shared/crud-page.component';
import { COACHES, PROGRAMS, SESSIONS } from '../module-configs';

export const COACHES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  { path: 'list', component: CrudPageComponent, data: { config: COACHES } },
  { path: 'programs', component: CrudPageComponent, data: { config: PROGRAMS } },
  { path: 'sessions', component: CrudPageComponent, data: { config: SESSIONS } },
  // Espace sportif : recommandation IA (recommendation-service) + réservation de séances
  { path: 'trouver', title: 'Trouver mon coach · SportBook',
    loadComponent: () => import('./coach-finder.component').then((m) => m.CoachFinderComponent) },
  { path: 'mes-seances', title: 'Mes séances · SportBook',
    loadComponent: () => import('./my-sessions.component').then((m) => m.MySessionsComponent) },
];
