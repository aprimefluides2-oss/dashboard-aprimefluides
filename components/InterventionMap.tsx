'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'

// --- Fix icône Leaflet avec Next/Webpack ---------------------------------
// Next remplace les imports d'images statiques par des objets { src, width, height }
// au lieu de strings. Le check `typeof === 'string'` couvre les deux cas (test runners
// retournent un string brut, build Next renvoie un StaticImageData).
type StaticImg = string | { src: string }
const resolveSrc = (img: StaticImg): string =>
  typeof img === 'string' ? img : img.src

// Le prototype par défaut a un `_getIconUrl` qui interroge des chemins relatifs cassés
// par le bundling. On le supprime puis on force les URLs résolues par Next.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: resolveSrc(iconUrl as StaticImg),
  iconRetinaUrl: resolveSrc(iconRetinaUrl as StaticImg),
  shadowUrl: resolveSrc(iconShadow as StaticImg),
})
// -------------------------------------------------------------------------

type Props = {
  adresse?: string
  ville?: string
  codePostal?: string
  showCadastre?: boolean
  className?: string
  zoom?: number
}

type LatLng = [number, number]

// Centre de Toulon, fallback si géocodage échoue
const TOULON_CENTER: LatLng = [43.1242, 5.928]

// Cache module-level : évite de re-géocoder la même adresse en navigant entre fiches.
const geocodeCache = new Map<string, LatLng | null>()

function buildQuery(adresse?: string, codePostal?: string, ville?: string): string {
  const parts: string[] = []
  const cpVille = [codePostal, ville].filter((v) => v && v.trim()).join(' ').trim()
  if (adresse && adresse.trim()) parts.push(adresse.trim())
  if (cpVille) parts.push(cpVille)
  parts.push('France')
  return parts.join(', ')
}

async function geocode(query: string): Promise<LatLng | null> {
  if (geocodeCache.has(query)) return geocodeCache.get(query) ?? null
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query,
  )}&limit=1&countrycodes=fr`
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'fr' },
    })
    if (!res.ok) {
      geocodeCache.set(query, null)
      return null
    }
    const data: unknown = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      geocodeCache.set(query, null)
      return null
    }
    const first = data[0] as { lat?: string; lon?: string }
    if (!first.lat || !first.lon) {
      geocodeCache.set(query, null)
      return null
    }
    const lat = parseFloat(first.lat)
    const lon = parseFloat(first.lon)
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      geocodeCache.set(query, null)
      return null
    }
    const coords: LatLng = [lat, lon]
    geocodeCache.set(query, coords)
    return coords
  } catch {
    geocodeCache.set(query, null)
    return null
  }
}

// Petit helper pour recentrer la carte si les coords changent après mount
// (utile quand le géocodage retourne après le premier render).
function MapRecenter({ center, zoom }: { center: LatLng; zoom: number }): null {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center, zoom])
  return null
}

export default function InterventionMap(props: Props): JSX.Element {
  const {
    adresse,
    ville,
    codePostal,
    showCadastre = false,
    className = 'h-72 rounded-xl overflow-hidden',
    zoom = 17,
  } = props

  const hasAddress = Boolean((adresse && adresse.trim()) || (ville && ville.trim()))

  const fullAddress = useMemo(
    () => buildQuery(adresse, codePostal, ville),
    [adresse, codePostal, ville],
  )

  const [coords, setCoords] = useState<LatLng | null>(null)
  const [loading, setLoading] = useState<boolean>(hasAddress)
  const [geocodingFailed, setGeocodingFailed] = useState<boolean>(false)
  const [cadastreOn, setCadastreOn] = useState<boolean>(showCadastre)

  // Resync du toggle si la prop change
  useEffect(() => {
    setCadastreOn(showCadastre)
  }, [showCadastre])

  useEffect(() => {
    if (!hasAddress) {
      setCoords(null)
      setLoading(false)
      setGeocodingFailed(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setGeocodingFailed(false)
    geocode(fullAddress).then((result) => {
      if (cancelled) return
      if (result) {
        setCoords(result)
        setGeocodingFailed(false)
      } else {
        setCoords(TOULON_CENTER)
        setGeocodingFailed(true)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fullAddress, hasAddress])

  // Garde-fou SSR : si jamais quelqu'un oublie le dynamic import { ssr: false },
  // on évite tout crash côté serveur. Placé APRÈS les hooks pour respecter les
  // Rules of Hooks (l'ordre des hooks doit être stable entre renders).
  if (typeof window === 'undefined') return <></>


  // État vide : pas d'adresse renseignée
  if (!hasAddress) {
    return (
      <div
        className={`relative bg-gray-50 border border-gray-200 flex items-center justify-center ${className}`}
      >
        <div className="flex flex-col items-center gap-2 text-gray-400 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-10 h-10"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
            />
          </svg>
          <span>Aucune adresse renseignée</span>
        </div>
      </div>
    )
  }

  // Pendant le géocodage : placeholder gris + spinner
  if (loading || !coords) {
    return (
      <div
        className={`relative bg-gray-100 flex items-center justify-center ${className}`}
      >
        <div className="flex flex-col items-center gap-2 text-gray-500 text-sm">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span>Localisation en cours…</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={coords}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {cadastreOn && (
          // Couche cadastre IGN (Géoportail) — service public, gratuit, libre.
          // En cas de 404/erreur, Leaflet garde le fond carte (pas de crash dur),
          // mais on logge un warn via eventHandlers.
          <TileLayer
            attribution='Cadastre &copy; <a href="https://www.geoportail.gouv.fr/">IGN</a>'
            url="https://data.geopf.fr/wmts?service=WMTS&request=GetTile&version=1.0.0&layer=CADASTRALPARCELS.PARCELS&style=PCI%20vecteur&format=image%2Fpng&tileMatrixSet=PM&tileMatrix={z}&tileRow={y}&tileCol={x}"
            opacity={0.6}
            maxZoom={19}
            eventHandlers={{
              tileerror: () => {
                console.warn(
                  '[InterventionMap] Couche cadastre IGN inaccessible (tile error) — désactivation.',
                )
                setCadastreOn(false)
              },
            }}
          />
        )}

        <Marker position={coords}>
          <Popup>{fullAddress}</Popup>
        </Marker>

        <MapRecenter center={coords} zoom={zoom} />
      </MapContainer>

      {/* Toggle cadastre : bouton flottant haut-droite. Affiché uniquement quand
          la prop showCadastre est activée (sinon on cache complètement). */}
      {showCadastre && (
        <button
          type="button"
          onClick={() => setCadastreOn((v) => !v)}
          className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur-sm hover:bg-white text-gray-800 text-xs font-medium px-3 py-1.5 rounded-lg shadow-md border border-gray-200 transition-colors flex items-center gap-1.5"
          aria-pressed={cadastreOn}
          aria-label="Basculer la couche cadastre"
        >
          <span>📐 Cadastre</span>
          <span className={cadastreOn ? 'text-green-600' : 'text-gray-400'}>
            {cadastreOn ? '✓' : '✗'}
          </span>
        </button>
      )}

      {geocodingFailed && (
        <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-amber-50/95 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-md shadow-sm">
          Adresse non géolocalisée — ajuste manuellement si besoin.
        </div>
      )}
    </div>
  )
}
