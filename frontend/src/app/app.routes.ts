import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'profile', loadComponent: () => import('./features/users/profile.component').then((m) => m.ProfileComponent) },
      { path: 'users', canActivate: [roleGuard], data: { roles: ['ADMIN'] }, loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent) },
      { path: 'venues', loadChildren: () => import('./features/venues/venues.routes').then((m) => m.VENUES_ROUTES) },
      { path: 'bookings', loadChildren: () => import('./features/bookings/bookings.routes').then((m) => m.BOOKINGS_ROUTES) },
      { path: 'marketplace', loadChildren: () => import('./features/marketplace/marketplace.routes').then((m) => m.MARKETPLACE_ROUTES) },
      { path: 'tournaments', loadChildren: () => import('./features/tournaments/tournaments.routes').then((m) => m.TOURNAMENTS_ROUTES) },
      { path: 'coaches', loadChildren: () => import('./features/coaches/coaches.routes').then((m) => m.COACHES_ROUTES) },
    ],
  },
  { path: '**', redirectTo: '' },
];
