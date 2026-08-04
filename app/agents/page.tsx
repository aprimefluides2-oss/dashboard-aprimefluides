import Link from "next/link"
import AppTabs from "@/components/AppTabs"
import { SECTEURS, labelSecteur, libelleAgentSecteur } from "@/lib/agents-departements"

export const metadata = {
  title: "Agents de secteur par département — Aprime fluides",
  description: "Libellé d'agent de secteur porté par les rapports, par département",
}

export default function AgentsPage() {
  const parAgence = SECTEURS.reduce<Record<string, typeof SECTEURS>>((acc, s) => {
    ;(acc[s.agence] ||= []).push(s)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <AppTabs />

        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0e2a52]">Agents de secteur</h1>
          <p className="mt-1 text-sm text-slate-500">
            Le code postal saisi sur un{' '}
            <Link href="/nouveau" className="font-semibold text-blue-600 hover:underline">nouveau rapport</Link>{' '}
            détermine l’agence et le libellé d’agent ci-dessous. Aucun nom d’intervenant n’apparaît :
            le rapport est signé par la signature enregistrée sur l’appareil.
          </p>
        </header>

        <div className="space-y-5">
          {Object.entries(parAgence).map(([agence, secteurs]) => (
            <section key={agence}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{agence}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {secteurs.map(s => (
                  <article key={s.code} className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0e2a52] text-sm font-black ring-1 ring-blue-200">
                        {s.code}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[#0e2a52] truncate">{labelSecteur(s)}</div>
                        <div className="text-xs text-slate-500 truncate">{libelleAgentSecteur(s)}</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Codes postaux {s.code}xxx
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Liste maintenue dans <code className="rounded bg-slate-100 px-1 py-0.5">lib/agents-departements.ts</code>.
          Hors de ces départements, le rapport porte simplement « Agent de secteur ».
          Les pages publiées sur le site parlent de « notre technicien ».
        </p>
      </div>
    </main>
  )
}
