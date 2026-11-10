import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/config';
import { Venue, Field, OpeningHour, VenueSummary, FieldSummary } from './venues.models';

/** Accès direct au microservice venue si la Gateway est indisponible. */
const VENUE_URL = 'http://localhost:8082';

@Injectable({ providedIn: 'root' })
export class VenuesApiService {
  private http = inject(HttpClient);

  // ── COMPLEXES (VENUES) ──────────────────────────────────
  getVenues(params?: { city?: string; search?: string; owner_id?: number }): Observable<Venue[]> {
    let httpParams = new HttpParams();
    if (params?.city) httpParams = httpParams.set('city', params.city);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.owner_id) httpParams = httpParams.set('owner_id', params.owner_id);

    return this.http.get<Venue[]>(`${VENUE_URL}/api/venues`, { params: httpParams });
  }

  getVenue(id: number): Observable<Venue> {
    return this.http.get<Venue>(`${VENUE_URL}/api/venues/${id}`);
  }

  getVenueSummary(id: number): Observable<VenueSummary> {
    return this.http.get<VenueSummary>(`${VENUE_URL}/api/venues/${id}/summary`);
  }

  createVenue(data: Partial<Venue>): Observable<Venue> {
    return this.http.post<Venue>(`${VENUE_URL}/api/venues`, data);
  }

  updateVenue(id: number, data: Partial<Venue>): Observable<Venue> {
    return this.http.put<Venue>(`${VENUE_URL}/api/venues/${id}`, data);
  }

  deleteVenue(id: number): Observable<void> {
    return this.http.delete<void>(`${VENUE_URL}/api/venues/${id}`);
  }

  // ── TERRAINS (FIELDS) ───────────────────────────────────
  getFields(params?: { venue_id?: number; sport?: string; min_price?: number; max_price?: number; search?: string }): Observable<Field[]> {
    let httpParams = new HttpParams();
    if (params?.venue_id) httpParams = httpParams.set('venue_id', params.venue_id);
    if (params?.sport) httpParams = httpParams.set('sport', params.sport);
    if (params?.min_price != null) httpParams = httpParams.set('min_price', params.min_price);
    if (params?.max_price != null) httpParams = httpParams.set('max_price', params.max_price);
    if (params?.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<Field[]>(`${VENUE_URL}/api/fields`, { params: httpParams });
  }

  getField(id: number): Observable<Field> {
    return this.http.get<Field>(`${VENUE_URL}/api/fields/${id}`);
  }

  getFieldSummary(id: number): Observable<FieldSummary> {
    return this.http.get<FieldSummary>(`${VENUE_URL}/api/fields/${id}/summary`);
  }

  createField(data: Partial<Field>): Observable<Field> {
    return this.http.post<Field>(`${VENUE_URL}/api/fields`, data);
  }

  updateField(id: number, data: Partial<Field>): Observable<Field> {
    return this.http.put<Field>(`${VENUE_URL}/api/fields/${id}`, data);
  }

  deleteField(id: number): Observable<void> {
    return this.http.delete<void>(`${VENUE_URL}/api/fields/${id}`);
  }

  // ── HORAIRES & DÉTAILS ──────────────────────────────────
  getVenueFields(venueId: number): Observable<Field[]> {
    return this.http.get<Field[]>(`${VENUE_URL}/api/venues/${venueId}/fields`);
  }

  getVenueOpeningHours(venueId: number): Observable<OpeningHour[]> {
    return this.http.get<OpeningHour[]>(`${VENUE_URL}/api/venues/${venueId}/opening-hours`);
  }

  addOpeningHour(venueId: number, data: Partial<OpeningHour>): Observable<OpeningHour> {
    return this.http.post<OpeningHour>(`${VENUE_URL}/api/venues/${venueId}/opening-hours`, data);
  }

  // ── ACTUATOR OBSERVABILITÉ ──────────────────────────────
  getActuatorHealth(): Observable<any> {
    return this.http.get<any>(`${VENUE_URL}/actuator/health`);
  }
}
