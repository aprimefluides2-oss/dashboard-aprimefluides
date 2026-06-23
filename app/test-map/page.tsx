'use client'

import dynamic from 'next/dynamic'

// Leaflet ne peut pas être SSR : import dynamique avec ssr: false.
const InterventionMap = dynamic(() => import('@/components/InterventionMap'), {
  ssr: false,
})

export default function TestMapPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Test InterventionMap
      </h1>

      <div className="space-y-8 max-w-3xl">
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Bezons — 1 rue Jean Carasso (avec cadastre)
          </h2>
          <div style={{ width: 600, height: 400 }}>
            <InterventionMap
              adresse="1 rue Jean Carasso"
              ville="Bezons"
              codePostal="95870"
              showCadastre
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Sans adresse (état vide)
          </h2>
          <div style={{ width: 600, height: 200 }}>
            <InterventionMap />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Adresse partielle (ville seule)
          </h2>
          <div style={{ width: 600, height: 300 }}>
            <InterventionMap ville="Argenteuil" codePostal="95100" zoom={14} />
          </div>
        </section>
      </div>
    </main>
  )
}
