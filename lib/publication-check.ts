export type PublicationInput = { title: unknown; content: unknown; city: unknown; postalCode: unknown; slug: unknown; photoCount: number }
export function publicationErrors(input: PublicationInput): string[] {
  const errors: string[] = []
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : ''
  if (!text(input.title)) errors.push('Le titre de la réalisation est manquant.')
  if (!text(input.content).replace(/<[^>]*>/g, '').trim()) errors.push('Le contenu de la réalisation est vide.')
  if (!text(input.city)) errors.push('La ville est manquante.')
  if (!/^\d{5}$/.test(text(input.postalCode))) errors.push('Le code postal doit comporter 5 chiffres.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(input.slug))) errors.push('L’adresse de la réalisation est manquante ou invalide.')
  if (!Number.isInteger(input.photoCount) || input.photoCount < 1) errors.push('Au moins une photo est nécessaire.')
  return errors
}
