import { CrudConfig, Role } from '../core/models';

const ADMIN_GERANT: Role[] = ['ADMIN', 'GERANT'];
const ALL: Role[] = ['ADMIN', 'GERANT', 'SPORTIF'];

/**
 * Une configuration par ressource exposée par la Gateway.
 * Les champs suivent database/sportbook_databases.sql (noms en camelCase côté JSON).
 * Si un microservice utilise d'autres noms, il suffit d'ajuster `key` ici.
 */

// ---- Venue Management (/api/venues, /api/fields) ----
export const VENUES: CrudConfig = {
  title: 'Complexes sportifs', subtitle: 'Les lieux où se trouvent les terrains.',
  endpoint: '/api/venues', itemLabel: 'complexe', writeRoles: ADMIN_GERANT,
  fields: [
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'address', label: 'Adresse', type: 'text' },
    { key: 'phone', label: 'Téléphone', type: 'text' },
    { key: 'ownerId', label: 'Gérant (id)', type: 'number', currentUserId: true },
  ],
};
export const FIELDS: CrudConfig = {
  title: 'Terrains', subtitle: 'Terrains réservables, avec leur prix par heure.',
  endpoint: '/api/fields', itemLabel: 'terrain', writeRoles: ADMIN_GERANT,
  fields: [
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'sport', label: 'Sport', type: 'select', options: ['Football', 'Tennis', 'Padel', 'Basketball'], required: true },
    { key: 'price', label: 'Prix par heure (DT)', type: 'number', required: true },
    { key: 'venueId', label: 'Complexe (id)', type: 'number', required: true },
  ],
};

// ---- Booking & Availability (/api/timeslots, /api/bookings) ----
export const TIMESLOTS: CrudConfig = {
  title: 'Créneaux', subtitle: 'Plages horaires proposées pour chaque terrain.',
  endpoint: '/api/timeslots', itemLabel: 'créneau', writeRoles: ADMIN_GERANT,
  fields: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'startTime', label: 'Début', type: 'time', required: true },
    { key: 'endTime', label: 'Fin', type: 'time', required: true },
    { key: 'fieldId', label: 'Terrain (id)', type: 'number', required: true },
  ],
};
export const BOOKINGS: CrudConfig = {
  title: 'Réservations', subtitle: 'Un créneau ne peut être réservé qu’une seule fois.',
  endpoint: '/api/bookings', itemLabel: 'réservation', writeRoles: ALL,
  fields: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'status', label: 'Statut', type: 'select', options: ['PENDING', 'CONFIRMED', 'CANCELLED'], required: true },
    { key: 'totalPrice', label: 'Prix total (DT)', type: 'number', required: true },
    { key: 'userId', label: 'Joueur (id)', type: 'number', currentUserId: true },
    { key: 'fieldId', label: 'Terrain (id)', type: 'number', required: true },
    { key: 'timeSlotId', label: 'Créneau (id)', type: 'number', required: true },
  ],
};

// ---- Marketplace (/api/products, /api/cart, /api/orders) ----
export const PRODUCTS: CrudConfig = {
  title: 'Produits', subtitle: 'Équipements et accessoires en vente.',
  endpoint: '/api/products', itemLabel: 'produit', writeRoles: ADMIN_GERANT,
  fields: [
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', formOnly: true },
    { key: 'price', label: 'Prix (DT)', type: 'number', required: true },
    { key: 'stock', label: 'Stock', type: 'number', required: true, default: 0 },
    { key: 'categoryId', label: 'Catégorie (id)', type: 'number' },
  ],
};
export const CART: CrudConfig = {
  title: 'Panier', subtitle: 'Paniers en cours.',
  endpoint: '/api/cart', itemLabel: 'panier', writeRoles: ALL,
  fields: [
    { key: 'createdAt', label: 'Créé le', type: 'date', required: true },
    { key: 'total', label: 'Total (DT)', type: 'number', default: 0 },
    { key: 'userId', label: 'Client (id)', type: 'number', currentUserId: true },
  ],
};
export const ORDERS: CrudConfig = {
  title: 'Commandes', subtitle: 'Historique des commandes.',
  endpoint: '/api/orders', itemLabel: 'commande', writeRoles: ALL,
  fields: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'status', label: 'Statut', type: 'select', options: ['PENDING', 'PAID', 'SHIPPED', 'CANCELLED'], required: true },
    { key: 'total', label: 'Total (DT)', type: 'number', required: true },
    { key: 'userId', label: 'Client (id)', type: 'number', currentUserId: true },
    { key: 'cartId', label: 'Panier (id)', type: 'number' },
  ],
};

// ---- Tournament & Events : pages dédiées dans features/tournaments (plus de CrudConfig) ----

// ---- Coach & Training (/api/coaches, /api/programs, /api/sessions) ----
export const COACHES: CrudConfig = {
  title: 'Coachs', subtitle: 'Entraîneurs disponibles.',
  endpoint: '/api/coaches', itemLabel: 'coach', writeRoles: ADMIN_GERANT,
  fields: [
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'speciality', label: 'Spécialité', type: 'text' },
    { key: 'rating', label: 'Note', type: 'number', default: 0 },
    { key: 'userId', label: 'Compte utilisateur (id)', type: 'number', formOnly: true },
  ],
};
export const PROGRAMS: CrudConfig = {
  title: 'Programmes', subtitle: 'Programmes d’entraînement proposés par les coachs.',
  endpoint: '/api/programs', itemLabel: 'programme', writeRoles: ADMIN_GERANT,
  fields: [
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', formOnly: true },
    { key: 'durationWeeks', label: 'Durée (semaines)', type: 'number' },
    { key: 'coachId', label: 'Coach (id)', type: 'number', required: true },
  ],
};
export const SESSIONS: CrudConfig = {
  title: 'Séances', subtitle: 'Séances d’entraînement planifiées.',
  endpoint: '/api/sessions', itemLabel: 'séance', writeRoles: ADMIN_GERANT,
  fields: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'startTime', label: 'Heure', type: 'time', required: true },
    { key: 'status', label: 'Statut', type: 'select', options: ['SCHEDULED', 'COMPLETED', 'CANCELLED'], required: true },
    { key: 'programId', label: 'Programme (id)', type: 'number', required: true },
    // Une séance est créée LIBRE : le sportif s'y inscrit depuis « Trouver mon coach » (POST /api/sessions/{id}/register)
    { key: 'userId', label: 'Sportif inscrit (id, vide = séance libre)', type: 'number' },
  ],
};
