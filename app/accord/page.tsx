import Link from "next/link"
import { getSupabaseOrNull, type AccordIntervention, type AccordStatut } from "@/lib/supabase"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import StatutSyncBadge from "@/components/accord/StatutSyncBadge"

// Outil d'admin : la liste doit toujours être fraîche (pas de cache).
export const dynamic = 'force-dynamic'

const STATUT_LABEL: Record<AccordStatut, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_SMS: 'En attente SMS',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
}

const STATUT_BADGE: Record<AccordStatut, string> = {
  BROUILLON: 'bg-slate-100 text-slate-600',
  EN_ATTENTE_SMS: 'bg-amber-100 text-amber-700',
  VALIDE: 'bg-emerald-100 text-emerald-700',
  REFUSE: 'bg-red-100 text-red-700',
  ANNULE: 'bg-slate-200 text-slate-500',
}

type LoadResult = {
  accords: AccordIntervention[]
  error: string | null
  /** true si la table n'existe pas encore (migration 005 non exécutée). */
  needsMigration: boolean
}

async function loadAccords(): Promise<LoadResult> {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return { accords: [], error: 'Supabase non configuré.', needsMigration: false }
  }
  const { data, error } = await sb
    .from('accords_intervention')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    // 42P01 = relation inexistante · PGRST205 = table absente du cache PostgREST
    const needsMigration =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      /accords_intervention/.test(error.message)
    return { accords: [], error: error.message, needsMigration }
  }
  return { accords: (data as AccordIntervention[]) || [], error: null, needsMigration: false }
}

export default async function AccordHubPage() {
  const { accords, error, needsMigration } = await loadAccords()

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-black text-lg sm:text-xl leading-tight">🤝 Accord d&apos;intervention</h1>
            <div className="text-[11px] opacity-70">Devis + accord signé avant travaux</div>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition shrink-0"
          >
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        <StatutSyncBadge />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
            {accords.length > 0 ? `${accords.length} accord${accords.length > 1 ? 's' : ''}` : 'Aucun accord'}
          </div>
          <Link
            href="/accord/nouveau"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition"
          >
            + Nouvel accord
          </Link>
        </div>

        {needsMigration && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm">
            <div className="font-bold mb-1">⚠ Base de données non initialisée</div>
            Exécute la migration <code className="font-mono">supabase/migrations/005_accord_intervention.sql</code>{' '}
            dans Supabase (SQL Editor) pour activer le module.
          </div>
        )}

        {error && !needsMigration && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            Erreur de chargement : {error}
          </div>
        )}

        {!error && accords.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-3">🤝</div>
            <div className="font-bold text-slate-800">Aucun accord pour le moment</div>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Crée un accord à l&apos;arrivée chez le client : devis détaillé, demande expresse
              d&apos;intervention urgente et information sur le droit de rétractation, validé sur place.
            </p>
            <Link
              href="/accord/nouveau"
              className="inline-block mt-5 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-sm transition"
            >
              + Créer le premier accord
            </Link>
          </div>
        )}

        {accords.length > 0 && (
          <ul className="space-y-2">
            {accords.map(a => (
              <li key={a.id}>
                <Link
                  href={`/accord/${a.id}`}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 truncate">
                        {a.client_nom || 'Client sans nom'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_BADGE[a.statut]}`}>
                        {STATUT_LABEL[a.statut]}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {a.reference || a.id.slice(0, 8)}
                      {a.client_ville ? ` · ${a.client_ville}` : ''}
                      {` · ${fmtDateFR(a.created_at)}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-slate-800">{fmtEUR(a.total_ttc)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
