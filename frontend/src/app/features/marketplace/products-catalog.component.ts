import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { MarketplaceApiService } from './marketplace-api.service';
import { Category, Product, ProductRecommendation } from './marketplace.models';

@Component({
  selector: 'app-products-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Boutique Sportive · SportBook</p>
        <h1>Catalogue des Équipements</h1>
        <p class="muted">Équipez-vous pour vos matchs et tournois avec des recommandations propulsées par IA.</p>
      </div>
      <div class="actions">
        @if (!canManage()) {
          <a class="btn ghost" routerLink="/marketplace/cart">
            🛒 Mon Panier
          </a>
        }
        <a class="btn ghost" routerLink="/marketplace/orders">
          📦 Mes Commandes
        </a>
        @if (canManage()) {
          <a class="btn ghost" routerLink="/marketplace/analytics">
            📊 Chiffre d'Affaires & Ventes
          </a>
          <button class="btn primary" (click)="openCreate()">+ Nouveau produit</button>
        }
      </div>
    </header>

    <!-- FORMULAIRE CRÉATION / MODIFICATION (GÉRANT / ADMIN) -->
    @if (formOpen()) {
      <form class="panel form-grid form-card" (ngSubmit)="saveProduct()">
        <h2>{{ editingProduct() ? 'Modifier le produit' : 'Ajouter un équipement au catalogue' }}</h2>
        <label class="wide">
          <span>Nom du produit <b aria-hidden="true">*</b></span>
          <input [(ngModel)]="model.name" name="name" required placeholder="Ex: Ballon de Football Officiel" />
        </label>
        <label>
          <span>Prix (DT) <b aria-hidden="true">*</b></span>
          <input type="number" step="0.5" [(ngModel)]="model.price" name="price" required min="0" />
        </label>
        <label>
          <span>Stock disponible <b aria-hidden="true">*</b></span>
          <input type="number" [(ngModel)]="model.stock" name="stock" required min="0" />
        </label>
        <label class="wide">
          <span>Catégorie sportive</span>
          <select [(ngModel)]="model.category_id" name="category_id">
            <option [ngValue]="null">Général / Sans catégorie</option>
            @for (cat of categories(); track cat.id) {
              <option [ngValue]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </label>
        <label class="wide">
          <span>Description & caractéristiques</span>
          <textarea [(ngModel)]="model.description" name="description" rows="3" placeholder="Matière, dimensions, marque..."></textarea>
        </label>
        <div class="form-actions wide">
          <button type="button" class="btn ghost" (click)="formOpen.set(false)">Annuler</button>
          <button type="submit" class="btn primary" [disabled]="saving()">
            {{ saving() ? 'Enregistrement...' : 'Enregistrer le produit' }}
          </button>
        </div>
      </form>
    }

    <!-- BARRE DE RECHERCHE ET FILTRES -->
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Filtrer par catégorie">
        <button class="seg-btn" [class.on]="selectedCategory() === null" (click)="selectedCategory.set(null)">
          Tous les sports <i>{{ products().length }}</i>
        </button>
        @for (cat of categories(); track cat.id) {
          <button class="seg-btn" [class.on]="selectedCategory() === cat.id" (click)="selectedCategory.set(cat.id)">
            {{ cat.name }}
          </button>
        }
      </div>
      <input
        class="search"
        type="search"
        placeholder="Rechercher un ballon, une raquette..."
        [ngModel]="searchQuery()"
        (ngModelChange)="searchQuery.set($event)"
      />
    </div>

    <!-- CHARGEMENT OU VIDE -->
    @if (loading()) {
      <div class="card-grid">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="t-card skeleton" style="height: 240px;"></div>
        }
      </div>
    } @else if (filteredProducts().length === 0) {
      <div class="panel empty-state">
        <p class="empty-title">Aucun produit ne correspond à votre recherche.</p>
        <p class="muted">Essayez un autre mot-clé ou réinitialisez les filtres.</p>
      </div>
    } @else {
      <!-- GRILLE DES PRODUITS -->
      <div class="card-grid">
        @for (p of filteredProducts(); track p.id) {
          <article class="t-card product-card">
            <div class="t-card-top">
              <span class="badge cat-badge">{{ getCategoryName(p.category_id) }}</span>
              <span class="stock-pill" [class.out]="p.stock <= 0" [class.low]="p.stock > 0 && p.stock <= 5">
                {{ p.stock > 0 ? (p.stock + ' en stock') : 'Rupture' }}
              </span>
            </div>

            <h2 class="product-title">{{ p.name }}</h2>
            <p class="product-desc">{{ p.description || 'Équipement homologué pour la pratique sportive.' }}</p>

            <div class="product-footer">
              <div class="price-box">
                <span class="price-val">{{ p.price | number:'1.2-2' }}</span>
                <span class="price-curr">DT</span>
              </div>

              <div class="card-btns">
                @if (!canManage()) {
                  <button
                    class="btn primary small"
                    [disabled]="p.stock <= 0 || addingToCart() === p.id"
                    (click)="addToCart(p)"
                  >
                    {{ addingToCart() === p.id ? 'Ajout...' : '+ Panier' }}
                  </button>
                }
                <button class="btn ghost small ai-btn" (click)="toggleRecommendations(p)" title="Voir les suggestions intelligentes">
                  💡 IA
                </button>
                @if (canManage()) {
                  <button class="btn ghost small" (click)="openEdit(p)" title="Modifier">✎</button>
                  <button class="btn danger small" (click)="deleteProduct(p.id)" title="Supprimer">✕</button>
                }
              </div>
            </div>

            <!-- TIROIR RECOMMANDATIONS MACHINE LEARNING -->
            @if (activeRecProductId() === p.id) {
              <div class="ai-box">
                <div class="ai-header">
                  <strong>💡 Recommandé par l'IA (Similarité Cosinus) :</strong>
                  <button class="close-rec" (click)="activeRecProductId.set(null)">✕</button>
                </div>
                @if (loadingRecs()) {
                  <p class="muted small">Calcul vectoriel TF-IDF en cours...</p>
                } @else if (recommendations().length === 0) {
                  <p class="muted small">Aucun article similaire trouvé.</p>
                } @else {
                  <div class="recs-list">
                    @for (r of recommendations(); track r.product.id) {
                      <div class="rec-item">
                        <div class="rec-info">
                          <span class="rec-name">{{ r.product.name }}</span>
                          <span class="rec-price">{{ r.product.price | number:'1.2-2' }} DT</span>
                        </div>
                        <div class="rec-action">
                          <span class="rec-score">{{ r.match_percentage }}</span>
                          <button class="btn primary small mini-btn" (click)="addToCart(r.product)">+ Panier</button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </article>
        }
      </div>
    }
  `,
  styles: [`
    .product-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid var(--line-soft, #e8eef3);
      background: var(--panel, #ffffff);
      border-radius: var(--radius, 12px);
      padding: 1.25rem;
      box-shadow: var(--shadow);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .product-card:hover {
      box-shadow: var(--shadow-lift);
      transform: translateY(-2px);
    }
    .cat-badge {
      background: var(--court-soft, #eaf1fb);
      color: var(--court, #1d4f91);
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .stock-pill {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--pitch, #1e8e5a);
    }
    .stock-pill.low {
      color: var(--amber, #b7791f);
    }
    .stock-pill.out {
      color: var(--danger, #b3372d);
    }
    .product-title {
      font-size: 1.15rem;
      margin: 0.75rem 0 0.35rem 0;
      color: var(--ink, #16222e);
    }
    .product-desc {
      font-size: 0.85rem;
      color: var(--muted, #5b6b79);
      margin-bottom: 1.25rem;
      flex-grow: 1;
      line-height: 1.4;
    }
    .product-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.75rem;
      border-top: 1px solid var(--line-soft, #e8eef3);
    }
    .price-box {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
    }
    .price-val {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--ink, #16222e);
    }
    .price-curr {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted, #5b6b79);
    }
    .card-btns {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .ai-btn {
      border-color: #9333ea;
      color: #9333ea;
    }
    .ai-btn:hover {
      background: #faf5ff;
    }
    .ai-box {
      margin-top: 1rem;
      padding: 0.75rem;
      background: #faf5ff;
      border: 1px solid #f3e8ff;
      border-radius: 8px;
    }
    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: #7e22ce;
      margin-bottom: 0.5rem;
    }
    .close-rec {
      border: none;
      background: transparent;
      cursor: pointer;
      color: #9333ea;
      font-weight: bold;
    }
    .recs-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .rec-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0.6rem;
      background: #ffffff;
      border-radius: 6px;
      font-size: 0.8rem;
      border: 1px solid #f3e8ff;
    }
    .rec-info {
      display: flex;
      flex-direction: column;
    }
    .rec-name {
      font-weight: 600;
      color: #1e293b;
    }
    .rec-price {
      color: #64748b;
      font-size: 0.75rem;
    }
    .rec-action {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .rec-score {
      font-size: 0.7rem;
      font-weight: 700;
      color: #059669;
      background: #ecfdf5;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }
    .mini-btn {
      padding: 0.2rem 0.5rem;
      font-size: 0.75rem;
    }
  `],
})
export class ProductsCatalogComponent implements OnInit {
  private api = inject(MarketplaceApiService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly selectedCategory = signal<number | null>(null);
  readonly searchQuery = signal('');

  readonly addingToCart = signal<number | null>(null);
  readonly activeRecProductId = signal<number | null>(null);
  readonly loadingRecs = signal(false);
  readonly recommendations = signal<ProductRecommendation[]>([]);

  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  model: Partial<Product> = { name: '', price: 0, stock: 10, category_id: null, description: '' };

  readonly canManage = computed(() => this.auth.hasRole('ADMIN', 'GERANT'));

  readonly filteredProducts = computed(() => {
    let list = this.products();
    const cat = this.selectedCategory();
    if (cat !== null) {
      list = list.filter((p) => p.category_id === cat);
    }
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return list;
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
    this.api.getProducts().subscribe({
      next: (prods) => {
        this.products.set(prods);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.error(err);
        this.loading.set(false);
      },
    });
  }

  getCategoryName(catId?: number | null): string {
    if (!catId) return 'Équipement';
    const c = this.categories().find((cat) => cat.id === catId);
    return c ? c.name : 'Équipement';
  }

  addToCart(product: Product) {
    const user = this.auth.user();
    const userId = user ? user.id : 1;
    this.addingToCart.set(product.id);
    this.api.addToCart(userId, product.id, 1).subscribe({
      next: () => {
        this.addingToCart.set(null);
        this.notify.success(`"${product.name}" ajouté au panier ! 🛒`);
      },
      error: (err) => {
        this.addingToCart.set(null);
        this.notify.error(err);
      },
    });
  }

  toggleRecommendations(product: Product) {
    if (this.activeRecProductId() === product.id) {
      this.activeRecProductId.set(null);
      return;
    }
    this.activeRecProductId.set(product.id);
    this.loadingRecs.set(true);
    this.api.getProductRecommendations(product.id, 3).subscribe({
      next: (recs) => {
        this.recommendations.set(recs);
        this.loadingRecs.set(false);
      },
      error: (err) => {
        this.loadingRecs.set(false);
        this.notify.error(err);
      },
    });
  }

  openCreate() {
    this.editingProduct.set(null);
    this.model = { name: '', price: 10, stock: 10, category_id: null, description: '' };
    this.formOpen.set(true);
  }

  openEdit(p: Product) {
    this.editingProduct.set(p);
    // Ne garder que les champs modifiables (exclure id, created_at, etc.)
    this.model = {
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      category_id: p.category_id ?? null,
    };
    this.formOpen.set(true);
  }

  saveProduct() {
    this.saving.set(true);
    const editing = this.editingProduct();
    // Construire un payload propre avec seulement les champs de ProductUpdate
    const payload: Partial<Product> = {
      name: this.model.name,
      description: this.model.description,
      price: this.model.price,
      stock: this.model.stock,
      category_id: this.model.category_id ?? null,
    };
    if (editing) {
      this.api.updateProduct(editing.id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.notify.success('Produit modifié avec succès.');
          this.loadData();
        },
        error: (err) => {
          this.saving.set(false);
          this.notify.error(err);
        },
      });
    } else {
      this.api.createProduct(this.model).subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.notify.success('Nouveau produit créé.');
          this.loadData();
        },
        error: (err) => {
          this.saving.set(false);
          this.notify.error(err);
        },
      });
    }
  }

  deleteProduct(id: number) {
    if (!confirm('Supprimer définitivement cet article ?')) return;
    this.api.deleteProduct(id).subscribe({
      next: () => {
        this.notify.success('Produit supprimé.');
        this.loadData();
      },
      error: (err) => this.notify.error(err),
    });
  }
}
