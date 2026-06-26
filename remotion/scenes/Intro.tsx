import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { BRAND, type VideoFormat } from "../types"
import { scale } from "../lib/layout"

export const Intro: React.FC<{ format: VideoFormat }> = ({ format }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = scale(format)

  const logoScale = spring({ frame, fps, config: { damping: 14, mass: 0.8 } })
  const logoOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" })
  const sloganY = interpolate(frame, [22, 44], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const sloganOpacity = interpolate(frame, [22, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const exitOpacity = interpolate(frame, [72, 90], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, ${BRAND.navyLight} 0%, ${BRAND.navy} 70%)`,
        opacity: exitOpacity,
        justifyContent: "center",
        alignItems: "center",
        gap: 48,
      }}
    >
      <Img
        src={BRAND.logoUrl}
        style={{
          width: s.logoSize,
          height: s.logoSize,
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.45))",
        }}
      />
      <div
        style={{
          opacity: sloganOpacity,
          transform: `translateY(${sloganY}px)`,
          color: BRAND.white,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 800,
          fontSize: s.titleSize,
          letterSpacing: -1,
          textAlign: "center",
          textShadow: "0 4px 16px rgba(0,0,0,0.4)",
          lineHeight: 1.05,
        }}
      >
        Aprime
        <br />
        Fluides
      </div>
    </AbsoluteFill>
  )
}
