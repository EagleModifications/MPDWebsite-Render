import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dices,
  Download,
  Eraser,
  Image as ImageIcon,
  Maximize2,
  Minus,
  Palette,
  Plus,
  RotateCcw,
  Settings2,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const STORAGE_KEY = "mpd-public-spin-wheel-v4"
const MAX_WHEELS = 5
const MAX_VISIBLE_SEGMENTS = 120
const MAX_HISTORY = 100

const WHEEL_COLORS = [
  "#2563eb",
  "#3b82f6",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
]

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

type Wheel = {
  id: string
  name: string
  entries: string[]
  duration: number
  removeWinner: boolean
  confetti: boolean
  colors: string[]
  backgroundImage?: string
  centerImage?: string
  entryImages?: Record<string, string>
  spinning: boolean
  rotation: number
}

type ResultGroup = {
  id: string
  values: string[]
  at: string
}

type SavedState = {
  wheels: Array<Omit<Wheel, "spinning">>
  activeWheelId: string
  results: ResultGroup[]
  resultsOpen: boolean
}

type Tab = "wheel" | "results"

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

function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  return polar(200, 200, 126, -90 + index * slice + slice / 2)
}

function normaliseRotation(value: number) {
  return ((value % 360) + 360) % 360
}

function makeWheel(index: number): Wheel {
  return {
    id: createId(),
    name: `Wheel ${index + 1}`,
    entries: index === 0 ? defaultEntries : [],
    duration: 5,
    removeWinner: false,
    confetti: true,
    colors: [...WHEEL_COLORS],
    spinning: false,
    rotation: 0,
    entryImages: {},
  }
}

function parseEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export default function SpinWheel() {
  const [wheels, setWheels] = useState<Wheel[]>(() => [makeWheel(0)])
  const [activeWheelId, setActiveWheelId] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("wheel")
  const [results, setResults] = useState<ResultGroup[]>([])
  const [entriesOpen, setEntriesOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [resultWinner, setResultWinner] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const wheelAreaRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const shared = params.get("wheels")

      if (shared) {
        const decoded = JSON.parse(atob(shared)) as SavedState
        if (Array.isArray(decoded.wheels) && decoded.wheels.length) {
          const restored = decoded.wheels.slice(0, MAX_WHEELS).map((wheel, index) => ({
            ...makeWheel(index),
            ...wheel,
            spinning: false,
            rotation: Number(wheel.rotation) || 0,
          }))
          setWheels(restored)
          setActiveWheelId(restored.find((wheel) => wheel.id === decoded.activeWheelId)?.id ?? restored[0].id)
          setResults(Array.isArray(decoded.results) ? decoded.results.slice(0, MAX_HISTORY) : [])
          setLoaded(true)
          return
        }
      }

      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as SavedState
        if (Array.isArray(parsed.wheels) && parsed.wheels.length) {
          const restored = parsed.wheels.slice(0, MAX_WHEELS).map((wheel, index) => ({
            ...makeWheel(index),
            ...wheel,
            spinning: false,
            rotation: Number(wheel.rotation) || 0,
          }))
          setWheels(restored)
          setActiveWheelId(restored.find((wheel) => wheel.id === parsed.activeWheelId)?.id ?? restored[0].id)
          setResults(Array.isArray(parsed.results) ? parsed.results.slice(0, MAX_HISTORY) : [])
          setLoaded(true)
          return
        }
      }
    } catch {
      // Invalid shared/local state falls back to the default wheel.
    }

    const initial = makeWheel(0)
    setWheels([initial])
    setActiveWheelId(initial.id)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    const state: SavedState = {
      wheels: wheels.map(({ spinning: _spinning, ...wheel }) => wheel),
      activeWheelId,
      results: results.slice(0, MAX_HISTORY),
      resultsOpen: activeTab === "results",
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [wheels, activeWheelId, results, activeTab, loaded])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const activeWheelIndex = Math.max(0, wheels.findIndex((wheel) => wheel.id === activeWheelId))
  const activeWheel = wheels[activeWheelIndex] ?? wheels[0]

  const allSpinning = wheels.some((wheel) => wheel.spinning)

  const updateWheel = (id: string, updater: (wheel: Wheel) => Wheel) => {
    setWheels((current) => current.map((wheel) => (wheel.id === id ? updater(wheel) : wheel)))
  }

  const syncActiveEntries = (value: string) => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({ ...wheel, entries: parseEntries(value) }))
  }

  const setEntry = (index: number, value: string) => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => {
      const entries = [...wheel.entries]
      entries[index] = value
      return { ...wheel, entries }
    })
  }

  const addEntry = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: [...wheel.entries, `Entry ${wheel.entries.length + 1}`],
    }))
    setSelectedEntryIndex(activeWheel.entries.length)
  }

  const deleteEntry = (index: number) => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: wheel.entries.filter((_, entryIndex) => entryIndex !== index),
    }))
    setSelectedEntryIndex((current) => Math.max(0, Math.min(current, activeWheel.entries.length - 2)))
  }

  const duplicateEntry = (index: number) => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => {
      const entries = [...wheel.entries]
      entries.splice(index + 1, 0, entries[index])
      return { ...wheel, entries }
    })
  }

  const moveEntry = (index: number, direction: -1 | 1) => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= wheel.entries.length) return wheel
      const entries = [...wheel.entries]
      ;[entries[index], entries[nextIndex]] = [entries[nextIndex], entries[index]]
      return { ...wheel, entries }
    })
    setSelectedEntryIndex(index + direction)
  }

  const shuffleActive = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({ ...wheel, entries: shuffle(wheel.entries) }))
  }

  const sortActive = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: [...wheel.entries].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    }))
  }

  const clearActive = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({ ...wheel, entries: [] }))
    setSelectedEntryIndex(0)
  }

  const restoreActive = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: [...defaultEntries],
      rotation: 0,
    }))
  }

  const addWheel = () => {
    if (wheels.length >= MAX_WHEELS) {
      toast.error(`You can have a maximum of ${MAX_WHEELS} wheels.`)
      return
    }
    const wheel = makeWheel(wheels.length)
    setWheels((current) => [...current, wheel])
    setActiveWheelId(wheel.id)
    setActiveTab("wheel")
  }

  const removeWheel = () => {
    if (!activeWheel || wheels.length === 1) {
      toast.error("At least one wheel must remain.")
      return
    }
    const next = wheels.filter((wheel) => wheel.id !== activeWheel.id)
    const nextIndex = Math.min(activeWheelIndex, next.length - 1)
    setWheels(next)
    setActiveWheelId(next[nextIndex].id)
    setActiveTab("wheel")
  }

  const renameActive = () => {
    if (!activeWheel) return
    const name = window.prompt("Wheel name", activeWheel.name)?.trim()
    if (!name) return
    updateWheel(activeWheel.id, (wheel) => ({ ...wheel, name }))
  }

  const addImage = (type: "background" | "center" | "entry") => {
    setImageMenuOpen(false)
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file || !activeWheel) return

      const reader = new FileReader()
      reader.onload = () => {
        const value = String(reader.result ?? "")
        if (!value) return

        if (type === "background") {
          updateWheel(activeWheel.id, (wheel) => ({ ...wheel, backgroundImage: value }))
          toast.success("Background image added to the wheel.")
          return
        }

        if (type === "center") {
          updateWheel(activeWheel.id, (wheel) => ({ ...wheel, centerImage: value }))
          toast.success("Center image added to the wheel.")
          return
        }

        if (!activeWheel.entries.length) {
          toast.error("Add at least one entry before adding an entry image.")
          return
        }

        // Entry images intentionally assign to exactly one random entry each time
        // this action is used, matching the Wheel of Names behaviour.
        const randomIndex = secureRandom(activeWheel.entries.length)
        const randomEntry = activeWheel.entries[randomIndex]
        updateWheel(activeWheel.id, (wheel) => ({
          ...wheel,
          entryImages: {
            ...(wheel.entryImages ?? {}),
            [String(randomIndex)]: value,
          },
        }))
        setSelectedEntryIndex(randomIndex)
        toast.success(`Image added to ${randomEntry || `Entry ${randomIndex + 1}`}.`)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const spinWheel = (wheelId: string, selectedIndexOverride?: number, options?: { recordResult?: boolean; showWinner?: boolean }) => {
    const recordResult = options?.recordResult ?? true
    const showWinner = options?.showWinner ?? true
    const wheel = wheels.find((item) => item.id === wheelId)
    if (!wheel || wheel.spinning || !wheel.entries.length) return

    const visible = wheel.entries.slice(0, MAX_VISIBLE_SEGMENTS)
    const winnerIndex = selectedIndexOverride ?? secureRandom(visible.length)
    const slice = 360 / visible.length
    const centerAngle = winnerIndex * slice + slice / 2
    const current = normaliseRotation(wheel.rotation)
    const targetOffset = normaliseRotation(-centerAngle - current)
    const turns = 6 + secureRandom(4)
    const nextRotation = wheel.rotation + targetOffset + turns * 360
    const selectedWinner = visible[winnerIndex]

    updateWheel(wheel.id, (currentWheel) => ({
      ...currentWheel,
      spinning: true,
      rotation: nextRotation,
    }))

    const timer = window.setTimeout(() => {
      updateWheel(wheel.id, (currentWheel) => ({
        ...currentWheel,
        spinning: false,
        entries: currentWheel.removeWinner
          ? currentWheel.entries.filter((entry) => entry !== selectedWinner)
          : currentWheel.entries,
      }))

      if (showWinner) setResultWinner(selectedWinner)
      if (showWinner && wheel.confetti) setShowConfetti(true)

      if (showWinner && wheel.confetti) {
        const confettiTimer = window.setTimeout(() => setShowConfetti(false), 2200)
        timersRef.current.push(confettiTimer)
      }

      if (recordResult) {
        setResults((current) => [
          {
            id: createId(),
            values: [selectedWinner],
            at: new Date().toISOString(),
          },
          ...current,
        ].slice(0, MAX_HISTORY))
      }
    }, wheel.duration * 1000)

    timersRef.current.push(timer)
  }

  const spinAll = () => {
    const eligible = wheels.filter((wheel) => wheel.entries.length && !wheel.spinning)
    if (!eligible.length || allSpinning) return

    const selectedWinners: string[] = []
    eligible.forEach((wheel) => {
      const visible = wheel.entries.slice(0, MAX_VISIBLE_SEGMENTS)
      const index = secureRandom(visible.length)
      selectedWinners.push(visible[index])
      spinWheel(wheel.id, index, { recordResult: false, showWinner: false })
    })

    const maxDuration = Math.max(...eligible.map((wheel) => wheel.duration))
    const timer = window.setTimeout(() => {
      const combined = selectedWinners.join(" - ")
      setResultWinner(combined)
      setResults((current) => [
        {
          id: createId(),
          values: selectedWinners,
          at: new Date().toISOString(),
        },
        ...current,
      ].slice(0, MAX_HISTORY))
    }, maxDuration * 1000 + 100)
    timersRef.current.push(timer)
  }

  const copyResults = async () => {
    const text = results.map((result) => result.values.join(" - ")).join("\n")
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Results copied")
    } catch {
      toast.error("Unable to copy results")
    }
  }

  const exportResults = () => {
    const content = results.map((result) => result.values.join(" - ")).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "mpd-spin-wheel-results.txt"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const sortResults = () => {
    setResults((current) => [...current].sort((a, b) =>
      a.values.join(" - ").localeCompare(b.values.join(" - "), undefined, { sensitivity: "base" }),
    ))
  }

  const clearResults = () => setResults([])

  const shareWheels = async () => {
    const state: SavedState = {
      wheels: wheels.map(({ spinning: _spinning, ...wheel }) => wheel),
      activeWheelId,
      results: [],
      resultsOpen: false,
    }
    const encoded = btoa(JSON.stringify(state))
    const url = new URL(window.location.href)
    url.searchParams.set("wheels", encoded)
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success("Wheel link copied", {
        description: "The current wheels and entries are included.",
      })
    } catch {
      toast.error("Unable to copy the wheel link")
    }
  }

  if (!activeWheel) return null

  const shortLabel = (entry: string, count: number) => {
    const limit = count <= 12 ? 18 : count <= 24 ? 12 : 8
    return entry.length > limit ? `${entry.slice(0, limit - 1)}…` : entry
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_15%,rgba(59,130,246,0.10),transparent_35%)]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1600px] flex-col px-3 py-3 sm:px-5 lg:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Metro Police Department</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Spin the Wheel</h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={() => void shareWheels()}>
                <Copy className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Customize
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section
              ref={wheelAreaRef}
              className={`relative flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm backdrop-blur ${fullscreen ? "fixed inset-3 z-[100] min-h-0" : ""}`}
            >
              <button
                type="button"
                className="absolute left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-500 shadow-sm"
                onClick={() => setEntriesOpen((value) => !value)}
                aria-label="Toggle sidebar"
              >
                {entriesOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </button>

              <button
                type="button"
                className="absolute right-3 top-3 z-40 rounded-lg border border-border/70 bg-background/80 p-2 text-muted-foreground backdrop-blur hover:text-foreground"
                onClick={() => setFullscreen((value) => !value)}
                aria-label="Toggle fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                {wheels.length} {wheels.length === 1 ? "wheel" : "wheels"} · {wheels.reduce((total, wheel) => total + wheel.entries.length, 0)} entries
              </div>

              <div
                className={`min-h-0 flex-1 overflow-auto p-8 pt-14 ${
                  wheels.length === 1
                    ? "flex items-center justify-center"
                    : "grid content-center grid-cols-1 gap-8 sm:grid-cols-2 xl:gap-10"
                }`}
              >
                {wheels.map((wheel) => {
                  const entries = wheel.entries.slice(0, MAX_VISIBLE_SEGMENTS)
                  const wheelSize = wheels.length === 1
                    ? "w-[min(70vh,700px,72vw)]"
                    : wheels.length === 2
                      ? "w-[min(38vw,520px)]"
                      : wheels.length <= 4
                        ? "w-[min(31vw,430px)]"
                        : "w-[min(25vw,360px)]"

                  return (
                    <div
                      key={wheel.id}
                      className={`relative flex min-w-0 flex-col items-center justify-center rounded-2xl p-3 transition-all ${
                        wheel.id === activeWheel.id
                          ? "bg-blue-500/[0.035]"
                          : "bg-transparent"
                      }`}
                      onClick={() => setActiveWheelId(wheel.id)}
                    >
                      <div className="mb-2 flex w-full max-w-[520px] items-center justify-between px-2">
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                            wheel.id === activeWheel.id
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
                              : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setActiveWheelId(wheel.id)
                          }}
                        >
                          {wheel.name} · {wheel.entries.length}
                        </button>
                        {wheel.spinning && (
                          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-500">
                            Spinning...
                          </span>
                        )}
                      </div>

                      <div className="relative flex w-full items-center justify-center">
                        <div className="absolute top-[-7px] z-30 drop-shadow-lg">
                          <div className="h-0 w-0 border-l-[13px] border-r-[13px] border-t-[27px] border-l-transparent border-r-transparent border-t-blue-500" />
                        </div>

                        <div className={`relative aspect-square ${wheelSize} max-w-full rounded-full bg-background p-1.5 shadow-[0_0_70px_rgba(37,99,235,0.12)]`}>
                          <button
                            type="button"
                            className="relative block h-full w-full cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                            onClick={(event) => {
                              event.stopPropagation()
                              setActiveWheelId(wheel.id)
                              spinWheel(wheel.id)
                            }}
                            disabled={allSpinning || !entries.length}
                            aria-label={`Spin ${wheel.name}`}
                          >
                            <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible rounded-full">
                              <defs>
                                <clipPath id={`wheel-bg-${wheel.id}`}>
                                  <circle cx="200" cy="200" r="184" />
                                </clipPath>
                              </defs>

                              <g
                                style={{
                                  transform: `rotate(${wheel.rotation}deg)`,
                                  transformOrigin: "200px 200px",
                                  transition: wheel.spinning
                                    ? `transform ${wheel.duration}s cubic-bezier(0.12,0.74,0.16,1)`
                                    : "none",
                                }}
                              >
                                {wheel.backgroundImage && (
                                  <image
                                    href={wheel.backgroundImage}
                                    x="16"
                                    y="16"
                                    width="368"
                                    height="368"
                                    preserveAspectRatio="xMidYMid slice"
                                    opacity="0.5"
                                    clipPath={`url(#wheel-bg-${wheel.id})`}
                                  />
                                )}
                                {!wheel.backgroundImage && <circle cx="200" cy="200" r="188" fill="var(--card)" />}

                                {entries.length ? entries.map((entry, index) => {
                                  const point = labelPoint(index, entries.length)
                                  const slice = 360 / entries.length
                                  const angle = -90 + index * slice + slice / 2
                                  const entryImage = wheel.entryImages?.[String(index)]
                                  const textOffset = entryImage ? (entries.length <= 12 ? 17 : 13) : 0
                                  return (
                                    <g key={`${wheel.id}-${index}-${entry}`}>
                                      <path
                                        d={segmentPath(index, entries.length)}
                                        fill={wheel.colors[index % wheel.colors.length]}
                                        fillOpacity={wheel.backgroundImage ? 0.8 : 1}
                                        stroke="rgba(255,255,255,0.28)"
                                        strokeWidth="1"
                                      />
                                      {entries.length <= 42 && (
                                        <g transform={`rotate(${angle + 90} ${point.x} ${point.y})`}>
                                          {entryImage && (
                                            <image
                                              href={entryImage}
                                              x={point.x - (entries.length <= 12 ? 14 : 9)}
                                              y={point.y - (entries.length <= 12 ? 28 : 19)}
                                              width={entries.length <= 12 ? 28 : 18}
                                              height={entries.length <= 12 ? 28 : 18}
                                              preserveAspectRatio="xMidYMid slice"
                                            />
                                          )}
                                          <text
                                            x={point.x}
                                            y={point.y + textOffset}
                                            fill="white"
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize={entries.length <= 12 ? 12 : entries.length <= 24 ? 9 : 6}
                                            fontWeight="600"
                                          >
                                            {shortLabel(entry, entries.length)}
                                          </text>
                                        </g>
                                      )}
                                    </g>
                                  )
                                }) : (
                                  <circle cx="200" cy="200" r="184" fill="#111827" />
                                )}

                                <circle cx="200" cy="200" r="50" fill="var(--card)" stroke="rgba(59,130,246,.45)" strokeWidth="3" />
                                {wheel.centerImage ? (
                                  <image href={wheel.centerImage} x="170" y="170" width="60" height="60" preserveAspectRatio="xMidYMid slice" />
                                ) : (
                                  <circle cx="200" cy="200" r="37" fill="#2563eb" />
                                )}
                              </g>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="mt-3 min-w-28"
                        onClick={(event) => {
                          event.stopPropagation()
                          setActiveWheelId(wheel.id)
                          spinWheel(wheel.id)
                        }}
                        disabled={allSpinning || !entries.length}
                      >
                        <Dices className="mr-2 h-4 w-4" />
                        {wheel.spinning ? "Spinning..." : "Spin"}
                      </Button>
                    </div>
                  )
                })}
              </div>

              {wheels.length > 1 && (
                <div className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2">
                  <Button variant="outline" size="sm" onClick={spinAll} disabled={allSpinning || !wheels.some((wheel) => wheel.entries.length)}>
                    <Dices className="mr-2 h-4 w-4" />
                    Spin all wheels
                  </Button>
                </div>
              )}
            </section>

            {entriesOpen && (
              <aside className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm backdrop-blur">
                <div className="flex shrink-0 items-center overflow-x-auto border-b border-border/70 bg-muted/10 px-2 pt-2">
                  {wheels.map((wheel, index) => (
                    <button
                      key={wheel.id}
                      type="button"
                      onClick={() => { setActiveWheelId(wheel.id); setActiveTab("wheel") }}
                      className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${activeTab === "wheel" && wheel.id === activeWheelId ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {wheel.name}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{wheel.entries.length}</span>
                      {activeTab === "wheel" && wheel.id === activeWheelId && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-500" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveTab("results")}
                    className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${activeTab === "results" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Results
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{results.length}</span>
                    {activeTab === "results" && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-500" />}
                  </button>
                </div>

                {activeTab === "results" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 flex-wrap gap-2 border-b border-border/70 p-3">
                      <Button variant="outline" size="sm" onClick={sortResults} disabled={!results.length}>
                        <ArrowUp className="mr-2 h-4 w-4" />
                        Sort
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearResults} disabled={!results.length}>
                        <X className="mr-2 h-4 w-4" />
                        Clear results
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportResults} disabled={!results.length}>
                        <Download className="mr-2 h-4 w-4" />
                        Export results
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                      {results.length ? results.map((result) => (
                        <div key={result.id} className="border-b border-border/70 px-2 py-2.5 last:border-b-0">
                          <p className="text-sm font-medium leading-5">{result.values.join(" - ")}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(result.at).toLocaleString("en-GB")}</p>
                        </div>
                      )) : (
                        <div className="flex h-full min-h-48 items-center justify-center text-center text-xs text-muted-foreground">Spin a wheel to create results.</div>
                      )}
                    </div>
                    <div className="shrink-0 border-t border-border/70 p-3">
                      <Button variant="outline" className="w-full" onClick={() => void copyResults()} disabled={!results.length}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy results
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 p-3">
                      <Button variant="outline" size="sm" onClick={shuffleActive} disabled={!activeWheel.entries.length}>
                        <Shuffle className="mr-2 h-4 w-4" />
                        Shuffle
                      </Button>
                      <Button variant="outline" size="sm" onClick={sortActive} disabled={!activeWheel.entries.length}>
                        <ArrowDown className="mr-2 h-4 w-4" />
                        Sort
                      </Button>
                      <div className="relative">
                        <Button variant="outline" size="sm" onClick={() => setImageMenuOpen((value) => !value)}>
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Add image
                          <ChevronDown className={`ml-2 h-3.5 w-3.5 transition-transform ${imageMenuOpen ? "rotate-180" : ""}`} />
                        </Button>
                        {imageMenuOpen && (
                          <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl">
                            <button type="button" onClick={() => addImage("background")} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-muted">
                              <div className="h-5 w-5 rounded-full bg-blue-500" />
                              Add background image
                            </button>
                            <button type="button" onClick={() => addImage("center")} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-muted">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted"><Dices className="h-3 w-3" /></div>
                              Add center image
                            </button>
                            <button type="button" onClick={() => addImage("entry")} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-muted">
                              <div className="h-5 w-5 rounded bg-muted" />
                              Add image as entry
                            </button>
                          </div>
                        )}
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                        <input type="checkbox" checked={advancedOpen} onChange={(event) => setAdvancedOpen(event.target.checked)} className="h-4 w-4 accent-blue-500" />
                        Advanced
                      </label>
                    </div>

                    {!advancedOpen ? (
                      <div className="min-h-0 flex-1 p-3">
                        <textarea
                          value={activeWheel.entries.join("\n")}
                          onChange={(event) => syncActiveEntries(event.target.value)}
                          placeholder="Enter one entry per line..."
                          className="h-full min-h-[470px] w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                        />
                      </div>
                    ) : (
                      <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        <div className="space-y-2">
                          {activeWheel.entries.map((entry, index) => (
                            <div key={`${index}-${entry}`} className="rounded-lg border border-border/70 bg-background/60 p-2.5">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                  <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => moveEntry(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></button>
                                  <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => moveEntry(index, 1)} disabled={index === activeWheel.entries.length - 1}><ArrowDown className="h-3.5 w-3.5" /></button>
                                </div>
                                {activeWheel.entryImages?.[String(index)] ? (
                                  <img
                                    src={activeWheel.entryImages[String(index)]}
                                    alt=""
                                    className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
                                  />
                                ) : null}
                                <Input value={entry} onFocus={() => setSelectedEntryIndex(index)} onChange={(event) => setEntry(index, event.target.value)} className="h-9 flex-1" />
                                <button type="button" onClick={() => duplicateEntry(index)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Duplicate"><Copy className="h-4 w-4" /></button>
                                <button type="button" onClick={() => deleteEntry(index)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete"><X className="h-4 w-4" /></button>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>Entry {index + 1}</span>
                                <span>Weight 1 · {(100 / Math.max(1, activeWheel.entries.length)).toFixed(1)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {advancedOpen && (
                      <div className="shrink-0 border-t border-border/70 p-3">
                        <Button className="w-full" onClick={addEntry}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add entry
                        </Button>
                      </div>
                    )}

                    <div className="shrink-0 border-t border-border/70 p-3">
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={clearActive} disabled={!activeWheel.entries.length}>
                          <Eraser className="mr-2 h-4 w-4" />
                          Clear list
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={restoreActive}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="shrink-0 border-t border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative">
                      <Button variant="outline" size="sm" onClick={addWheel} disabled={wheels.length >= MAX_WHEELS}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add wheel
                        <ChevronDown className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{wheels.length}/{MAX_WHEELS} wheels</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={renameActive}>
                      Rename {activeWheel.name}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCustomizeOpen(true)}>
                      <Palette className="mr-2 h-4 w-4" />
                      Customize
                    </Button>
                    {wheels.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={removeWheel}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove {activeWheel.name}
                      </Button>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>

      {resultWinner && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setResultWinner(null) }}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-500/20 bg-card p-7 text-center shadow-2xl">
            <button type="button" className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setResultWinner(null)} aria-label="Close winner">
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
              <Trophy className="h-7 w-7 text-blue-500" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Winner</p>
            <h2 className="mt-2 break-words text-3xl font-bold tracking-tight">{resultWinner}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Selected from {wheels.length > 1 ? "the active wheels" : activeWheel.name}.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setResultWinner(null)}>Close</Button>
              <Button onClick={() => { setResultWinner(null); window.setTimeout(() => spinWheel(activeWheel.id), 150) }} disabled={allSpinning || !activeWheel.entries.length}>
                <Dices className="mr-2 h-4 w-4" />
                Spin Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {customizeOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomizeOpen(false) }}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-blue-500" />Customize {activeWheel.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">Control how this wheel spins and handles winners.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCustomizeOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs font-semibold">Spin duration</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, duration: Math.max(1, wheel.duration - 1) }))}><Minus className="h-4 w-4" /></Button>
                  <Input value={`${activeWheel.duration}s`} readOnly className="text-center" />
                  <Button variant="outline" size="icon" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, duration: Math.min(15, wheel.duration + 1) }))}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <button type="button" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, removeWinner: !wheel.removeWinner }))} className={`rounded-xl border p-3 text-left ${activeWheel.removeWinner ? "border-blue-500/30 bg-blue-500/5" : "border-border/70"}`}>
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Remove winner</span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${activeWheel.removeWinner ? "border-blue-500 bg-blue-500 text-white" : "border-border"}`}>{activeWheel.removeWinner && <Check className="h-3 w-3" />}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">Remove the winner after each spin.</p>
              </button>
              <button type="button" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, confetti: !wheel.confetti }))} className={`rounded-xl border p-3 text-left ${activeWheel.confetti ? "border-blue-500/30 bg-blue-500/5" : "border-border/70"}`}>
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Winner effects</span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${activeWheel.confetti ? "border-blue-500 bg-blue-500 text-white" : "border-border"}`}>{activeWheel.confetti && <Check className="h-3 w-3" />}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">Show the winner celebration.</p>
              </button>
              <div className="rounded-xl border border-border/70 p-3">
                <p className="text-xs font-semibold">Wheel actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { updateWheel(activeWheel.id, (wheel) => ({ ...wheel, rotation: 0 })); setCustomizeOpen(false) }}>Reset rotation</Button>
                  <Button variant="outline" size="sm" onClick={() => { setResults([]); setCustomizeOpen(false) }}>Clear results</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[130] overflow-hidden" aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => (
            <span
              key={index}
              className="absolute left-1/2 top-1/2 h-2 w-1 rounded-full bg-blue-500"
              style={{
                transform: `rotate(${index * 11}deg) translateY(-${120 + (index % 8) * 24}px)`,
                animation: `mpd-wheel-confetti 1.8s ease-out ${index * 16}ms forwards`,
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
