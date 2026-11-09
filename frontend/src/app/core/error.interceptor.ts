import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Erreur normalisée renvoyée à tous les composants. */
export interface ApiError {
  status: number;
  message: string;
  details: string[];
}

/**
 * Transforme les erreurs HTTP en message lisible.
 * Priorité au message renvoyé par le microservice ({ message, details } côté
 * Node/Python, { message } ou { error } côté Spring), sinon message générique.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const body = err.error && typeof err.error === 'object' ? err.error : {};
      const details: string[] = Array.isArray(body.details) ? body.details.map(String) : [];
      let message = 'Une erreur est survenue.';
      if (err.status === 0) message = 'Service injoignable. Vérifiez que la Gateway (8085) et le microservice sont démarrés.';
      else if (body.message) message = body.message;
      else if (err.status === 503) message = 'Le microservice demandé n’est pas enregistré sur Eureka.';
      else if (body.error) message = body.error;
      else if (err.status === 404) message = 'Ressource introuvable.';
      else if (err.status >= 500) message = 'Erreur interne du serveur. Réessayez dans un instant.';
      const error: ApiError = { status: err.status, message, details };
      return throwError(() => error);
    }),
  );
