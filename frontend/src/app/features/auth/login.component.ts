import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth">
      <div class="auth-intro">
        <h1>SportBook</h1>
        <p>Réservez un terrain, rejoignez un tournoi, trouvez un coach.</p>
      </div>
      <form class="panel auth-form" (ngSubmit)="submit()" #f="ngForm">
        <h2>Connexion</h2>
        @if (error()) { <div class="alert" role="alert">{{ error() }}</div> }
        <label><span>Email</span>
          <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" /></label>
        <label><span>Mot de passe</span>
          <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
        <button class="btn primary" type="submit" [disabled]="f.invalid || loading()">{{ loading() ? 'Connexion…' : 'Se connecter' }}</button>
        <p class="muted">Pas de compte ? <a routerLink="/register">Créer un compte</a></p>
      </form>
    </section>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (e) => {
        this.error.set(e.message);
        this.loading.set(false);
      },
    });
  }
}
