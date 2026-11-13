import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Role, UserResponse } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

const ROLES: { id: Role; label: string }[] = [
  { id: 'SPORTIF', label: 'Sportif' },
  { id: 'GERANT', label: 'Gérant' },
  { id: 'ADMIN', label: 'Admin' },
];

/** Administration des comptes : rôles, blocage / déblocage, suppression (rôle ADMIN). */
@Component({
  selector: 'app-users',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Identity · administration</p>
        <h1>Comptes & rôles</h1>
        <p class="muted">Attribuez les rôles, bloquez un accès ou supprimez un compte.</p>
      </div>
      <div class="actions"><button class="btn ghost" (click)="load()">Actualiser</button></div>
    </header>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filtrer par rôle">
        <button class="seg-btn" [class.on]="roleFilter() === ''" (click)="roleFilter.set('')">Tous <span class="pill">{{ users().length }}</span></button>
        @for (r of roles; track r.id) {
          <button class="seg-btn" [class.on]="roleFilter() === r.id" (click)="roleFilter.set(r.id)">
            {{ r.label }}s <span class="pill">{{ countRole(r.id) }}</span></button>
        }
      </div>
      <input type="search" placeholder="Rechercher un nom ou un email" [ngModel]="q()" (ngModelChange)="q.set($event)" aria-label="Rechercher" />
    </div>

    @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }
    <div class="panel table-wrap">
      @if (loading()) { <p class="empty">Chargement…</p> }
      @else if (visible().length === 0) { <p class="empty">Aucun utilisateur.</p> }
      @else {
        <table>
          <thead><tr><th>#</th><th>Nom</th><th>Email</th><th>Rôles</th><th>Statut</th><th class="end">Actions</th></tr></thead>
          <tbody>
            @for (u of visible(); track u.id) {
              <tr>
                <td class="muted">{{ u.id }}</td>
                <td>{{ [u.firstName, u.lastName].join(' ').trim() || '—' }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <div class="role-toggles" role="group" [attr.aria-label]="'Rôles de ' + u.email">
                    @for (r of roles; track r.id) {
                      <label class="role-toggle" [class.on]="u.roles.includes(r.id)">
                        <input type="checkbox" [checked]="u.roles.includes(r.id)"
                               [disabled]="saving() === u.id || (u.id === me()?.id && r.id === 'ADMIN')"
                               (change)="toggleRole(u, r.id)" />
                        {{ r.label }}
                      </label>
                    }
                  </div>
                </td>
                <td><span class="badge" [class.bad]="u.status !== 'ACTIVE'">{{ u.status === 'ACTIVE' ? 'Actif' : 'Bloqué' }}</span></td>
                <td class="end">
                  @if (u.id !== me()?.id) {
                    <button class="btn small ghost" (click)="toggleStatus(u)">{{ u.status === 'ACTIVE' ? 'Bloquer' : 'Débloquer' }}</button>
                    <button class="btn small danger" (click)="remove(u)">Supprimer</button>
                  } @else { <span class="muted">Vous</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .toolbar input { max-width: 320px; }
    .role-toggles { display: flex; flex-wrap: wrap; gap: .35rem; }
    .role-toggle { display: inline-flex; align-items: center; gap: .3rem; font-size: .8rem; font-weight: 600; padding: .15rem .55rem;
      border: 1px solid var(--line); border-radius: 99px; color: var(--muted); cursor: pointer; margin: 0; }
    .role-toggle.on { background: var(--court-soft); border-color: #bccfe6; color: var(--court-dark); }
    .role-toggle input { width: auto; margin: 0; }
  `],
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  me = inject(AuthService).user;
  readonly roles = ROLES;
  users = signal<UserResponse[]>([]);
  loading = signal(true);
  saving = signal<number | null>(null);
  error = signal('');
  roleFilter = signal<Role | ''>('');
  q = signal('');

  visible = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.users().filter(
      (u) =>
        (!this.roleFilter() || u.roles.includes(this.roleFilter() as Role)) &&
        (!q || `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.email}`.toLowerCase().includes(q)),
    );
  });
  countRole = (r: Role) => this.users().filter((u) => u.roles.includes(r)).length;

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.list<UserResponse>('/api/users').subscribe({
      next: (u) => { this.users.set(u); this.loading.set(false); },
      error: (e) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  toggleRole(u: UserResponse, role: Role) {
    const roles = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    if (roles.length === 0) {
      this.notify.error('Un compte doit garder au moins un rôle.');
      this.load();
      return;
    }
    this.saving.set(u.id);
    this.api.update<UserResponse>(`/api/users/${u.id}`, 'roles', { roles }).subscribe({
      next: (updated) => {
        this.saving.set(null);
        this.users.update((list) => list.map((x) => (x.id === u.id ? updated : x)));
        this.notify.success(`Rôles de ${u.email} : ${updated.roles.join(', ')}.`);
      },
      error: (e) => { this.saving.set(null); this.notify.error(e); this.load(); },
    });
  }

  toggleStatus(u: UserResponse) {
    const status = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    this.api.patch<UserResponse>(`/api/users/${u.id}/status`, { status }).subscribe({
      next: () => { this.notify.success(`Compte ${u.email} ${status === 'ACTIVE' ? 'débloqué' : 'bloqué'}.`); this.load(); },
      error: (e) => this.notify.error(e),
    });
  }

  remove(u: UserResponse) {
    if (!confirm(`Supprimer le compte ${u.email} ?`)) return;
    this.api.remove('/api/users', u.id).subscribe({
      next: () => { this.notify.success(`Compte ${u.email} supprimé.`); this.load(); },
      error: (e) => this.notify.error(e),
    });
  }
}
