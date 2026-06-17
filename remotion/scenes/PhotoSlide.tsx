import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion"
import { BRAND, TIMINGS, type VideoFormat } from "../types"
import { scale } from "../lib/layout"

type Props = {
  format: VideoFormat
  src: string
  caption?: string
  index: number
}

export const PhotoSlide: React.FC<Props> = ({ format, src, caption, index }) => {
  const frame = useCurrentFrame()
  const total = TIMINGS.photoFrames
  const cross = TIMINGS.photoCrossfadeFrames
  const s = scale(format)

  const opacityIn = interpolate(frame, [0, cross], [0, 1], { extrapolateRight: "clamp" })
  const opacityOut = interpolate(frame, [total - cross, total], [1, 0], { extrapolateLeft: "clamp" })
  const opacity = Math.min(opacityIn, opacityOut)

  // Ken Burns alternated per index
  const startScale = index % 2 === 0 ? 1.0 : 1.12
  const endScale = index % 2 === 0 ? 1.12 : 1.0
  const kenScale = interpolate(frame, [0, total], [startScale, endScale])
  const panX = interpolate(frame, [0, total], [index % 3 === 0 ? -20 : 20, index % 3 === 0 ? 20 : -20])

  const captionOpacity = interpolate(frame, [cross + 4, cross + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const captionY = interpolate(frame, [cross + 4, cross + 22], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.navy, opacity }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${kenScale}) translateX(${panX}px)`,
          }}
        />
      </AbsoluteFill>

      {/* Bottom gradient for legibility */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {caption ? (
        <div
          style={{
            position: "absolute",
            left: s.padding,
            right: s.padding,
            bottom: s.safeBottom,
            opacity: captionOpacity,
            transform: `translateY(${captionY}px)`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: BRAND.white,
              color: BRAND.navy,
              padding: "18px 32px",
              borderRadius: 999,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 700,
              fontSize: s.captionSize,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              letterSpacing: -0.5,
            }}
          >
            {caption}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
