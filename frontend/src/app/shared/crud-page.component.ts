import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CrudConfig } from '../core/models';
import { NotifyService } from '../core/notify.service';

/** Page CRUD générique : liste + création + modification + suppression, pilotée par une CrudConfig. */
@Component({
  selector: 'app-crud-page',
  imports: [FormsModule],
  templateUrl: './crud-page.component.html',
})
export class CrudPageComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  cfg =inject(ActivatedRoute).snapshot.data['config'] as CrudConfig;

  rows = signal<any[]>([]);
  loading = signal(true);
  error = signal('');
  saving = signal(false);
  editing = signal(false);
  model: Record<string, any> = {};
  filter = signal('');

  canWrite = computed(() => this.cfg.writeRoles.length > 0 && this.auth.hasRole(...this.cfg.writeRoles));
  tableFields = this.cfg.fields.filter((f) => !f.formOnly);
  visibleRows = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.list(this.cfg.endpoint).subscribe({
      next: (r) => {
        this.rows.set(Array.isArray(r) ? r : []);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e.message);
        this.loading.set(false);
      },
    });
  }

  openForm(row?: any) {
    this.model = row ? { ...row } : this.blank();
    this.editing.set(true);
  }

  closeForm() {
    this.editing.set(false);
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    const body = this.clean(this.model);
    const isEdit = !!this.model['id'];
    const req$ = this.model['id']
      ? this.api.update(this.cfg.endpoint, this.model['id'], body)
      : this.api.create(this.cfg.endpoint, body);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.notify.success(`${this.label()} ${isEdit ? 'modifié(e)' : 'ajouté(e)'}.`);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e.message);
      },
    });
  }

  remove(row: any) {
    if (!confirm(`Supprimer cet élément (${this.cfg.itemLabel} n°${row.id}) ?`)) return;
    this.api.remove(this.cfg.endpoint, row.id).subscribe({
      next: () => {
        this.notify.success(`${this.label()} n°${row.id} supprimé(e).`);
        this.load();
      },
      error: (e) => this.notify.error(e),
    });
  }

  /** "terrain" → "Terrain" */
  private label() {
    return this.cfg.itemLabel.charAt(0).toUpperCase() + this.cfg.itemLabel.slice(1);
  }

  display(row: any, key: string): string {
    const v = row[key];
    return v === null || v === undefined || v === '' ? '—' : String(v);
  }

  private blank(): Record<string, any> {
    const m: Record<string, any> = {};
    for (const f of this.cfg.fields) {
      if (f.currentUserId) m[f.key] = this.auth.user()?.id;
      else if (f.default !== undefined) m[f.key] = f.default;
      else if (f.type === 'select') m[f.key] = f.options?.[0] ?? '';
      else m[f.key] = f.type === 'number' ? null : '';
    }
    return m;
  }

  /** Les champs vides deviennent null ; les nombres sont convertis. */
  private clean(m: Record<string, any>) {
    const out: Record<string, any> = { ...m };
    for (const f of this.cfg.fields) {
      const v = out[f.key];
      if (v === '' || v === undefined) out[f.key] = null;
      else if (f.type === 'number') out[f.key] = Number(v);
    }
    return out;
  }
}
