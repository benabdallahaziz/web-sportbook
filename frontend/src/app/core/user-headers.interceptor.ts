import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { API_URL } from './config';

/**
 * Transmet l'utilisateur connecté aux microservices (via la Gateway) :
 *   X-User-Id: 12
 *   X-User-Roles: SPORTIF,GERANT
 * identity-user-service ne délivre pas encore de jeton JWT : ces en-têtes
 * permettent au service des tournois d'appliquer le circuit de validation
 * (propositions des utilisateurs, décisions de l'administrateur).
 * Avec JWT, on enverrait à la place "Authorization: Bearer <jeton>".
 */
export const userHeadersInterceptor: HttpInterceptorFn = (req, next) => {
  const user = inject(AuthService).user();
  if (!user || !req.url.startsWith(API_URL)) return next(req);
  return next(
    req.clone({
      setHeaders: { 'X-User-Id': String(user.id), 'X-User-Roles': user.roles.join(',') },
    }),
  );
};
