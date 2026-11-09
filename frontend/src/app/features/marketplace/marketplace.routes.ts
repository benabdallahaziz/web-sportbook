import { Routes } from '@angular/router';
import { CrudPageComponent } from '../../shared/crud-page.component';
import { PRODUCTS, CART, ORDERS } from '../module-configs';

export const MARKETPLACE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'products', component: CrudPageComponent, data: { config: PRODUCTS } },
  { path: 'cart', component: CrudPageComponent, data: { config: CART } },
  { path: 'orders', component: CrudPageComponent, data: { config: ORDERS } },
];
