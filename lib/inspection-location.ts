/** Reuse only explicit locations; never infer a distance from narrative or video time. */
export function inspectionLocation(o: { position?: string; troncon?: string; pointDepart?: string; description?: string }): string {
 const explicit = o.troncon?.trim() || o.position?.trim() || o.pointDepart?.trim()
 if (explicit) return explicit
 const markers = o.description?.match(/\b(?:place|cave|regard)\s+(?:n[°o]\s*)?\d+\b|\b\d+(?:er|e|ème)\s+étage\b/gi)
 return markers?.length ? Array.from(new Set(markers)).join(' · ') : 'Repère à compléter'
}
