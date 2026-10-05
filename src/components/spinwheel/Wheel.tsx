import { useCallback, useEffect, useRef, useState } from "react"
import { Wheel as SpinWheel } from "spin-wheel"

export type SpinWheelItem = {
  id: string
  label: string
  color?: string
  weight?: number
}

type WheelProps = {
  items: SpinWheelItem[]
  onResult?: (item: SpinWheelItem) => void
}

const FALLBACK_COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
]

export default function Wheel({
  items,
  onResult,
}: WheelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wheelRef = useRef<SpinWheel | null>(null)
  const spinningRef = useRef(false)

  const [isSpinning, setIsSpinning] = useState(false)

  const spin = useCallback(() => {
    const wheel = wheelRef.current

    if (!wheel || items.length === 0 || spinningRef.current) {
      return
    }

    const selectedIndex = Math.floor(
      Math.random() * items.length,
    )

    spinningRef.current = true
    setIsSpinning(true)

    wheel.spinToItem(
      selectedIndex,
      4200,
      true,
      6,
      1,
    )
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

    const wheel = new SpinWheel(container, {
      items: items.map((item, index) => ({
        label: item.label || "Untitled",
        value: item.id,
        weight: item.weight ?? 1,

        backgroundColor:
          item.color ??
          FALLBACK_COLORS[
            index % FALLBACK_COLORS.length
          ],

        labelColor: "#ffffff",
      })),

      radius: 0.92,

      pointerAngle: 0,

      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.18)",

      lineWidth: 1,
      lineColor: "rgba(255,255,255,0.22)",

      itemLabelAlign: "right",
      itemLabelRadius: 0.78,
      itemLabelRadiusMax: 0.3,

      itemLabelFont:
        "Inter, ui-sans-serif, system-ui, sans-serif",

      itemLabelFontSizeMax: 34,
      itemLabelStrokeWidth: 0,

      isInteractive: false,

      rotationResistance: -35,
      rotationSpeedMax: 1000,

      onRest: () => {
        const selectedIndex =
          wheel.getCurrentIndex()

        const selectedItem =
          items[selectedIndex]

        spinningRef.current = false
        setIsSpinning(false)

        if (selectedItem) {
          onResult?.(selectedItem)
        }
      },
    })

    wheelRef.current = wheel

    return () => {
      wheel.remove()
      wheelRef.current = null
      spinningRef.current = false
    }
  }, [items, onResult])

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-background">
      {/* Subtle MPD background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.07),transparent_56%)]" />

      {items.length > 0 ? (
        <div
          ref={containerRef}
          className="relative aspect-square w-[min(76vw,calc(100vh-150px),980px)] max-w-[90%]"
          aria-label="Spin wheel"
        >
          {/* Pointer */}
          <div className="pointer-events-none absolute left-1/2 top-[-1px] z-20 -translate-x-1/2">
            <div className="h-0 w-0 border-l-[20px] border-r-[20px] border-t-[38px] border-l-transparent border-r-transparent border-t-foreground drop-shadow-xl" />
          </div>
        </div>
      ) : (
        <div className="flex aspect-square w-[min(62vw,calc(100vh-180px),760px)] max-w-[78%] items-center justify-center rounded-full border border-border/70 bg-card/30">
          <div className="px-6 text-center">
            <p className="text-lg font-semibold">
              Your wheel is empty
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Add entries from the sidebar to get started.
            </p>
          </div>
        </div>
      )}

      {/* Spin button */}
      <button
        type="button"
        disabled={
          items.length === 0 ||
          isSpinning
        }
        onClick={spin}
        className="absolute bottom-8 left-1/2 z-30 inline-flex h-11 min-w-36 -translate-x-1/2 items-center justify-center rounded-xl bg-blue-600 px-7 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSpinning ? "Spinning..." : "Spin"}
      </button>
    </div>
  )
}
