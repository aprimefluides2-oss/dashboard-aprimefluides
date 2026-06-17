/**
 * Canaux d'acquisition d'une intervention.
 * Source unique de vérité — utilisé par le formulaire de création, l'API
 * et la page /statistiques.
 *
 * `key` est ce qui est stocké en base (string). `label` est l'affichage UI.
 * Pour ajouter un canal : ajouter une entrée dans la liste, ça se propage
 * automatiquement partout.
 */
export const CANAUX_ACQUISITION = [
  { key: 'pages_jaunes',   label: 'PagesJaunes',     icon: '📒' },
  { key: 'site_internet',  label: 'Site internet',   icon: '🌐' },
  { key: 'google_adwords', label: 'Google Adwords',  icon: '💰' },
  { key: 'bouche_oreille', label: 'Bouche-à-oreille', icon: '👄' },
  { key: 'prescription',   label: 'Prescription',    icon: '🔗' },
  { key: 'client_fidel',   label: 'Client fidèle',   icon: '⭐' },
] as const

export type CanalAcquisition = typeof CANAUX_ACQUISITION[number]['key']

const CANAL_KEYS = new Set(CANAUX_ACQUISITION.map(c => c.key))

export function isCanalAcquisition(v: unknown): v is CanalAcquisition {
  return typeof v === 'string' && CANAL_KEYS.has(v as CanalAcquisition)
}

export function canalLabel(key: string | null | undefined): string {
  if (!key) return '—'
  const c = CANAUX_ACQUISITION.find(x => x.key === key)
  return c?.label || key
}

export function canalIcon(key: string | null | undefined): string {
  if (!key) return '❔'
  const c = CANAUX_ACQUISITION.find(x => x.key === key)
  return c?.icon || '❔'
}
