import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { REALISATION_PAGE_STYLE } from "@/lib/realisationPageCss"

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Publication directe d'une intervention déjà saisie (avec rapport_json,
 * seo_json et photos_urls) vers le site Django LTDB.
 *
 * Body : { interventionId: string }
 *
 * Évite le détour par /nouveau : le wizard Mode Terrain a déjà tout le
 * contenu nécessaire, pas besoin de re-cliquer sur "Publier".
 */
export async function POST(req: NextRequest) {
  const ltdbUrl = process.env.CLIENT_API_URL
  const token = process.env.CLIENT_PUBLISH_TOKEN
  if (!ltdbUrl || !token) {
    return NextResponse.json({ error: 'Configuration API client manquante (CLIENT_API_URL / CLIENT_PUBLISH_TOKEN)' }, { status: 500 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let body: { interventionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const interventionId = (body.interventionId || '').trim()
  if (!interventionId) return NextResponse.json({ error: 'interventionId requis' }, { status: 400 })

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, reference, type_intervention, ville, code_postal, adresse_chantier, date_realisee, date_prevue, client_id, technicien_id, rapport_json, seo_json, transcription, photos_urls, photos_legendes, publie_slug')
    .eq('id', interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  if (!interv.rapport_json || Object.keys(interv.rapport_json).length === 0) {
    return NextResponse.json({ error: 'Le rapport n\'est pas généré pour cette intervention.' }, { status: 400 })
  }
  const seo = interv.seo_json
  if (!seo || Object.keys(seo).length === 0) {
    return NextResponse.json({ error: 'Le bloc SEO n\'est pas généré pour cette intervention.' }, { status: 400 })
  }
  const photosUrls: string[] = Array.isArray(interv.photos_urls) ? interv.photos_urls : []
  if (photosUrls.length === 0) {
    return NextResponse.json({ error: 'Aucune photo — au moins une est requise pour publier.' }, { status: 400 })
  }

  // Client : on remonte aussi l'adresse pour pouvoir basculer sur la fiche
  // quand l'intervention n'a pas d'adresse chantier (cas fréquent quand le
  // chantier est chez le client).
  let clientNom = ''
  let clientEmail = ''
  let clientAdresse: string | null = null
  let clientVille: string | null = null
  let clientCp: string | null = null
  if (interv.client_id) {
    const { data: c } = await sb
      .from('clients')
      .select('nom, email, adresse, ville, code_postal')
      .eq('id', interv.client_id)
      .maybeSingle()
    clientNom = c?.nom || ''
    clientEmail = c?.email || ''
    clientAdresse = c?.adresse || null
    clientVille = c?.ville || null
    clientCp = c?.code_postal || null
  }

  // Technicien : Django LTDB exige le champ technicien_name NOT NULL en base
  // (commit Django a904cfb). Sans ça, le serializer accepte sans valeur et
  // create() écrit null → IntegrityError 500. Fallback vide si pas de tech.
  let technicienNom = ''
  if (interv.technicien_id) {
    const { data: t } = await sb
      .from('techniciens')
      .select('nom')
      .eq('id', interv.technicien_id)
      .maybeSingle()
    technicienNom = t?.nom || ''
  }

  // Localisation effective (fallback sur la fiche client quand l'intervention
  // n'a pas de chantier renseigné) + base de nommage SEO des photos :
  // « <service>-<ville> » → ex. debouchage-wc-toulon.
  const ville = interv.ville || clientVille || ''
  const codePostal = interv.code_postal || clientCp || ''
  const adresse = interv.adresse_chantier || clientAdresse || ''
  const slugify = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[àâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const nomBase =
    [slugify(interv.type_intervention || 'intervention'), slugify(ville)]
      .filter(Boolean)
      .join('-') || 'realisation'

  // Récupère les photos depuis Storage en passant par le endpoint de transformation
  // Supabase pour les compresser. Sans ça, 2 photos iPhone ~1MB chacune dépassent
  // la limite de taille de body côté Django LTDB (~2MB) → HTTP 500 silencieux
  // sur l'endpoint /api/gallery/publish/. width=1280 + quality=70 ramène chaque
  // image à ~300-400KB.
  const toRenderUrl = (url: string) => {
    // /storage/v1/object/public/<bucket>/<path> → /storage/v1/render/image/public/<bucket>/<path>
    const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const sep = transformed.includes('?') ? '&' : '?'
    return `${transformed}${sep}width=1280&quality=70`
  }

  const photoBlobs = await Promise.all(
    photosUrls.map(async (url, i) => {
      try {
        const r = await fetch(toRenderUrl(url))
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const blob = await r.blob()
        return { blob, filename: `${nomBase}-${i + 1}.jpg`, legende: interv.photos_legendes?.[i] || `Photo ${i + 1}` }
      } catch (e) {
        console.error('[publish/from-intervention] photo fetch', url, e)
        return null
      }
    })
  )
  const validPhotos = photoBlobs.filter((p): p is NonNullable<typeof p> => p !== null)
  if (validPhotos.length === 0) {
    return NextResponse.json({ error: 'Aucune photo téléchargeable depuis Storage.' }, { status: 502 })
  }

  // Construit le HTML de contenu identique à /nouveau (resume + contenu + galerie + FAQ).
  const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const galleryHtml = validPhotos.length > 1
    ? `<section class="content-block gallery-block"><h2>Photos de l'intervention</h2><p>Ces photos documentent les étapes clés sur site (avant, pendant, après).</p><div class="photo-grid">${validPhotos.map((p, i) => {
        const legendePropre = /^photo \d+$/i.test(p.legende) ? '' : p.legende
        const alt = `${interv.type_intervention || 'Intervention'} à ${ville}${legendePropre ? ` — ${legendePropre}` : ''}`
        return `<figure class="photo-card"><img src="{PHOTO_${i + 1}_URL}" alt="${escapeHtml(alt)}" loading="lazy"><figcaption>${escapeHtml(p.legende)}</figcaption></figure>`
      }).join('')}</div></section>`
    : ''
  const faqHtml = Array.isArray(seo.faq) && seo.faq.length > 0
    ? `<section class="content-block faq-block"><h2>Questions fréquentes</h2>${seo.faq.map((f: { question?: string; reponse?: string }) => `<details class="faq-item"><summary>${escapeHtml(f?.question || '')}</summary><div class="faq-answer"><p>${escapeHtml(f?.reponse || '')}</p></div></details>`).join('')}</section>`
    : ''
  const resumeHtml = seo.resume_rich_snippet
    ? `<section class="content-block resume-block"><h2>Résumé de l'intervention</h2><p>${escapeHtml(seo.resume_rich_snippet)}</p></section>`
    : ''
  // CSS embed désactivé : Django renvoie HTTP 500 quand le content commence
  // par un <style> (probablement le sanitizer/parser HTML côté backend).
  // Tant qu'on n'a pas trouvé une voie compatible, on s'en passe — Django
  // utilise son propre template pour le rendu, FAQ comprise (intégrée dans
  // le HTML via faqHtml ci-dessus).
  void REALISATION_PAGE_STYLE
  const contentWithContainers = `${resumeHtml}${seo.contenu_principal || ''}${galleryHtml}${faqHtml}`

  const dateIntervention = interv.date_realisee || interv.date_prevue || new Date().toISOString().slice(0, 10)

  // Tronque les champs courts pour respecter les CharField Django.
  // title = CharField(max_length=100) côté Django → DeepSeek génère parfois
  // 108+ chars et le serveur renvoyait HTTP 500 silencieusement. On garde
  // 95 chars + une marge de sécurité. meta_description = max ~200, on garde 195.
  const truncate = (s: string, max: number) => {
    if (s.length <= max) return s
    return s.slice(0, max - 3).trimEnd() + '...'
  }
  const rawTitle = seo.titre_h1 || `${interv.type_intervention || 'Intervention'} à ${ville}`
  const rawDesc = seo.meta_description || ''

  // Construit le FormData attendu par /api/gallery/publish/ Django.
  const fd = new FormData()
  fd.append('title', truncate(rawTitle, 95))
  fd.append('slug', seo.slug || '')
  fd.append('service_type', interv.type_intervention || '')
  fd.append('location', ville)
  fd.append('intervention_city', ville)
  fd.append('postal_code', codePostal)
  fd.append('intervention_date', dateIntervention)
  fd.append('description', truncate(rawDesc, 195))
  fd.append('meta_keywords', Array.isArray(seo.meta_keywords) ? seo.meta_keywords.join(', ') : '')
  fd.append('content', contentWithContainers)
  fd.append('faq_json', JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (Array.isArray(seo.faq) ? seo.faq : []).map((f: { question?: string; reponse?: string }) => ({
      '@type': 'Question', name: f?.question || '',
      acceptedAnswer: { '@type': 'Answer', text: f?.reponse || '' },
    })),
  }))
  fd.append('jsonld', JSON.stringify(seo.jsonld || {}))
  fd.append('related_services_json', JSON.stringify(seo.related_services || []))
  fd.append('is_published', 'true')
  fd.append('transcription', interv.transcription || '')
  fd.append('rapport_json', JSON.stringify(interv.rapport_json))
  fd.append('seo_json', JSON.stringify(seo))
  fd.append('client_nom', clientNom)
  fd.append('client_email', clientEmail)
  fd.append('client_adresse', `${adresse} ${codePostal} ${ville}`.trim())
  fd.append('intervention_id', interventionId)
  fd.append('technicien_name', technicienNom)
  // Wrap les Blob en File explicite : certains parseurs multipart (Django
  // notamment) discriminent en fonction de l'objet, et un Blob "nu" peut
  // tomber dans un code path différent qui finit en 500 silencieux.
  const toFile = (b: { blob: Blob; filename: string }) =>
    new File([b.blob], b.filename, { type: b.blob.type || 'image/jpeg' })
  fd.append('before_image', toFile(validPhotos[0]))
  fd.append('after_image', toFile(validPhotos[1] || validPhotos[0]))
  validPhotos.slice(2).forEach((p, i) => fd.append(`extra_image_${i}`, toFile(p)))

  // Métadonnées photos structurées — permet à Django de renommer chaque
  // fichier (SEO : activité + ville) et d'écrire des alt / ImageObject précis,
  // au lieu de déduire depuis le seul nom de fichier multipart.
  fd.append('photos_nom_base', nomBase)
  fd.append(
    'photos_json',
    JSON.stringify(
      validPhotos.map((p, i) => ({
        field: i === 0 ? 'before_image' : i === 1 ? 'after_image' : `extra_image_${i - 2}`,
        ordre: i,
        filename: p.filename,
        legende: p.legende,
      })),
    ),
  )

  // Forward au Django.
  let djResp: Response
  try {
    djResp = await fetch(`${ltdbUrl}/api/gallery/publish/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
  } catch (e) {
    return NextResponse.json({ error: `Appel Django échoué : ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }
  const txt = await djResp.text()
  let data: unknown = null
  try { data = JSON.parse(txt) } catch { /* HTML d'erreur */ }
  if (!djResp.ok) {
    // Log verbeux pour diagnostiquer un rejet Django : taille du content,
    // types des fichiers, liste des champs envoyés.
    const fieldSizes: Record<string, number | string> = {}
    fd.forEach((v, k) => {
      if (typeof v === 'string') fieldSizes[k] = v.length
      else if (v instanceof Blob) fieldSizes[k] = `Blob(${v.size}b, ${v.type || 'no-type'})`
    })
    console.error('[publish/from-intervention] Django error', {
      status: djResp.status,
      contentType: djResp.headers.get('content-type'),
      bodyFull: txt,
      fieldSizes,
      url: `${ltdbUrl}/api/gallery/publish/`,
    })
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: string }).error) : `HTTP ${djResp.status}`
    return NextResponse.json({ error: `LTDB : ${msg}`, bodyPreview: txt.slice(0, 800), fieldSizes }, { status: djResp.status })
  }

  const slug = (data && typeof data === 'object' && 'slug' in data ? String((data as { slug: string }).slug) : '') || seo.slug || ''
  // Persiste le slug sur l'intervention (best-effort).
  if (slug) {
    await sb.from('interventions').update({ publie_slug: slug }).eq('id', interventionId)
  }

  return NextResponse.json({ ok: true, slug, data })
}
