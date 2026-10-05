import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  Copy,
  Dices,
  Download,
  Expand,
  FileDown,
  FileUp,
  History,
  Maximize2,
  Plus,
  RotateCcw,
  Settings2,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Footer from "@/components/Footer"
import Navbar from "@/components/home/Navbar"

type WheelEntry = {
  text: string
  weight: number
  color: string
}

type SpinResult = {
  winner: string
  animation?: string
  imageFormat?: string
}

type HistoryItem = {
  id: string
  winner: string
  at: number
}

const DEFAULT_ENTRIES = [
  "Officer 1",
  "Officer 2",
  "Officer 3",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Master Sergeant",
  "2nd Lieutenant",
  "1st Lieutenant",
  "Captain",
  "Major",
  "Lieutenant Colonel",
  "Colonel",
  "Chief Of Staff",
  "Assistant Chief",
  "Deputy Chief",
  "Chief",
]

const COLORS = [
  "#5B8DEF",
  "#B85AD9",
  "#F4C84B",
  "#55C78A",
  "#4AA8DF",
  "#D96BBD",
  "#F0A84B",
  "#63C7B2",
]

const STORAGE_KEY = "mpd-spin-wheel-v3"

function secureRandom(max: number) {
  if (max <= 1) return 0
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % max
}

function makeEntries(values: string[]): WheelEntry[] {
  return values
    .map((text, index) => ({
      text: text.trim(),
      weight: 1,
      color: COLORS[index % COLORS.length],
    }))
    .filter((entry) => entry.text)
}

function normaliseEntries(text: string) {
  return text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function weightedPick(entries: WheelEntry[]) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0.01, entry.weight), 0)
  let value = (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * total

  for (let index = 0; index < entries.length; index += 1) {
    value -= Math.max(0.01, entries[index].weight)
    if (value <= 0) return index
  }

  return entries.length - 1
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp)
}

export default function SpinWheel() {
  const [entries, setEntries] = useState<WheelEntry[]>(() => makeEntries(DEFAULT_ENTRIES))
  const [draft, setDraft] = useState(DEFAULT_ENTRIES.join("\n"))
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [winner, setWinner] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showWinner, setShowWinner] = useState(true)
  const [removeWinner, setRemoveWinner] = useState(false)
  const [confetti, setConfetti] = useState(true)
  const [sound, setSound] = useState(false)
  const [spinTime, setSpinTime] = useState(5)
  const [centerText, setCenterText] = useState("SPIN")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [winnerMessage, setWinnerMessage] = useState("The wheel has selected a winner.")
  const [showOverlayText, setShowOverlayText] = useState(true)
  const [pageGradient, setPageGradient] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"during" | "after" | "appearance">("during")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [previewAnimation, setPreviewAnimation] = useState<SpinResult | null>(null)
  const [apiBusy, setApiBusy] = useState(false)
  const animationRef = useRef<number | null>(null)
  const rotationStartRef = useRef(0)

  const entryCountLabel = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`

  const wheelSegments = useMemo(() => {
    const total = entries.reduce((sum, entry) => sum + Math.max(0.01, entry.weight), 0)
    let angle = -Math.PI / 2

    return entries.map((entry) => {
      const sweep = (Math.max(0.01, entry.weight) / total) * Math.PI * 2
      const start = angle
      const end = angle + sweep
      angle = end
      return { ...entry, start, end, sweep }
    })
  }, [entries])

  const pathForSegment = useCallback((start: number, end: number, radius = 250) => {
    const x1 = 250 + Math.cos(start) * radius
    const y1 = 250 + Math.sin(start) * radius
    const x2 = 250 + Math.cos(end) * radius
    const y2 = 250 + Math.sin(end) * radius
    const largeArc = end - start > Math.PI ? 1 : 0
    return `M 250 250 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<{
        entries: WheelEntry[]
        history: HistoryItem[]
        spinTime: number
        removeWinner: boolean
        showWinner: boolean
        confetti: boolean
        sound: boolean
        centerText: string
        title: string
        description: string
        winnerMessage: string
        showOverlayText: boolean
        pageGradient: boolean
        advanced: boolean
      }>

      if (Array.isArray(saved.entries) && saved.entries.length) {
        setEntries(saved.entries.map((entry, index) => ({
          text: String(entry.text ?? "").trim(),
          weight: Number(entry.weight) > 0 ? Number(entry.weight) : 1,
          color: typeof entry.color === "string" ? entry.color : COLORS[index % COLORS.length],
        })).filter((entry) => entry.text))
        setDraft(saved.entries.map((entry) => entry.text).join("\n"))
      }
      if (Array.isArray(saved.history)) setHistory(saved.history.slice(0, 50))
      if (typeof saved.spinTime === "number") setSpinTime(Math.min(30, Math.max(1, saved.spinTime)))
      if (typeof saved.removeWinner === "boolean") setRemoveWinner(saved.removeWinner)
      if (typeof saved.showWinner === "boolean") setShowWinner(saved.showWinner)
      if (typeof saved.confetti === "boolean") setConfetti(saved.confetti)
      if (typeof saved.sound === "boolean") setSound(saved.sound)
      if (typeof saved.centerText === "string") setCenterText(saved.centerText)
      if (typeof saved.title === "string") setTitle(saved.title)
      if (typeof saved.description === "string") setDescription(saved.description)
      if (typeof saved.winnerMessage === "string") setWinnerMessage(saved.winnerMessage)
      if (typeof saved.showOverlayText === "boolean") setShowOverlayText(saved.showOverlayText)
      if (typeof saved.pageGradient === "boolean") setPageGradient(saved.pageGradient)
      if (typeof saved.advanced === "boolean") setAdvanced(saved.advanced)
    } catch {
      // Ignore malformed local state.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        entries,
        history,
        spinTime,
        removeWinner,
        showWinner,
        confetti,
        sound,
        centerText,
        title,
        description,
        winnerMessage,
        showOverlayText,
        pageGradient,
        advanced,
      }),
    )
  }, [
    entries,
    history,
    spinTime,
    removeWinner,
    showWinner,
    confetti,
    sound,
    centerText,
    title,
    description,
    winnerMessage,
    showOverlayText,
    pageGradient,
    advanced,
  ])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get("entries")
    if (!shared) return

    const values = normaliseEntries(shared.replace(/,/g, "\n"))
    if (!values.length) return

    setEntries(makeEntries(values))
    setDraft(values.join("\n"))

    const sharedSpinTime = Number(params.get("spinTime"))
    if (Number.isFinite(sharedSpinTime)) {
      setSpinTime(Math.min(30, Math.max(1, sharedSpinTime)))
    }

    const sharedTitle = params.get("title")
    if (sharedTitle) setTitle(sharedTitle)
  }, [])

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const applyDraft = () => {
    const values = normaliseEntries(draft)
    setEntries(makeEntries(values))
    setDraft(values.join("\n"))
    setWinner(null)
    toast.success(`${values.length} entries applied`)
  }

  const syncDraft = (value: string) => {
    setDraft(value)
  }

  const addEntry = () => {
    const next = [...entries, {
      text: `Entry ${entries.length + 1}`,
      weight: 1,
      color: COLORS[entries.length % COLORS.length],
    }]
    setEntries(next)
    setDraft(next.map((entry) => entry.text).join("\n"))
  }

  const shuffle = () => {
    const copy = [...entries]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const next = secureRandom(index + 1)
      ;[copy[index], copy[next]] = [copy[next], copy[index]]
    }
    setEntries(copy)
    setDraft(copy.map((entry) => entry.text).join("\n"))
  }

  const sortEntries = () => {
    const sorted = [...entries].sort((a, b) =>
      a.text.localeCompare(b.text, undefined, { numeric: true }),
    )
    setEntries(sorted)
    setDraft(sorted.map((entry) => entry.text).join("\n"))
  }

  const clearEntries = () => {
    setEntries([])
    setDraft("")
    setWinner(null)
  }

  const reset = () => {
    const defaults = makeEntries(DEFAULT_ENTRIES)
    setEntries(defaults)
    setDraft(DEFAULT_ENTRIES.join("\n"))
    setHistory([])
    setRotation(0)
    setWinner(null)
    setSpinTime(5)
    setRemoveWinner(false)
    setShowWinner(true)
    setConfetti(true)
    setSound(false)
    setCenterText("SPIN")
    setTitle("")
    setDescription("")
    setWinnerMessage("The wheel has selected a winner.")
    setShowOverlayText(true)
    setPageGradient(true)
    toast.success("Wheel reset")
  }

  const copyShareLink = async () => {
    const params = new URLSearchParams()
    params.set("entries", entries.map((entry) => entry.text).join(","))
    if (spinTime !== 5) params.set("spinTime", String(spinTime))
    if (title) params.set("title", title)

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/spin-wheel?${params.toString()}`)
      toast.success("Wheel link copied")
    } catch {
      toast.error("Could not copy the wheel link")
    }
  }

  const downloadWheel = () => {
    const payload = {
      version: 1,
      entries,
      spinTime,
      removeWinner,
      showWinner,
      confetti,
      sound,
      centerText,
      title,
      description,
      winnerMessage,
      showOverlayText,
      pageGradient,
      advanced,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "mpd-wheel.wheel"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Wheel saved")
  }

  const openWheel = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".wheel,application/json"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const data = JSON.parse(await file.text()) as Partial<{
          entries: WheelEntry[]
          spinTime: number
          removeWinner: boolean
          showWinner: boolean
          confetti: boolean
          sound: boolean
          centerText: string
          title: string
          description: string
          winnerMessage: string
          showOverlayText: boolean
          pageGradient: boolean
          advanced: boolean
        }>
        if (!Array.isArray(data.entries) || data.entries.length === 0) throw new Error("Invalid wheel")
        const loaded = data.entries.map((entry, index) => ({
          text: String(entry.text ?? "").trim(),
          weight: Number(entry.weight) > 0 ? Number(entry.weight) : 1,
          color: typeof entry.color === "string" ? entry.color : COLORS[index % COLORS.length],
        })).filter((entry) => entry.text)
        setEntries(loaded)
        setDraft(loaded.map((entry) => entry.text).join("\n"))
        if (typeof data.spinTime === "number") setSpinTime(Math.min(30, Math.max(1, data.spinTime)))
        if (typeof data.removeWinner === "boolean") setRemoveWinner(data.removeWinner)
        if (typeof data.showWinner === "boolean") setShowWinner(data.showWinner)
        if (typeof data.confetti === "boolean") setConfetti(data.confetti)
        if (typeof data.sound === "boolean") setSound(data.sound)
        if (typeof data.centerText === "string") setCenterText(data.centerText)
        if (typeof data.title === "string") setTitle(data.title)
        if (typeof data.description === "string") setDescription(data.description)
        if (typeof data.winnerMessage === "string") setWinnerMessage(data.winnerMessage)
        if (typeof data.showOverlayText === "boolean") setShowOverlayText(data.showOverlayText)
        if (typeof data.pageGradient === "boolean") setPageGradient(data.pageGradient)
        if (typeof data.advanced === "boolean") setAdvanced(data.advanced)
        toast.success("Wheel opened")
      } catch {
        toast.error("That file is not a valid MPD wheel")
      }
    }
    input.click()
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen?.()
        setIsFullscreen(false)
      }
    } catch {
      toast.error("Fullscreen is not available in this browser")
    }
  }

  const playResultSound = () => {
    if (!sound) return
    try {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = 620
      oscillator.type = "sine"
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.24)
    } catch {
      // Browser audio can be unavailable.
    }
  }

  const runConfetti = () => {
    if (!confetti) return
    const layer = document.createElement("div")
    layer.className = "fixed inset-0 z-[120] pointer-events-none overflow-hidden"
    for (let index = 0; index < 80; index += 1) {
      const piece = document.createElement("i")
      piece.style.position = "absolute"
      piece.style.left = `${Math.random() * 100}%`
      piece.style.top = "-12px"
      piece.style.width = "7px"
      piece.style.height = "12px"
      piece.style.background = COLORS[index % COLORS.length]
      piece.style.transform = `rotate(${Math.random() * 360}deg)`
      piece.style.animation = `mpd-confetti 1.9s ${Math.random() * 0.35}s ease-out forwards`
      layer.appendChild(piece)
    }
    document.body.appendChild(layer)
    window.setTimeout(() => layer.remove(), 2600)
  }

  const spin = async () => {
    if (spinning || apiBusy) return
    if (entries.length < 2) {
      toast.error("Add at least two entries before spinning.")
      return
    }

    setApiBusy(true)
    setWinner(null)
    setPreviewAnimation(null)

    let apiResult: SpinResult

    try {
      const response = await fetch("/api/spin-wheel/animate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries: entries.map((entry) => ({
            text: entry.text,
            color: entry.color,
            weight: advanced ? entry.weight : 1,
          })),
          spinTime: 1,
          maxNames: Math.min(1000, entries.length),
          imageFormat: "webp",
        }),
      })

      const data = (await response.json()) as SpinResult & { success?: boolean; error?: string }
      if (!response.ok || !data.success || !data.winner) {
        throw new Error(data.error || "Wheel of Names could not select a winner.")
      }
      apiResult = data
    } catch (error) {
      setApiBusy(false)
      toast.error(error instanceof Error ? error.message : "Wheel of Names request failed.")
      return
    }

    setApiBusy(false)

    const selectedIndex = entries.findIndex((entry) => entry.text === apiResult.winner)
    const safeIndex = selectedIndex >= 0 ? selectedIndex : weightedPick(entries)
    const segment = wheelSegments[safeIndex]
    const segmentCenter = segment ? (segment.start + segment.end) / 2 : 0
    const desiredRotation = -segmentCenter - Math.PI / 2
    const currentTurns = rotation / (Math.PI * 2)
    const desiredNormalized = ((desiredRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const currentNormalized = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    let delta = desiredNormalized - currentNormalized
    if (delta < 0) delta += Math.PI * 2
    delta += (7 + secureRandom(3)) * Math.PI * 2

    const from = rotation
    const to = rotation + delta
    const duration = Math.max(1000, spinTime * 1000)
    const start = performance.now()

    setSpinning(true)
    rotationStartRef.current = from

    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 5)
      setRotation(from + (to - from) * eased)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setRotation(to)
        setSpinning(false)

        const item: HistoryItem = {
          id: crypto.randomUUID(),
          winner: apiResult.winner,
          at: Date.now(),
        }
        setWinner(apiResult.winner)
        setHistory((current) => [item, ...current].slice(0, 50))
        setPreviewAnimation(apiResult)
        playResultSound()
        runConfetti()

        if (removeWinner) {
          const next = entries.filter((entry) => entry.text !== apiResult.winner)
          setEntries(next)
          setDraft(next.map((entry) => entry.text).join("\n"))
        }
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  const wheelTransform = `rotate(${rotation * 180 / Math.PI} 250 250)`

  return (
    <div className={`min-h-screen ${pageGradient ? "bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,.10),transparent_42%)]" : ""} bg-background text-foreground`}>
      <Navbar />

      <main className="mx-auto w-[min(1540px,calc(100%-32px))] py-6 pb-16">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white shadow-lg shadow-blue-600/20">
              MPD
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title || "Spin the Wheel"}</h1>
              <p className="text-sm text-muted-foreground">
                {description || "Randomly select an officer, assignment, or entry."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold hover:bg-muted" onClick={() => void copyShareLink()}>
              <Copy size={16} /> Share
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold hover:bg-muted" onClick={downloadWheel}>
              <FileDown size={16} /> Save
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold hover:bg-muted" onClick={openWheel}>
              <FileUp size={16} /> Open
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold hover:bg-muted" onClick={() => setShowHistory(true)}>
              <History size={16} /> History
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold hover:bg-muted" onClick={() => setShowSettings(true)}>
              <Settings2 size={16} /> Customize
            </button>
            <button className="inline-flex size-9 items-center justify-center rounded-lg border bg-card hover:bg-muted" onClick={() => void toggleFullscreen()} title="Fullscreen">
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="relative flex min-h-[690px] flex-col items-center justify-center overflow-hidden rounded-2xl border bg-card p-6 shadow-xl shadow-black/5">
            <div className="absolute size-[640px] rounded-full bg-blue-500/[0.035] blur-2xl" />

            <div className="relative aspect-square w-[min(650px,74vw)] max-w-full">
              <svg
                viewBox="0 0 500 500"
                className="block size-full select-none drop-shadow-[0_18px_25px_rgba(0,0,0,.18)]"
                role="img"
                aria-label="Spin wheel"
                style={{ overflow: "visible" }}
              >
                <g transform={wheelTransform} style={{ transformOrigin: "250px 250px" }}>
                  {wheelSegments.map((segment, index) => {
                    const mid = (segment.start + segment.end) / 2
                    const labelRadius = 165
                    const labelX = 250 + Math.cos(mid) * labelRadius
                    const labelY = 250 + Math.sin(mid) * labelRadius
                    const fontSize = entries.length > 35 ? 7 : entries.length > 24 ? 9 : entries.length > 15 ? 12 : 15
                    const maxLength = entries.length > 35 ? 10 : entries.length > 24 ? 14 : 20
                    const label = segment.text.length > maxLength ? `${segment.text.slice(0, maxLength - 1)}…` : segment.text

                    return (
                      <g key={`${segment.text}-${index}`}>
                        <path
                          d={pathForSegment(segment.start, segment.end)}
                          fill={segment.color}
                          stroke="rgba(255,255,255,.72)"
                          strokeWidth="1.5"
                        />
                        {segment.sweep > 0.08 && (
                          <text
                            x={labelX}
                            y={labelY}
                            fill="#fff"
                            fontSize={fontSize}
                            fontWeight="700"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${(mid * 180) / Math.PI + 90} ${labelX} ${labelY})`}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,.22)", strokeWidth: 1.5 }}
                          >
                            {label}
                          </text>
                        )}
                      </g>
                    )
                  })}

                  <circle cx="250" cy="250" r="63" fill="white" stroke="rgba(0,0,0,.15)" strokeWidth="3" />
                  <text x="250" y="250" textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="900" fill="#111827">
                    {centerText.slice(0, 8)}
                  </text>
                </g>

                <path d="M250 7 L231 45 L269 45 Z" fill="#111827" stroke="white" strokeWidth="3" />
              </svg>
            </div>

            {showOverlayText && (
              <div className="relative mt-1 text-center text-xs text-muted-foreground">
                {apiBusy ? "Preparing secure Wheel of Names result…" : spinning ? `Spinning for ${spinTime}s…` : "Click Spin or press Ctrl + Enter"}
              </div>
            )}

            <button
              className="relative mt-3 inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-full bg-blue-600 px-7 text-base font-extrabold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void spin()}
              disabled={spinning || apiBusy || entries.length < 2}
            >
              <Dices size={19} />
              {apiBusy ? "Preparing…" : spinning ? "Spinning…" : "Spin"}
            </button>

            {previewAnimation && !spinning && (
              <div className="mt-3 text-[11px] text-muted-foreground">
                Winner verified by Wheel of Names API
              </div>
            )}
          </section>

          <aside className="flex min-h-[690px] flex-col overflow-hidden rounded-2xl border bg-card shadow-xl shadow-black/5">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <div>
                <h2 className="font-semibold">Entries</h2>
                <p className="text-xs text-muted-foreground">{entryCountLabel}</p>
              </div>
              <div className="flex items-center gap-1">
                <button className="grid size-8 place-items-center rounded-lg hover:bg-muted" onClick={addEntry} title="Add entry"><Plus size={17} /></button>
                <button className="grid size-8 place-items-center rounded-lg hover:bg-muted" onClick={clearEntries} title="Clear all"><Trash2 size={17} /></button>
                <button className="grid size-8 place-items-center rounded-lg hover:bg-muted" onClick={() => setShowSettings(true)} title="Customize"><Settings2 size={17} /></button>
              </div>
            </div>

            <div className="flex-1 p-4">
              <textarea
                value={draft}
                onChange={(event) => syncDraft(event.target.value)}
                onBlur={applyDraft}
                className="h-full min-h-[470px] w-full resize-none rounded-xl border bg-background p-3 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Enter one entry per line…"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t p-3">
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-muted" onClick={shuffle}><Shuffle size={14} /> Shuffle</button>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-muted" onClick={sortEntries}><SlidersHorizontal size={14} /> Sort</button>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-muted" onClick={applyDraft}><Check size={14} /> Apply</button>
              <button className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-muted" onClick={() => setShowSettings(true)}><Settings2 size={14} /> Customize</button>
            </div>

            {winner && (
              <div className="border-t p-4">
                <div className="rounded-xl border bg-background p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-500">Latest Winner</p>
                  <p className="mt-1 break-words text-2xl font-bold">{winner}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold hover:bg-muted" onClick={() => setShowHistory(true)}><History size={14} /> View history</button>
                    <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => setWinner(null)}>Dismiss</button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <Footer />

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={() => setShowSettings(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Customize wheel</h2>
                <p className="text-xs text-muted-foreground">Wheel of Names-style controls, adapted for MPD.</p>
              </div>
              <button className="grid size-9 place-items-center rounded-lg hover:bg-muted" onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>

            <div className="flex border-b">
              {(["during", "after", "appearance"] as const).map((tab) => (
                <button key={tab} className={`flex-1 px-4 py-3 text-sm font-semibold ${settingsTab === tab ? "border-b-2 border-blue-600 text-blue-600" : "text-muted-foreground"}`} onClick={() => setSettingsTab(tab)}>
                  {tab === "during" ? "During spin" : tab === "after" ? "After spin" : "Appearance"}
                </button>
              ))}
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-5">
              {settingsTab === "during" && (
                <div className="space-y-5">
                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div><p className="font-semibold">Spin time</p><p className="text-xs text-muted-foreground">How long the wheel rotates.</p></div>
                      <strong>{spinTime}s</strong>
                    </div>
                    <input className="mt-5 w-full accent-blue-600" type="range" min="1" max="30" value={spinTime} onChange={(event) => setSpinTime(Number(event.target.value))} />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>1 second</span><span>30 seconds</span></div>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border p-4">
                    <span><p className="font-semibold">Sound effects</p><p className="text-xs text-muted-foreground">Play a short result sound.</p></span>
                    <input className="sr-only" type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />
                    {sound ? <Volume2 className="text-blue-600" /> : <VolumeX className="text-muted-foreground" />}
                  </label>

                  <label className="flex cursor-pointer items-center justify-between rounded-xl border p-4">
                    <span><p className="font-semibold">Advanced / weighted mode</p><p className="text-xs text-muted-foreground">Use each entry's weight when selecting the winner.</p></span>
                    <input type="checkbox" checked={advanced} onChange={(event) => setAdvanced(event.target.checked)} />
                  </label>

                  {advanced && (
                    <div className="rounded-xl border p-4">
                      <p className="mb-3 font-semibold">Entry weights</p>
                      <div className="space-y-2">
                        {entries.map((entry, index) => (
                          <div key={`${entry.text}-${index}`} className="flex items-center gap-3">
                            <span className="min-w-0 flex-1 truncate text-sm">{entry.text}</span>
                            <input
                              className="h-9 w-20 rounded-lg border bg-background px-2 text-sm"
                              type="number"
                              min="0.01"
                              step="0.1"
                              value={entry.weight}
                              onChange={(event) => {
                                const value = Math.max(0.01, Number(event.target.value) || 1)
                                setEntries((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, weight: value } : item))
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {settingsTab === "after" && (
                <div className="space-y-3">
                  <label className="flex items-center justify-between rounded-xl border p-4">
                    <span><p className="font-semibold">Show winner dialog</p><p className="text-xs text-muted-foreground">Display a large winner announcement.</p></span>
                    <input type="checkbox" checked={showWinner} onChange={(event) => setShowWinner(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border p-4">
                    <span><p className="font-semibold">Remove winner</p><p className="text-xs text-muted-foreground">Remove the selected entry before the next spin.</p></span>
                    <input type="checkbox" checked={removeWinner} onChange={(event) => setRemoveWinner(event.target.checked)} />
                  </label>
                  <label className="block rounded-xl border p-4">
                    <p className="font-semibold">Winner message</p>
                    <input className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={winnerMessage} onChange={(event) => setWinnerMessage(event.target.value)} />
                  </label>
                  <label className="block rounded-xl border p-4">
                    <p className="font-semibold">Wheel title</p>
                    <input className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Spin the Wheel" />
                  </label>
                  <label className="block rounded-xl border p-4">
                    <p className="font-semibold">Description</p>
                    <input className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Randomly select an entry." />
                  </label>
                </div>
              )}

              {settingsTab === "appearance" && (
                <div className="space-y-3">
                  <label className="block rounded-xl border p-4">
                    <p className="font-semibold">Center text</p>
                    <input className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm" maxLength={8} value={centerText} onChange={(event) => setCenterText(event.target.value.toUpperCase())} />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border p-4">
                    <span><p className="font-semibold">Confetti</p><p className="text-xs text-muted-foreground">Celebrate the winner.</p></span>
                    <input type="checkbox" checked={confetti} onChange={(event) => setConfetti(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border p-4">
                    <span><p className="font-semibold">Page gradient</p><p className="text-xs text-muted-foreground">Use the subtle MPD blue page glow.</p></span>
                    <input type="checkbox" checked={pageGradient} onChange={(event) => setPageGradient(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border p-4">
                    <span><p className="font-semibold">Spin instructions</p><p className="text-xs text-muted-foreground">Show the keyboard/click hint below the wheel.</p></span>
                    <input type="checkbox" checked={showOverlayText} onChange={(event) => setShowOverlayText(event.target.checked)} />
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-between border-t p-4">
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-muted" onClick={reset}><RotateCcw size={14} /> Reset</button>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => setShowSettings(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={() => setShowHistory(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div><h2 className="font-bold">Spin history</h2><p className="text-xs text-muted-foreground">{history.length} recorded spins</p></div>
              <button className="grid size-9 place-items-center rounded-lg hover:bg-muted" onClick={() => setShowHistory(false)}><X size={18} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {history.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">No spins yet.</div>
              ) : history.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-muted">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-600/10 text-xs font-bold text-blue-600">{index + 1}</span>
                    <span className="truncate font-semibold">{item.winner}</span>
                  </div>
                  <span className="ml-3 shrink-0 text-xs text-muted-foreground">{formatTime(item.at)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t p-4">
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold hover:bg-muted" onClick={() => setHistory([])}><Trash2 size={14} /> Clear</button>
              <button className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white" onClick={() => setShowHistory(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {winner && showWinner && !spinning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={() => setWinner(null)}>
          <div className="w-full max-w-xl rounded-3xl border bg-card p-8 text-center shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <p className="text-[11px] font-black uppercase tracking-[.22em] text-blue-600">WINNER</p>
            <h2 className="mt-3 break-words text-4xl font-black tracking-tight">{winner}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{winnerMessage}</p>
            <div className="mt-7 flex justify-center gap-2">
              <button className="h-10 rounded-lg border px-4 text-sm font-semibold hover:bg-muted" onClick={() => setWinner(null)}>Close</button>
              <button className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700" onClick={() => { setWinner(null); void spin() }}>Spin again</button>
            </div>
          </div>
        </div>
      )}

      {isFullscreen && (
        <button className="fixed bottom-4 right-4 z-[150] rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white shadow-xl" onClick={() => void toggleFullscreen()}>
          Exit fullscreen
        </button>
      )}

      <style>{`
        @keyframes mpd-confetti {
          0% { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(0,110vh,0) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
