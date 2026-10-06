import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Dices,
  Download,
  ImagePlus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Shuffle,
  SortAsc,
  Sparkles,
  Trophy,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Navbar from "@/components/home/Navbar"
import { Button } from "@/components/ui/button"

type Entry = {
  id: string
  text: string
  image?: string
}

type Wheel = {
  id: string
  title: string
  entries: Entry[]
  removeWinner: boolean
  sound: boolean
  spinTime: number
}

const STORAGE_KEY = "mpd-spin-wheel-v2"

const DEFAULT_ENTRIES = [
  "Officer 1",
  "Officer 2",
  "Officer 3",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Master Sergeant",
]

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#eab308",
  "#64748b",
]

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function makeEntries(values: string[]): Entry[] {
  return values.map((text) => ({ id: uid(), text }))
}

function createWheel(title = "Wheel 1"): Wheel {
  return {
    id: uid(),
    title,
    entries: makeEntries(DEFAULT_ENTRIES),
    removeWinner: false,
    sound: true,
    spinTime: 5,
  }
}

function safeLoad(): Wheel[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return [createWheel()]
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.length) return [createWheel()]

    return parsed.map((wheel: Partial<Wheel>, index: number) => ({
      id: wheel.id || uid(),
      title: wheel.title || `Wheel ${index + 1}`,
      entries: Array.isArray(wheel.entries)
        ? wheel.entries
            .map((entry) =>
              typeof entry === "string"
                ? { id: uid(), text: entry }
                : {
                    id: entry.id || uid(),
                    text: String(entry.text ?? ""),
                    image: entry.image,
                  },
            )
            .filter((entry) => entry.text.trim())
        : makeEntries(DEFAULT_ENTRIES),
      removeWinner: Boolean(wheel.removeWinner),
      sound: wheel.sound !== false,
      spinTime: Math.max(1, Math.min(60, Number(wheel.spinTime) || 5)),
    }))
  } catch {
    return [createWheel()]
  }
}

function playSound(file: string) {
  try {
    const audio = new Audio(file)
    audio.volume = 0.7
    void audio.play().catch(() => undefined)
  } catch {
    // Browser audio can be unavailable until the page has received a gesture.
  }
}

function WheelCanvas({
  wheel,
  rotation,
  spinning,
  onSpin,
}: {
  wheel: Wheel
  rotation: number
  spinning: boolean
  onSpin: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const size = Math.max(300, Math.min(rect.width, rect.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.scale(dpr, dpr)
      const cx = size / 2
      const cy = size / 2
      const radius = size / 2 - 8
      const entries = wheel.entries.length
        ? wheel.entries
        : [{ id: "empty", text: "Add entries" }]

      ctx.clearRect(0, 0, size, size)

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((rotation * Math.PI) / 180)

      const slice = (Math.PI * 2) / entries.length

      entries.forEach((entry, index) => {
        const start = -Math.PI / 2 + index * slice
        const end = start + slice

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, radius, start, end)
        ctx.closePath()
        ctx.fillStyle =
          COLORS[index % COLORS.length]
        ctx.fill()

        ctx.strokeStyle = "rgba(255,255,255,.92)"
        ctx.lineWidth = Math.max(1, size / 260)
        ctx.stroke()

        if (entry.text.trim()) {
          ctx.save()
          ctx.rotate(start + slice / 2)
          ctx.translate(radius * 0.69, 0)
          ctx.rotate(Math.PI / 2)

          const fontSize = Math.max(
            10,
            Math.min(
              23,
              size / Math.max(12, entries.length * 1.8),
            ),
          )

          ctx.font = `700 ${fontSize}px Inter, Arial, sans-serif`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillStyle = "#fff"
          ctx.shadowColor = "rgba(0,0,0,.28)"
          ctx.shadowBlur = 3

          const text =
            entry.text.length > 22
              ? `${entry.text.slice(0, 21)}…`
              : entry.text

          ctx.fillText(text, 0, 0)
          ctx.restore()
        }
      })

      ctx.restore()

      ctx.beginPath()
      ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(255,255,255,.95)"
      ctx.lineWidth = 5
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(28, size * 0.075), 0, Math.PI * 2)
      ctx.fillStyle = "#111827"
      ctx.fill()
      ctx.strokeStyle = "rgba(255,255,255,.9)"
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = "#fff"
      ctx.font = `800 ${Math.max(11, size * 0.025)}px Inter, Arial, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("SPIN", cx, cy)
    }

    draw()

    const observer = new ResizeObserver(draw)
    observer.observe(canvas)

    return () => observer.disconnect()
  }, [wheel, rotation])

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(72vh,760px)] cursor-pointer select-none"
      onClick={() => !spinning && onSpin()}
      role="button"
      tabIndex={0}
      aria-label={`Spin ${wheel.title}`}
      onKeyDown={(event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          !spinning
        ) {
          event.preventDefault()
          onSpin()
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[-2px] z-10 -translate-x-1/2"
        style={{
          filter:
            "drop-shadow(0 3px 3px rgba(0,0,0,.35))",
        }}
      >
        <div
          className="h-0 w-0 border-l-[17px] border-r-[17px] border-t-[31px] border-l-transparent border-r-transparent"
          style={{
            borderTopColor:
              wheel.entries.length
                ? COLORS[
                    Math.max(
                      0,
                      Math.floor(
                        ((rotation % 360) / 360) *
                          wheel.entries.length,
                      ),
                    ) % COLORS.length
                  ]
                : "#3b82f6",
          }}
        />
      </div>
    </div>
  )
}

function Fireworks() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => ({
        id: index,
        x: Math.random() * 100,
        y: 5 + Math.random() * 25,
        delay: Math.random() * 0.45,
        duration: 2.5 + Math.random() * 2,
        rotate: Math.random() * 360,
      })),
    [],
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-[130] overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute h-2 w-1 rounded-sm bg-blue-500 animate-[confetti-fall_3.2s_ease-out_forwards]"
          style={
            {
              left: `${piece.x}%`,
              top: `${piece.y}%`,
              animationDelay: `${piece.delay}s`,
              transform: `rotate(${piece.rotate}deg)`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function EntriesPanel({
  wheel,
  onEntries,
  onShuffle,
  onSort,
  onClear,
  onRemoveWinnerChange,
  onSoundChange,
  onSpinTimeChange,
}: {
  wheel: Wheel
  onEntries: (value: string) => void
  onShuffle: () => void
  onSort: () => void
  onClear: () => void
  onRemoveWinnerChange: (value: boolean) => void
  onSoundChange: (value: boolean) => void
  onSpinTimeChange: (value: number) => void
}) {
  const [advanced, setAdvanced] = useState(false)

  return (
    <aside className="flex h-full min-h-0 w-full max-w-[470px] flex-col border-l border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-center gap-2">
          <button className="border-b-2 border-blue-500 pb-1 text-sm font-semibold text-foreground">
            Entries
          </button>
          <button className="pb-1 text-sm text-muted-foreground">
            Results
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <textarea
          value={wheel.entries.map((entry) => entry.text).join("\n")}
          onChange={(event) => onEntries(event.target.value)}
          placeholder="Enter one entry per line"
          className="min-h-[310px] w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          spellCheck={false}
        />

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={onShuffle}
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Shuffle
          </Button>
          <Button
            variant="outline"
            className="h-9"
            onClick={onSort}
          >
            <SortAsc className="mr-2 h-4 w-4" />
            Sort
          </Button>
          <Button
            variant="outline"
            className="h-9 text-muted-foreground"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="justify-start"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Add image
            <ChevronDown className="ml-auto h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setAdvanced((value) => !value)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Advanced
            <ChevronDown
              className={[
                "ml-auto h-4 w-4 transition-transform",
                advanced ? "rotate-180" : "",
              ].join(" ")}
            />
          </Button>
        </div>

        {advanced && (
          <div className="mt-3 space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              <span>
                <span className="block font-medium">
                  Remove winner
                </span>
                <span className="text-xs text-muted-foreground">
                  Automatically remove the selected entry.
                </span>
              </span>
              <input
                type="checkbox"
                checked={wheel.removeWinner}
                onChange={(event) =>
                  onRemoveWinnerChange(event.target.checked)
                }
                className="h-4 w-4 accent-blue-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              <span>
                <span className="block font-medium">
                  Sound effects
                </span>
                <span className="text-xs text-muted-foreground">
                  Play tick and winner sounds.
                </span>
              </span>
              <input
                type="checkbox"
                checked={wheel.sound}
                onChange={(event) =>
                  onSoundChange(event.target.checked)
                }
                className="h-4 w-4 accent-blue-500"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-2 flex items-center justify-between">
                <span className="font-medium">Spin time</span>
                <span className="text-xs text-muted-foreground">
                  {wheel.spinTime}s
                </span>
              </span>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={wheel.spinTime}
                onChange={(event) =>
                  onSpinTimeChange(
                    Number(event.target.value),
                  )
                }
                className="w-full accent-blue-500"
              />
            </label>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <span>
              Click the wheel or press Space/Enter to spin. Entries are
              weighted equally unless configured otherwise.
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-border/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {wheel.entries.length} entries
          </span>
          <span className="text-xs text-muted-foreground">
            Changes save automatically
          </span>
        </div>
      </div>
    </aside>
  )
}

export default function SpinWheel() {
  const [wheels, setWheels] = useState<Wheel[]>(() => {
    if (typeof window === "undefined") return [createWheel()]
    return safeLoad()
  })
  const [activeWheel, setActiveWheel] = useState(0)
  const [rotations, setRotations] = useState<Record<string, number>>({})
  const [spinning, setSpinning] = useState<string | null>(null)
  const [winner, setWinner] = useState<{
    wheelId: string
    entry: Entry
  } | null>(null)
  const [showCelebration, setShowCelebration] =
    useState(false)
  const [showWheelMenu, setShowWheelMenu] =
    useState(false)
  const spinTimer = useRef<number | null>(null)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(wheels),
    )
  }, [wheels])

  useEffect(() => {
    return () => {
      if (spinTimer.current) {
        window.clearTimeout(spinTimer.current)
      }
    }
  }, [])

  const wheel = wheels[activeWheel] ?? wheels[0]

  const updateWheel = useCallback(
    (id: string, update: Partial<Wheel>) => {
      setWheels((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, ...update }
            : item,
        ),
      )
    },
    [],
  )

  const updateEntries = useCallback(
    (id: string, value: string) => {
      const entries = value
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({
          id: uid(),
          text,
        }))

      updateWheel(id, { entries })
    },
    [updateWheel],
  )

  function chooseWinner(
    targetWheel: Wheel,
  ): Entry | null {
    if (!targetWheel.entries.length) {
      toast.error("Add at least one entry first.")
      return null
    }

    const index = Math.floor(
      Math.random() * targetWheel.entries.length,
    )

    return targetWheel.entries[index]
  }

  function spin(targetWheel = wheel) {
    if (!targetWheel || spinning) return

    const selected = chooseWinner(targetWheel)
    if (!selected) return

    setSpinning(targetWheel.id)
    setWinner(null)
    setShowCelebration(false)

    const count = targetWheel.entries.length
    const selectedIndex =
      targetWheel.entries.findIndex(
        (entry) => entry.id === selected.id,
      )

    const slice = 360 / count
    const current =
      rotations[targetWheel.id] ?? 0

    const currentNormalized =
      ((current % 360) + 360) % 360

    const targetNormalized =
      (360 -
        (selectedIndex + 0.5) * slice +
        360) %
      360

    const delta =
      360 * 6 +
      ((targetNormalized - currentNormalized + 360) %
        360)

    const nextRotation = current + delta

    setRotations((currentRotations) => ({
      ...currentRotations,
      [targetWheel.id]: nextRotation,
    }))

    if (targetWheel.sound) {
      playSound("/sounds/during-spin/ding.mp3")
    }

    spinTimer.current = window.setTimeout(
      () => {
        setSpinning(null)
        setWinner({
          wheelId: targetWheel.id,
          entry: selected,
        })
        setShowCelebration(true)

        if (targetWheel.sound) {
          playSound(
            "/sounds/after-spin/correct-answer-ding.mp3",
          )
        }

        if (targetWheel.removeWinner) {
          setWheels((currentWheels) =>
            currentWheels.map((item) =>
              item.id === targetWheel.id
                ? {
                    ...item,
                    entries: item.entries.filter(
                      (entry) =>
                        entry.id !== selected.id,
                    ),
                  }
                : item,
            ),
          )
        }
      },
      targetWheel.spinTime * 1000,
    )
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter"
      ) {
        event.preventDefault()
        spin()
        return
      }

      if (event.key === "Escape") {
        setWinner(null)
        setShowCelebration(false)
        setShowWheelMenu(false)
      }
    }

    window.addEventListener("keydown", keydown)
    return () =>
      window.removeEventListener("keydown", keydown)
  })

  function shuffleEntries() {
    if (!wheel) return
    const next = [...wheel.entries]

    for (let index = next.length - 1; index > 0; index--) {
      const random = Math.floor(
        Math.random() * (index + 1),
      )
      ;[next[index], next[random]] = [
        next[random],
        next[index],
      ]
    }

    updateWheel(wheel.id, { entries: next })
  }

  function sortEntries() {
    if (!wheel) return
    updateWheel(wheel.id, {
      entries: [...wheel.entries].sort((a, b) =>
        a.text.localeCompare(b.text),
      ),
    })
  }

  function addWheel() {
    const next = createWheel(
      `Wheel ${wheels.length + 1}`,
    )
    setWheels((current) => [...current, next])
    setActiveWheel(wheels.length)
    setShowWheelMenu(false)
  }

  function duplicateWheel() {
    if (!wheel) return
    const next: Wheel = {
      ...wheel,
      id: uid(),
      title: `${wheel.title} Copy`,
      entries: wheel.entries.map((entry) => ({
        ...entry,
        id: uid(),
      })),
    }
    setWheels((current) => [...current, next])
    setActiveWheel(wheels.length)
    setShowWheelMenu(false)
  }

  function removeWheel(index: number) {
    if (wheels.length === 1) {
      toast.error("You must keep at least one wheel.")
      return
    }

    setWheels((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    )
    setActiveWheel((current) =>
      Math.min(current, wheels.length - 2),
    )
  }

  function clearWheel() {
    if (!wheel) return
    updateWheel(wheel.id, { entries: [] })
  }

  function exportResults() {
    const data = winner
      ? `${winner.entry.text}\n`
      : "No result yet.\n"

    const blob = new Blob([data], {
      type: "text/plain;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "mpd-spin-results.txt"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (!wheel) return null

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative flex min-h-screen flex-col pt-16">
        <div className="flex min-h-[calc(100vh-64px)] flex-1 overflow-hidden">
          <section className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-5 pt-5 sm:px-6 lg:px-8">
              <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-500">
                    <Dices className="h-4 w-4" />
                    Community Tool
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      value={wheel.title}
                      onChange={(event) =>
                        updateWheel(wheel.id, {
                          title: event.target.value,
                        })
                      }
                      className="min-w-0 max-w-[420px] bg-transparent text-2xl font-extrabold tracking-tight outline-none sm:text-3xl"
                      aria-label="Wheel title"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowWheelMenu((value) => !value)
                      }
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label="Wheel options"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="relative flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    className="hidden sm:flex"
                    onClick={duplicateWheel}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy wheel
                  </Button>

                  <div className="relative">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() =>
                        setShowWheelMenu((value) => !value)
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add wheel
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>

                    {showWheelMenu && (
                      <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={addWheel}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
                        >
                          <Plus className="h-4 w-4 text-blue-500" />
                          New blank wheel
                        </button>
                        <button
                          type="button"
                          onClick={duplicateWheel}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
                        >
                          <Copy className="h-4 w-4 text-blue-500" />
                          Copy current wheel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {wheels.length > 1 && (
                <div className="mb-4 flex shrink-0 items-center gap-2 overflow-x-auto rounded-xl border border-border/70 bg-card/70 p-2">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    onClick={() =>
                      setActiveWheel((value) =>
                        Math.max(0, value - 1),
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {wheels.map((item, index) => (
                    <div
                      key={item.id}
                      className={[
                        "group flex shrink-0 items-center gap-1 rounded-lg border px-2",
                        index === activeWheel
                          ? "border-blue-500/40 bg-blue-500/10"
                          : "border-transparent",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveWheel(index)
                        }
                        className="px-2 py-1.5 text-xs font-medium"
                      >
                        {item.title}
                      </button>
                      {wheels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWheel(index)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                          aria-label={`Remove ${item.title}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    onClick={() =>
                      setActiveWheel((value) =>
                        Math.min(wheels.length - 1, value + 1),
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm sm:p-5">
                <WheelCanvas
                  wheel={wheel}
                  rotation={rotations[wheel.id] ?? 0}
                  spinning={spinning === wheel.id}
                  onSpin={() => spin()}
                />
              </div>

              <div className="flex shrink-0 items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() =>
                    setRotations((current) => ({
                      ...current,
                      [wheel.id]: 0,
                    }))
                  }
                  disabled={Boolean(spinning)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>

                <Button
                  className="h-10 min-w-32 bg-blue-600 px-6 hover:bg-blue-700"
                  onClick={() => spin()}
                  disabled={Boolean(spinning)}
                >
                  <Dices className="mr-2 h-4 w-4" />
                  {spinning ? "Spinning..." : "Spin"}
                </Button>

                <Button
                  variant="outline"
                  className="h-10"
                  onClick={exportResults}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Results
                </Button>
              </div>
            </div>
          </section>

          <EntriesPanel
            wheel={wheel}
            onEntries={(value) =>
              updateEntries(wheel.id, value)
            }
            onShuffle={shuffleEntries}
            onSort={sortEntries}
            onClear={clearWheel}
            onRemoveWinnerChange={(value) =>
              updateWheel(wheel.id, {
                removeWinner: value,
              })
            }
            onSoundChange={(value) =>
              updateWheel(wheel.id, { sound: value })
            }
            onSpinTimeChange={(value) =>
              updateWheel(wheel.id, {
                spinTime: value,
              })
            }
          />
        </div>
      </main>

      {showCelebration && <Fireworks />}

      {winner && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
              setWinner(null)
              setShowCelebration(false)
            }
          }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                setWinner(null)
                setShowCelebration(false)
              }}
              aria-label="Close winner dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="px-7 py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                <Trophy className="h-7 w-7" />
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">
                Winner
              </p>

              <h2 className="mt-2 break-words text-3xl font-extrabold tracking-tight">
                {winner.entry.text}
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                The wheel has selected this entry.
              </p>

              <div className="mt-6 flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWinner(null)
                    setShowCelebration(false)
                  }}
                >
                  Close
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setWinner(null)
                    setShowCelebration(false)
                    window.setTimeout(() => spin(), 50)
                  }}
                >
                  Spin again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 0;
            transform: translate3d(0, -10px, 0) rotate(0deg) scale(.6);
          }
          12% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate3d(${Math.random() * 180 - 90}px, 95vh, 0) rotate(720deg) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
