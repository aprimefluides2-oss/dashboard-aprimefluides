'use client'
import { useEffect, useRef, useState } from "react"

type Props = {
  /** Appelé avec le PNG (data URL) à chaque tracé, ou null si effacé. */
  onChange: (dataUrl: string | null) => void
}

/**
 * Cadre de signature tactile (canvas). Pointer Events = souris, tactile et
 * stylet gérés d'un seul code. `touch-none` empêche le scroll pendant le tracé.
 */
export default function SignatureCanvas({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0e2a52'
    }
  }, [])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const { x, y } = point(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = point(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInk.current = true
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (!canvas || !hasInk.current) return
    setEmpty(false)
    onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="w-full h-44 border-2 border-dashed border-slate-300 rounded-xl bg-white touch-none cursor-crosshair"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-slate-400">
          {empty ? 'Faire signer le client dans le cadre' : 'Signature capturée ✓'}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-slate-500 hover:text-red-600"
        >
          Effacer
        </button>
      </div>
    </div>
  )
}
