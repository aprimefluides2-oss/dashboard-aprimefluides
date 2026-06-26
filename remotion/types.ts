import { staticFile } from "remotion"

export type VideoFormat = "vertical" | "horizontal" | "square"

export type PhotoItem = {
  url: string
  caption?: string
}

export type InterventionVideoProps = {
  format: VideoFormat
  photos: PhotoItem[]
  clientNom?: string
  ville?: string
  typeIntervention?: string
  dateRealisee?: string
  enableMusic?: boolean
  musicVolume?: number
}

export const FORMAT_DIMENSIONS: Record<VideoFormat, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
}

export const FPS = 30

export const TIMINGS = {
  introFrames: 90,
  photoFrames: 120,
  photoCrossfadeFrames: 18,
  outroFrames: 180,
} as const

export const BRAND = {
  navy: "#0F1E3D",
  navyLight: "#1E3A5F",
  red: "#D63A3A",
  white: "#FFFFFF",
  yellow: "#FFC83D",
  slogan: "Débouchage Île-de-France 24h/24 dès 99€ TTC",
  tel: "01 39 47 17 09",
  site: "www.aprime-fluides.fr",
  zone: "Toute l'Île-de-France",
  logoUrl: staticFile("logo-1024.png"),
  logoSmallUrl: staticFile("logo-512.png"),
  camionUrl: staticFile("hero.webp"),
  musicUrl: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
} as const
