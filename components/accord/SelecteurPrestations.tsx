'use client'
import type { Tarif } from "@/lib/supabase"
import type { LigneDraft } from "@/lib/accord/calcul-devis"
import { totalLigne } from "@/lib/accord/calcul-devis"
import { fmtEUR } from "@/lib/format"

/** Ligne de devis avec une clé stable pour le rendu React. */
export type LigneState = LigneDraft & { key: string }

type Props = {
  tarifs: Tarif[]
  lignes: LigneState[]
  onChange: (lignes: LigneState[]) => void
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `l-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Sélecteur de prestations : catalogue lu depuis la table `tarifs` (R2 — aucun
 * prix en dur) et lignes du devis avec quantité + marquage urgent/non-urgent.
 */
export default function SelecteurPrestations({ tarifs, lignes, onChange }: Props) {
  function addTarif(t: Tarif) {
    onChange([
      ...lignes,
      {
        key: newKey(),
        tarif_type: t.type,
        label: t.label,
        prix_unitaire: t.prix_min, // prix gelé (prix_min = prix_max pour un prix fixe)
        unite: t.unite,
        quantite: 1,
        urgent: true,
      },
    ])
  }

  function updateLigne(key: string, patch: Partial<LigneState>) {
    onChange(lignes.map(l => (l.key === key ? { ...l, ...patch } : l)))
  }

  function removeLigne(key: string) {
    onChange(lignes.filter(l => l.key !== key))
  }

  return (
    <div className="space-y-3">
      {/* Catalogue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {tarifs.length === 0 && (
          <p className="text-sm text-slate-400 italic">
            Aucun tarif disponible — vérifie la table <code className="font-mono">tarifs</code>.
          </p>
        )}
        {tarifs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => addTarif(t)}
            className="flex items-center justify-between gap-2 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl px-3 py-2.5 text-left transition"
          >
            <span className="font-semibold text-sm">+ {t.label}</span>
            <span className="text-xs font-bold whitespace-nowrap">
              {fmtEUR(t.prix_min)} / {t.unite}
            </span>
          </button>
        ))}
      </div>

      {/* Lignes ajoutées */}
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-1">
          Sélectionne les prestations réalisées ci-dessus.
        </p>
      ) : (
        <ul className="space-y-2">
          {lignes.map(l => (
            <li key={l.key} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm text-slate-800">{l.label}</div>
                <button
                  type="button"
                  onClick={() => removeLigne(l.key)}
                  className="text-slate-400 hover:text-red-600 text-xl leading-none shrink-0"
                  aria-label={`Retirer ${l.label}`}
                >
                  ×
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-500">Qté</span>
                  <input
                    type="number"
                    min="0"
                    step={l.unite === 'metre' ? '0.5' : '1'}
                    value={l.quantite}
                    onChange={e => updateLigne(l.key, { quantite: Number(e.target.value) || 0 })}
                    className="w-20 border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-2 py-1.5 text-sm"
                  />
                  <span className="text-slate-400 text-xs">{l.unite}</span>
                </label>
                <button
                  type="button"
                  onClick={() => updateLigne(l.key, { urgent: !l.urgent })}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border-2 transition ${
                    l.urgent
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                  title="Travail strictement nécessaire pour répondre à l'urgence ?"
                >
                  {l.urgent ? '🚨 Urgent' : 'Non urgent'}
                </button>
                <span className="ml-auto font-bold text-sm text-slate-800">
                  {fmtEUR(totalLigne(l))}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                {fmtEUR(l.prix_unitaire)} / {l.unite}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
