import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { Approvable } from './tournament.models';

/**
 * Droits côté interface, identiques aux règles de l'API (src/utils/auth.js) :
 *   - tout utilisateur connecté propose des tournois / matchs (en attente) ;
 *   - il modifie ou supprime SES propositions tant qu'elles ne sont pas validées ;
 *   - l'admin valide, refuse, saisit les scores et peut tout modifier.
 * L'interface masque les boutons, mais c'est l'API qui fait foi (403 sinon).
 */
@Injectable({ providedIn: 'root' })
export class TournamentAccess {
  private auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  readonly userId = computed(() => this.auth.user()?.id ?? null);
  readonly isLoggedIn = computed(() => this.auth.isLoggedIn());

  isOwner(row: Pick<Approvable, 'created_by'>): boolean {
    const id = this.userId();
    return id !== null && row.created_by !== null && Number(row.created_by) === id;
  }

  /** Équipes : pas de validation, mais seul le propriétaire (ou l'admin) les gère. */
  canManageTeam(team: Pick<Approvable, 'created_by'>): boolean {
    return this.isAdmin() || this.isOwner(team);
  }

  canModify(row: Pick<Approvable, 'created_by' | 'approval_status'>): boolean {
    return this.isAdmin() || (this.isOwner(row) && row.approval_status !== 'APPROVED');
  }
}
