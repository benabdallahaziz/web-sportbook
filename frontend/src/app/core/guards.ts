import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/**
 * Page d'accueil selon le profil :
 *   - ADMIN            → /dashboard (back-office : état des microservices)
 *   - SPORTIF / GERANT → /accueil   (espace utilisateur « Mon espace »)
 */
export const homeUrl = (auth: AuthService) => (auth.hasRole('ADMIN') ? '/dashboard' : '/accueil');

/** Redirection de la racine "/" vers l'accueil du profil connecté. */
export const redirectToHome: RedirectFunction = () => inject(Router).parseUrl(homeUrl(inject(AuthService)));

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).parseUrl('/login');
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).parseUrl(homeUrl(auth)) : true;
};

/** Utilisation : data: { roles: ['ADMIN'] }. Sinon, retour à l'accueil du profil. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = (route.data['roles'] ?? []) as Role[];
  return roles.length === 0 || auth.hasRole(...roles) ? true : inject(Router).parseUrl(homeUrl(auth));
};
