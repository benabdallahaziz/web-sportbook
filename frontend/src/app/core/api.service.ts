import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from './config';

/** Service REST générique : toutes les requêtes passent par l'API Gateway. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  list<T = any>(endpoint: string): Observable<T[]> {
    return this.http.get<T[]>(`${API_URL}${endpoint}`);
  }
  /** GET d'un objet sans id ajouté, ex. /api/stats/ranking?tournament_id=1 */
  read<T = any>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${API_URL}${endpoint}`);
  }
  get<T = any>(endpoint: string, id: number | string): Observable<T> {
    return this.http.get<T>(`${API_URL}${endpoint}/${id}`);
  }
  create<T = any>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${API_URL}${endpoint}`, body);
  }
  update<T = any>(endpoint: string, id: number | string, body: unknown): Observable<T> {
    return this.http.put<T>(`${API_URL}${endpoint}/${id}`, body);
  }
  patch<T = any>(endpoint: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${API_URL}${endpoint}`, body);
  }
  remove(endpoint: string, id: number | string): Observable<void> {
    return this.http.delete<void>(`${API_URL}${endpoint}/${id}`);
  }
  post<T = any>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${API_URL}${endpoint}`, body);
  }
}
