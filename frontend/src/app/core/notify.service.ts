import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  details: string[];
}

/** Notifications éphémères (« toasts ») affichées en bas à droite de l'écran. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  success(text: string) {
    this.push('success', text, [], 3500);
  }

  info(text: string) {
    this.push('info', text, [], 4000);
  }

  /** Accepte un texte ou l'erreur normalisée par errorInterceptor ({ message, details }). */
  error(err: unknown) {
    const e = err as { message?: string; details?: string[] } | string;
    const text = typeof e === 'string' ? e : e?.message ?? 'Une erreur est survenue.';
    const details = typeof e === 'string' ? [] : e?.details ?? [];
    this.push('error', text, details, 8000);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, text: string, details: string[], ms: number) {
    const id = ++this.seq;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, text, details }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
