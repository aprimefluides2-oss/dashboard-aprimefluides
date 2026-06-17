import Link from "next/link"
import { listGmbPosts, type GmbPost } from "@/lib/gmb"
import { fmtDateFR } from "@/lib/format"

// Outil d'admin : liste toujours fraîche.
export const dynamic = "force-dynamic"

const STATE_LABEL: Record<string, string> = {
  LIVE: "En ligne",
  PROCESSING: "En traitement",
  REJECTED: "Rejeté",
}
const STATE_BADGE: Record<string, string> = {
  LIVE: "bg-emerald-100 text-emerald-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
}

async function load(): Promise<{ posts: GmbPost[]; error: string | null }> {
  try {
    return { posts: await listGmbPosts(), error: null }
  } catch (e) {
    return { posts: [], error: e instanceof Error ? e.message : "Erreur GMB" }
  }
}

export default async function PostGmbPage() {
  const { posts, error } = await load()

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-black text-lg sm:text-xl leading-tight">📍 Posts Google Business</h1>
            <div className="text-[11px] opacity-70">Publications sur la fiche d&apos;établissement</div>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition shrink-0"
          >
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {!error && posts.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <div className="text-5xl mb-2">📍</div>
            <div className="font-bold text-slate-800">Aucun post pour le moment</div>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Publie un post depuis une fiche intervention → bouton « Publier sur Google Business ».
            </p>
          </div>
        )}

        {posts.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              {posts.length} post{posts.length > 1 ? "s" : ""}
            </div>
            <ul className="space-y-2">
              {posts.map(p => (
                <li
                  key={p.name}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex gap-4"
                >
                  {p.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photoUrl}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover shrink-0 bg-slate-100"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          STATE_BADGE[p.state] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {STATE_LABEL[p.state] || p.state || "—"}
                      </span>
                      <span className="text-[11px] text-slate-400">{fmtDateFR(p.createTime)}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 line-clamp-3 whitespace-pre-line">
                      {p.summary}
                    </p>
                    {p.searchUrl && (
                      <a
                        href={p.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900 mt-1 inline-block"
                      >
                        Voir sur Google →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  )
}
