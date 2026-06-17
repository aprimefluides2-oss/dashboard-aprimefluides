/**
 * Construit un nom de fichier sûr pour téléchargement.
 * Exemple : safeFilename('facture', 'FA 2026-04-29 / 0123') → "facture-fa-2026-04-29-0123.pdf"
 */
export function safeFilename(prefix: string, suffix: string, ext: string = 'pdf'): string {
  return `${prefix}-${suffix || 'document'}.${ext}`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
