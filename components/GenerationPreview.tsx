'use client'

interface Rapport {
  diagnostic?: string
  travaux_realises?: string
  recommandations?: string
  commentaire_technicien?: string
  [k: string]: any
}

interface SEO {
  titre_h1?: string
  meta_description?: string
  contenu_principal?: string
  faq?: { question: string; reponse: string }[]
  [k: string]: any
}

interface Props {
  rapport: Rapport
  seo: SEO
  onRapportChange: (r: Rapport) => void
  onSeoChange: (s: SEO) => void
}

export default function GenerationPreview({ rapport, seo, onRapportChange, onSeoChange }: Props) {
  const titreH1 = seo?.titre_h1 ?? ''
  const metaDesc = seo?.meta_description ?? ''
  const contenu = seo?.contenu_principal ?? ''
  const faq = Array.isArray(seo?.faq) ? seo!.faq! : []

  function updateRapport(field: keyof Rapport, value: string) {
    onRapportChange({ ...rapport, [field]: value })
  }

  function updateSeo(field: keyof SEO, value: string) {
    onSeoChange({ ...seo, [field]: value })
  }

  function updateFaq(index: number, field: 'question' | 'reponse', value: string) {
    const newFaq = [...faq]
    newFaq[index] = { ...newFaq[index], [field]: value }
    onSeoChange({ ...seo, faq: newFaq })
  }

  const fieldClass = "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  const labelClass = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-bold text-gray-800 mb-3 text-lg">Rapport technique</h3>
        <div className="space-y-3">
          {(['diagnostic', 'travaux_realises', 'recommandations', 'commentaire_technicien'] as const).map(field => (
            <div key={field}>
              <label className={labelClass}>{field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
              <textarea
                value={rapport?.[field] ?? ''}
                onChange={e => updateRapport(field, e.target.value)}
                rows={3}
                className={fieldClass}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-bold text-gray-800 mb-3 text-lg">Contenu SEO</h3>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Titre H1 ({titreH1.length}/70 car.)</label>
            <input
              value={titreH1}
              onChange={e => updateSeo('titre_h1', e.target.value)}
              maxLength={70}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Meta description ({metaDesc.length}/155 car.)</label>
            <textarea
              value={metaDesc}
              onChange={e => updateSeo('meta_description', e.target.value)}
              maxLength={155}
              rows={2}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Contenu principal (HTML)</label>
            <textarea
              value={contenu}
              onChange={e => updateSeo('contenu_principal', e.target.value)}
              rows={6}
              className={`${fieldClass} font-mono text-xs`}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-bold text-gray-800 mb-3 text-lg">FAQ ({faq.length} questions)</h3>
        <div className="space-y-4">
          {faq.map((item, i) => (
            <div key={i} className="border rounded p-3 bg-gray-50">
              <div className="mb-2">
                <label className={labelClass}>Question {i + 1}</label>
                <input
                  value={item?.question ?? ''}
                  onChange={e => updateFaq(i, 'question', e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Réponse</label>
                <textarea
                  value={item?.reponse ?? ''}
                  onChange={e => updateFaq(i, 'reponse', e.target.value)}
                  rows={2}
                  className={fieldClass}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
