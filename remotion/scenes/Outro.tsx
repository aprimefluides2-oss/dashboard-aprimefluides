import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { BRAND, type VideoFormat } from "../types"
import { scale } from "../lib/layout"

export const Outro: React.FC<{ format: VideoFormat }> = ({ format }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = scale(format)

  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" })
  const camionScale = interpolate(frame, [0, 180], [1.05, 1.18])
  const telPop = spring({ frame: frame - 18, fps, config: { damping: 12, mass: 0.6 } })

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.navy, opacity: fadeIn }}>
      {/* Background camion with zoom + dark overlay */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={BRAND.camionUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${camionScale})`,
            opacity: 0.45,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${BRAND.navy}E6 0%, ${BRAND.navy}99 50%, ${BRAND.navy}F2 100%)`,
        }}
      />

      <AbsoluteFill
        style={{
          paddingLeft: s.padding,
          paddingRight: s.padding,
          paddingTop: s.padding * 1.4,
          paddingBottom: s.safeBottom,
          justifyContent: "space-between",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <Img
          src={BRAND.logoSmallUrl}
          style={{
            width: s.logoSize * 0.65,
            height: s.logoSize * 0.65,
            filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.5))",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          <div
            style={{
              color: BRAND.white,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 600,
              fontSize: s.subtitleSize,
              letterSpacing: -0.5,
              opacity: 0.85,
            }}
          >
            Une urgence ? Appelez-nous
          </div>
          <div
            style={{
              color: BRAND.yellow,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 900,
              fontSize: s.telSize,
              letterSpacing: -2,
              transform: `scale(${telPop})`,
              textShadow: "0 6px 24px rgba(0,0,0,0.5)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {BRAND.tel}
          </div>
          <div
            style={{
              color: BRAND.white,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 700,
              fontSize: s.captionSize,
              letterSpacing: -0.3,
            }}
          >
            {BRAND.slogan}
          </div>
        </div>

        <div
          style={{
            color: BRAND.white,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: s.captionSize * 0.8,
            opacity: 0.9,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>{BRAND.site}</div>
          <div style={{ opacity: 0.75 }}>{BRAND.zone}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
