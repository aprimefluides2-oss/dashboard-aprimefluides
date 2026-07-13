/**
 * Signature du technicien — image uploadée une fois, mémorisée sur l'appareil
 * (localStorage) et réutilisée automatiquement sur les PDF (rapport + devis).
 *
 * Clé interne conservée en `ltdb_*` par convention (comme `ltdb_technicien`) —
 * ne pas renommer (compat données locales existantes).
 */
export const TECHNICIEN_SIGNATURE_KEY = 'ltdb_technicien_signature'

export function getTechnicienSignature(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(TECHNICIEN_SIGNATURE_KEY)
  } catch {
    return null
  }
}

export function setTechnicienSignature(dataUrl: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (dataUrl) localStorage.setItem(TECHNICIEN_SIGNATURE_KEY, dataUrl)
    else localStorage.removeItem(TECHNICIEN_SIGNATURE_KEY)
  } catch {
    /* quota / mode privé : silencieux */
  }
}

/**
 * Charge un fichier image (upload/scan) et le redimensionne (bornes max) pour
 * limiter la taille stockée en localStorage. Renvoie un data URL PNG.
 */
export async function fileToSignatureDataUrl(
  file: File,
  maxW = 640,
  maxH = 240,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Lecture du fichier impossible'))
    r.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new window.Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Image invalide'))
    im.src = dataUrl
  })

  const scale = Math.min(1, maxW / img.width, maxH / img.height)
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}
