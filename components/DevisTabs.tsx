'use client'
import Link from "next/link"

export default function DevisTabs({ current }: { current: 'nouveau' | 'liste' }) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1">
        <Link
          href="/devis"
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${current === 'nouveau' ? 'border-[#0e2a52] text-[#0e2a52]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >📋 Nouveau devis</Link>
        <Link
          href="/devis/tous"
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${current === 'liste' ? 'border-[#0e2a52] text-[#0e2a52]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >📚 Tous les devis</Link>
      </div>
    </div>
  )
}
