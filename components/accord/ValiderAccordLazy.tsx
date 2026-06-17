'use client'
import dynamic from "next/dynamic"
import type { AccordIntervention, LigneDevis } from "@/lib/supabase"
import type { EmetteurInfo } from "@/components/accord/ApercuAccord"

/**
 * Wrapper client : charge ValiderAccord (et @react-pdf/renderer, requis pour
 * régénérer le PDF signé) dans un chunk séparé. Garde /accord/[id] légère.
 */
const ValiderAccord = dynamic(() => import("@/components/accord/ValiderAccord"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm text-slate-400">
      Chargement de la validation…
    </div>
  ),
})

type Props = {
  accord: AccordIntervention
  lignes: LigneDevis[]
  emetteur: EmetteurInfo
  telephone: string
}

export default function ValiderAccordLazy(props: Props) {
  return <ValiderAccord {...props} />
}
