import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/config';
import { Field, FieldInput, FieldSummary, OpeningHour, Venue, VenueFilterCriteria, VenueInput, VenueSummary } from './venues.models';

/**
 * Accès au venue-management-service PAR LA GATEWAY (et non en direct sur le port 8082) :
 * l'intercepteur ajoute ainsi X-User-Id / X-User-Roles, indispensables au contrôle
 * d'appartenance (un gérant ne gère que ses complexes).
 */
@Injectable({ providedIn: 'root' })
export class VenuesApiService {
  private http = inject(HttpClient);
  private venues = `${API_URL}/api/venues`;
  private fields = `${API_URL}/api/fields`;

  // ── Complexes ──
  getVenues(f: VenueFilterCriteria = {}): Observable<Venue[]> {
    let p = new HttpParams();
    if (f.search?.trim()) p = p.set('search', f.search.trim());
    if (f.city) p = p.set('city', f.city);
    if (f.sport) p = p.set('sport', f.sport);
    if (f.max_price != null) p = p.set('max_price', f.max_price);
    if (f.indoor) p = p.set('indoor', true);
    return this.http.get<Venue[]>(this.venues, { params: p });
  }

  getMyVenues(): Observable<Venue[]> {
    return this.http.get<Venue[]>(`${this.venues}/my-venues`);
  }

  getVenue(id: number): Observable<Venue> {
    return this.http.get<Venue>(`${this.venues}/${id}`);
  }

  getVenueSummary(id: number): Observable<VenueSummary> {
    return this.http.get<VenueSummary>(`${this.venues}/${id}/summary`);
  }

  createVenue(data: VenueInput): Observable<Venue> {
    return this.http.post<Venue>(this.venues, data);
  }

  updateVenue(id: number, data: Partial<VenueInput>): Observable<Venue> {
    return this.http.put<Venue>(`${this.venues}/${id}`, data);
  }

  deleteVenue(id: number): Observable<void> {
    return this.http.delete<void>(`${this.venues}/${id}`);
  }

  // ── Horaires ──
  getOpeningHours(venueId: number): Observable<OpeningHour[]> {
    return this.http.get<OpeningHour[]>(`${this.venues}/${venueId}/opening-hours`);
  }

  /** Remplace toute la semaine (jour absent = fermé). */
  replaceOpeningHours(venueId: number, hours: Omit<OpeningHour, 'id' | 'venue_id'>[]): Observable<OpeningHour[]> {
    return this.http.put<OpeningHour[]>(`${this.venues}/${venueId}/opening-hours`, hours);
  }

  // ── Terrains ──
  getFields(params: { venue_id?: number; sport?: string; indoor?: boolean; status?: string; city?: string } = {}): Observable<Field[]> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return this.http.get<Field[]>(this.fields, { params: p });
  }

  getField(id: number): Observable<Field> {
    return this.http.get<Field>(`${this.fields}/${id}`);
  }

  getFieldSummary(id: number): Observable<FieldSummary> {
    return this.http.get<FieldSummary>(`${this.fields}/${id}/summary`);
  }

  createField(data: FieldInput): Observable<Field> {
    return this.http.post<Field>(this.fields, data);
  }

  updateField(id: number, data: Partial<FieldInput>): Observable<Field> {
    return this.http.put<Field>(`${this.fields}/${id}`, data);
  }

  toggleMaintenance(id: number): Observable<Field> {
    return this.http.patch<Field>(`${this.fields}/${id}/toggle-maintenance`, {});
  }

  deleteField(id: number): Observable<void> {
    return this.http.delete<void>(`${this.fields}/${id}`);
  }
}
