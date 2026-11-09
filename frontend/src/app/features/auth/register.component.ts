import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { RegisterRequest } from '../../core/models';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth">
      <div class="auth-intro">
        <h1>SportBook</h1>
        <p>Un compte sportif pour réserver, ou un compte gérant pour proposer vos terrains.</p>
      </div>
      <form class="panel auth-form form-grid" (ngSubmit)="submit()" #f="ngForm">
        <h2 class="wide">Créer un compte</h2>
        @if (error()) { <div class="alert wide" role="alert">{{ error() }}</div> }
        <label><span>Prénom</span><input name="firstName" [(ngModel)]="m.firstName" /></label>
        <label><span>Nom</span><input name="lastName" [(ngModel)]="m.lastName" /></label>
        <label class="wide"><span>Email *</span>
          <input type="email" name="email" [(ngModel)]="m.email" required autocomplete="email" /></label>
        <label class="wide"><span>Mot de passe * (6 caractères minimum)</span>
          <input type="password" name="password" [(ngModel)]="m.password" required minlength="6" autocomplete="new-password" /></label>
        <label><span>Téléphone</span><input name="phone" [(ngModel)]="m.phone" /></label>
        <label><span>Adresse</span><input name="address" [(ngModel)]="m.address" /></label>
        <label class="wide"><span>Type de compte</span>
          <select name="role" [(ngModel)]="m.role">
            <option value="SPORTIF">Sportif : je réserve des terrains</option>
            <option value="GERANT">Gérant : je gère un complexe</option>
          </select></label>
        <button class="btn primary wide" type="submit" [disabled]="f.invalid || loading()">{{ loading() ? 'Création…' : 'Créer mon compte' }}</button>
        <p class="muted wide">Déjà inscrit ? <a routerLink="/login">Se connecter</a></p>
      </form>
    </section>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  m: RegisterRequest = { email: '', password: '', role: 'SPORTIF' };
  loading = signal(false);
  error = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.m).subscribe({
      // Le backend ne renvoie pas de jeton : on connecte l'utilisateur juste après l'inscription.
      next: () =>
        this.auth.login(this.m.email, this.m.password).subscribe({
          next: () => this.router.navigateByUrl('/dashboard'),
          error: () => this.router.navigateByUrl('/login'),
        }),
      error: (e) => {
        this.error.set(e.message);
        this.loading.set(false);
      },
    });
  }
}
