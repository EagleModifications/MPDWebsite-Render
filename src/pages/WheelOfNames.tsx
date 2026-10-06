import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import {
  Check,
  ChevronDown,
  Copy,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  History,
  MoreHorizontal,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { Wheel } from "spin-wheel"
import { toast } from "sonner"

import Footer from "@/components/Footer"
import Navbar from "@/components/home/Navbar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const STORAGE_KEY = "mpd-wheel-of-names"
const MAX_HISTORY = 25

const DEFAULT_ENTRIES = [
  "Option 1",
  "Option 2",
  "Option 3",
  "Option 4",
  "Option 5",
  "Option 6",
  "Option 7",
  "Option 8",
]

const MPD_COLORS = [
  "#2563eb",
  "#0f172a",
  "#3b82f6",
  "#1e293b",
  "#60a5fa",
  "#334155",
  "#1d4ed8",
  "#475569",
  "#2563eb",
  "#111827",
]

type WheelSettings = {
  duration: number
  removeWinner: boolean
  sound: boolean
  confetti: boolean
  showWinnerDialog: boolean
}

type StoredState = {
  entries?: string[]
  history?: string[]
  title?: string
  description?: string
  settings?: Partial<WheelSettings>
}

type WheelItem = {
  label: string
  backgroundColor: string
  labelColor: string
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredState
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function randomIndex(length: number) {
  if (length <= 1) return 0

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1)
    crypto.getRandomValues(value)
    return value[0] % length
  }

  return Math.floor(Math.random() * length)
}

function shuffleList<T>(list: T[]) {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function createItems(entries: string[]): WheelItem[] {
  return entries.map((label, index) => ({
    label,
    backgroundColor: MPD_COLORS[index % MPD_COLORS.length],
    labelColor: "#ffffff",
  }))
}

function playTone(type: "tick" | "winner", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime

    oscillator.type = type === "winner" ? "sine" : "triangle"
    oscillator.frequency.setValueAtTime(type === "winner" ? 600 : 150, now)
    if (type === "winner") {
      oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.18)
    }

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(
      type === "winner" ? 0.08 : 0.025,
      now + 0.01,
    )
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (type === "winner" ? 0.28 : 0.07),
    )

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + (type === "winner" ? 0.3 : 0.08))

    window.setTimeout(() => void context.close(), 350)
  } catch {
    // Audio is optional.
  }
}

function downloadWheel(state: StoredState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "mpd-wheel.wheel"
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function WheelOfNames() {
  const stored = useMemo(() => loadState(), [])

  const initialEntries = stored.entries?.filter(Boolean).length
    ? stored.entries!.filter(Boolean)
    : DEFAULT_ENTRIES

  const [entries, setEntries] = useState<string[]>(initialEntries)
  const [listText, setListText] = useState(initialEntries.join("\n"))
  const [history, setHistory] = useState<string[]>(stored.history ?? [])
  const [title, setTitle] = useState(stored.title ?? "Wheel of Names")
  const [description, setDescription] = useState(
    stored.description ?? "Enter names below and spin the wheel to pick a random winner.",
  )
  const [settings, setSettings] = useState<WheelSettings>({
    duration: stored.settings?.duration ?? 5,
    removeWinner: stored.settings?.removeWinner ?? false,
    sound: stored.settings?.sound ?? true,
    confetti: stored.settings?.confetti ?? true,
    showWinnerDialog: stored.settings?.showWinnerDialog ?? true,
  })

  const [winner, setWinner] = useState<string | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const wheelContainerRef = useRef<HTMLDivElement | null>(null)
  const wheelRef = useRef<Wheel | null>(null)
  const entriesRef = useRef(entries)
  const settingsRef = useRef(settings)
  const spinningRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ entries, history, title, description, settings }),
    )
  }, [entries, history, title, description, settings])

  const updateEntries = useCallback((next: string[]) => {
    setEntries(next)
    setListText(next.join("\n"))
    setWinner(null)
  }, [])

  const applyEntries = useCallback(() => {
    const next = listText
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)

    if (!next.length) {
      toast.error("Enter at least one name or option.")
      return
    }

    updateEntries(next)
    toast.success(`${next.length} entries loaded`)
  }, [listText, updateEntries])

  const addEntry = useCallback(() => {
    if (isSpinning) return
    const next = [...entries, `Option ${entries.length + 1}`]
    updateEntries(next)
  }, [entries, isSpinning, updateEntries])

  const shuffle = useCallback(() => {
    if (isSpinning) return
    updateEntries(shuffleList(entries))
    toast.success("Entries shuffled")
  }, [entries, isSpinning, updateEntries])

  const sortEntries = useCallback(() => {
    if (isSpinning) return
    updateEntries([...entries].sort((a, b) => a.localeCompare(b)))
  }, [entries, isSpinning, updateEntries])

  const removeDuplicates = useCallback(() => {
    if (isSpinning) return
    const seen = new Set<string>()
    const next = entries.filter((entry) => {
      const key = entry.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    updateEntries(next)
    toast.success(`${entries.length - next.length} duplicates removed`)
  }, [entries, isSpinning, updateEntries])

  const clearEntries = useCallback(() => {
    if (isSpinning) return
    updateEntries([])
  }, [isSpinning, updateEntries])

  const reset = useCallback(() => {
    if (isSpinning) return
    updateEntries(DEFAULT_ENTRIES)
    setHistory([])
    setTitle("Wheel of Names")
    setDescription("Enter names below and spin the wheel to pick a random winner.")
    setSettings({
      duration: 5,
      removeWinner: false,
      sound: true,
      confetti: true,
      showWinnerDialog: true,
    })
    toast.success("Wheel reset")
  }, [isSpinning, updateEntries])

  const finishSpin = useCallback((index: number) => {
    const currentEntries = entriesRef.current
    const selected = currentEntries[index]
    if (!selected || !spinningRef.current) return

    setWinner(selected)
    setHistory((current) => [selected, ...current].slice(0, MAX_HISTORY))
    setIsSpinning(false)
    spinningRef.current = false
    playTone("winner", settingsRef.current.sound)

    if (settingsRef.current.confetti) {
      setShowConfetti(true)
      window.setTimeout(() => setShowConfetti(false), 2400)
    }

    if (settingsRef.current.removeWinner) {
      const next = currentEntries.filter((_, entryIndex) => entryIndex !== index)
      setEntries(next)
      setListText(next.join("\n"))
    }
  }, [])

  const spin = useCallback(() => {
    if (isSpinning || !wheelRef.current || entries.length === 0) return

    if (entries.length === 1) {
      setWinner(entries[0])
      setHistory((current) => [entries[0], ...current].slice(0, MAX_HISTORY))
      playTone("winner", settings.sound)
      return
    }

    const index = randomIndex(entries.length)
    setWinner(null)
    setIsSpinning(true)
    spinningRef.current = true

    wheelRef.current.spinToItem(
      index,
      settings.duration * 1000,
      true,
      5,
      1,
    )
  }, [entries, isSpinning, settings.duration, settings.sound])

  useEffect(() => {
    const element = wheelContainerRef.current
    if (!element) return

    const wheel = new Wheel(element, {
      items: createItems(entriesRef.current),
      radius: 0.94,
      pointerAngle: 270,
      lineWidth: 1,
      lineColor: "rgba(255,255,255,0.28)",
      itemLabelFont: "Geist Variable, sans-serif",
      itemLabelFontSizeMax: 34,
      itemLabelRadius: 0.68,
      itemLabelRadiusMax: 0.82,
      itemLabelAlign: "right",
      itemLabelColors: ["#ffffff"],
      borderWidth: 0,
      pixelRatio: 2,
      isInteractive: false,
    })

    wheelRef.current = wheel

    wheel.onCurrentIndexChange = () => {
      playTone("tick", settingsRef.current.sound)
    }

    wheel.onRest = (event) => finishSpin(event.currentIndex)

    return () => {
      wheel.remove()
      wheelRef.current = null
    }
  }, [finishSpin])

  useEffect(() => {
    if (!wheelRef.current || isSpinning) return
    wheelRef.current.items = createItems(entries)
  }, [entries, isSpinning])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        spin()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [spin])

  const openFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as StoredState
        const next = data.entries?.filter(Boolean) ?? DEFAULT_ENTRIES
        setEntries(next)
        setListText(next.join("\n"))
        setHistory(data.history ?? [])
        setTitle(data.title ?? "Wheel of Names")
        setDescription(
          data.description ?? "Enter names below and spin the wheel to pick a random winner.",
        )
        if (data.settings) {
          setSettings((current) => ({ ...current, ...data.settings }))
        }
        toast.success("Wheel opened")
      } catch {
        toast.error("That file is not a valid MPD wheel file.")
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }, [])

  const save = useCallback(() => {
    downloadWheel({ entries, history, title, description, settings })
    toast.success("Wheel downloaded")
  }, [description, entries, history, settings, title])

  const share = useCallback(async () => {
    const url = new URL(window.location.href)
    url.searchParams.set("entries", entries.join(","))
    url.searchParams.set("title", title)
    url.searchParams.set("spinTime", String(settings.duration))

    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success("Wheel link copied to clipboard")
    } catch {
      window.prompt("Copy this wheel link:", url.toString())
    }
  }, [entries, settings.duration, title])

  const removeWinner = useCallback(() => {
    if (!winner) return
    const next = entries.filter((entry) => entry !== winner)
    updateEntries(next)
    setWinner(null)
    toast.success("Winner removed")
  }, [entries, updateEntries, winner])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto max-w-[1700px] px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        {/* Wheel of Names style toolbar, recoloured for MPD */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/80 p-2 shadow-sm backdrop-blur">
          <Button variant="default" size="sm" onClick={reset} disabled={isSpinning}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            New
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSpinning}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open
          </Button>
          <Button variant="outline" size="sm" onClick={save} disabled={isSpinning}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={share} disabled={isSpinning}>
            <Copy className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)} disabled={isSpinning}>
            <Palette className="mr-2 h-4 w-4" />
            Customize
          </Button>

          <div className="relative ml-auto">
            <Button variant="outline" size="sm" onClick={() => setMoreOpen((value) => !value)}>
              <MoreHorizontal className="mr-2 h-4 w-4" />
              More
              <ChevronDown className="ml-2 h-3.5 w-3.5" />
            </Button>
            {moreOpen && (
              <div className="absolute right-0 top-11 z-40 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { shuffle(); setMoreOpen(false) }}>
                  <Shuffle className="mr-3 h-4 w-4" /> Shuffle entries
                </button>
                <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { sortEntries(); setMoreOpen(false) }}>
                  <Sparkles className="mr-3 h-4 w-4" /> Sort alphabetically
                </button>
                <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { removeDuplicates(); setMoreOpen(false) }}>
                  <Check className="mr-3 h-4 w-4" /> Remove duplicates
                </button>
                <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setAdvanced((value) => !value); setMoreOpen(false) }}>
                  <Settings2 className="mr-3 h-4 w-4" /> Advanced mode {advanced ? "✓" : ""}
                </button>
              </div>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept=".wheel,.json,application/json" className="hidden" onChange={openFile} />
        </div>

        <div className="mb-5 flex flex-col gap-1 px-1">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full max-w-3xl bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground sm:text-3xl"
              aria-label="Wheel title"
            />
          </div>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full max-w-3xl bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Wheel description"
          />
        </div>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(350px,0.9fr)]">
          {/* Main wheel column */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/80 to-transparent" />

            <div className="flex min-h-[650px] flex-col items-center justify-center p-4 sm:p-7 lg:p-8">
              <div className="relative w-full max-w-[780px]">
                <div
                  ref={wheelContainerRef}
                  className="mx-auto aspect-square w-full max-w-[760px]"
                  onClick={() => !isSpinning && spin()}
                />

                {/* Wheel of Names-style pointer */}
                <div className="pointer-events-none absolute left-1/2 top-[-3px] z-10 -translate-x-1/2">
                  <div className="h-0 w-0 border-l-[17px] border-r-[17px] border-t-[30px] border-l-transparent border-r-transparent border-t-blue-500 drop-shadow-lg" />
                </div>

                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-slate-950 bg-white p-2 shadow-2xl dark:border-slate-950">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-inner sm:h-20 sm:w-20">
                    {isSpinning ? "" : "SPIN"}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-center text-xs text-muted-foreground">
                {isSpinning ? "Spinning…" : "Click the wheel or press Ctrl + Enter to spin"}
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button className="min-w-[150px]" size="lg" onClick={spin} disabled={isSpinning || entries.length === 0}>
                  <Trophy className="mr-2 h-4 w-4" />
                  {isSpinning ? "Spinning…" : "Spin"}
                </Button>
                <Button variant="outline" size="lg" onClick={shuffle} disabled={isSpinning || entries.length < 2}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Shuffle
                </Button>
              </div>

              {winner && !settings.showWinnerDialog && (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500">Winner</div>
                    <div className="font-semibold">{winner}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Editor column */}
          <aside className="flex min-h-[650px] flex-col gap-3">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <div className="font-semibold">Entries</div>
                  <div className="text-xs text-muted-foreground">One name or option per line.</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={addEntry} disabled={isSpinning} aria-label="Add entry">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={clearEntries} disabled={isSpinning} aria-label="Clear entries">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3">
                <Textarea
                  value={listText}
                  onChange={(event) => setListText(event.target.value)}
                  className="min-h-[230px] resize-none border-border/70 bg-muted/20 font-medium leading-6"
                  placeholder="Enter names..."
                  disabled={isSpinning}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
                  <Button size="sm" onClick={applyEntries} disabled={isSpinning}>
                    <Check className="mr-2 h-4 w-4" />
                    Update wheel
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/70 px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" onClick={shuffle} disabled={isSpinning}>
                    <Shuffle className="mr-2 h-3.5 w-3.5" /> Shuffle
                  </Button>
                  <Button variant="ghost" size="sm" onClick={sortEntries} disabled={isSpinning}>
                    Sort
                  </Button>
                  <Button variant="ghost" size="sm" onClick={removeDuplicates} disabled={isSpinning}>
                    Remove duplicates
                  </Button>
                </div>
              </div>

              {advanced && (
                <div className="border-t border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                  Advanced mode is enabled. Entry weights can be added in a future server-backed version; the wheel remains equally weighted here so every listed entry has the same chance.
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <button className="flex w-full items-center justify-between px-4 py-4 text-left" onClick={() => setSettingsOpen((value) => !value)}>
                <div className="flex items-center gap-3">
                  <Settings2 className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="font-semibold">Wheel settings</div>
                    <div className="text-xs text-muted-foreground">Spin time, winners and sound</div>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </button>

              {settingsOpen && (
                <div className="space-y-4 border-t border-border/70 px-4 py-4">
                  <label className="block">
                    <div className="mb-2 flex items-center justify-between text-sm font-medium">
                      <span>Spin time</span>
                      <span className="text-muted-foreground">{settings.duration}s</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      step="1"
                      value={settings.duration}
                      onChange={(event) => setSettings((current) => ({ ...current, duration: Number(event.target.value) }))}
                      className="w-full accent-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 text-sm">
                    <span>Remove winner after spin</span>
                    <input type="checkbox" checked={settings.removeWinner} onChange={(event) => setSettings((current) => ({ ...current, removeWinner: event.target.checked }))} className="h-4 w-4 accent-blue-500" />
                  </label>
                  <label className="flex items-center justify-between gap-4 text-sm">
                    <span>Winner popup</span>
                    <input type="checkbox" checked={settings.showWinnerDialog} onChange={(event) => setSettings((current) => ({ ...current, showWinnerDialog: event.target.checked }))} className="h-4 w-4 accent-blue-500" />
                  </label>
                  <label className="flex items-center justify-between gap-4 text-sm">
                    <span>Confetti</span>
                    <input type="checkbox" checked={settings.confetti} onChange={(event) => setSettings((current) => ({ ...current, confetti: event.target.checked }))} className="h-4 w-4 accent-blue-500" />
                  </label>
                  <label className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2">Sound effects {settings.sound ? <Volume2 className="h-4 w-4 text-blue-500" /> : <VolumeX className="h-4 w-4" />}</span>
                    <input type="checkbox" checked={settings.sound} onChange={(event) => setSettings((current) => ({ ...current, sound: event.target.checked }))} className="h-4 w-4 accent-blue-500" />
                  </label>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              <button className="flex w-full items-center justify-between px-4 py-4 text-left" onClick={() => setHistoryOpen((value) => !value)}>
                <div className="flex items-center gap-3">
                  <History className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="font-semibold">Recent winners</div>
                    <div className="text-xs text-muted-foreground">{history.length} recorded {history.length === 1 ? "result" : "results"}</div>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>

              {historyOpen && (
                <div className="border-t border-border/70 p-3">
                  {history.length ? (
                    <div className="max-h-52 space-y-1 overflow-auto pr-1">
                      {history.map((item, index) => (
                        <div key={`${item}-${index}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/50">
                          <span className="truncate">{item}</span>
                          <span className="ml-3 text-xs text-muted-foreground">#{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">No spins yet.</div>
                  )}
                  {!!history.length && (
                    <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setHistory([])}>
                      Clear history
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><HelpCircle className="h-3.5 w-3.5" /> Your wheel is saved locally in this browser.</span>
              <Button variant="ghost" size="sm" onClick={reset} disabled={isSpinning}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </aside>
        </section>
      </main>

      {customizeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setCustomizeOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Customize wheel</div>
                <p className="mt-1 text-sm text-muted-foreground">The wheel uses the MPD blue/slate colour system.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCustomizeOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {MPD_COLORS.slice(0, 8).map((color) => (
                <div key={color} className="h-12 rounded-lg border border-white/10" style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              MPD branding is intentionally locked into the wheel so it matches the rest of your website instead of exposing the original Wheel of Names colour editor.
            </div>
            <Button className="mt-5 w-full" onClick={() => setCustomizeOpen(false)}>Done</Button>
          </div>
        </div>
      )}

      {winner && settings.showWinnerDialog && !isSpinning && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={() => setWinner(null)}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-500/30 bg-card shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-blue-400 to-blue-700" />
            <div className="p-7 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                <Trophy className="h-8 w-8" />
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-blue-500">Winner</div>
              <div className="mt-2 break-words text-3xl font-bold tracking-tight">{winner}</div>
              <div className="mt-2 text-sm text-muted-foreground">Congratulations!</div>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="outline" onClick={() => setWinner(null)}>Close</Button>
                {!settings.removeWinner && <Button onClick={removeWinner}><Trash2 className="mr-2 h-4 w-4" /> Remove</Button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[110] overflow-hidden">
          {Array.from({ length: 26 }).map((_, index) => (
            <span
              key={index}
              className="absolute h-2 w-1.5 animate-bounce rounded-sm bg-blue-500"
              style={{
                left: `${(index * 37) % 100}%`,
                top: `${(index * 17) % 55}%`,
                transform: `rotate(${index * 27}deg)`,
                animationDelay: `${(index % 7) * 80}ms`,
              }}
            />
          ))}
        </div>
      )}

      <Footer />
    </div>
  )
}
