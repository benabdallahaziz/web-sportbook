import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VenuesApiService } from './venues-api.service';
import { Venue, Field, OpeningHour } from './venues.models';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-venues-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <div>
        <p class="eyebrow">Infrastructures & Espaces Sportifs</p>
        <h1>Complexes & Terrains</h1>
        <p class="muted">Explorez les clubs et réservez votre terrain de sport préféré.</p>
      </div>

      <div class="actions">
        @if (canManage()) {
          <button class="btn primary" (click)="openCreateVenueModal()">
            ＋ Nouveau Complexe
          </button>
        }
      </div>
    </div>

    <!-- ═════════ BARRE DE FILTRES ═════════ -->
    <div class="panel filters-bar">
      <div class="filter-inputs">
        <div class="search-box">
          <input
            type="text"
            placeholder="🔍 Rechercher par nom ou adresse..."
            [(ngModel)]="searchQuery"
            (ngModelChange)="onFilterChange()"
          />
        </div>

        <div class="filter-select">
          <select [(ngModel)]="selectedCity" (ngModelChange)="onFilterChange()">
            <option value="">Toutes les villes</option>
            @for (city of availableCities(); track city) {
              <option [value]="city">{{ city }}</option>
            }
          </select>
        </div>

        <div class="filter-select">
          <select [(ngModel)]="selectedSport" (ngModelChange)="onFilterChange()">
            <option value="">Tous les sports</option>
            <option value="Football">⚽ Football</option>
            <option value="Tennis">🎾 Tennis</option>
            <option value="Padel">🏓 Padel</option>
            <option value="Basketball">🏀 Basketball</option>
          </select>
        </div>
      </div>

      <!-- Badges de filtre rapide par sport -->
      <div class="sport-pills">
        <button
          class="sport-pill"
          [class.active]="selectedSport === ''"
          (click)="setSport('')"
        >
          Tous
        </button>
        <button
          class="sport-pill"
          [class.active]="selectedSport === 'Football'"
          (click)="setSport('Football')"
        >
          ⚽ Football
        </button>
        <button
          class="sport-pill"
          [class.active]="selectedSport === 'Tennis'"
          (click)="setSport('Tennis')"
        >
          🎾 Tennis
        </button>
        <button
          class="sport-pill"
          [class.active]="selectedSport === 'Padel'"
          (click)="setSport('Padel')"
        >
          🏓 Padel
        </button>
        <button
          class="sport-pill"
          [class.active]="selectedSport === 'Basketball'"
          (click)="setSport('Basketball')"
        >
          🏀 Basketball
        </button>
      </div>
    </div>

    <!-- ═════════ ÉTAT DE CHARGEMENT ═════════ -->
    @if (loading()) {
      <div class="panel empty-state">
        <p class="muted">Chargement des complexes sportifs...</p>
      </div>
    }

    <!-- ═════════ LISTE DES COMPLEXES (GRILLE) ═════════ -->
    @if (!loading() && filteredVenues().length === 0) {
      <div class="panel empty-state">
        <p class="empty-title">Aucun complexe ne correspond à vos critères</p>
        <p class="muted">Essayez de modifier vos filtres de recherche ou sélectionnez une autre ville.</p>
        <button class="btn ghost small" (click)="resetFilters()">Réinitialiser les filtres</button>
      </div>
    }

    <div class="venues-grid">
      @for (v of filteredVenues(); track v.id) {
        <div class="panel venue-card">
          <div class="venue-header">
            <div class="venue-main-info">
              <span class="venue-badge">Club Sportif</span>
              <h3>{{ v.name }}</h3>
              <p class="venue-address">📍 {{ v.address || 'Adresse non renseignée' }}</p>
              @if (v.phone) {
                <p class="venue-phone">📞 {{ v.phone }}</p>
              }
            </div>

            @if (canManage()) {
              <div class="card-admin-actions">
                <button class="btn ghost small" (click)="openAddFieldModal(v)" title="Ajouter un terrain">
                  ＋ Terrain
                </button>
                <button class="btn ghost small" (click)="openEditVenueModal(v)" title="Modifier">
                  ✏️
                </button>
                <button class="btn danger small" (click)="deleteVenue(v)" title="Supprimer">
                  🗑️
                </button>
              </div>
            }
          </div>

          <!-- Disciplines sportives du complexe -->
          <div class="venue-sports-row">
            @for (sport of getVenueSports(v); track sport) {
              <span class="sport-tag">{{ getSportEmoji(sport) }} {{ sport }}</span>
            }
            @if (getVenueSports(v).length === 0) {
              <span class="muted small">Aucun terrain encore configuré</span>
            }
          </div>

          <!-- Horaires d'ouverture -->
          @if (v.opening_hours && v.opening_hours.length > 0) {
            <div class="venue-hours">
              <span class="hours-title">⏰ Horaires d'ouverture :</span>
              <div class="hours-list">
                @for (h of v.opening_hours; track h.id || h.day) {
                  <span class="hour-chip">{{ h.day }} : {{ h.opening_time.slice(0, 5) }} - {{ h.closing_time.slice(0, 5) }}</span>
                }
              </div>
            </div>
          }

          <!-- Terrains rattachés -->
          <div class="venue-fields-section">
            <div class="fields-section-header">
              <h4>Terrains disponibles ({{ (v.fields || []).length }})</h4>
              <span class="price-hint">À partir de {{ getMinPrice(v) }} DT / heure</span>
            </div>

            @if ((v.fields || []).length > 0) {
              <div class="fields-cards-list">
                @for (f of v.fields; track f.id) {
                  <div class="field-item-card">
                    <div class="field-item-info">
                      <span class="field-name">{{ f.name }}</span>
                      <span class="field-meta">{{ getSportEmoji(f.sport) }} {{ f.sport }} · <strong>{{ f.price }} DT/h</strong></span>
                    </div>

                    <div class="field-item-actions">
                      <a [routerLink]="['/bookings/list']" [queryParams]="{ fieldId: f.id }" class="btn primary small">
                        Réserver
                      </a>
                      @if (canManage()) {
                        <button class="btn danger small icon-delete" (click)="deleteField(f, v)" title="Supprimer ce terrain">
                          ✕
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="muted small empty-fields-msg">Aucun terrain disponible pour le moment.</p>
            }
          </div>
        </div>
      }
    </div>

    <!-- ═════════ MODAL CRÉATION / MODIFICATION COMPLEXE ═════════ -->
    @if (showVenueModal()) {
      <div class="modal-backdrop" (click)="closeVenueModal()">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingVenueId ? 'Modifier le Complexe' : 'Nouveau Complexe Sportif' }}</h3>
            <button class="icon-close" (click)="closeVenueModal()">✕</button>
          </div>

          <form (ngSubmit)="saveVenue()">
            <div class="form-group">
              <label>Nom du complexe *</label>
              <input type="text" [(ngModel)]="venueForm.name" name="name" required placeholder="Ex: Arena Club Lac 2" />
            </div>

            <div class="form-group">
              <label>Adresse / Ville</label>
              <input type="text" [(ngModel)]="venueForm.address" name="address" placeholder="Ex: Les Berges du Lac, Tunis" />
            </div>

            <div class="form-group">
              <label>Téléphone de contact</label>
              <input type="text" [(ngModel)]="venueForm.phone" name="phone" placeholder="Ex: +216 71 123 456" />
            </div>

            <!-- Horaires rapides -->
            @if (!editingVenueId) {
              <div class="form-divider">Horaires d'ouverture (Optionnels)</div>
              <div class="form-row">
                <div class="form-group">
                  <label>Jour</label>
                  <select [(ngModel)]="newHour.day" name="day">
                    <option value="Lundi">Lundi</option>
                    <option value="Mardi">Mardi</option>
                    <option value="Mercredi">Mercredi</option>
                    <option value="Jeudi">Jeudi</option>
                    <option value="Vendredi">Vendredi</option>
                    <option value="Samedi">Samedi</option>
                    <option value="Dimanche">Dimanche</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Ouverture</label>
                  <input type="time" [(ngModel)]="newHour.opening_time" name="op_time" />
                </div>
                <div class="form-group">
                  <label>Fermeture</label>
                  <input type="time" [(ngModel)]="newHour.closing_time" name="cl_time" />
                </div>
              </div>
            }

            <div class="modal-actions">
              <button type="button" class="btn ghost" (click)="closeVenueModal()">Annuler</button>
              <button type="submit" class="btn primary" [disabled]="saving()">
                {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- ═════════ MODAL AJOUT TERRAIN ═════════ -->
    @if (showFieldModal()) {
      <div class="modal-backdrop" (click)="closeFieldModal()">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Ajouter un terrain à {{ selectedVenueForField?.name }}</h3>
            <button class="icon-close" (click)="closeFieldModal()">✕</button>
          </div>

          <form (ngSubmit)="saveField()">
            <div class="form-group">
              <label>Nom du terrain *</label>
              <input type="text" [(ngModel)]="fieldForm.name" name="name" required placeholder="Ex: Court Central Synthétique" />
            </div>

            <div class="form-group">
              <label>Discipline / Sport *</label>
              <select [(ngModel)]="fieldForm.sport" name="sport" required>
                <option value="Football">⚽ Football</option>
                <option value="Tennis">🎾 Tennis</option>
                <option value="Padel">🏓 Padel</option>
                <option value="Basketball">🏀 Basketball</option>
              </select>
            </div>

            <div class="form-group">
              <label>Tarif horaire (DT / heure) *</label>
              <input type="number" [(ngModel)]="fieldForm.price" name="price" min="0" step="5" required placeholder="80" />
            </div>

            <div class="modal-actions">
              <button type="button" class="btn ghost" (click)="closeFieldModal()">Annuler</button>
              <button type="submit" class="btn primary" [disabled]="saving()">
                {{ saving() ? 'Création...' : 'Créer le terrain' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .filters-bar {
      margin-bottom: 1.5rem;
      padding: 1.25rem;
    }
    .filter-inputs {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    @media (max-width: 768px) {
      .filter-inputs {
        grid-template-columns: 1fr;
      }
    }
    .sport-pills {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .sport-pill {
      font-size: 0.88rem;
      font-weight: 600;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      cursor: pointer;
      transition: all 0.15s;
    }
    .sport-pill:hover {
      border-color: var(--court);
      background: var(--court-soft);
    }
    .sport-pill.active {
      background: var(--court);
      color: #fff;
      border-color: var(--court);
    }
    .venues-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1.5rem;
    }
    .venue-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-top: 4px solid var(--court);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .venue-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lift);
    }
    .venue-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }
    .venue-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--court);
      background: var(--court-soft);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.35rem;
    }
    .venue-card h3 {
      font-size: 1.25rem;
      color: var(--ink);
      margin: 0.2rem 0 0.4rem;
    }
    .venue-address {
      font-size: 0.9rem;
      color: var(--muted);
      margin: 0.1rem 0;
    }
    .venue-phone {
      font-size: 0.85rem;
      color: var(--court-dark);
      margin: 0.1rem 0;
      font-weight: 600;
    }
    .card-admin-actions {
      display: flex;
      gap: 0.3rem;
    }
    .venue-sports-row {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin: 0.6rem 0;
    }
    .sport-tag {
      font-size: 0.8rem;
      font-weight: 600;
      background: #f1f5f9;
      color: #334155;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .venue-hours {
      background: #f8fafc;
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      margin: 0.6rem 0;
      font-size: 0.82rem;
    }
    .hours-title {
      font-weight: 600;
      color: var(--muted);
      display: block;
      margin-bottom: 0.25rem;
    }
    .hours-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .hour-chip {
      background: #fff;
      border: 1px solid #e2e8f0;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      color: var(--ink);
    }
    .venue-fields-section {
      border-top: 1px solid var(--line-soft);
      padding-top: 0.85rem;
      margin-top: 0.5rem;
    }
    .fields-section-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.6rem;
    }
    .fields-section-header h4 {
      margin: 0;
      font-size: 0.95rem;
      color: var(--ink);
    }
    .price-hint {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--pitch);
    }
    .fields-cards-list {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .field-item-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fff;
      border: 1px solid var(--line-soft);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      transition: background 0.1s;
    }
    .field-item-card:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .field-item-info {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .field-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--ink);
    }
    .field-meta {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .field-item-actions {
      display: flex;
      gap: 0.35rem;
      align-items: center;
    }
    .icon-delete {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
    .empty-fields-msg {
      margin: 0.5rem 0;
      font-style: italic;
    }

    /* Modal styles */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-box {
      background: #fff;
      border-radius: var(--radius);
      width: 100%;
      max-width: 520px;
      padding: 1.5rem;
      box-shadow: var(--shadow-lift);
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .icon-close {
      background: transparent;
      border: 0;
      font-size: 1.2rem;
      color: var(--muted);
      cursor: pointer;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-group label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--ink);
      margin-bottom: 0.35rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1.2fr 1fr 1fr;
      gap: 0.5rem;
    }
    .form-divider {
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--court-dark);
      margin: 1.25rem 0 0.75rem;
      padding-bottom: 0.3rem;
      border-bottom: 1px solid var(--line-soft);
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  `]
})
export class VenuesCatalogComponent implements OnInit {
  private api = inject(VenuesApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  venues = signal<Venue[]>([]);
  loading = signal(true);
  saving = signal(false);

  // Filtres
  searchQuery = '';
  selectedCity = '';
  selectedSport = '';

  // Droits RBAC
  canManage = computed(() => this.auth.hasRole('ADMIN', 'GERANT'));

  // Modales
  showVenueModal = signal(false);
  editingVenueId: number | null = null;
  venueForm: { name: string; address: string; phone: string } = { name: '', address: '', phone: '' };
  newHour = { day: 'Lundi', opening_time: '08:00', closing_time: '23:00' };

  showFieldModal = signal(false);
  selectedVenueForField: Venue | null = null;
  fieldForm = { name: '', sport: 'Football', price: 80 };

  ngOnInit() {
    this.loadVenues();
  }

  loadVenues() {
    this.loading.set(true);
    this.api.getVenues().subscribe({
      next: (data) => {
        // Pour chaque complexe, charger ses détails (terrains et horaires)
        const venuesList = Array.isArray(data) ? data : [];
        if (venuesList.length === 0) {
          this.venues.set([]);
          this.loading.set(false);
          return;
        }

        // Charger les détails de chaque complexe en parallèle
        let completed = 0;
        const fullVenues: Venue[] = [];

        venuesList.forEach((v) => {
          if (v.id) {
            this.api.getVenue(v.id).subscribe({
              next: (detail) => {
                fullVenues.push(detail);
                completed++;
                if (completed === venuesList.length) {
                  fullVenues.sort((a, b) => (a.id || 0) - (b.id || 0));
                  this.venues.set(fullVenues);
                  this.loading.set(false);
                }
              },
              error: () => {
                fullVenues.push(v);
                completed++;
                if (completed === venuesList.length) {
                  this.venues.set(fullVenues);
                  this.loading.set(false);
                }
              }
            });
          } else {
            completed++;
          }
        });
      },
      error: (err) => {
        console.error('Erreur chargement complexes:', err);
        const msg = err.message || err.error?.detail || 'Erreur lors du chargement des complexes sportifs.';
        this.notify.error(msg);
        this.loading.set(false);
      }
    });
  }

  // Villes disponibles extraites des complexes
  availableCities = computed(() => {
    const cities = new Set<string>();
    this.venues().forEach((v) => {
      if (v.address) {
        const parts = v.address.split(',');
        const cityCandidate = parts[parts.length - 1]?.trim();
        if (cityCandidate) cities.add(cityCandidate);
      }
    });
    return Array.from(cities);
  });

  // Complexes filtrés
  filteredVenues = computed(() => {
    return this.venues().filter((v) => {
      // Filtre texte (nom ou adresse)
      const q = this.searchQuery.trim().toLowerCase();
      const matchSearch = !q || (v.name?.toLowerCase().includes(q)) || (v.address?.toLowerCase().includes(q));

      // Filtre ville
      const matchCity = !this.selectedCity || (v.address?.toLowerCase().includes(this.selectedCity.toLowerCase()));

      // Filtre sport
      const matchSport = !this.selectedSport || (v.fields || []).some((f) => f.sport?.toLowerCase() === this.selectedSport.toLowerCase());

      return matchSearch && matchCity && matchSport;
    });
  });

  onFilterChange() {}

  setSport(sport: string) {
    this.selectedSport = sport;
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedCity = '';
    this.selectedSport = '';
  }

  getVenueSports(v: Venue): string[] {
    const sports = new Set<string>();
    (v.fields || []).forEach((f) => {
      if (f.sport) sports.add(f.sport);
    });
    return Array.from(sports);
  }

  getSportEmoji(sport: string): string {
    switch (sport?.toLowerCase()) {
      case 'football': return '⚽';
      case 'tennis': return '🎾';
      case 'padel': return '🏓';
      case 'basketball': return '🏀';
      default: return '🏆';
    }
  }

  getMinPrice(v: Venue): number {
    if (!v.fields || v.fields.length === 0) return 0;
    return Math.min(...v.fields.map((f) => f.price));
  }

  // ── MODAL VENUE ──
  openCreateVenueModal() {
    this.editingVenueId = null;
    this.venueForm = { name: '', address: '', phone: '' };
    this.newHour = { day: 'Lundi', opening_time: '08:00', closing_time: '23:00' };
    this.showVenueModal.set(true);
  }

  openEditVenueModal(v: Venue) {
    this.editingVenueId = v.id || null;
    this.venueForm = {
      name: v.name || '',
      address: v.address || '',
      phone: v.phone || ''
    };
    this.showVenueModal.set(true);
  }

  closeVenueModal() {
    this.showVenueModal.set(false);
  }

  saveVenue() {
    if (!this.venueForm.name) {
      this.notify.error('Le nom du complexe est obligatoire.');
      return;
    }

    this.saving.set(true);
    if (this.editingVenueId) {
      this.api.updateVenue(this.editingVenueId, this.venueForm).subscribe({
        next: () => {
          this.notify.success('Complexe sportif modifié avec succès.');
          this.saving.set(false);
          this.closeVenueModal();
          this.loadVenues();
        },
        error: (err) => {
          this.notify.error(err.error?.detail || 'Erreur lors de la mise à jour.');
          this.saving.set(false);
        }
      });
    } else {
      const hours: any[] = [];
      if (this.newHour?.day && this.newHour?.opening_time && this.newHour?.closing_time) {
        const formatTime = (t: string) => {
          if (!t) return '00:00:00';
          const parts = t.split(':');
          if (parts.length === 2) return `${t}:00`;
          return t;
        };
        hours.push({
          day: this.newHour.day,
          opening_time: formatTime(this.newHour.opening_time),
          closing_time: formatTime(this.newHour.closing_time)
        });
      }

      const payload: any = {
        name: this.venueForm.name.trim(),
        address: this.venueForm.address?.trim() || undefined,
        phone: this.venueForm.phone?.trim() || undefined,
        owner_id: this.auth.user()?.id || undefined,
      };
      if (hours.length > 0) {
        payload.opening_hours = hours;
      }

      this.api.createVenue(payload).subscribe({
        next: () => {
          this.notify.success('Complexe sportif créé avec succès.');
          this.saving.set(false);
          this.closeVenueModal();
          this.loadVenues();
        },
        error: (err) => {
          console.error('Erreur createVenue:', err);
          const detail = err.message || err.error?.detail || (typeof err.error === 'string' ? err.error : null);
          this.notify.error(detail || 'Erreur lors de la création du complexe.');
          this.saving.set(false);
        }
      });
    }
  }

  deleteVenue(v: Venue) {
    if (!v.id) return;
    if (confirm(`Voulez-vous vraiment supprimer le complexe "${v.name}" ? Tous ses terrains seront supprimés.`)) {
      this.api.deleteVenue(v.id).subscribe({
        next: () => {
          this.notify.success('Complexe supprimé avec succès.');
          this.loadVenues();
        },
        error: () => {
          this.notify.error('Erreur lors de la suppression.');
        }
      });
    }
  }

  // ── MODAL FIELD ──
  openAddFieldModal(v: Venue) {
    this.selectedVenueForField = v;
    this.fieldForm = { name: '', sport: 'Football', price: 80 };
    this.showFieldModal.set(true);
  }

  closeFieldModal() {
    this.showFieldModal.set(false);
    this.selectedVenueForField = null;
  }

  saveField() {
    if (!this.selectedVenueForField?.id) return;
    if (!this.fieldForm.name) {
      this.notify.error('Le nom du terrain est obligatoire.');
      return;
    }

    this.saving.set(true);
    const payload = {
      name: this.fieldForm.name,
      sport: this.fieldForm.sport,
      price: Number(this.fieldForm.price),
      venue_id: this.selectedVenueForField.id
    };

    this.api.createField(payload).subscribe({
      next: () => {
        this.notify.success('Terrain ajouté avec succès.');
        this.saving.set(false);
        this.closeFieldModal();
        this.loadVenues();
      },
      error: (err) => {
        this.notify.error(err.error?.detail || 'Erreur lors de l\'ajout du terrain.');
        this.saving.set(false);
      }
    });
  }

  deleteField(f: Field, v: Venue) {
    if (!f.id) return;
    if (confirm(`Voulez-vous supprimer le terrain "${f.name}" ?`)) {
      this.api.deleteField(f.id).subscribe({
        next: () => {
          this.notify.success('Terrain supprimé.');
          this.loadVenues();
        },
        error: () => {
          this.notify.error('Erreur lors de la suppression du terrain.');
        }
      });
    }
  }
}
