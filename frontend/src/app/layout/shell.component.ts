import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { MODULES } from '../features/modules';
import { ToastHostComponent } from './toast-host.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  auth = inject(AuthService);
  open = signal(false);
  modules = computed(() => MODULES.filter((m) => !m.roles || this.auth.hasRole(...m.roles)));
  roleLabel = computed(() => this.auth.user()?.roles.join(' · ') ?? '');
}
