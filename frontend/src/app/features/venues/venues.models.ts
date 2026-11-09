export interface OpeningHour {
  id?: number;
  day: string;
  opening_time: string;
  closing_time: string;
  venue_id?: number;
  venueId?: number;
}

export interface Field {
  id?: number;
  name: string;
  sport: string;
  price: number;
  venue_id: number;
  venueId?: number;
  venue_name?: string;
  venueName?: string;
}

export interface Venue {
  id?: number;
  name: string;
  address?: string;
  phone?: string;
  owner_id?: number;
  ownerId?: number;
  fields?: Field[];
  opening_hours?: OpeningHour[];
  openingHours?: OpeningHour[];
}

export interface VenueSummary {
  id: number;
  name: string;
  address?: string;
  total_fields: number;
  sports_available: string[];
  min_price: number;
  max_price: number;
}

export interface FieldSummary {
  id: number;
  name: string;
  sport: string;
  price_per_hour: number;
  venue_id: number;
  venue_name?: string;
}
