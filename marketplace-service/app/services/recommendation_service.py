"""
Service de recommandation IA / Machine Learning pour la Marketplace.
Utilise TF-IDF et la similarité cosinus (scikit-learn) pour suggérer
des produits complémentaires ou similaires basés sur le texte (nom, description, catégorie).
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.models import Product, Cart


def get_product_recommendations(
    product_id: int,
    db: Session,
    limit: int = 4
) -> List[Dict[str, Any]]:
    """
    Calcule les recommandations IA pour un produit cible donné en utilisant TF-IDF + similarité cosinus.
    """
    target = db.get(Product, product_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Produit {product_id} introuvable."
        )

    all_products = db.query(Product).all()
    if len(all_products) <= 1:
        return []

    # Construire le corpus textuel
    corpus = []
    product_map = []
    target_idx = -1

    for idx, p in enumerate(all_products):
        product_map.append(p)
        if p.id == product_id:
            target_idx = idx

        # On enrichit le texte avec le nom, la description et la catégorie
        category_name = p.category.name if p.category else ""
        category_desc = p.category.description if p.category and p.category.description else ""
        text = f"{p.name} {p.name} {p.description or ''} {category_name} {category_name} {category_desc}"
        corpus.append(text)

    if target_idx == -1:
        return []

    # Vectorisation TF-IDF
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    tfidf_matrix = vectorizer.fit_transform(corpus)

    # Calcul de la similarité cosinus entre le produit cible et tous les autres
    similarities = cosine_similarity(tfidf_matrix[target_idx], tfidf_matrix).flatten()

    # Trier par score décroissant (en excluant le produit lui-même)
    ranked_indices = [
        i for i in similarities.argsort()[::-1]
        if i != target_idx
    ]

    results = []
    for i in ranked_indices[:limit]:
        prod = product_map[i]
        score = float(similarities[i])
        results.append({
            "product": prod,
            "similarity_score": round(score, 3),
            "match_percentage": f"{round(score * 100, 1)}%",
        })

    return results


def get_cart_recommendations(
    user_id: int,
    db: Session,
    limit: int = 4
) -> List[Dict[str, Any]]:
    """
    Recommande des produits complémentaires basés sur le contenu actuel du panier de l'utilisateur.
    """
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart or not cart.items:
        # Si panier vide, renvoyer les produits les plus en stock
        products = db.query(Product).order_by(Product.stock.desc()).limit(limit).all()
        return [
            {
                "product": p,
                "similarity_score": 0.0,
                "match_percentage": "Produit populaire",
            }
            for p in products
        ]

    cart_product_ids = {item.product_id for item in cart.items}

    # Calculer les recommandations cumulées pour tous les articles du panier
    aggregated_scores = {}
    for item in cart.items:
        try:
            recs = get_product_recommendations(item.product_id, db, limit=limit * 2)
            for r in recs:
                pid = r["product"].id
                if pid not in cart_product_ids:
                    if pid not in aggregated_scores or r["similarity_score"] > aggregated_scores[pid]["similarity_score"]:
                        aggregated_scores[pid] = r
        except Exception:
            continue

    # Trier les suggestions agrégées
    sorted_recs = sorted(
        aggregated_scores.values(),
        key=lambda x: x["similarity_score"],
        reverse=True
    )
    return sorted_recs[:limit]
