import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { UserResponse } from '../../core/models';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  template: `
    <header class="page-head"><div><h1>Mon profil</h1><p class="muted">{{ auth.user()?.email }} · {{ auth.user()?.roles?.join(', ') }}</p></div></header>
    @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }
    @if (saved()) { <div class="notice" role="status">Profil enregistré.</div> }
    <form class="panel form-grid" (ngSubmit)="save()">
      <label><span>Prénom</span><input name="firstName" [(ngModel)]="m.firstName" /></label>
      <label><span>Nom</span><input name="lastName" [(ngModel)]="m.lastName" /></label>
      <label><span>Téléphone</span><input name="phone" [(ngModel)]="m.phone" /></label>
      <label><span>Adresse</span><input name="address" [(ngModel)]="m.address" /></label>
      <div class="form-actions wide"><button class="btn primary" type="submit">Enregistrer</button></div>
    </form>
  `,
})
export class ProfileComponent {
  auth = inject(AuthService);
  private api = inject(ApiService);
  error = signal('');
  saved = signal(false);
  m = {
    firstName: this.auth.user()?.firstName ?? '',
    lastName: this.auth.user()?.lastName ?? '',
    phone: this.auth.user()?.phone ?? '',
    address: this.auth.user()?.address ?? '',
  };

  save() {
    const id = this.auth.user()!.id;
    this.error.set('');
    this.saved.set(false);
    this.api.update<UserResponse>('/api/users', id, this.m).subscribe({
      next: (u) => { this.auth.refresh(u); this.saved.set(true); },
      error: (e) => this.error.set(e.message),
    });
  }
}
