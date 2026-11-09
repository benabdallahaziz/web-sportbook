import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import { RegisterRequest, Role, UserResponse } from './models';

const KEY = 'sportbook.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly user = signal<UserResponse | null>(this.restore());
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly fullName = computed(() => {
    const u = this.user();
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  });

  hasRole(...roles: Role[]): boolean {
    const u = this.user();
    return !!u && roles.some((r) => u.roles.includes(r));
  }

  login(email: string, password: string) {
    return this.api
      .post<UserResponse>('/api/auth/login', { email, password })
      .pipe(tap((u) => this.store(u)));
  }

  register(req: RegisterRequest) {
    return this.api.post<UserResponse>('/api/auth/register', req);
  }

  /** Met à jour l'utilisateur en session (ex. après modification du profil). */
  refresh(u: UserResponse) {
    this.store(u);
  }

  logout() {
    localStorage.removeItem(KEY);
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }

  private store(u: UserResponse) {
    localStorage.setItem(KEY, JSON.stringify(u));
    this.user.set(u);
  }

  private restore(): UserResponse | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as UserResponse) : null;
    } catch {
      return null;
    }
  }
}
