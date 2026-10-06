import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Expand,
  FilePlus2,
  FolderOpen,
  History,
  MoreHorizontal,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  Share2,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import confetti from "canvas-confetti"
import { Wheel } from "spin-wheel"
import { toast } from "sonner"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

interface Entry {
  text: string
  color?: string
}

type SavedWheel = {
  title: string
  description: string
  entries: Entry[]
  colors: string[]
  spinTime: number
  removeWinner: boolean
  sound: boolean
  confetti: boolean
}

const STORAGE_KEY = "mpd-wheel-of-names-v4"
const DEFAULT_COLORS = [
  "#2563eb",
  "#0f172a",
  "#3b82f6",
  "#1e293b",
  "#60a5fa",
  "#334155",
]

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

function randomInt(max: number) {
  if (max <= 1) return 0
  try {
    const array = new Uint32Array(1)
    crypto.getRandomValues(array)
    return Math.floor((array[0] / 4294967296) * max)
  } catch {
    return Math.floor(Math.random() * max)
  }
}

function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function playTone(kind: "tick" | "winner") {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = kind === "winner" ? "sine" : "square"
    oscillator.frequency.value = kind === "winner" ? 660 : 130
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      kind === "winner" ? 0.08 : 0.025,
      context.currentTime + 0.01,
    )
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.13)
    window.setTimeout(() => void context.close(), 250)
  } catch {
    // Audio is optional; silently ignore browsers that block it.
  }
}

export default function WheelOfNames() {
  const wheelHostRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<Wheel | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("Wheel of Names")
  const [description, setDescription] = useState("")
  const [entries, setEntries] = useState<Entry[]>(
    DEFAULT_ENTRIES.map((text) => ({ text })),
  )
  const [draftEntries, setDraftEntries] = useState(DEFAULT_ENTRIES.join("\n"))
  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [spinTime, setSpinTime] = useState(5)
  const [removeWinner, setRemoveWinner] = useState(false)
  const [sound, setSound] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)
  const [winner, setWinner] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [spinning, setSpinning] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [showSettings, setShowSettings] = useState(true)
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const settingsRef = useRef({
    title,
    description,
    colors,
    spinTime,
    removeWinner,
    sound,
    confetti: confettiEnabled,
  })
  settingsRef.current = { title, description, colors, spinTime, removeWinner, sound, confetti: confettiEnabled }

  const entryTexts = useMemo(
    () => entries.map((entry) => entry.text).filter(Boolean),
    [entries],
  )

  const saveLocal = useCallback(
    (nextEntries = entries) => {
      const payload: SavedWheel = {
        title,
        description,
        entries: nextEntries,
        colors,
        spinTime,
        removeWinner,
        sound,
        confetti: confettiEnabled,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    },
    [colors],
  )

  const rebuildWheel = useCallback(
    (nextEntries = entries) => {
      if (!wheelHostRef.current) return
      const host = wheelHostRef.current
      host.innerHTML = ""
      const wheel = new Wheel(host, {
        items: nextEntries.map((entry, index) => ({
          label: entry.text,
          backgroundColor: entry.color || colors[index % colors.length],
          textColor: "#ffffff",
        })),
        pointerAngle: 270,
        radius: 0.9,
        borderWidth: 2,
        borderColor: "#0b1220",
        lineWidth: 1,
        lineColor: "rgba(255,255,255,.24)",
        itemLabelFont: "Geist Variable, sans-serif",
        itemLabelFontSizeMax: 22,
        itemLabelRadius: 0.76,
        itemLabelRadiusMax: 0.9,
        itemLabelAlign: "right",
        itemLabelColors: ["#ffffff"],
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        isInteractive: false,
      })
      wheel.onCurrentIndexChange = () => {
        if (settingsRef.current.sound) playTone("tick")
      }
      wheel.onRest = (event: { currentIndex: number }) => {
        const index = event.currentIndex
        const selected = nextEntries[index]?.text
        if (!selected) return
        setSpinning(false)
        setWinner(selected)
        setHistory((current) => [selected, ...current.filter((item) => item !== selected)].slice(0, 20))
        if (settingsRef.current.sound) playTone("winner")
        if (settingsRef.current.confetti) {
          void confetti({ particleCount: 120, spread: 75, origin: { y: 0.62 } })
        }
        if (settingsRef.current.removeWinner) {
          const remaining = nextEntries.filter((_, itemIndex) => itemIndex !== index)
          setEntries(remaining)
          setDraftEntries(remaining.map((item) => item.text).join("\n"))
          const settings = settingsRef.current
          const payload: SavedWheel = { title: settings.title, description: settings.description, entries: remaining, colors: settings.colors, spinTime: settings.spinTime, removeWinner: settings.removeWinner, sound: settings.sound, confetti: settings.confetti }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
          window.setTimeout(() => rebuildWheel(remaining), 0)
        } else {
          const settings = settingsRef.current
          const payload: SavedWheel = { title: settings.title, description: settings.description, entries: nextEntries, colors: settings.colors, spinTime: settings.spinTime, removeWinner: settings.removeWinner, sound: settings.sound, confetti: settings.confetti }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
        }
      }
      wheelRef.current = wheel
    },
    [colors],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as SavedWheel
        if (Array.isArray(saved.entries) && saved.entries.length) {
          setEntries(saved.entries)
          setDraftEntries(saved.entries.map((entry) => entry.text).join("\n"))
        }
        if (typeof saved.title === "string") setTitle(saved.title)
        if (typeof saved.description === "string") setDescription(saved.description)
        if (Array.isArray(saved.colors) && saved.colors.length) setColors(saved.colors)
        if (typeof saved.spinTime === "number") setSpinTime(saved.spinTime)
        if (typeof saved.removeWinner === "boolean") setRemoveWinner(saved.removeWinner)
        if (typeof saved.sound === "boolean") setSound(saved.sound)
        if (typeof saved.confetti === "boolean") setConfettiEnabled(saved.confetti)
      }
    } catch {
      // Ignore malformed local data.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    rebuildWheel()
    return () => {
      wheelRef.current = null
    }
  }, [loaded, rebuildWheel])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault()
        if (!spinning) spin()
      }
      if (event.key === "Escape") {
        setShowCustomize(false)
        setShowMore(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  function updateWheel() {
    const next = draftEntries
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text }))
    if (!next.length) {
      toast.error("Add at least one entry.")
      return
    }
    setEntries(next)
    setWinner("")
    saveLocal(next)
    rebuildWheel(next)
    toast.success("Wheel updated")
  }

  function spin() {
    if (spinning || !wheelRef.current || !entryTexts.length) return
    setSpinning(true)
    setWinner("")
    const index = randomInt(entryTexts.length)
    wheelRef.current.spinToItem(index, spinTime * 1000, true, 5, 1)
  }

  function newWheel() {
    const next = DEFAULT_ENTRIES.map((text) => ({ text }))
    setTitle("Wheel of Names")
    setDescription("")
    setEntries(next)
    setDraftEntries(DEFAULT_ENTRIES.join("\n"))
    setWinner("")
    setHistory([])
    setRemoveWinner(false)
    setSpinTime(5)
    setSound(true)
    setConfettiEnabled(true)
    setColors(DEFAULT_COLORS)
    window.setTimeout(() => rebuildWheel(next), 0)
    localStorage.removeItem(STORAGE_KEY)
    toast.success("New wheel created")
  }

  function shuffleEntries() {
    const next = [...entries]
    for (let index = next.length - 1; index > 0; index -= 1) {
      const target = randomInt(index + 1)
      ;[next[index], next[target]] = [next[target], next[index]]
    }
    setEntries(next)
    setDraftEntries(next.map((entry) => entry.text).join("\n"))
    rebuildWheel(next)
    saveLocal(next)
  }

  function removeDuplicates() {
    const seen = new Set<string>()
    const next = entries.filter((entry) => {
      const key = entry.text.trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setEntries(next)
    setDraftEntries(next.map((entry) => entry.text).join("\n"))
    rebuildWheel(next)
    saveLocal(next)
    toast.success(`${entries.length - next.length} duplicates removed`)
  }

  function clearEntries() {
    setEntries([])
    setDraftEntries("")
    setWinner("")
    if (wheelHostRef.current) wheelHostRef.current.innerHTML = ""
    wheelRef.current = null
    localStorage.removeItem(STORAGE_KEY)
  }

  function saveFile() {
    const payload: SavedWheel = {
      title,
      description,
      entries,
      colors,
      spinTime,
      removeWinner,
      sound,
      confetti: confettiEnabled,
    }
    downloadText(`${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "wheel"}.wheel`, JSON.stringify(payload, null, 2))
    toast.success("Wheel saved")
  }

  function openFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const saved = JSON.parse(String(reader.result)) as SavedWheel
        const next = Array.isArray(saved.entries) ? saved.entries.filter((entry) => entry?.text) : []
        if (!next.length) throw new Error("No entries")
        setTitle(saved.title || "Wheel of Names")
        setDescription(saved.description || "")
        setEntries(next)
        setDraftEntries(next.map((entry) => entry.text).join("\n"))
        setColors(saved.colors?.length ? saved.colors : DEFAULT_COLORS)
        setSpinTime(saved.spinTime || 5)
        setRemoveWinner(Boolean(saved.removeWinner))
        setSound(saved.sound !== false)
        setConfettiEnabled(saved.confetti !== false)
        setWinner("")
        window.setTimeout(() => rebuildWheel(next), 0)
        toast.success("Wheel opened")
      } catch {
        toast.error("That file is not a valid wheel file.")
      }
    }
    reader.readAsText(file)
  }

  async function shareWheel() {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      title,
      description,
      entries,
      colors,
      spinTime,
      removeWinner,
      sound,
      confetti: confettiEnabled,
    }))))
    const url = `${window.location.origin}${window.location.pathname}#wheel=${payload}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Wheel link copied to clipboard")
    } catch {
      window.prompt("Copy this wheel link:", url)
    }
  }

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith("#wheel=")) return
    try {
      const encoded = hash.slice(7)
      const saved = JSON.parse(decodeURIComponent(escape(atob(encoded)))) as SavedWheel
      const next = saved.entries?.filter((entry) => entry?.text) || []
      if (!next.length) return
      setTitle(saved.title || "Wheel of Names")
      setDescription(saved.description || "")
      setEntries(next)
      setDraftEntries(next.map((entry) => entry.text).join("\n"))
      setColors(saved.colors?.length ? saved.colors : DEFAULT_COLORS)
      setSpinTime(saved.spinTime || 5)
      setRemoveWinner(Boolean(saved.removeWinner))
      setSound(saved.sound !== false)
      setConfettiEnabled(saved.confetti !== false)
      window.history.replaceState(null, "", window.location.pathname)
      window.setTimeout(() => rebuildWheel(next), 100)
    } catch {
      // Ignore malformed shared wheels.
    }
  }, [rebuildWheel])

  async function copyEntries() {
    try {
      await navigator.clipboard.writeText(draftEntries)
      toast.success("Entries copied")
    } catch {
      toast.error("Clipboard access is unavailable")
    }
  }

  function toggleFullscreen() {
    const element = document.documentElement
    if (!document.fullscreenElement) {
      void element.requestFullscreen?.()
      setFullscreen(true)
    } else {
      void document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  const accent = colors[0] || DEFAULT_COLORS[0]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className={`mx-auto w-full max-w-[1600px] px-4 pb-12 pt-24 sm:px-6 lg:px-8 ${fullscreen ? "hidden" : ""}`}>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-2xl shadow-black/20 backdrop-blur">
          <header className="border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => setShowCustomize(true)} className="wheel-toolbar-button">
                <Palette className="size-4" /> Customize
              </button>
              <button onClick={newWheel} className="wheel-toolbar-button"><FilePlus2 className="size-4" /> New</button>
              <button onClick={() => fileInputRef.current?.click()} className="wheel-toolbar-button"><FolderOpen className="size-4" /> Open</button>
              <button onClick={saveFile} className="wheel-toolbar-button"><Save className="size-4" /> Save</button>
              <button onClick={() => void shareWheel()} className="wheel-toolbar-button"><Share2 className="size-4" /> Share</button>
              <button onClick={() => toast.info("Gallery is not required for this MPD build.")} className="wheel-toolbar-button"><Sparkles className="size-4" /> Gallery</button>
              <button onClick={toggleFullscreen} className="wheel-toolbar-button"><Expand className="size-4" /> {fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
              <div className="relative ml-auto">
                <button onClick={() => setShowMore((value) => !value)} className="wheel-toolbar-button" aria-label="More">
                  <MoreHorizontal className="size-4" /> More
                </button>
                {showMore && (
                  <div className="absolute right-0 top-11 z-40 w-52 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                    <button onClick={shuffleEntries} className="wheel-menu-item"><Shuffle className="size-4" /> Shuffle entries</button>
                    <button onClick={removeDuplicates} className="wheel-menu-item"><Scissors className="size-4" /> Remove duplicates</button>
                    <button onClick={copyEntries} className="wheel-menu-item"><Copy className="size-4" /> Copy entries</button>
                    <button onClick={clearEntries} className="wheel-menu-item text-red-500"><Trash2 className="size-4" /> Clear entries</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <section className="px-4 py-4 sm:px-6">
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => saveLocal()}
                  className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground sm:text-3xl"
                  placeholder="Wheel of Names"
                  aria-label="Wheel title"
                />
                {showDescriptionEditor ? (
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    onBlur={() => { saveLocal(); setShowDescriptionEditor(false) }}
                    autoFocus
                    className="mt-1 w-full bg-transparent text-sm text-muted-foreground outline-none"
                    placeholder="Add a description"
                  />
                ) : (
                  <button onClick={() => setShowDescriptionEditor(true)} className="mt-1 text-left text-sm text-muted-foreground hover:text-foreground">
                    {description || "Add a description"}
                  </button>
                )}
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{entries.length} entries</span>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{removeWinner ? "Remove winners" : "Keep winners"}</span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
              <section className="relative flex min-h-[700px] flex-col rounded-2xl border border-border/70 bg-background/40 p-3 sm:p-5">
                <div className="relative flex min-h-[570px] flex-1 items-center justify-center overflow-hidden rounded-xl">
                  <div
                    className="absolute left-1/2 top-1 z-20 -translate-x-1/2"
                    style={{ width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: `26px solid ${accent}`, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.45))" }}
                  />
                  <div
                    ref={wheelHostRef}
                    onClick={spin}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") spin() }}
                    className="aspect-square w-[min(76vw,620px)] max-w-full cursor-pointer"
                    aria-label="Spin the wheel"
                  />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-foreground bg-background shadow-xl">
                    <div className="size-3 rounded-full" style={{ backgroundColor: accent }} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pb-2 pt-3">
                  <button
                    disabled={spinning || !entries.length}
                    onClick={spin}
                    className="inline-flex h-11 items-center gap-2 rounded-lg px-7 font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    <Trophy className="size-4" /> {spinning ? "Spinning..." : "Spin the wheel"}
                  </button>
                  <button disabled={spinning || entries.length < 2} onClick={shuffleEntries} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 font-medium transition hover:bg-muted disabled:opacity-50">
                    <Shuffle className="size-4" /> Shuffle
                  </button>
                </div>

                {winner && (
                  <div className="mx-auto mt-2 flex w-fit items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 shadow-sm">
                    <div className="flex size-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}><Trophy className="size-4" /></div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500">Winner</div>
                      <div className="font-bold">{winner}</div>
                    </div>
                  </div>
                )}
              </section>

              <aside className="space-y-5">
                <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/40">
                  <div className="flex items-center justify-between px-4 py-4">
                    <div>
                      <h2 className="font-bold">Entries</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Type one name or option per line.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDraftEntries((value) => `${value}${value ? "\n" : ""}New entry`)} className="rounded-md p-2 hover:bg-muted" aria-label="Add entry"><Plus className="size-4" /></button>
                      <button onClick={clearEntries} className="rounded-md p-2 hover:bg-muted" aria-label="Clear entries"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  <div className="px-4">
                    <textarea
                      value={draftEntries}
                      onChange={(event) => setDraftEntries(event.target.value)}
                      className="h-56 w-full resize-none rounded-xl border border-border bg-muted/20 p-3 text-sm leading-6 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"
                      aria-label="Wheel entries"
                    />
                    <div className="flex items-center justify-between py-3">
                      <span className="text-xs text-muted-foreground">{draftEntries ? draftEntries.split(/\r?\n/).filter(Boolean).length : 0} lines</span>
                      <button onClick={updateWheel} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition hover:opacity-90">
                        <RotateCcw className="size-3.5" /> Update wheel
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border-t border-border/70">
                    {entries.map((entry, index) => (
                      <div key={`${entry.text}-${index}`} className="group flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/30">
                        <span className="size-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                        <span className="min-w-0 flex-1 truncate">{entry.text}</span>
                        <button
                          onClick={() => {
                            const next = entries.filter((_, itemIndex) => itemIndex !== index)
                            setEntries(next)
                            setDraftEntries(next.map((item) => item.text).join("\n"))
                            rebuildWheel(next)
                            saveLocal(next)
                          }}
                          className="invisible rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:visible"
                          aria-label={`Remove ${entry.text}`}
                        ><X className="size-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/40">
                  <button onClick={() => setShowSettings((value) => !value)} className="flex w-full items-center justify-between px-4 py-4 text-left">
                    <div><h2 className="font-bold">Wheel settings</h2><p className="mt-0.5 text-xs text-muted-foreground">Spin time, winners and sound</p></div>
                    {showSettings ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                  {showSettings && (
                    <div className="space-y-4 border-t border-border/70 px-4 py-4 text-sm">
                      <label className="flex items-center justify-between gap-4"><span>Spin time <b>{spinTime}s</b></span><input type="range" min="1" max="20" step="1" value={spinTime} onChange={(event) => setSpinTime(Number(event.target.value))} onMouseUp={() => saveLocal()} className="w-40" /></label>
                      <label className="flex cursor-pointer items-center justify-between"><span>Remove winner after spin</span><input type="checkbox" checked={removeWinner} onChange={(event) => { setRemoveWinner(event.target.checked); window.setTimeout(() => saveLocal(), 0) }} /></label>
                      <label className="flex cursor-pointer items-center justify-between"><span className="flex items-center gap-2">{sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} Sound</span><input type="checkbox" checked={sound} onChange={(event) => { setSound(event.target.checked); window.setTimeout(() => saveLocal(), 0) }} /></label>
                      <label className="flex cursor-pointer items-center justify-between"><span>Confetti</span><input type="checkbox" checked={confettiEnabled} onChange={(event) => { setConfettiEnabled(event.target.checked); window.setTimeout(() => saveLocal(), 0) }} /></label>
                    </div>
                  )}
                </section>

                <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/40">
                  <button onClick={() => setShowHistory((value) => !value)} className="flex w-full items-center justify-between px-4 py-4 text-left">
                    <div><h2 className="flex items-center gap-2 font-bold"><History className="size-4" /> Recent winners</h2><p className="mt-0.5 text-xs text-muted-foreground">{history.length} recorded results</p></div>
                    {showHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                  {showHistory && history.length > 0 && <div className="border-t border-border/70">{history.map((item, index) => <div key={`${item}-${index}`} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{item}</span><span className="text-xs text-muted-foreground">#{index + 1}</span></div>)}</div>}
                </section>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <button onClick={newWheel} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-muted"><RotateCcw className="size-3.5" /> Reset</button>
                  <span className="rounded-md border border-border px-3 py-1.5">Your list is saved locally in this browser.</span>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      <input ref={fileInputRef} type="file" accept=".wheel,.json,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) openFile(file); event.currentTarget.value = "" }} />

      {showCustomize && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={() => setShowCustomize(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">Customize wheel</h2><p className="text-sm text-muted-foreground">Make the Wheel of Names match MPD.</p></div><button onClick={() => setShowCustomize(false)} className="rounded-lg p-2 hover:bg-muted"><X className="size-4" /></button></div>
            <div className="space-y-5">
              <div><label className="mb-2 block text-sm font-medium">Wheel colors</label><div className="grid grid-cols-3 gap-2">{colors.map((color, index) => <label key={index} className="flex items-center gap-2 rounded-lg border border-border p-2"><input type="color" value={color} onChange={(event) => { const next = [...colors]; next[index] = event.target.value; setColors(next); window.setTimeout(() => { rebuildWheel(entries); saveLocal() }, 0) }} className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" /><input value={color} onChange={(event) => { const next = [...colors]; next[index] = event.target.value; setColors(next) }} onBlur={() => { rebuildWheel(entries); saveLocal() }} className="min-w-0 flex-1 bg-transparent text-xs uppercase outline-none" /></label>)}</div></div>
              <div><label className="mb-2 block text-sm font-medium">Quick palette</label><div className="flex flex-wrap gap-2">{[["#2563eb","#0f172a","#3b82f6","#1e293b","#60a5fa","#334155"],["#1d4ed8","#172554","#2563eb","#1e3a8a","#60a5fa","#0f172a"],["#dc2626","#7f1d1d","#f97316","#431407","#f59e0b","#451a03"]].map((palette, index) => <button key={index} onClick={() => { setColors(palette); window.setTimeout(() => rebuildWheel(entries), 0) }} className="flex overflow-hidden rounded-lg border border-border">{palette.map((color) => <span key={color} className="h-7 w-7" style={{ backgroundColor: color }} />)}</button>)}</div></div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">The wheel is rendered directly by React. No external Wheel of Names page, image pack, wheel folder, icon pack or asset bundle is required.</div>
            </div>
            <div className="mt-5 flex justify-end"><button onClick={() => { saveLocal(); setShowCustomize(false) }} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: accent }}>Done</button></div>
          </div>
        </div>
      )}

      <style>{`
        .wheel-toolbar-button{display:inline-flex;align-items:center;gap:.45rem;border-radius:.55rem;padding:.55rem .72rem;font-size:.78rem;font-weight:600;color:var(--foreground);transition:background-color .15s,opacity .15s}
        .wheel-toolbar-button:hover{background:color-mix(in srgb,var(--foreground) 7%,transparent)}
        .wheel-menu-item{display:flex;width:100%;align-items:center;gap:.6rem;border-radius:.5rem;padding:.6rem .7rem;text-align:left;font-size:.8rem}
        .wheel-menu-item:hover{background:color-mix(in srgb,var(--foreground) 7%,transparent)}
      `}</style>
    </div>
  )
}
