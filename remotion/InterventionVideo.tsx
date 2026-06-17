import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion"
import { Intro } from "./scenes/Intro"
import { PhotoSlide } from "./scenes/PhotoSlide"
import { Outro } from "./scenes/Outro"
import { BRAND, TIMINGS, type InterventionVideoProps } from "./types"

export const InterventionVideo: React.FC<InterventionVideoProps> = ({
  format,
  photos,
  ville,
  typeIntervention,
  enableMusic = true,
  musicVolume = 0.22,
}) => {
  const { durationInFrames, fps } = useVideoConfig()
  const fadeInFrames = fps * 1
  const fadeOutFrames = fps * 2
  const cross = TIMINGS.photoCrossfadeFrames
  const photoStep = TIMINGS.photoFrames - cross
  const introEnd = TIMINGS.introFrames - cross

  const photosFiltered = photos.length > 0 ? photos : []

  const buildCaption = (p: { caption?: string }) =>
    p.caption || [typeIntervention, ville].filter(Boolean).join(" · ") || undefined

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.navy }}>
      {enableMusic ? (
        <Audio
          src={BRAND.musicUrl}
          volume={(f) => {
            if (f < fadeInFrames) return musicVolume * (f / fadeInFrames)
            if (f >= durationInFrames - fadeOutFrames) {
              return Math.max(
                0,
                musicVolume * (1 - (f - (durationInFrames - fadeOutFrames)) / fadeOutFrames),
              )
            }
            return musicVolume
          }}
        />
      ) : null}
      <Sequence from={0} durationInFrames={TIMINGS.introFrames} name="Intro">
        <Intro format={format} />
      </Sequence>

      {photosFiltered.map((p, i) => (
        <Sequence
          key={`${p.url}-${i}`}
          from={introEnd + i * photoStep}
          durationInFrames={TIMINGS.photoFrames}
          name={`Photo ${i + 1}`}
        >
          <PhotoSlide format={format} src={p.url} caption={buildCaption(p)} index={i} />
        </Sequence>
      ))}

      <Sequence
        from={introEnd + photosFiltered.length * photoStep - cross}
        durationInFrames={TIMINGS.outroFrames}
        name="Outro"
      >
        <Outro format={format} />
      </Sequence>
    </AbsoluteFill>
  )
}

export const computeDuration = (photoCount: number) => {
  const cross = TIMINGS.photoCrossfadeFrames
  const photoStep = TIMINGS.photoFrames - cross
  const introEnd = TIMINGS.introFrames - cross
  return introEnd + photoCount * photoStep - cross + TIMINGS.outroFrames
}
