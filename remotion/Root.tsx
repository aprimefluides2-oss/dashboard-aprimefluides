import { Composition } from "remotion"
import { InterventionVideo, computeDuration } from "./InterventionVideo"
import { FORMAT_DIMENSIONS, FPS, type InterventionVideoProps, type VideoFormat } from "./types"

const DEFAULT_PHOTOS = [
  { url: "https://www.aprime-fluides.fr/media/gallery/before/argenteuil-wc-bouche-avant.webp" },
  { url: "https://www.aprime-fluides.fr/media/gallery/after/argenteuil-wc-bouche-apres.webp" },
  { url: "https://www.aprime-fluides.fr/media/gallery/before/alfortville-pompe-avant.webp" },
  { url: "https://www.aprime-fluides.fr/media/gallery/after/alfortville-pompe-apres.webp" },
  { url: "https://www.aprime-fluides.fr/media/gallery/before/avant-debouchage-wc-au-furet-manuel-768x768.webp" },
  { url: "https://www.aprime-fluides.fr/media/gallery/after/apres-debouchage-wc-au-furet-manuel-768x768.webp" },
]

const DEFAULT_PROPS: Omit<InterventionVideoProps, "format"> = {
  photos: DEFAULT_PHOTOS,
  clientNom: "Client",
  ville: "Argenteuil",
  typeIntervention: "Débouchage canalisation",
  dateRealisee: new Date().toISOString().slice(0, 10),
}

const formats: { id: string; format: VideoFormat; label: string }[] = [
  { id: "InterventionVertical", format: "vertical", label: "Vertical 9:16" },
  { id: "InterventionHorizontal", format: "horizontal", label: "Horizontal 16:9" },
  { id: "InterventionSquare", format: "square", label: "Carré 1:1" },
]

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {formats.map(({ id, format }) => {
        const dims = FORMAT_DIMENSIONS[format]
        return (
          <Composition
            key={id}
            id={id}
            component={InterventionVideo}
            durationInFrames={computeDuration(DEFAULT_PHOTOS.length)}
            fps={FPS}
            width={dims.width}
            height={dims.height}
            defaultProps={{ ...DEFAULT_PROPS, format } as InterventionVideoProps}
            calculateMetadata={async ({ props }) => ({
              durationInFrames: computeDuration(props.photos.length),
              props,
            })}
          />
        )
      })}
    </>
  )
}
