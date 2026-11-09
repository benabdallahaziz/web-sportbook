import { Routes } from '@angular/router';
import { CrudPageComponent } from '../../shared/crud-page.component';
import { VENUES, FIELDS } from '../module-configs';

export const VENUES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  { path: 'list', component: CrudPageComponent, data: { config: VENUES } },
  { path: 'fields', component: CrudPageComponent, data: { config: FIELDS } },
];
