import { useCallback, useEffect, useRef, useState } from "react"
import { Wheel } from "spin-wheel"

export type SpinWheelItem = {
  id: string
  label: string
  color?: string
  weight?: number
}

type SpinWheelCanvasProps = {
  items: SpinWheelItem[]
}

const FALLBACK_COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
]

export default function SpinWheelCanvas({
  items,
}: SpinWheelCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wheelRef = useRef<Wheel | null>(null)
  const spinningRef = useRef(false)
  const [isSpinning, setIsSpinning] = useState(false)

  const handleSpin = useCallback(() => {
    const wheel = wheelRef.current

    if (!wheel || items.length === 0 || spinningRef.current) {
      return
    }

    const index = Math.floor(Math.random() * items.length)

    spinningRef.current = true
    setIsSpinning(true)

    wheel.spinToItem(index, 4200, true, 5, 1)
  }, [items.length])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    container.innerHTML = ""
    wheelRef.current = null
    spinningRef.current = false
    setIsSpinning(false)

    if (items.length === 0) {
      return
    }

    const wheel = new Wheel(container, {
      items: items.map((item, index) => ({
        label: item.label || "Untitled",
        value: item.id,
        weight: item.weight ?? 1,
        backgroundColor:
          item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        labelColor: "#ffffff",
      })),
      radius: 0.92,
      pointerAngle: 0,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.18)",
      lineWidth: 1,
      lineColor: "rgba(255,255,255,0.24)",
      itemLabelAlign: "right",
      itemLabelRadius: 0.78,
      itemLabelRadiusMax: 0.28,
      itemLabelFont: "Inter, ui-sans-serif, system-ui, sans-serif",
      itemLabelFontSizeMax: 32,
      itemLabelStrokeWidth: 0,
      isInteractive: false,
      rotationResistance: -35,
      rotationSpeedMax: 900,
      onRest: () => {
        spinningRef.current = false
        setIsSpinning(false)
      },
    })

    wheelRef.current = wheel

    return () => {
      wheel.remove()
      wheelRef.current = null
      spinningRef.current = false
    }
  }, [items])

  return (
    <div className="relative flex min-h-[620px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur sm:p-6 lg:min-h-0 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_58%)]" />

      <div className="relative flex w-full max-w-[min(82vh,980px)] flex-col items-center">
        <div
          className="relative aspect-square w-full"
          aria-label="Spin wheel"
        >
          <div
            ref={containerRef}
            className="absolute inset-0"
          />

          {items.length > 0 && (
            <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2">
              <div className="h-0 w-0 border-l-[17px] border-r-[17px] border-t-[32px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-lg" />
            </div>
          )}

          {items.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex aspect-square w-full max-w-[700px] items-center justify-center rounded-full border border-dashed border-border/80 bg-background/40">
                <div className="px-6 text-center">
                  <p className="text-sm font-semibold">
                    Your wheel is empty
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add entries from the panel to get started.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!items.length || isSpinning}
          onClick={handleSpin}
          className="mt-5 inline-flex h-11 min-w-36 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSpinning ? "Spinning..." : "Spin"}
        </button>
      </div>
    </div>
  )
}
