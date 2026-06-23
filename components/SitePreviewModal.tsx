'use client'
import { useMemo } from "react"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

type Props = {
  open: boolean
  onClose: () => void
  seo: any
  ville: string
  photos: { dataUrl: string; legende: string }[]
}

export default function SitePreviewModal({ open, onClose, seo, ville, photos }: Props) {
  const html = useMemo(() => {
    if (!seo) return ''
    const escape = (s: string) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    const gallery = photos.length > 0
      ? `<section class="content-block gallery-block"><h2>Photos de l'intervention</h2><div class="photo-grid">${photos.map((p, i) => `<figure class="photo-card"><img src="${p.dataUrl}" alt="${escape(p.legende || `Photo ${i + 1}`)}"/><figcaption>${escape(p.legende || `Photo ${i + 1}`)}</figcaption></figure>`).join('')}</div></section>`
      : ''
    // Inject photo URLs into {PHOTO_N_URL} placeholders if present
    let content = seo.contenu_principal || ''
    photos.forEach((p, i) => {
      content = content.replaceAll(`{PHOTO_${i + 1}_URL}`, p.dataUrl)
    })
    const resume = seo.resume_rich_snippet
      ? `<section class="content-block resume-block"><h2>Résumé de l'intervention</h2><p>${escape(seo.resume_rich_snippet)}</p></section>`
      : ''
    // FAQ rendue comme à la publication : intégrée au contenu, classes faq-block/faq-item.
    const faq = Array.isArray(seo.faq) && seo.faq.length > 0
      ? `<section class="content-block faq-block"><h2>Questions fréquentes</h2>${seo.faq.map((f: any) => `<details class="faq-item"><summary>${escape(f.question)}</summary><div class="faq-answer"><p>${escape(f.reponse)}</p></div></details>`).join('')}</section>`
      : ''
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escape(seo.titre_h1 || '')}</title>
<style>
  :root { --navy:#0e2a52; --navy-light:#1a3a6b; --orange:#e67e22; --ink:#1e293b; --muted:#5b6678; --border:#e1e6ef; --bg:#f4f6fa; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.65; font-size: 16px; }
  .page { max-width: 820px; margin: 0 auto; padding: 0 16px 60px; }
  .hero { background: linear-gradient(135deg, var(--navy), var(--navy-light)); color: #fff; padding: 40px 32px; border-radius: 0 0 16px 16px; margin-bottom: 28px; }
  .hero .eyebrow { font-size: 13px; opacity: .8; text-transform: uppercase; letter-spacing: 1px; }
  .hero h1 { margin: 8px 0 14px; font-size: 28px; line-height: 1.3; }
  .hero .meta { font-size: 14px; opacity: .85; }
  .meta-desc { font-size: 14px; color: var(--muted); font-style: italic; padding: 12px 16px; background: #fff; border: 1px solid var(--border); border-left: 3px solid var(--orange); border-radius: 8px; margin-bottom: 22px; }
  .content-block { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 26px 28px; margin-bottom: 22px; box-shadow: 0 1px 3px rgba(14,42,82,.04); }
  .content-block h2 { margin: 0 0 16px; font-size: 21px; color: var(--navy); padding-bottom: 10px; border-bottom: 3px solid var(--orange); display: inline-block; }
  .content-block h3 { margin: 20px 0 8px; font-size: 17px; color: var(--navy-light); }
  .content-block p { margin: 10px 0; }
  .content-block a { color: var(--orange); font-weight: 600; text-decoration: none; border-bottom: 1px solid transparent; }
  .content-block a:hover { border-bottom-color: var(--orange); }
  .resume-block { background: #fff7ef; border: 1px solid #f3d9bd; border-left: 5px solid var(--orange); }
  .resume-block h2 { border-bottom-color: #f3d9bd; }
  .info-box { background: #e9f2fb; border-left: 4px solid #2980b9; border-radius: 8px; padding: 16px 20px; margin: 18px 0; }
  .info-box strong { color: #1f5f8b; }
  .checklist-box { background: #e9f6ee; border-left: 4px solid #1e8449; border-radius: 8px; padding: 16px 20px; margin: 18px 0; }
  .checklist-box ul { margin: 6px 0; padding-left: 22px; }
  .checklist-box li { margin: 4px 0; }
  .photo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 14px; }
  .photo-card { margin: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: #fff; }
  .photo-card img { width: 100%; height: 180px; object-fit: cover; display: block; }
  .photo-card figcaption { padding: 8px 12px; font-size: 13px; color: var(--muted); background: #fafbfc; }
  .faq-block { padding-bottom: 14px; }
  .faq-item { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; overflow: hidden; background: #fafbfc; }
  .faq-item summary { cursor: pointer; padding: 15px 44px 15px 20px; font-weight: 700; color: var(--navy); list-style: none; position: relative; }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary::after { content: "+"; position: absolute; right: 18px; top: 50%; transform: translateY(-50%); font-size: 22px; font-weight: 400; color: var(--orange); transition: transform .2s; }
  .faq-item[open] summary::after { transform: translateY(-50%) rotate(45deg); }
  .faq-item[open] summary { background: #fff; border-bottom: 1px solid var(--border); }
  .faq-answer { padding: 4px 20px 16px; color: var(--muted); }
  .faq-answer p { margin: 10px 0 0; }
  .contact-strip { background: var(--navy); color: #fff; border-radius: 12px; padding: 24px 28px; text-align: center; margin-top: 26px; }
  .contact-strip p { margin: 6px 0; }
  .contact-strip .tel { font-size: 22px; font-weight: 800; }
  footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; }
</style>
</head><body>
<div class="page">
  <header class="hero">
    <div class="eyebrow">Réalisation · ${escape(ville)}</div>
    <h1>${escape(seo.titre_h1 || '')}</h1>
    <div class="meta">Aprime fluides · ${escape(TEL_PRINCIPAL_FALLBACK)}</div>
  </header>
  ${seo.meta_description ? `<div class="meta-desc">${escape(seo.meta_description)}</div>` : ''}
  ${resume}
  ${content}
  ${gallery}
  ${faq}
  <div class="contact-strip">
    <p>Un problème de canalisation à ${escape(ville)} ou dans le Var ?</p>
    <p class="tel">${escape(TEL_PRINCIPAL_FALLBACK)}</p>
    <p style="opacity:.8;font-size:14px">Aprime fluides</p>
  </div>
  <footer>Aperçu — www.aprime-fluides.fr</footer>
</div>
</body></html>`
  }, [seo, ville, photos])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 py-3 border-b bg-slate-50">
          <h3 className="font-black text-[#0e2a52] text-lg">🌐 Aperçu page web</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center">✕</button>
        </div>
        <div className="flex-1 bg-slate-100">
          <iframe srcDoc={html} className="w-full h-full border-0" sandbox="allow-same-origin" title="Aperçu page site" />
        </div>
      </div>
    </div>
  )
}
