'use client'
import React from "react"
import { useRouter } from "next/navigation"
import type { RapportData } from "./RealisationPDF"
import { buildFactureFromRapport } from "@/lib/rapportToFacture"

export interface CreateFactureFromRapportSource {
  rapport: RapportData
  client_nom?: string | null
  client_email?: string | null
  client_adresse?: string | null
  client_code_postal?: string | null
  client_ville?: string | null
  adresse_chantier?: string | null
  type_intervention?: string | null
  date_intervention?: string | null
  reference?: string | null
}

export default function CreateFactureFromRapportButton({
  source,
  className,
  label,
  size = 'md',
  disabled,
  disabledReason,
}: {
  source: CreateFactureFromRapportSource
  className?: string
  label?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  disabledReason?: string
}) {
  const router = useRouter()

  const baseEnabled = size === 'sm'
    ? 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition'
    : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition'
  const baseDisabled = size === 'sm'
    ? 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-300 text-slate-500 text-xs font-bold cursor-not-allowed'
    : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-300 text-slate-500 font-bold text-sm cursor-not-allowed'

  const baseClass = className || (disabled ? baseDisabled : baseEnabled)

  function handleClick() {
    if (disabled) return
    if (typeof window === 'undefined') return
    const payload = buildFactureFromRapport(source)
    sessionStorage.setItem('ltdb_devis_to_facture', JSON.stringify(payload))
    router.push('/facture/nouvelle')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={baseClass}
      title={disabled ? (disabledReason || 'Une facture existe déjà pour ce rapport') : 'Créer une facture pré-remplie à partir de ce rapport'}
    >
      {disabled ? '✓' : '💶'} {label || (disabled ? 'Facture déjà créée' : 'Facturer le rapport')}
    </button>
  )
}
