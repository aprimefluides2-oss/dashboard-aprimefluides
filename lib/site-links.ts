/**
 * Liens du site Aprime insérés dans les études de cas publiées — SOURCE UNIQUE.
 *
 * Pourquoi ce fichier existe (audit 2026-07-30) : les URLs étaient codées en dur
 * dans `app/api/generate/route.ts` et avaient dérivé par rapport au site. Sur la
 * réalisation « sanibroyeur Clichy », chaque page publiée embarquait :
 *   - un lien ville MORT : `/{ville}-{cp}` (ex. /clichy-92110) → 404, ce motif
 *     n'existe pas sur le site (la convention est /debouchage-canalisation-…) ;
 *   - 6 liens service en 308 (dont 2 en double redirection) ;
 *   - /debouchage/debouchage-evier-douche → 404 ;
 *   - /urgence-debouchage → 404 ; /tarifs → 308.
 * Le prompt SEO exigeant « ≥ 3 liens services + ≥ 2 liens ville », chaque
 * réalisation naissait avec ~8 liens cassés ou redirigés.
 *
 * ⚠ RÈGLE : toute URL ajoutée ici doit avoir été vérifiée en 200 SANS
 * redirection sur la prod. Les pages publiées héritent de ces liens tels quels.
 * Vérification de référence :
 *   curl -s -o /dev/null -w "%{http_code}\n" \
 *     "http://127.0.0.1:3001<path>" -H "Host: www.aprime-fluides.fr"
 * Dernière passe complète : 2026-07-30 (toutes les entrées ci-dessous en 200).
 */

export const SITE = 'https://www.aprime-fluides.fr'

export type SiteLink = { label: string; path: string }

/** Hub débouchage — pilier par défaut et fallback ultime des liens ville. */
export const HUB_DEBOUCHAGE: SiteLink = {
  label: 'Débouchage de canalisation',
  path: '/debouchage-canalisation',
}

/**
 * Pages service proposées au prompt pour le maillage interne.
 * Volontairement courte : mieux vaut 8 liens vivants et pertinents qu'une liste
 * exhaustive à moitié périmée.
 */
export const SERVICE_LINKS: SiteLink[] = [
  HUB_DEBOUCHAGE,
  { label: 'Curage et hydrocurage de canalisation', path: '/curage-de-canalisation' },
  { label: 'Inspection vidéo de canalisation', path: '/inspection-video-canalisation' },
  { label: 'Débouchage WC', path: '/debouchage-canalisation/debouchage-wc' },
  { label: 'Débouchage lavabo et évier', path: '/debouchage-canalisation/debouchage-lavabo-evier' },
  { label: 'Débouchage douche et baignoire', path: '/debouchage-canalisation/debouchage-douche-baignoire' },
  { label: 'Vidange de fosse septique', path: '/vidange-fosse-septique' },
  { label: 'Recherche de fuite', path: '/recherche-de-fuite' },
  { label: 'Pompe de relevage', path: '/pompe-de-relevage' },
  { label: 'Chemisage de canalisation', path: '/chemisage' },
  { label: 'Dépannage de sanibroyeur', path: '/depannage-sanibroyeur-paris' },
  { label: 'Débouchage de colonne d’immeuble', path: '/debouchage-colonne-immeuble' },
  { label: 'Intervention en urgence', path: '/urgence' },
  { label: 'Tarifs de débouchage', path: '/tarifs-de-debouchage-de-canalisation' },
]

/**
 * Page pilier la PLUS proche du type d'intervention — c'est le lien de
 * pertinence n°1 de la page publiée. Avant ce mapping, une étude « Sanibroyeur »
 * ne pointait que vers des pages débouchage génériques alors que
 * /depannage-sanibroyeur-paris existe.
 *
 * Types sans page dédiée (bac à graisse, regard, gouttière, poste de relevage)
 * → rattachés au pilier le plus proche métier, jamais à une URL inventée.
 */
const PILLAR_BY_TYPE: Record<string, string> = {
  'Débouchage canalisation': '/debouchage-canalisation',
  'Débouchage WC': '/debouchage-canalisation/debouchage-wc',
  'Débouchage évier': '/debouchage-canalisation/debouchage-lavabo-evier',
  'Débouchage lavabo': '/debouchage-canalisation/debouchage-lavabo-evier',
  'Débouchage douche': '/debouchage-canalisation/debouchage-douche-baignoire',
  'Débouchage colonne': '/debouchage-colonne-immeuble',
  'Débouchage regard': '/curage-de-canalisation',
  'Pompage de regard': '/curage-de-canalisation',
  'Débouchage gouttière': '/debouchage-canalisation',
  Hydrocurage: '/curage-de-canalisation',
  'Curage canalisation': '/curage-de-canalisation',
  'Inspection caméra': '/inspection-video-canalisation',
  'Vidange fosse septique': '/vidange-fosse-septique',
  'Vidange bac à graisse': '/vidange-fosse-septique',
  'Pompe de relevage': '/pompe-de-relevage',
  'Pompage poste de relevage': '/pompe-de-relevage',
  Chemisage: '/chemisage',
  Sanibroyeur: '/depannage-sanibroyeur-paris',
  'Recherche de fuite': '/recherche-de-fuite',
}

/** Page pilier du type d'intervention (fallback : hub débouchage). */
export function pillarForType(type: string): SiteLink {
  const path = PILLAR_BY_TYPE[type]
  if (!path) return HUB_DEBOUCHAGE
  return SERVICE_LINKS.find((l) => l.path === path) || { label: type, path }
}

/** Slug de ville façon site : sans accent, kebab-case. */
export function citySlug(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

/** Page département de repli, par préfixe de code postal (toutes en 200). */
const DEPT_PATH_BY_CP: Record<string, string> = {
  '75': '/debouchage-canalisation-paris-75',
  '77': '/debouchage-canalisation-seine-et-marne-77',
  '78': '/debouchage-canalisation-yvelines-78',
  '91': '/debouchage-canalisation-essonne-91',
  '92': '/debouchage-canalisation-hauts-de-seine-92',
  '93': '/debouchage-canalisation-seine-saint-denis-93',
  '94': '/debouchage-canalisation-val-de-marne-94',
  '95': '/debouchage-canalisation-val-d-oise-95',
}

/** Page département correspondant au CP, ou le hub si hors Île-de-France. */
export function deptPath(cp: string): string {
  return DEPT_PATH_BY_CP[(cp || '').slice(0, 2)] || HUB_DEBOUCHAGE.path
}

/**
 * Chemin de la page ville. Paris = convention arrondissement
 * (/debouchage-canalisation-paris-11 pour 75011, les 20 existent), sinon
 * /debouchage-canalisation-{ville}-{cp}.
 * Le résultat reste une HYPOTHÈSE : passer par `resolveCityPath` pour vérifier.
 */
export function cityPathCandidate(ville: string, cp: string): string {
  if (/^75\d{3}$/.test(cp)) {
    const arr = parseInt(cp.slice(3), 10)
    if (arr >= 1 && arr <= 20) return `/debouchage-canalisation-paris-${arr}`
    return DEPT_PATH_BY_CP['75']
  }
  const slug = citySlug(ville)
  if (!slug || !cp) return deptPath(cp)
  return `/debouchage-canalisation-${slug}-${cp}`
}

export function absolute(path: string): string {
  return `${SITE}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Vrai si l'URL répond 200 SANS redirection (`redirect: 'manual'` → un 308
 * ressort en `opaqueredirect`/3xx et est donc rejeté : on ne veut pas publier
 * un lien qui coûte un hop).
 * Silencieux et borné dans le temps : une indisponibilité réseau ne doit jamais
 * faire échouer une génération de rapport.
 */
export async function isReachable(path: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(absolute(path), {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      })
      return res.status === 200
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

/**
 * Lien ville garanti vivant : page ville si elle répond, sinon page
 * département, sinon hub. En cas de réseau KO, on retombe sur le département
 * (page qui existe pour tous les CP franciliens) plutôt que sur une URL non
 * vérifiée.
 */
export async function resolveCityPath(ville: string, cp: string): Promise<string> {
  const candidate = cityPathCandidate(ville, cp)
  if (await isReachable(candidate)) return candidate
  const dept = deptPath(cp)
  if (dept !== candidate && (await isReachable(dept))) return dept
  return HUB_DEBOUCHAGE.path
}
