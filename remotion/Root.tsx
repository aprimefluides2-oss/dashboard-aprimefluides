import { Composition } from "remotion"
import { InterventionVideo, computeDuration } from "./InterventionVideo"
import { FORMAT_DIMENSIONS, FPS, type InterventionVideoProps, type VideoFormat } from "./types"

const DEFAULT_PHOTOS = [
  { url: "https://www.aprime-fluide.fr/media/gallery/before/IMG_6988.jpeg" },
  { url: "https://www.aprime-fluide.fr/media/gallery/after/IMG_6990.jpeg" },
  { url: "https://www.aprime-fluide.fr/media/gallery/before/IMG_7002.jpeg" },
  { url: "https://www.aprime-fluide.fr/media/gallery/after/IMG_7001.jpeg" },
  { url: "https://www.aprime-fluide.fr/media/gallery/before/IMG_7015.jpeg" },
  { url: "https://www.aprime-fluide.fr/media/gallery/after/IMG_7017.jpeg" },
]

const DEFAULT_PROPS: Omit<InterventionVideoProps, "format"> = {
  photos: DEFAULT_PHOTOS,
  clientNom: "Client",
  ville: "Toulon",
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
