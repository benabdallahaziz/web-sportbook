import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { UserResponse } from '../../core/models';

/** Administration des comptes : liste, blocage / déblocage, suppression (rôle ADMIN). */
@Component({
  selector: 'app-users',
  template: `
    <header class="page-head">
      <div><h1>Utilisateurs</h1><p class="muted">Gérez les comptes et bloquez les accès si nécessaire.</p></div>
      <div class="actions"><button class="btn ghost" (click)="load()">Actualiser</button></div>
    </header>
    @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }
    <div class="panel table-wrap">
      @if (loading()) { <p class="empty">Chargement…</p> }
      @else if (users().length === 0) { <p class="empty">Aucun utilisateur.</p> }
      @else {
        <table>
          <thead><tr><th>#</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Rôles</th><th>Statut</th><th class="end">Actions</th></tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td class="muted">{{ u.id }}</td>
                <td>{{ [u.firstName, u.lastName].join(' ').trim() || '—' }}</td>
                <td>{{ u.email }}</td>
                <td>{{ u.phone || '—' }}</td>
                <td>{{ u.roles.join(', ') }}</td>
                <td><span class="badge" [class.bad]="u.status !== 'ACTIVE'">{{ u.status === 'ACTIVE' ? 'Actif' : 'Bloqué' }}</span></td>
                <td class="end">
                  @if (u.id !== me()?.id) {
                    <button class="btn small ghost" (click)="toggle(u)">{{ u.status === 'ACTIVE' ? 'Bloquer' : 'Débloquer' }}</button>
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
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  me = inject(AuthService).user;
  users = signal<UserResponse[]>([]);
  loading = signal(true);
  error = signal('');

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.list<UserResponse>('/api/users').subscribe({
      next: (u) => { this.users.set(u); this.loading.set(false); },
      error: (e) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  toggle(u: UserResponse) {
    const status = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    this.api.patch<UserResponse>(`/api/users/${u.id}/status`, { status }).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.message),
    });
  }

  remove(u: UserResponse) {
    if (!confirm(`Supprimer le compte ${u.email} ?`)) return;
    this.api.remove('/api/users', u.id).subscribe({
      next: () => this.load(),
      error: (e) => this.error.set(e.message),
    });
  }
}
