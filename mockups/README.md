# Maquette — page de réalisation Aprime fluides

Maquette du design des pages publiées sur `www.aprime-fluides.fr/nos-realisations/<slug>`.

## Fichier

| Fichier | Description |
|---|---|
| `realisation-demo.html` | Design retenu — sections en cartes encadrées, ombres légères, FAQ en accordéon |

Ouvre-le dans un navigateur (double-clic) pour visualiser le rendu cible.

## Ce que la maquette corrige

1. **FAQ visible** — la FAQ est intégrée *dans le HTML de contenu* (`<section class="content-block faq-block">`). Avant, elle ne partait que dans `faq_json` / `seo_json` et le template Django ne l'affichait pas.
2. **Sections distinctes encadrées** — chaque partie (Résumé, Contexte, Diagnostic, Travaux, Photos, FAQ) est un bloc visuellement séparé et lisible.

## Côté app (déjà fait, déployé)

- L'app intègre la FAQ dans le champ `content` envoyé à Django → la page publiée l'affichera même si le template Django ne lit que `content`.
- Le bloc SEO du prompt a été réordonné : `faq` placé **avant** `contenu_principal` → la FAQ n'est plus perdue si la réponse de l'IA est tronquée.
- L'aperçu « page web » de l'app utilise le même CSS que cette maquette.

## Côté site Django (à transmettre à qui gère le site)

Le rendu final est produit par le template Django. Pour appliquer le design :

1. Copier le bloc `<style>...</style>` de `realisation-demo.html` dans la feuille de style du template `/nos-realisations/<slug>`.
2. S'assurer que le template affiche bien le champ `content` reçu (il contient désormais résumé + contenu + photos + FAQ).

Les classes CSS utilisées (`content-block`, `info-box`, `checklist-box`, `photo-grid`, `photo-card`, `faq-block`, `faq-item`, `faq-answer`, `resume-block`, `gallery-block`, `related-block`) correspondent exactement à celles générées par l'app — aucun changement de structure HTML nécessaire côté Django.
