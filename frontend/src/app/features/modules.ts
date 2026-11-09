import { Role } from '../core/models';

export interface ModuleLink { label: string; path: string; endpoint: string; roles?: Role[] }
export interface ModuleInfo {
  id: string;
  label: string;
  service: string;
  description: string;
  base: string;
  roles?: Role[];
  links: ModuleLink[];
}

/** Source unique pour le menu, le tableau de bord et le contrôle de santé des services. */
export const MODULES: ModuleInfo[] = [
  { id: 'identity', label: 'Utilisateurs', service: 'identity-user-service', base: '/users', roles: ['ADMIN'],
    description: 'Comptes, profils et rôles.',
    links: [{ label: 'Utilisateurs', path: '/users', endpoint: '/api/users' }] },
  { id: 'venues', label: 'Complexes', service: 'venue-management-service', base: '/venues',
    description: 'Complexes sportifs et terrains.',
    links: [
      { label: 'Complexes', path: '/venues/list', endpoint: '/api/venues' },
      { label: 'Terrains', path: '/venues/fields', endpoint: '/api/fields' },
    ] },
  { id: 'bookings', label: 'Réservations', service: 'booking-availability-service', base: '/bookings',
    description: 'Créneaux et réservations.',
    links: [
      { label: 'Réservations', path: '/bookings/list', endpoint: '/api/bookings' },
      { label: 'Créneaux', path: '/bookings/timeslots', endpoint: '/api/timeslots' },
    ] },
  { id: 'marketplace', label: 'Boutique', service: 'marketplace-service', base: '/marketplace',
    description: 'Produits, panier et commandes.',
    links: [
      { label: 'Produits', path: '/marketplace/products', endpoint: '/api/products' },
      { label: 'Panier', path: '/marketplace/cart', endpoint: '/api/cart' },
      { label: 'Commandes', path: '/marketplace/orders', endpoint: '/api/orders' },
      { label: 'Ventes & Analytics', path: '/marketplace/analytics', endpoint: '/api/orders/analytics', roles: ['ADMIN', 'GERANT'] },
    ] },
  { id: 'tournaments', label: 'Tournois', service: 'tournament-events-service', base: '/tournaments',
    description: 'Tournois, inscriptions, tours, matchs et scores.',
    links: [
      { label: 'Tournois', path: '/tournaments/list', endpoint: '/api/tournaments' },
      { label: 'Équipes', path: '/tournaments/teams', endpoint: '/api/teams' },
      { label: 'Matchs', path: '/tournaments/matches', endpoint: '/api/matches' },
      { label: 'Validation', path: '/tournaments/approvals', endpoint: '/api/tournaments?approval=PENDING', roles: ['ADMIN'] },
    ] },
  { id: 'stats', label: 'Statistiques', service: 'stats-service', base: '/tournaments/ranking',
    description: 'Classement Elo et pronostics (microservice Python).',
    links: [
      { label: 'Classement & pronostics', path: '/tournaments/ranking', endpoint: '/api/stats/ranking' },
    ] },
  { id: 'coaches', label: 'Coachs', service: 'coach-training-service', base: '/coaches',
    description: 'Coachs, programmes et séances.',
    links: [
      { label: 'Coachs', path: '/coaches/list', endpoint: '/api/coaches' },
      { label: 'Programmes', path: '/coaches/programs', endpoint: '/api/programs' },
      { label: 'Séances', path: '/coaches/sessions', endpoint: '/api/sessions' },
    ] },
];
