import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards';

/**
 * Module Complexes & Terrains :
 *   /venues/catalog  catalogue public (sportif, visiteur)
 *   /venues/gerant   cockpit du gérant (GERANT, ADMIN)
 */
export const VENUES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalog' },
  {
    path: 'catalog',
    title: 'Terrains & Salles · SportBook',
    loadComponent: () => import('./sportif/venues-catalog.component').then((m) => m.VenuesCatalogComponent),
  },
  {
    path: 'gerant',
    title: 'Espace gérant · SportBook',
    canActivate: [roleGuard],
    data: { roles: ['GERANT', 'ADMIN'] },
    loadComponent: () => import('./gerant/gerant-dashboard.component').then((m) => m.GerantDashboardComponent),
  },
  // Compatibilité avec les anciens liens
  { path: 'manage', pathMatch: 'full', redirectTo: 'gerant' },
  { path: 'list', pathMatch: 'full', redirectTo: 'catalog' },
  { path: 'fields', pathMatch: 'full', redirectTo: 'gerant' },
];
