import { Routes } from '@angular/router';
import { CrudPageComponent } from '../../shared/crud-page.component';
import { BOOKINGS, TIMESLOTS } from '../module-configs';

export const BOOKINGS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  { path: 'list', component: CrudPageComponent, data: { config: BOOKINGS } },
  { path: 'timeslots', component: CrudPageComponent, data: { config: TIMESLOTS } },
];
