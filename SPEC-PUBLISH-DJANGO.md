# Spec — Optimisation SEO/GEO du module Réalisations (côté Django)

> Document de contrat entre le **back-office Next.js** (`dashboard-aprimefluides`)
> et le **site Django** (`www.aprime-fluides.fr`).
> Rédigé pour l'agent qui implémente les 4 optimisations du module réalisations.

## 1. Contexte

Quand un technicien publie une intervention, le back-office envoie une requête
`multipart/form-data` à :

```
POST {CLIENT_API_URL}/api/gallery/publish/
Authorization: Bearer {CLIENT_PUBLISH_TOKEN}
```

Django crée/met à jour la page réalisation et renvoie `{ slug }`.

Le back-office a **déjà fait sa part** : compression des photos (transformation
Supabase `width=1280&quality=70` → ~300-400 Ko/photo) et génération du contenu
SEO par IA. Les 4 optimisations ci-dessous se font **côté Django**, à partir du
payload décrit en §2.

## 2. Payload envoyé par le back-office

Champs `multipart/form-data` reçus par `/api/gallery/publish/` :

| Champ | Type | Contenu |
|---|---|---|
| `title` | texte (≤ 95) | Titre H1 de la réalisation |
| `slug` | texte | Slug d'URL proposé |
| `service_type` | texte | **Type de prestation** (ex. « Débouchage WC ») |
| `location` | texte | **Ville d'intervention** |
| `intervention_city` | texte | Ville (doublon de `location`) |
| `postal_code` | texte | Code postal |
| `intervention_date` | texte | Date `YYYY-MM-DD` |
| `description` | texte (≤ 195) | Meta description |
| `meta_keywords` | texte | Mots-clés séparés par virgules |
| `content` | HTML | Résumé + contenu principal + galerie + FAQ |
| `faq_json` | JSON | `schema.org/FAQPage` prêt à l'emploi |
| `jsonld` | JSON | JSON-LD généré par l'IA (`seo_json.jsonld`) — **à enrichir, cf. §3.1** |
| `related_services_json` | JSON | Liste de services liés (pour le maillage) |
| `seo_json` | JSON | Bundle SEO complet (cf. structure ci-dessous) |
| `rapport_json` | JSON | Rapport d'intervention structuré |
| `transcription` | texte | Dictée brute du technicien |
| `client_nom` / `client_email` / `client_adresse` | texte | Client |
| `technicien_name` | texte | Technicien |
| `intervention_id` | texte | ID Supabase (back-office) |
| `is_published` | `'true'` | — |
| `before_image` | fichier | Photo 1 (JPEG, 1280px) |
| `after_image` | fichier | Photo 2 (ou copie de la 1 si une seule) |
| `extra_image_0..N` | fichier | Photos suivantes |
| **`photos_nom_base`** | texte | **NOUVEAU** — base de nommage SEO : `<service>-<ville>` slugifié, ex. `debouchage-wc-argenteuil` |
| **`photos_json`** | JSON | **NOUVEAU** — métadonnées par photo, cf. §3.4 |

### Structure de `seo_json`

```jsonc
{
  "titre_h1": "…",
  "meta_description": "…",
  "slug": "…",
  "meta_keywords": ["…"],
  "resume_rich_snippet": "Résumé court de l'intervention",
  "contenu_principal": "<p>HTML…</p>",
  "faq": [{ "question": "…", "reponse": "…" }],
  "jsonld": { /* objet JSON-LD de base */ },
  "related_services": [ /* services liés */ ]
}
```

## 3. Les 4 optimisations

### 3.1 — JSON-LD enrichi

Sur **chaque page réalisation**, émettre un `<script type="application/ld+json">`.
Construire un `@graph` à partir du payload :

- **La réalisation** : `Article` (ou `CreativeWork`) — `headline` = `title`,
  `description`, `datePublished` = `intervention_date`, `image` = la liste des
  `ImageObject` ci-dessous, `mainEntityOfPage` = URL de la page.
- **Chaque photo** : `ImageObject` — `contentUrl` (URL finale WebP), `name` et
  `caption` dérivés de `photos_json[].legende` + service + ville.
- **Le service rendu** : `Service` — `name` = `service_type`,
  `areaServed` = la ville (`location` + `postal_code`),
  `provider` = le `LocalBusiness` Aprime fluides.
- **Le lieu** : `Place` / `PostalAddress` (`addressLocality` = `location`,
  `postalCode` = `postal_code`, `addressRegion` = « Île-de-France », `addressCountry` = « FR »).
  ⚠️ Le back-office **n'envoie pas** de coordonnées géo → Django doit géocoder la
  ville (ou réutiliser les coordonnées de ses pages villes existantes) pour
  ajouter `geo` (`GeoCoordinates`).
- **FAQ** : réutiliser `faq_json` (déjà au format `FAQPage`).
- **Liens** : pointer le JSON-LD vers la **page service** et la **page ville**
  correspondantes (`isPartOf` / `about` / `url`).

### 3.2 — Maillage interne

- Chaque **page réalisation** → liens contextuels vers : sa **page ville** et sa
  **page service** (résolues via `service_type` + `location`). Plus un bloc
  « réalisations similaires » (même service ou même ville).
- Chaque **page ville** → liste les réalisations faites dans cette ville.
- Chaque **page service** → liste les réalisations de ce service.
- `related_services_json` est déjà fourni : le rendre en liens vers les pages
  services correspondantes.
- Objectif : que chaque réalisation soit reliée des deux côtés (ville ↔ service)
  et qu'aucune page ne soit orpheline.

### 3.3 — llms.txt détaillé

Servir `/llms.txt` (Markdown) à la racine du site. Sections recommandées :

- Présentation Aprime fluides (activité, zone : Île-de-France, téléphone).
- Liste des services, avec l'URL de chaque page service.
- Liste des villes couvertes, avec l'URL de chaque page ville.
- **Section « Réalisations »** : une entrée par réalisation publiée —
  `titre · ville · service · résumé (resume_rich_snippet) · URL`.

Régénérer / mettre à jour le fichier à chaque publication (signal Django
`post_save` sur le modèle réalisation). Objectif : que ChatGPT / Perplexity /
Google AI Overviews puissent citer une réalisation précise.

### 3.4 — Photos : noms de fichiers + alt

Le back-office envoie désormais :

```jsonc
// photos_nom_base
"debouchage-wc-argenteuil"

// photos_json — une entrée par fichier réellement envoyé
[
  { "field": "before_image",   "ordre": 0, "filename": "debouchage-wc-argenteuil-1.jpg", "legende": "avant" },
  { "field": "after_image",    "ordre": 1, "filename": "debouchage-wc-argenteuil-2.jpg", "legende": "après" },
  { "field": "extra_image_0",  "ordre": 2, "filename": "debouchage-wc-argenteuil-3.jpg", "legende": "Photo 3" }
]
```

Django doit, pour chaque fichier (matché par `field`) :

1. **Renommer** en `{photos_nom_base}-{ordre+1}.webp`.
2. **Convertir en WebP** (le back-office envoie du JPEG 1280px ; WebP ≈ -30 %).
3. Écrire l'**`alt`** : `{service_type} à {location}` + la `legende` si elle est
   parlante (ignorer les légendes génériques type « Photo 3 »).
   Ex. `alt="Débouchage WC à Argenteuil — avant"`.
4. Reporter ces valeurs dans les `ImageObject` du JSON-LD (§3.1).

## 4. Contraintes connues

- **Ne pas** préfixer `content` par une balise `<style>` : le sanitizer Django
  renvoie un HTTP 500 silencieux.
- `title` : `CharField(max_length=100)` — le back-office tronque déjà à 95.
- `meta_description` : tronquée à 195.
- Un **second chemin de publication** existe (`POST /api/publish` depuis la page
  `/nouveau` du back-office) : il transmet un `FormData` construit côté client
  et **peut ne pas inclure** `photos_json` / `photos_nom_base`. Django doit
  dégrader proprement : si ces champs manquent, déduire le nommage et les `alt`
  depuis `service_type` + `location`.

## 5. Côté back-office — ce qui est déjà fait

- Photos compressées (Supabase transform 1280px / q70).
- Noms de fichiers multipart en `{service}-{ville}-{n}.jpg`.
- `alt` de la galerie HTML enrichi (`{service} à {ville} — {légende}`).
- Champs `photos_nom_base` et `photos_json` ajoutés au payload.

_Fin de la spec._
