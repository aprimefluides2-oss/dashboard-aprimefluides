'use client'
import Link from "next/link"

export default function RapportTabs({ current }: { current: 'rediger' | 'liste' }) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1">
        <Link
          href="/nouveau"
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${current === 'rediger' ? 'border-[#0e2a52] text-[#0e2a52]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >📝 Rédiger</Link>
        <Link
          href="/rapports"
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${current === 'liste' ? 'border-[#0e2a52] text-[#0e2a52]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >📚 Tous les rapports</Link>
      </div>
    </div>
  )
}
