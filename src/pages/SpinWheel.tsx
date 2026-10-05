import { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Dices,
  Eraser,
  History,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Shuffle,
  Trophy,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const STORAGE_KEY = "mpd-public-spin-wheel-v2"
const MAX_VISIBLE_SEGMENTS = 80

const WHEEL_COLORS = [
  "#2563eb",
  "#3b82f6",
  "#60a5fa",
  "#1d4ed8",
  "#0ea5e9",
  "#38bdf8",
  "#6366f1",
  "#818cf8",
]

type HistoryItem = {
  id: string
  winner: string
  at: string
}

type SavedState = {
  entries: string[]
  duration: number
  removeWinner: boolean
  confetti: boolean
  history: HistoryItem[]
}

const defaultEntries = [
  "Officer 1",
  "Officer 2",
  "Officer 3",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Master Sergeant",
]

function secureRandom(max: number) {
  if (max <= 1) return 0

  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return Math.floor((values[0] / 4294967296) * max)
}

function shuffle<T>(items: T[]) {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = secureRandom(index + 1)
    ;[result[index], result[next]] = [result[next], result[index]]
  }

  return result
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180

  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function segmentPath(index: number, count: number) {
  const slice = 360 / count
  const start = -90 + index * slice
  const end = start + slice
  const startPoint = polar(200, 200, 184, start)
  const endPoint = polar(200, 200, 184, end)
  const largeArc = slice > 180 ? 1 : 0

  return `M 200 200 L ${startPoint.x} ${startPoint.y} A 184 184 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y} Z`
}

function labelPoint(index: number, count: number) {
  const slice = 360 / count
  const angle = -90 + index * slice + slice / 2
  return polar(200, 200, 126, angle)
}

function normaliseRotation(value: number) {
  return ((value % 360) + 360) % 360
}

function createId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()}`
}

export default function SpinWheel() {
  const [entries, setEntries] = useState(defaultEntries)
  const [text, setText] = useState(defaultEntries.join("\n"))
  const [duration, setDuration] = useState(5)
  const [removeWinner, setRemoveWinner] = useState(false)
  const [confetti, setConfetti] = useState(true)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [entriesOpen, setEntriesOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)
  const spinTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const sharedEntries = params.get("entries")

      if (sharedEntries) {
        const nextEntries = sharedEntries
          .split("|")
          .map((entry) => entry.trim())
          .filter(Boolean)

        if (nextEntries.length) {
          setEntries(nextEntries)
          setText(nextEntries.join("\n"))
        }

        const spinTime = Number(params.get("spinTime"))
        if (Number.isFinite(spinTime)) {
          setDuration(Math.min(15, Math.max(1, spinTime)))
        }

        return
      }

      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return

      const parsed = JSON.parse(stored) as SavedState

      if (Array.isArray(parsed.entries) && parsed.entries.length) {
        setEntries(parsed.entries)
        setText(parsed.entries.join("\n"))
      }

      if (typeof parsed.duration === "number") {
        setDuration(Math.min(15, Math.max(1, parsed.duration)))
      }

      if (typeof parsed.removeWinner === "boolean") {
        setRemoveWinner(parsed.removeWinner)
      }

      if (typeof parsed.confetti === "boolean") {
        setConfetti(parsed.confetti)
      }

      if (Array.isArray(parsed.history)) {
        setHistory(parsed.history.slice(0, 30))
      }
    } catch {
      // Ignore invalid saved state.
    }
  }, [])

  useEffect(() => {
    const state: SavedState = {
      entries,
      duration,
      removeWinner,
      confetti,
      history,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [entries, duration, removeWinner, confetti, history])

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current !== null) {
        window.clearTimeout(spinTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!winner) return

    const timeout = window.setTimeout(() => setWinner(null), 12000)
    return () => window.clearTimeout(timeout)
  }, [winner])

  const visibleEntries = useMemo(
    () => entries.slice(0, MAX_VISIBLE_SEGMENTS),
    [entries],
  )

  const syncEntries = (value: string) => {
    setText(value)

    const next = value
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)

    setEntries(next)
  }

  const spin = () => {
    if (spinning || !visibleEntries.length) return

    const winnerIndex = secureRandom(visibleEntries.length)
    const slice = 360 / visibleEntries.length
    const centerAngle = winnerIndex * slice + slice / 2
    const current = normaliseRotation(rotation)
    const targetOffset = normaliseRotation(-centerAngle - current)
    const turns = 6 + secureRandom(4)
    const nextRotation = rotation + targetOffset + turns * 360
    const selectedWinner = visibleEntries[winnerIndex]

    setSpinning(true)
    setWinner(null)
    setRotation(nextRotation)

    spinTimeoutRef.current = window.setTimeout(() => {
      setSpinning(false)
      setWinner(selectedWinner)
      setHistory((currentHistory) => [
        {
          id: createId(),
          winner: selectedWinner,
          at: new Date().toISOString(),
        },
        ...currentHistory,
      ].slice(0, 30))

      if (removeWinner) {
        const remaining = entries.filter((entry) => entry !== selectedWinner)
        setEntries(remaining)
        setText(remaining.join("\n"))
      }

      if (confetti) {
        setShowConfetti(true)
        window.setTimeout(() => setShowConfetti(false), 2600)
      }
    }, duration * 1000)
  }

  const clearEntries = () => {
    setEntries([])
    setText("")
    setWinner(null)
  }

  const restoreDefaults = () => {
    setEntries(defaultEntries)
    setText(defaultEntries.join("\n"))
    setWinner(null)
    setRotation(0)
  }

  const shareWheel = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set("entries", entries.join("|"))
    url.searchParams.set("spinTime", String(duration))

    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success("Wheel link copied", {
        description: "Anyone with the link can open this wheel.",
      })
      setShareOpen(false)
    } catch {
      setShareOpen(true)
    }
  }

  const copyEntries = async () => {
    try {
      await navigator.clipboard.writeText(entries.join("\n"))
      toast.success("Entries copied")
    } catch {
      toast.error("Unable to copy entries")
    }
  }

  const sortEntries = () => {
    const sorted = [...entries].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )

    setEntries(sorted)
    setText(sorted.join("\n"))
  }

  const shuffleEntries = () => {
    const shuffled = shuffle(entries)
    setEntries(shuffled)
    setText(shuffled.join("\n"))
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.10),transparent_34%)]" />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
              <Dices className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">
              Metro Police Department
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Spin the Wheel
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Add names, officers, tasks or anything else and let the wheel make the random selection for you.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen((value) => !value)}>
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
            <Button variant="outline" size="sm" onClick={() => void shareWheel()}>
              <Copy className="mr-2 h-4 w-4" />
              Share Wheel
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen((value) => !value)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Customize
            </Button>
          </div>

          {historyOpen && (
            <section className="mx-auto mt-4 max-w-5xl rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Spin history</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recent winners are saved on this device.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHistory([])}
                  disabled={!history.length}
                  aria-label="Clear spin history"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {history.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
                    <p className="truncate text-sm font-medium">{item.winner}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(item.at).toLocaleString("en-GB")}
                    </p>
                  </div>
                ))}
                {!history.length && (
                  <p className="text-xs text-muted-foreground">No spins yet.</p>
                )}
              </div>
            </section>
          )}

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="relative flex min-h-[650px] items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur sm:p-8">
              <div className="absolute left-5 top-5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </div>

              <button
                type="button"
                className="absolute right-5 top-5 rounded-lg border border-border/70 bg-background/80 p-2 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => wheelRef.current?.requestFullscreen?.()}
                aria-label="Fullscreen wheel"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              <div className="relative flex w-full max-w-[660px] items-center justify-center pt-8">
                <div className="absolute top-0 z-30 drop-shadow-lg">
                  <div className="h-0 w-0 border-l-[15px] border-r-[15px] border-t-[32px] border-l-transparent border-r-transparent border-t-blue-500" />
                </div>

                <div
                  ref={wheelRef}
                  className="relative aspect-square w-[min(82vw,610px)] max-w-full rounded-full bg-background p-2 shadow-[0_0_80px_rgba(37,99,235,0.12)]"
                >
                  <div
                    role="button"
                    tabIndex={spinning || !entries.length ? -1 : 0}
                    aria-label="Spin the wheel"
                    onClick={spin}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && !spinning && entries.length) {
                        event.preventDefault()
                        spin()
                      }
                    }}
                    className="relative h-full w-full cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transitionDuration: `${spinning ? duration : 0}000ms`,
                      transitionTimingFunction: spinning ? "cubic-bezier(0.12, 0.74, 0.16, 1)" : "linear",
                    }}
                  >
                    <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible rounded-full">
                      <circle cx="200" cy="200" r="188" fill="var(--card)" />

                      {visibleEntries.length > 0 ? visibleEntries.map((entry, index) => {
                        const point = labelPoint(index, visibleEntries.length)
                        const slice = 360 / visibleEntries.length
                        const angle = -90 + index * slice + slice / 2
                        const shortLabel = entry.length > (visibleEntries.length <= 12 ? 18 : 11)
                          ? `${entry.slice(0, visibleEntries.length <= 12 ? 17 : 10)}…`
                          : entry

                        return (
                          <g key={`${entry}-${index}`}>
                            <path
                              d={segmentPath(index, visibleEntries.length)}
                              fill={WHEEL_COLORS[index % WHEEL_COLORS.length]}
                              stroke="rgba(255,255,255,0.22)"
                              strokeWidth="1"
                            />
                            {visibleEntries.length <= 36 && (
                              <text
                                x={point.x}
                                y={point.y}
                                fill="white"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={visibleEntries.length <= 12 ? 12 : visibleEntries.length <= 24 ? 9 : 6}
                                fontWeight="600"
                                transform={`rotate(${angle + 90} ${point.x} ${point.y})`}
                              >
                                {shortLabel}
                              </text>
                            )}
                          </g>
                        )
                      }) : (
                        <circle cx="200" cy="200" r="184" fill="#111827" />
                      )}

                      <circle cx="200" cy="200" r="48" fill="var(--card)" stroke="rgba(59,130,246,0.5)" strokeWidth="3" />
                      <circle cx="200" cy="200" r="36" fill="#2563eb" />
                      <text x="200" y="201" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="700">
                        SPIN
                      </text>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                <Button
                  size="lg"
                  className="min-w-36 rounded-xl shadow-lg shadow-blue-500/15"
                  onClick={spin}
                  disabled={spinning || !entries.length}
                >
                  <Dices className="mr-2 h-5 w-5" />
                  {spinning ? "Spinning..." : "SPIN"}
                </Button>
              </div>
            </section>

            <aside className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold">Entries</p>
                  <p className="mt-1 text-xs text-muted-foreground">One entry per line</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEntriesOpen((value) => !value)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  aria-label="Toggle entries"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${entriesOpen ? "rotate-180" : ""}`} />
                </button>
              </div>

              {entriesOpen && (
                <div className="p-4">
                  <textarea
                    value={text}
                    onChange={(event) => syncEntries(event.target.value)}
                    placeholder="Enter names, ranks, tasks..."
                    className="min-h-[310px] w-full resize-y rounded-2xl border border-border bg-background px-3 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                  />

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={shuffleEntries} disabled={!entries.length}>
                      <Shuffle className="mr-2 h-4 w-4" />
                      Shuffle
                    </Button>
                    <Button variant="outline" size="sm" onClick={sortEntries} disabled={!entries.length}>
                      <ChevronDown className="mr-2 h-4 w-4 rotate-90" />
                      Sort
                    </Button>
                    <Button variant="outline" size="sm" onClick={copyEntries} disabled={!entries.length}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearEntries} disabled={!entries.length}>
                      <Eraser className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/70 bg-background/50 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total entries</span>
                      <span className="font-semibold">{entries.length}</span>
                    </div>
                    {entries.length > MAX_VISIBLE_SEGMENTS && (
                      <p className="mt-1 text-[11px] text-amber-500">
                        Only the first {MAX_VISIBLE_SEGMENTS} entries are displayed on the wheel.
                      </p>
                    )}
                  </div>

                  <Button variant="outline" className="mt-3 w-full" onClick={restoreDefaults}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore Example Entries
                  </Button>
                </div>
              )}
            </aside>
          </div>

          {settingsOpen && (
            <section className="mx-auto mt-5 max-w-5xl rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Customize wheel</p>
                  <p className="mt-1 text-xs text-muted-foreground">Control how the wheel behaves.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 p-3">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Spin duration</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setDuration((value) => Math.max(1, value - 1))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input value={`${duration}s`} readOnly className="text-center" />
                    <Button variant="outline" size="icon" onClick={() => setDuration((value) => Math.min(15, value + 1))}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRemoveWinner((value) => !value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${removeWinner ? "border-blue-500/30 bg-blue-500/5" : "border-border/70 hover:bg-muted/20"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Remove winner</span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${removeWinner ? "border-blue-500 bg-blue-500 text-white" : "border-border"}`}>
                      {removeWinner && <Check className="h-3 w-3" />}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Remove the selected entry after each spin.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfetti((value) => !value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${confetti ? "border-blue-500/30 bg-blue-500/5" : "border-border/70 hover:bg-muted/20"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Winner effects</span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${confetti ? "border-blue-500 bg-blue-500 text-white" : "border-border"}`}>
                      {confetti && <Check className="h-3 w-3" />}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Show a small winner celebration after the spin.</p>
                </button>
              </div>
            </section>
          )}

          {shareOpen && (
            <section className="mx-auto mt-4 max-w-2xl rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Share this wheel</p>
                  <p className="mt-1 text-xs text-muted-foreground">Copy this link to share the current entries and spin duration.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShareOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground break-all">
                {window.location.href}
              </div>
            </section>
          )}
        </div>
      </main>

      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setWinner(null)
        }}>
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-blue-500/20 bg-card p-7 text-center shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              onClick={() => setWinner(null)}
              aria-label="Close winner"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
              <Trophy className="h-7 w-7 text-blue-500" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">Winner</p>
            <h2 className="mt-2 break-words text-3xl font-bold tracking-tight">{winner}</h2>
            <p className="mt-2 text-sm text-muted-foreground">The wheel has selected this entry.</p>

            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setWinner(null)}>Close</Button>
              <Button onClick={() => { setWinner(null); window.setTimeout(spin, 150) }} disabled={entries.length === 0}>
                <Dices className="mr-2 h-4 w-4" />
                Spin Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => (
            <span
              key={index}
              className="absolute left-1/2 top-1/2 h-2 w-1 rounded-full bg-blue-500"
              style={{
                transform: `rotate(${index * 13}deg) translateY(-${100 + (index % 7) * 24}px)`,
                animation: `mpd-wheel-confetti 1.8s ease-out ${index * 18}ms forwards`,
                opacity: 0.9 - (index % 4) * 0.12,
              }}
            />
          ))}
        </div>
      )}

      <Footer />
    </div>
  )
}
