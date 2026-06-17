'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ComponentType } from "react"
import {
  HomeIcon, CalendarIcon, DocumentIcon, CameraIcon, ClipboardIcon, ReceiptIcon,
  CheckBadgeIcon, ArchiveIcon, ChartBarIcon, BriefcaseIcon, EnvelopeIcon,
} from "@/components/Icons"

type Tab = {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
}

const TABS: Tab[] = [
  { href: '/',             label: 'Accueil',      Icon: HomeIcon },
  { href: '/planning',     label: 'Planning',     Icon: CalendarIcon },
  { href: '/nouveau',      label: 'Rapport',      Icon: DocumentIcon },
  { href: '/inspection',   label: 'Caméra',       Icon: CameraIcon },
  { href: '/devis',        label: 'Devis',        Icon: ClipboardIcon },
  { href: '/facture',      label: 'Facturation',  Icon: ReceiptIcon },
  { href: '/attestation',  label: 'Attestation',  Icon: CheckBadgeIcon },
  { href: '/historique',   label: 'Historique',   Icon: ArchiveIcon },
  { href: '/statistiques', label: 'Statistiques', Icon: ChartBarIcon },
  { href: '/comptabilite', label: 'Comptabilité', Icon: BriefcaseIcon },
  { href: '/mail',         label: 'Mail',         Icon: EnvelopeIcon },
]

export default function AppTabs() {
  const pathname = usePathname() || ''
  const visibleTabs = TABS

  return (
    <nav className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
      <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-2xl mb-3 whitespace-nowrap min-w-max sm:min-w-0">
        {visibleTabs.map(t => {
          const active = t.href === '/'
            ? pathname === '/'
            : pathname.startsWith(t.href)
          const Icon = t.Icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-white text-[#0e2a52] shadow-sm ring-1 ring-black/5'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
