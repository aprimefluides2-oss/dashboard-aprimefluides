import type { VideoFormat } from "../types"

export function scale(format: VideoFormat) {
  switch (format) {
    case "vertical":
      return { titleSize: 92, subtitleSize: 52, telSize: 112, captionSize: 46, logoSize: 320, padding: 96, safeBottom: 220 }
    case "horizontal":
      return { titleSize: 96, subtitleSize: 56, telSize: 168, captionSize: 44, logoSize: 240, padding: 110, safeBottom: 110 }
    case "square":
      return { titleSize: 84, subtitleSize: 48, telSize: 124, captionSize: 44, logoSize: 280, padding: 88, safeBottom: 130 }
  }
}
