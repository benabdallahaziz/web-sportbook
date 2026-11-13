/** Modèles alignés sur venue-management-service (FastAPI, schemas.py). */

export type VenueStatus = 'ACTIVE' | 'INACTIVE';
export type FieldStatus = 'AVAILABLE' | 'MAINTENANCE';

export interface OpeningHour {
  id?: number;
  day: string;
  opening_time: string; // "08:00:00"
  closing_time: string;
  venue_id?: number;
}

export interface Field {
  id: number;
  name: string;
  sport: string;
  price: number;
  surface: string | null;
  is_indoor: boolean;
  status: FieldStatus;
  venue_id: number;
  venue_name?: string | null;
  venue_city?: string | null;
}

export interface Venue {
  id: number;
  name: string;
  description: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  image_url: string | null;
  amenities: string | null;
  amenities_list: string[];
  status: VenueStatus;
  owner_id: number | null;
  // Résumé calculé par le service (catalogue)
  sports: string[];
  fields_count: number;
  available_fields: number;
  min_price: number | null;
  has_indoor: boolean;
  // Détail
  fields?: Field[];
  opening_hours?: OpeningHour[];
}

export interface VenueInput {
  name: string;
  description: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  image_url: string | null;
  amenities: string[];
  status: VenueStatus;
  owner_id?: number | null;
  opening_hours?: { day: string; opening_time: string; closing_time: string }[];
}

export interface FieldInput {
  name: string;
  sport: string;
  price: number;
  surface: string | null;
  is_indoor: boolean;
  status: FieldStatus;
  venue_id: number;
}

export interface VenueSummary {
  id: number;
  name: string;
  city: string;
  address?: string | null;
  status: VenueStatus;
  total_fields: number;
  available_fields: number;
  sports_available: string[];
  min_price: number;
  max_price: number;
}

export interface FieldSummary {
  id: number;
  name: string;
  sport: string;
  price_per_hour: number;
  surface: string | null;
  is_indoor: boolean;
  status: FieldStatus;
  bookable: boolean;
  venue_id: number;
  venue_name?: string | null;
}

export interface VenueFilterCriteria {
  search?: string;
  city?: string;
  sport?: string;
  max_price?: number | null;
  indoor?: boolean;
}

// ── Référentiels d'affichage ──
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export const CITIES = ['Tunis', 'Ariana', 'Ben Arous', 'La Marsa', 'Manouba', 'Nabeul', 'Hammamet', 'Bizerte',
  'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Gabès', 'Djerba'];

export const SPORTS: { id: string; label: string; emoji: string }[] = [
  { id: 'Football', label: 'Football', emoji: '⚽' },
  { id: 'Tennis', label: 'Tennis', emoji: '🎾' },
  { id: 'Padel', label: 'Padel', emoji: '🏓' },
  { id: 'Basketball', label: 'Basketball', emoji: '🏀' },
  { id: 'Handball', label: 'Handball', emoji: '🤾' },
  { id: 'Volleyball', label: 'Volleyball', emoji: '🏐' },
];

export const SURFACES = ['Gazon synthétique', 'Gazon naturel', 'Terre battue', 'Dur (résine)', 'Parquet', 'Béton'];

export const AMENITIES: { id: string; label: string; emoji: string }[] = [
  { id: 'parking', label: 'Parking', emoji: '🅿️' },
  { id: 'vestiaires', label: 'Vestiaires', emoji: '👕' },
  { id: 'douches', label: 'Douches', emoji: '🚿' },
  { id: 'eclairage', label: 'Éclairage', emoji: '💡' },
  { id: 'cafeteria', label: 'Buvette', emoji: '☕' },
  { id: 'wifi', label: 'Wifi', emoji: '📶' },
];

export const sportEmoji = (sport: string) => SPORTS.find((s) => s.id.toLowerCase() === sport.toLowerCase())?.emoji ?? '🏟️';
export const amenity = (id: string) => AMENITIES.find((a) => a.id === id) ?? { id, label: id, emoji: '✔️' };
/** "08:00:00" → "08:00" */
export const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5);
