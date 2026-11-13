import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { MODULES, ModuleInfo } from '../features/modules';
import { ToastHostComponent } from './toast-host.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  auth = inject(AuthService);
  open = signal(false);
  /** Admin → back-office ; Sportif / Gérant → espace utilisateur (couleurs et accueil différents). */
  isAdmin = computed(() => this.auth.hasRole('ADMIN'));
  modules = computed(() => MODULES.filter((m) => m.deployed !== false && (!m.roles || this.auth.hasRole(...m.roles))));
  /** Liens visibles selon les rôles de l'utilisateur (ex. Validation = ADMIN). */
  links = (m: ModuleInfo) => m.links.filter((l) => !l.roles || this.auth.hasRole(...l.roles));
  userMenu = signal(false);
  initials = computed(() =>
    this.auth.fullName().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''),
  );
  /** Navigation du site utilisateur : des rubriques simples, pas des modules techniques. */
  playerNav = computed(() => [
    { label: 'Accueil', path: '/accueil', exact: true },
    { label: 'Terrains & Salles', path: '/venues/catalog' },
    { label: 'Tournois', path: '/tournaments/list' },
    { label: 'Matchs', path: '/tournaments/matches' },
    { label: 'Classement', path: '/tournaments/ranking' },
    { label: 'Mes équipes', path: '/tournaments/teams' },
    { label: 'Réserver', path: '/bookings/list' },
    { label: 'Boutique', path: '/marketplace/products' },
    { label: 'Coachs', path: '/coaches/trouver' },
    ...(this.auth.hasRole('GERANT', 'ADMIN') ? [{ label: 'Espace Gérant', path: '/venues/gerant' }] : []),
  ]);
  roleLabel = computed(() =>
    (this.auth.user()?.roles ?? []).map((r) => ({ ADMIN: 'Administrateur', GERANT: 'Gérant', SPORTIF: 'Sportif' })[r] ?? r).join(' · '),
  );
}
