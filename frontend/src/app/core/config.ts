/**
 * URL de l'API Gateway.
 *  - Développement (`ng serve`, port 4200) : la Gateway est appelée directement sur le port 8085.
 *  - Docker / cloud (KillerCoda…) : le frontend est servi par nginx, qui relaie /api vers la Gateway.
 *    On appelle alors la même origine (URL relative), quelle que soit l'adresse publique.
 */
const loc = typeof window !== 'undefined' ? window.location : null;
export const API_URL = !loc || loc.port === '4200' ? `${loc?.protocol ?? 'http:'}//${loc?.hostname ?? 'localhost'}:8085` : '';
