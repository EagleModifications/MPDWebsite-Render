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

const STORAGE_KEY = "mpd-public-spin-wheel-v5"
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

type Entry = {
  id: string
  text: string
  color: string
  weight: number
  visible: boolean
  image?: string
  popupMessage?: string
}

type Wheel = {
  id: string
  name: string
  entries: Entry[]
  duration: number
  removeWinner: boolean
  confetti: boolean
  rotation: number
  backgroundImage?: string
  centerImage?: string
  centerSize: number
  backgroundColor: string
  spinning: boolean
}

type Result = {
  id: string
  values: string[]
  at: string
}

type SavedState = {
  wheels: Array<Omit<Wheel, "spinning">>
  activeWheelId: string
  results: Result[]
}

type Tab = "wheel" | "results"

function createId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function randomInt(max: number) {
  if (max <= 1) return 0
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return Math.floor((values[0] / 4294967296) * max)
  }
  return Math.floor(Math.random() * max)
}

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1)
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return next
}

function makeEntry(text: string, index: number): Entry {
  return {
    id: createId(),
    text,
    color: WHEEL_COLORS[index % WHEEL_COLORS.length],
    weight: 1,
    visible: true,
  }
}

function makeWheel(index: number): Wheel {
  return {
    id: createId(),
    name: `Wheel ${index + 1}`,
    entries: index === 0 ? DEFAULT_ENTRIES.map(makeEntry) : [],
    duration: 5,
    removeWinner: false,
    confetti: true,
    rotation: 0,
    centerSize: 50,
    backgroundColor: "#111111",
    spinning: false,
  }
}

function normaliseRotation(value: number) {
  return ((value % 360) + 360) % 360
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function weightedEntries(entries: Entry[]) {
  return entries.filter((entry) => entry.visible && entry.text.trim()).slice(0, MAX_VISIBLE_SEGMENTS)
}

function segmentPath(startAngle: number, endAngle: number) {
  const start = polar(200, 200, 184, startAngle)
  const end = polar(200, 200, 184, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M 200 200 L ${start.x} ${start.y} A 184 184 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function textPoint(angle: number, radius: number) {
  return polar(200, 200, radius, angle)
}

function pickWeighted(entries: Entry[]) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0.01, entry.weight), 0)
  let cursor = Math.random() * total
  for (let index = 0; index < entries.length; index += 1) {
    cursor -= Math.max(0.01, entries[index].weight)
    if (cursor <= 0) return index
  }
  return Math.max(0, entries.length - 1)
}

function readImage(type: "background" | "center" | "entry", onImage: (value: string) => void) {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = "image/*"
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImage(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  }
  input.click()
}

export default function SpinWheel() {
  const [wheels, setWheels] = useState<Wheel[]>(() => [makeWheel(0)])
  const [activeWheelId, setActiveWheelId] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("wheel")
  const [results, setResults] = useState<Result[]>([])
  const [advanced, setAdvanced] = useState(false)
  const [entriesOpen, setEntriesOpen] = useState(true)
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const [addWheelMenuOpen, setAddWheelMenuOpen] = useState(false)
  const [advancedEntry, setAdvancedEntry] = useState<{ wheelId: string; entryIndex: number } | null>(null)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [spinningAll, setSpinningAll] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const shared = params.get("wheels")
      const raw = shared ? atob(shared) : localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as SavedState
        if (Array.isArray(parsed.wheels) && parsed.wheels.length) {
          const restored = parsed.wheels.slice(0, MAX_WHEELS).map((wheel, index) => ({
            ...makeWheel(index),
            ...wheel,
            entries: Array.isArray(wheel.entries)
              ? wheel.entries.map((entry, entryIndex) => ({
                  ...makeEntry(String(entry.text ?? ""), entryIndex),
                  ...entry,
                  id: String(entry.id || createId()),
                  weight: Math.max(0.01, Number(entry.weight) || 1),
                  visible: entry.visible !== false,
                }))
              : [],
            spinning: false,
          }))
          setWheels(restored)
          setActiveWheelId(restored.find((wheel) => wheel.id === parsed.activeWheelId)?.id ?? restored[0].id)
          setResults(Array.isArray(parsed.results) ? parsed.results.slice(0, MAX_HISTORY) : [])
        }
      }
    } catch {
      // Ignore invalid local/share state and use defaults.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!activeWheelId && wheels[0]) setActiveWheelId(wheels[0].id)
  }, [activeWheelId, wheels])

  useEffect(() => {
    if (!loaded) return
    const state: SavedState = {
      wheels: wheels.map(({ spinning: _spinning, ...wheel }) => wheel),
      activeWheelId,
      results,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [wheels, activeWheelId, results, loaded])

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const activeWheel = wheels.find((wheel) => wheel.id === activeWheelId) ?? wheels[0]
  const activeWheelIndex = Math.max(0, wheels.findIndex((wheel) => wheel.id === activeWheel?.id))
  const anySpinning = spinningAll || wheels.some((wheel) => wheel.spinning)

  const visibleEntries = useMemo(
    () => weightedEntries(activeWheel?.entries ?? []),
    [activeWheel],
  )

  const updateWheel = (id: string, updater: (wheel: Wheel) => Wheel) => {
    setWheels((current) => current.map((wheel) => (wheel.id === id ? updater(wheel) : wheel)))
  }

  const updateEntry = (wheelId: string, entryIndex: number, updater: (entry: Entry) => Entry) => {
    updateWheel(wheelId, (wheel) => ({
      ...wheel,
      entries: wheel.entries.map((entry, index) => (index === entryIndex ? updater(entry) : entry)),
    }))
  }

  const setEntriesFromText = (value: string) => {
    if (!activeWheel) return
    const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: lines.map((line, index) => {
        const existing = wheel.entries[index]
        return existing ? { ...existing, text: line } : makeEntry(line, index)
      }),
    }))
  }

  const addEntry = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: [...wheel.entries, makeEntry(`Entry ${wheel.entries.length + 1}`, wheel.entries.length)],
    }))
  }

  const removeEntry = (index: number) => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: wheel.entries.filter((_, entryIndex) => entryIndex !== index),
    }))
  }

  const duplicateEntry = (index: number) => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => {
      const copy = { ...wheel.entries[index], id: createId() }
      const entries = [...wheel.entries]
      entries.splice(index + 1, 0, copy)
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
  }

  const shuffleEntries = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({ ...wheel, entries: shuffle(wheel.entries) }))
  }

  const sortEntries = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: [...wheel.entries].sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: "base" })),
    }))
  }

  const clearEntries = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({ ...wheel, entries: [] }))
  }

  const restoreEntries = () => {
    if (!activeWheel) return
    updateWheel(activeWheel.id, (wheel) => ({
      ...wheel,
      entries: DEFAULT_ENTRIES.map(makeEntry),
      rotation: 0,
    }))
  }

  const addWheel = () => {
    if (wheels.length >= MAX_WHEELS) {
      toast.error(`You can have a maximum of ${MAX_WHEELS} wheels.`)
      return
    }
    const next = makeWheel(wheels.length)
    setWheels((current) => [...current, next])
    setActiveWheelId(next.id)
    setActiveTab("wheel")
    setAddWheelMenuOpen(false)
  }

  const removeActiveWheel = () => {
    if (wheels.length <= 1 || !activeWheel) {
      toast.error("At least one wheel must remain.")
      return
    }
    const remaining = wheels.filter((wheel) => wheel.id !== activeWheel.id)
    setWheels(remaining)
    setActiveWheelId(remaining[Math.min(activeWheelIndex, remaining.length - 1)].id)
  }

  const renameActiveWheel = () => {
    if (!activeWheel) return
    const name = window.prompt("Rename wheel", activeWheel.name)?.trim()
    if (name) updateWheel(activeWheel.id, (wheel) => ({ ...wheel, name }))
  }

  const addImage = (type: "background" | "center" | "entry") => {
    setImageMenuOpen(false)
    if (!activeWheel) return

    if (type === "entry" && !activeWheel.entries.length) {
      toast.error("Add at least one entry before adding an entry image.")
      return
    }

    readImage(type, (value) => {
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

      // Wheel of Names style: each click assigns the uploaded image to one random entry.
      const index = randomInt(activeWheel.entries.length)
      updateEntry(activeWheel.id, index, (entry) => ({ ...entry, image: value }))
      toast.success(`Entry image added to ${activeWheel.entries[index]?.text || `Entry ${index + 1}`}.`)
    })
  }

  const spinWheel = (wheelId: string, winnerIndex?: number, record = true, showWinner = true) => {
    const wheel = wheels.find((item) => item.id === wheelId)
    if (!wheel || wheel.spinning || !wheel.entries.length) return

    const candidates = weightedEntries(wheel.entries)
    if (!candidates.length) return
    const selectedIndex = winnerIndex ?? pickWeighted(candidates)
    const selected = candidates[selectedIndex]
    const totalWeight = candidates.reduce((sum, entry) => sum + Math.max(0.01, entry.weight), 0)
    let cursor = 0
    for (let index = 0; index < selectedIndex; index += 1) cursor += Math.max(0.01, candidates[index].weight)
    const start = cursor / totalWeight * 360
    const size = Math.max(0.01, selected.weight) / totalWeight * 360
    const centerAngle = start + size / 2
    const current = normaliseRotation(wheel.rotation)
    const offset = normaliseRotation(-90 - centerAngle - current)
    const turns = 6 + randomInt(4)
    const target = wheel.rotation + offset + turns * 360

    updateWheel(wheel.id, (currentWheel) => ({ ...currentWheel, spinning: true, rotation: target }))

    const timer = window.setTimeout(() => {
      updateWheel(wheel.id, (currentWheel) => ({
        ...currentWheel,
        spinning: false,
        entries: currentWheel.removeWinner
          ? currentWheel.entries.filter((entry) => entry.id !== selected.id)
          : currentWheel.entries,
      }))

      if (record) {
        setResults((currentResults) => [
          { id: createId(), values: [selected.text], at: new Date().toISOString() },
          ...currentResults,
        ].slice(0, MAX_HISTORY))
      }
      if (showWinner) {
        setWinner(selected.text)
        if (wheel.confetti) {
          setShowConfetti(true)
          const confettiTimer = window.setTimeout(() => setShowConfetti(false), 2200)
          timers.current.push(confettiTimer)
        }
      }
    }, wheel.duration * 1000)

    timers.current.push(timer)
  }

  const spinAll = () => {
    if (anySpinning) return
    const eligible = wheels.filter((wheel) => weightedEntries(wheel.entries).length)
    if (!eligible.length) return
    setSpinningAll(true)
    const selected: string[] = []
    let maxDuration = 0

    eligible.forEach((wheel) => {
      const candidates = weightedEntries(wheel.entries)
      const index = pickWeighted(candidates)
      selected.push(candidates[index].text)
      maxDuration = Math.max(maxDuration, wheel.duration)
      spinWheel(wheel.id, index, false, false)
    })

    const timer = window.setTimeout(() => {
      setSpinningAll(false)
      const line = selected.join(" - ")
      setWinner(line)
      setResults((current) => [
        { id: createId(), values: selected, at: new Date().toISOString() },
        ...current,
      ].slice(0, MAX_HISTORY))
    }, maxDuration * 1000 + 150)
    timers.current.push(timer)
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
    if (!results.length) return
    const blob = new Blob([results.map((result) => result.values.join(" - ")).join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "mpd-spin-wheel-results.txt"
    link.click()
    URL.revokeObjectURL(url)
  }

  const shareWheel = async () => {
    const state: SavedState = {
      wheels: wheels.map(({ spinning: _spinning, ...wheel }) => wheel),
      activeWheelId,
      results: [],
    }
    const url = new URL(window.location.href)
    url.searchParams.set("wheels", btoa(JSON.stringify(state)))
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success("Wheel link copied")
    } catch {
      toast.error("Unable to copy the wheel link")
    }
  }

  const sortResults = () => {
    setResults((current) => [...current].sort((a, b) => a.values.join(" - ").localeCompare(b.values.join(" - "), undefined, { sensitivity: "base" })))
  }

  const clearResults = () => setResults([])

  if (!activeWheel) return null

  const sidebarEntries = activeWheel.entries
  const textareaValue = sidebarEntries.map((entry) => entry.text).join("\n")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_15%,rgba(59,130,246,0.08),transparent_36%)]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1700px] flex-col px-3 py-3 sm:px-5 lg:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">Metro Police Department</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Spin the Wheel</h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={() => void shareWheel()}>
                <Copy className="mr-2 h-4 w-4" /> Share
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" /> Customize
              </Button>
            </div>
          </div>

          <div className={`${fullscreen ? "fixed inset-3 z-[100]" : ""} grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_390px]`}>
            <section className="relative flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/55 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => setEntriesOpen((value) => !value)}
                className="absolute left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-blue-500/30 bg-background/80 text-blue-500 shadow-sm backdrop-blur"
                aria-label="Toggle editor"
              >
                {entriesOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setFullscreen((value) => !value)}
                className="absolute right-3 top-3 z-50 rounded-lg border border-border/70 bg-background/80 p-2 text-muted-foreground backdrop-blur hover:text-foreground"
                aria-label="Fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                {wheels.length} {wheels.length === 1 ? "wheel" : "wheels"} · {wheels.reduce((sum, wheel) => sum + wheel.entries.length, 0)} entries
              </div>

              <div className={`min-h-0 flex-1 overflow-auto p-8 pt-14 ${wheels.length === 1 ? "flex items-center justify-center" : "grid content-center grid-cols-1 gap-7 sm:grid-cols-2 xl:gap-8"}`}>
                {wheels.map((wheel) => {
                  const entries = weightedEntries(wheel.entries)
                  const wheelWidth = wheels.length === 1
                    ? "w-[min(70vh,680px,72vw)]"
                    : wheels.length === 2
                      ? "w-[min(35vw,480px)]"
                      : wheels.length <= 4
                        ? "w-[min(28vw,400px)]"
                        : "w-[min(22vw,320px)]"

                  return (
                    <div key={wheel.id} className={`flex min-w-0 flex-col items-center justify-center rounded-2xl p-2 transition ${wheel.id === activeWheel.id ? "bg-blue-500/[0.035]" : ""}`} onClick={() => setActiveWheelId(wheel.id)}>
                      <div className="mb-2 flex w-full max-w-[520px] items-center justify-between px-2">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setActiveWheelId(wheel.id); setActiveTab("wheel") }}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${wheel.id === activeWheel.id ? "border-blue-500/30 bg-blue-500/10 text-blue-500" : "border-border/70 bg-background/70 text-muted-foreground"}`}
                        >
                          {wheel.name} <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{wheel.entries.length}</span>
                        </button>
                        {wheel.spinning && <span className="text-[10px] font-medium text-blue-500">Spinning...</span>}
                      </div>

                      <div className="relative flex w-full items-center justify-center">
                        <div className="absolute top-[-6px] z-30 h-0 w-0 border-l-[14px] border-r-[14px] border-t-[29px] border-l-transparent border-r-transparent border-t-blue-500 drop-shadow-lg" />
                        <div className={`relative aspect-square ${wheelWidth} max-w-full rounded-full bg-black p-1.5 shadow-[0_0_70px_rgba(37,99,235,0.14)]`}>
                          <button
                            type="button"
                            className="relative block h-full w-full cursor-pointer rounded-full bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            disabled={anySpinning || !entries.length}
                            onClick={(event) => { event.stopPropagation(); setActiveWheelId(wheel.id); spinWheel(wheel.id) }}
                            aria-label={`Spin ${wheel.name}`}
                          >
                            <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible rounded-full">
                              <defs>
                                <clipPath id={`wheel-bg-${wheel.id}`}><circle cx="200" cy="200" r="184" /></clipPath>
                              </defs>
                              <g style={{ transform: `rotate(${wheel.rotation}deg)`, transformOrigin: "200px 200px", transition: wheel.spinning ? `transform ${wheel.duration}s cubic-bezier(0.12,0.74,0.16,1)` : "none" }}>
                                {wheel.backgroundImage && (
                                  <image href={wheel.backgroundImage} x="16" y="16" width="368" height="368" preserveAspectRatio="xMidYMid slice" clipPath={`url(#wheel-bg-${wheel.id})`} opacity="0.46" />
                                )}
                                <circle cx="200" cy="200" r="184" fill={wheel.backgroundImage ? "transparent" : wheel.backgroundColor} />

                                {entries.length ? (() => {
                                  const total = entries.reduce((sum, entry) => sum + Math.max(0.01, entry.weight), 0)
                                  let cursor = -90
                                  return entries.map((entry) => {
                                    const size = Math.max(0.01, entry.weight) / total * 360
                                    const start = cursor
                                    const end = cursor + size
                                    const mid = start + size / 2
                                    cursor = end
                                    const point = textPoint(mid, entries.length <= 12 ? 126 : entries.length <= 24 ? 135 : 142)
                                    const imageSize = entries.length <= 12 ? 28 : entries.length <= 24 ? 20 : 14
                                    return (
                                      <g key={entry.id}>
                                        <path d={segmentPath(start, end)} fill={entry.color} fillOpacity={wheel.backgroundImage ? 0.78 : 1} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                                        {entries.length <= 50 && (
                                          <g transform={`rotate(${mid + 90} ${point.x} ${point.y})`}>
                                            {entry.image && <image href={entry.image} x={point.x - imageSize / 2} y={point.y - imageSize - 6} width={imageSize} height={imageSize} preserveAspectRatio="xMidYMid slice" />}
                                            <text x={point.x} y={point.y + (entry.image ? imageSize / 2 : 0)} fill="white" textAnchor="middle" dominantBaseline="middle" fontSize={entries.length <= 12 ? 12 : entries.length <= 24 ? 9 : 6} fontWeight="600">
                                              {entry.text.length > (entries.length <= 12 ? 18 : entries.length <= 24 ? 12 : 8) ? `${entry.text.slice(0, entries.length <= 12 ? 17 : entries.length <= 24 ? 11 : 7)}…` : entry.text}
                                            </text>
                                          </g>
                                        )}
                                      </g>
                                    )
                                  })
                                })() : <circle cx="200" cy="200" r="184" fill={wheel.backgroundColor} />}

                                <circle cx="200" cy="200" r={wheel.centerSize} fill={wheel.backgroundColor} stroke="rgba(59,130,246,.55)" strokeWidth="3" />
                                {wheel.centerImage && <image href={wheel.centerImage} x={200 - wheel.centerSize + 5} y={200 - wheel.centerSize + 5} width={(wheel.centerSize - 5) * 2} height={(wheel.centerSize - 5) * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#wheel-bg-${wheel.id})`} />}
                              </g>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <Button size="sm" className="mt-3 min-w-28" disabled={anySpinning || !entries.length} onClick={(event) => { event.stopPropagation(); setActiveWheelId(wheel.id); spinWheel(wheel.id) }}>
                        <Dices className="mr-2 h-4 w-4" />
                        {wheel.spinning ? "Spinning..." : "Spin"}
                      </Button>
                    </div>
                  )
                })}
              </div>

              {wheels.length > 1 && (
                <div className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2">
                  <Button variant="outline" onClick={spinAll} disabled={anySpinning || !wheels.some((wheel) => weightedEntries(wheel.entries).length)}>
                    <Dices className="mr-2 h-4 w-4" /> Spin all wheels
                  </Button>
                </div>
              )}
            </section>

            {entriesOpen && (
              <aside className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm backdrop-blur">
                <div className="flex shrink-0 items-end overflow-x-auto border-b border-border/70 px-2 pt-1">
                  {wheels.map((wheel) => (
                    <button key={wheel.id} type="button" onClick={() => { setActiveWheelId(wheel.id); setActiveTab("wheel") }} className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-xs font-semibold ${activeTab === "wheel" && activeWheel.id === wheel.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {wheel.name}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{wheel.entries.length}</span>
                      {activeTab === "wheel" && activeWheel.id === wheel.id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-500" />}
                    </button>
                  ))}
                  <button type="button" onClick={() => setActiveTab("results")} className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-xs font-semibold ${activeTab === "results" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    Results <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{results.length}</span>
                    {activeTab === "results" && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-500" />}
                  </button>
                </div>

                {activeTab === "results" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 flex-wrap gap-2 border-b border-border/70 p-3">
                      <Button variant="outline" size="sm" onClick={sortResults} disabled={!results.length}><ArrowDown className="mr-2 h-4 w-4" /> Sort</Button>
                      <Button variant="outline" size="sm" onClick={clearResults} disabled={!results.length}><X className="mr-2 h-4 w-4" /> Clear the list</Button>
                      <Button variant="outline" size="sm" onClick={exportResults} disabled={!results.length}><Download className="mr-2 h-4 w-4" /> Export results</Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                      {results.length ? results.map((result) => (
                        <div key={result.id} className="border-b border-border/70 px-2 py-2.5 last:border-0">
                          <p className="text-sm font-medium">{result.values.join(" - ")}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(result.at).toLocaleString("en-GB")}</p>
                        </div>
                      )) : <div className="flex h-full min-h-48 items-center justify-center text-center text-xs text-muted-foreground">Spin the wheel to create results.</div>}
                    </div>
                    <div className="shrink-0 border-t border-border/70 p-3"><Button variant="outline" className="w-full" onClick={() => void copyResults()} disabled={!results.length}><Copy className="mr-2 h-4 w-4" /> Copy results</Button></div>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="relative flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 p-3">
                      <Button variant="outline" size="sm" onClick={shuffleEntries} disabled={!sidebarEntries.length}><Shuffle className="mr-2 h-4 w-4" /> Shuffle</Button>
                      <Button variant="outline" size="sm" onClick={sortEntries} disabled={!sidebarEntries.length}><ArrowUp className="mr-2 h-4 w-4" /> Sort</Button>
                      <div className="relative">
                        <Button variant="outline" size="sm" onClick={() => setImageMenuOpen((value) => !value)}><ImageIcon className="mr-2 h-4 w-4" /> Add image <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                        {imageMenuOpen && (
                          <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                            <button type="button" onClick={() => addImage("background")} className="flex w-full items-center gap-3 px-3 py-3 text-left text-xs hover:bg-muted"><span className="h-7 w-7 rounded-full bg-blue-500" /> Add background image</button>
                            <button type="button" onClick={() => addImage("center")} className="flex w-full items-center gap-3 px-3 py-3 text-left text-xs hover:bg-muted"><span className="flex h-7 w-7 items-center justify-center rounded-full border bg-muted"><ImageIcon className="h-4 w-4" /></span> Add center image</button>
                            <button type="button" onClick={() => addImage("entry")} className="flex w-full items-center gap-3 px-3 py-3 text-left text-xs hover:bg-muted"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted"><ImageIcon className="h-4 w-4" /></span> Add image as entry</button>
                          </div>
                        )}
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium"><input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} className="h-4 w-4 accent-blue-500" /> Advanced</label>
                    </div>

                    {!advanced ? (
                      <div className="min-h-0 flex-1 p-3">
                        <textarea
                          value={textareaValue}
                          onChange={(event) => setEntriesFromText(event.target.value)}
                          className="h-full min-h-[420px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm leading-5 outline-none focus:border-blue-500"
                          aria-label="Wheel entries"
                        />
                      </div>
                    ) : (
                      <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        <div className="space-y-2">
                          {sidebarEntries.map((entry, index) => (
                            <div key={entry.id} className="rounded-lg border border-border bg-background/80 p-2">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                  <button type="button" onClick={() => moveEntry(index, -1)} disabled={index === 0} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => moveEntry(index, 1)} disabled={index === sidebarEntries.length - 1} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                                </div>
                                <Input value={entry.text} onChange={(event) => updateEntry(activeWheel.id, index, (item) => ({ ...item, text: event.target.value }))} className="h-9 flex-1" />
                                <button type="button" onClick={() => duplicateEntry(index)} className="rounded p-2 text-muted-foreground hover:bg-muted" title="Duplicate"><Copy className="h-4 w-4" /></button>
                                <button type="button" onClick={() => removeEntry(index)} className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete"><X className="h-4 w-4" /></button>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button type="button" onClick={() => setAdvancedEntry({ wheelId: activeWheel.id, entryIndex: index })} className="flex h-9 w-12 items-center justify-center rounded-md" style={{ background: entry.color }} title="Entry color"><Palette className="h-4 w-4 text-white" /></button>
                                <button type="button" onClick={() => setAdvancedEntry({ wheelId: activeWheel.id, entryIndex: index })} className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted" title="Entry image">{entry.image ? <img src={entry.image} alt="" className="h-7 w-7 rounded object-cover" /> : <ImageIcon className="h-4 w-4" />}</button>
                                <div className="flex h-9 flex-1 items-center rounded-md bg-muted px-2 text-xs text-muted-foreground"><SlidersHorizontal className="mr-2 h-4 w-4" /> {entry.weight}</div>
                                <button type="button" onClick={() => updateEntry(activeWheel.id, index, (item) => ({ ...item, weight: Math.max(0.01, item.weight - 1) }))} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Minus className="h-4 w-4" /></button>
                                <button type="button" onClick={() => updateEntry(activeWheel.id, index, (item) => ({ ...item, weight: item.weight + 1 }))} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /></button>
                                <span className="w-12 text-right text-[10px] text-muted-foreground">{((entry.weight / Math.max(0.01, sidebarEntries.reduce((sum, item) => sum + item.weight, 0))) * 100).toFixed(0)}%</span>
                                <button type="button" onClick={() => updateEntry(activeWheel.id, index, (item) => ({ ...item, visible: !item.visible }))} className={`flex h-7 w-7 items-center justify-center rounded-md border ${entry.visible ? "border-blue-500/30 bg-blue-500/10 text-blue-500" : "text-muted-foreground"}`} title="Visible">{entry.visible && <Check className="h-4 w-4" />}</button>
                                <button type="button" onClick={() => setAdvancedEntry({ wheelId: activeWheel.id, entryIndex: index })} className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white" title="Advanced entry settings"><SlidersHorizontal className="h-4 w-4" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {advanced && <div className="shrink-0 border-t border-border/70 p-3"><Button className="w-full" onClick={addEntry}><Plus className="mr-2 h-4 w-4" /> Add entry</Button></div>}

                    <div className="shrink-0 border-t border-border/70 p-3">
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={clearEntries} disabled={!sidebarEntries.length}><Eraser className="mr-2 h-4 w-4" /> Clear the list</Button>
                        <Button variant="outline" className="flex-1" onClick={restoreEntries}><RotateCcw className="mr-2 h-4 w-4" /> Restore</Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative shrink-0 border-t border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAddWheelMenuOpen((value) => !value)} disabled={wheels.length >= MAX_WHEELS}>
                      <Plus className="mr-2 h-4 w-4" /> Add wheel <ChevronDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground">{wheels.length}/{MAX_WHEELS} wheels</span>
                  </div>
                  {addWheelMenuOpen && (
                    <div className="absolute bottom-14 left-3 z-50 w-48 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
                      <button type="button" onClick={addWheel} className="flex w-full items-center gap-2 px-3 py-3 text-left text-xs hover:bg-muted"><Plus className="h-4 w-4" /> New wheel</button>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={renameActiveWheel}>Rename {activeWheel.name}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setCustomizeOpen(true)}><Palette className="mr-2 h-4 w-4" /> Customize</Button>
                    {wheels.length > 1 && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={removeActiveWheel}><Trash2 className="mr-2 h-4 w-4" /> Remove {activeWheel.name}</Button>}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>

      {advancedEntry && (() => {
        const wheel = wheels.find((item) => item.id === advancedEntry.wheelId)
        const entry = wheel?.entries[advancedEntry.entryIndex]
        if (!wheel || !entry) return null
        return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdvancedEntry(null) }}>
            <div className="w-full max-w-[640px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><h2 className="flex items-center gap-2 text-xl font-semibold"><SlidersHorizontal className="h-5 w-5" /> Advanced</h2><button type="button" onClick={() => setAdvancedEntry(null)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button></div>
              <div className="p-5">
                <div className="flex items-center justify-between border-b pb-4"><button type="button" onClick={() => setAdvancedEntry({ wheelId: wheel.id, entryIndex: Math.max(0, advancedEntry.entryIndex - 1) })} disabled={advancedEntry.entryIndex === 0} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button><span className="text-sm font-medium">Entry {advancedEntry.entryIndex + 1} / {wheel.entries.length}</span><button type="button" onClick={() => setAdvancedEntry({ wheelId: wheel.id, entryIndex: Math.min(wheel.entries.length - 1, advancedEntry.entryIndex + 1) })} disabled={advancedEntry.entryIndex === wheel.entries.length - 1} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button></div>
                <div className="mt-4 flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={entry.visible} onChange={(event) => updateEntry(wheel.id, advancedEntry.entryIndex, (item) => ({ ...item, visible: event.target.checked }))} className="h-4 w-4 accent-blue-600" /> Visible</label><div className="flex gap-2"><Button variant="outline" onClick={() => duplicateEntry(advancedEntry.entryIndex)}><Copy className="mr-2 h-4 w-4" /> Duplicate</Button><Button variant="destructive" onClick={() => { removeEntry(advancedEntry.entryIndex); setAdvancedEntry(null) }}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button></div></div>
                <div className="mt-5 grid gap-4">
                  <label className="grid gap-2 text-sm"><span>Text</span><Input value={entry.text} onChange={(event) => updateEntry(wheel.id, advancedEntry.entryIndex, (item) => ({ ...item, text: event.target.value }))} /></label>
                  <div className="grid gap-2 text-sm"><span>Color</span><div className="flex gap-2">{WHEEL_COLORS.slice(0, 8).map((color) => <button key={color} type="button" onClick={() => updateEntry(wheel.id, advancedEntry.entryIndex, (item) => ({ ...item, color }))} className={`h-9 w-9 rounded-md border-2 ${entry.color === color ? "border-foreground" : "border-transparent"}`} style={{ background: color }} aria-label={`Use ${color}`} />)}<button type="button" onClick={() => addImage("entry")} className="ml-auto flex items-center gap-2 rounded-md border px-3 text-xs"><ImageIcon className="h-4 w-4" /> Add image</button></div></div>
                  <label className="grid gap-2 text-sm"><span>Popup message</span><Input value={entry.popupMessage ?? ""} onChange={(event) => updateEntry(wheel.id, advancedEntry.entryIndex, (item) => ({ ...item, popupMessage: event.target.value }))} /></label>
                  <div className="grid gap-2 text-sm"><span>Weight</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => updateEntry(wheel.id, advancedEntry.entryIndex, (item) => ({ ...item, weight: Math.max(0.01, item.weight - 1) }))}><Minus className="h-4 w-4" /></Button><Input type="number" min="0.01" step="0.01" value={entry.weight} onChange={(event) => updateEntry(wheel.id, advancedEntry.entryIndex, (item) => ({ ...item, weight: Math.max(0.01, Number(event.target.value) || 0.01) }))} /><Button variant="outline" size="icon" onClick={() => updateEntry(wheel.id, advancedEntry.entryIndex, (item) => ({ ...item, weight: item.weight + 1 }))}><Plus className="h-4 w-4" /></Button><span className="ml-auto text-xs text-muted-foreground">Probability {((entry.weight / Math.max(0.01, wheel.entries.reduce((sum, item) => sum + item.weight, 0))) * 100).toFixed(1)}%</span></div></div>
                </div>
                <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAdvancedEntry(null)}>Cancel</Button><Button onClick={() => setAdvancedEntry(null)}>OK</Button></div>
              </div>
            </div>
          </div>
        )
      })()}

      {customizeOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomizeOpen(false) }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><Palette className="h-5 w-5 text-blue-500" /> Customize {activeWheel.name}</h2><p className="mt-1 text-xs text-muted-foreground">Colors, timing, winner behavior and wheel appearance.</p></div><Button variant="ghost" size="icon" onClick={() => setCustomizeOpen(false)}><X className="h-4 w-4" /></Button></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-xl border p-4"><p className="text-sm font-semibold">Spin time</p><div className="mt-3 flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, duration: Math.max(1, wheel.duration - 1) }))}><Minus className="h-4 w-4" /></Button><Input readOnly value={`${activeWheel.duration}s`} className="text-center" /><Button variant="outline" size="icon" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, duration: Math.min(30, wheel.duration + 1) }))}><Plus className="h-4 w-4" /></Button></div></div>
              <div className="rounded-xl border p-4"><p className="text-sm font-semibold">Center size</p><input type="range" min="25" max="85" value={activeWheel.centerSize} onChange={(event) => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, centerSize: Number(event.target.value) }))} className="mt-4 w-full accent-blue-600" /></div>
              <button type="button" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, removeWinner: !wheel.removeWinner }))} className={`rounded-xl border p-4 text-left ${activeWheel.removeWinner ? "border-blue-500/30 bg-blue-500/5" : ""}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">Remove winner</span>{activeWheel.removeWinner && <Check className="h-4 w-4 text-blue-500" />}</div><p className="mt-1 text-xs text-muted-foreground">Remove the selected entry after it wins.</p></button>
              <button type="button" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, confetti: !wheel.confetti }))} className={`rounded-xl border p-4 text-left ${activeWheel.confetti ? "border-blue-500/30 bg-blue-500/5" : ""}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">Winner effects</span>{activeWheel.confetti && <Check className="h-4 w-4 text-blue-500" />}</div><p className="mt-1 text-xs text-muted-foreground">Show a winner celebration after a spin.</p></button>
              <div className="rounded-xl border p-4 sm:col-span-2"><p className="text-sm font-semibold">Wheel background</p><div className="mt-3 flex items-center gap-3"><input type="color" value={activeWheel.backgroundColor} onChange={(event) => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, backgroundColor: event.target.value }))} className="h-10 w-14 rounded border bg-background" /><Button variant="outline" onClick={() => addImage("background")}><ImageIcon className="mr-2 h-4 w-4" /> Add background image</Button>{activeWheel.backgroundImage && <Button variant="ghost" onClick={() => updateWheel(activeWheel.id, (wheel) => ({ ...wheel, backgroundImage: undefined }))}>Remove image</Button>}</div></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-4"><Button variant="outline" onClick={() => { updateWheel(activeWheel.id, (wheel) => ({ ...wheel, rotation: 0 })); setCustomizeOpen(false) }}><RotateCcw className="mr-2 h-4 w-4" /> Reset rotation</Button><Button onClick={() => setCustomizeOpen(false)}>Done</Button></div>
          </div>
        </div>
      )}

      {winner && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setWinner(null) }}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-500/20 bg-card p-7 text-center shadow-2xl"><button type="button" onClick={() => setWinner(null)} className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10"><Trophy className="h-7 w-7 text-blue-500" /></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Winner</p><h2 className="mt-2 break-words text-3xl font-bold">{winner}</h2><div className="mt-6 flex justify-center gap-2"><Button variant="outline" onClick={() => setWinner(null)}>Close</Button><Button onClick={() => { setWinner(null); window.setTimeout(() => spinWheel(activeWheel.id), 100) }} disabled={anySpinning || !activeWheel.entries.length}><Dices className="mr-2 h-4 w-4" /> Spin again</Button></div></div>
        </div>
      )}

      {showConfetti && <div className="pointer-events-none fixed inset-0 z-[170] overflow-hidden" aria-hidden="true">{Array.from({ length: 30 }, (_, index) => <span key={index} className="absolute left-1/2 top-1/2 h-2 w-1 rounded-full bg-blue-500" style={{ transform: `rotate(${index * 12}deg) translateY(-${120 + (index % 8) * 22}px)`, animation: `mpd-wheel-confetti 1.8s ease-out ${index * 14}ms forwards` }} />)}</div>}

      <Footer />
    </div>
  )
}
