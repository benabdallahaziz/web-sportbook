import { Routes } from '@angular/router';
import { VenuesCatalogComponent } from './venues-catalog.component';
import { VenuesManagementComponent } from './venues-management.component';
import { roleGuard } from '../../core/guards';

export const VENUES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalog' },
  {
    path: 'catalog',
    title: 'Complexes & Terrains · SportBook',
    component: VenuesCatalogComponent,
  },
  {
    path: 'manage',
    title: 'Gestion des Espaces & Terrains · SportBook',
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'GERANT'] },
    component: VenuesManagementComponent,
  },
  // Redirections pour compatibilité avec l'ancien menu CRUD
  { path: 'list', pathMatch: 'full', redirectTo: 'catalog' },
  { path: 'fields', pathMatch: 'full', redirectTo: 'manage' },
];
