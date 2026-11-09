import { Component, inject } from '@angular/core';
import { NotifyService } from '../core/notify.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toast-host" aria-live="polite">
      @for (t of notify.toasts(); track t.id) {
        <div class="toast" [attr.data-kind]="t.kind" role="status">
          <div class="toast-body">
            <strong>{{ t.kind === 'error' ? 'Erreur' : t.kind === 'success' ? 'C’est fait' : 'Info' }}</strong>
            <span>{{ t.text }}</span>
            @if (t.details.length) {
              <ul>@for (d of t.details; track d) { <li>{{ d }}</li> }</ul>
            }
          </div>
          <button class="toast-close" (click)="notify.dismiss(t.id)" aria-label="Fermer">×</button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  notify = inject(NotifyService);
}
