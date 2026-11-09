import { Routes } from '@angular/router';
import { ProductsCatalogComponent } from './products-catalog.component';
import { CartComponent } from './cart.component';
import { OrdersComponent } from './orders.component';
import { AnalyticsComponent } from './analytics.component';
import { roleGuard } from '../../core/guards';

export const MARKETPLACE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'products', title: 'Boutique · SportBook', component: ProductsCatalogComponent },
  { path: 'cart', title: 'Mon Panier · SportBook', component: CartComponent },
  { path: 'orders', title: 'Commandes · SportBook', component: OrdersComponent },
  {
    path: 'analytics',
    title: 'Ventes & Statistiques · SportBook',
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'GERANT'] },
    component: AnalyticsComponent,
  },
];
