import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SpinWheel as ReactSpinWheel } from "react-spin-wheel"
import "react-spin-wheel/dist/index.css"
import {
  Check,
  Copy,
  FolderOpen,
  Maximize2,
  Plus,
  RotateCcw,
  Settings2,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Footer from "@/components/Footer"
import Navbar from "@/components/home/Navbar"

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

const WHEEL_COLORS = [
  "#5B8DEF",
  "#B85AD9",
  "#F4C84B",
  "#55C78A",
  "#4AA8DF",
  "#D96BBD",
  "#F0A84B",
  "#63C7B2",
]

const STORAGE_KEY = "mpd-spin-wheel-react-package-v1"

type SavedWheel = {
  entries: string[]
  spinTime: number
  removeWinner: boolean
  showWinner: boolean
  muted: boolean
  title: string
}

type HistoryItem = {
  id: string
  winner: string
  at: number
}

function normalizeEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function secureRandom(max: number) {
  if (max <= 1) return 0
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % max
}

function resultName(value: unknown) {
  if (typeof value === "string") return value.trim()

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.name === "string") return record.name.trim()
    if (typeof record.text === "string") return record.text.trim()
    if (typeof record.label === "string") return record.label.trim()
  }

  return ""
}

function playWinnerSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(660, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      990,
      context.currentTime + 0.12,
    )

    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.3)

    window.setTimeout(() => void context.close(), 450)
  } catch {
    // Browsers can block audio contexts until the user interacts with the page.
  }
}

function launchConfetti() {
  const root = document.createElement("div")
  root.setAttribute("aria-hidden", "true")
  root.className = "mpd-spin-confetti"

  for (let index = 0; index < 36; index += 1) {
    const piece = document.createElement("span")
    piece.style.left = `${35 + Math.random() * 30}%`
    piece.style.top = `${25 + Math.random() * 10}%`
    piece.style.setProperty("--x", `${(Math.random() - 0.5) * 600}px`)
    piece.style.setProperty("--y", `${160 + Math.random() * 280}px`)
    piece.style.setProperty("--r", `${Math.random() * 720 - 360}deg`)
    piece.style.setProperty("--delay", `${Math.random() * 80}ms`)
    root.appendChild(piece)
  }

  document.body.appendChild(root)
  window.setTimeout(() => root.remove(), 1200)
}

export default function SpinWheel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const spinningRef = useRef(false)

  const [entries, setEntries] = useState(DEFAULT_ENTRIES)
  const [draft, setDraft] = useState(DEFAULT_ENTRIES.join("\n"))
  const [winner, setWinner] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [showWinner, setShowWinner] = useState(true)
  const [removeWinner, setRemoveWinner] = useState(false)
  const [spinTime, setSpinTime] = useState(5)
  const [muted, setMuted] = useState(true)
  const [title, setTitle] = useState("Spin the Wheel")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const entryCountLabel = useMemo(
    () => `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`,
    [entries.length],
  )

  const syncDraft = useCallback((value: string) => {
    setDraft(value)
    setEntries(normalizeEntries(value))
    setWinner(null)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sharedEntries = params.get("entries")
    const sharedTitle = params.get("title")
    const sharedSpinTime = Number(params.get("spinTime"))

    if (sharedEntries) {
      const parsed = normalizeEntries(sharedEntries.replace(/,/g, "\n"))
      if (parsed.length) {
        setEntries(parsed)
        setDraft(parsed.join("\n"))
      }
    }

    if (sharedTitle?.trim()) setTitle(sharedTitle.trim())
    if (Number.isFinite(sharedSpinTime) && sharedSpinTime >= 1) {
      setSpinTime(Math.min(30, Math.max(1, sharedSpinTime)))
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved || sharedEntries) return

      const parsed = JSON.parse(saved) as Partial<SavedWheel>
      if (Array.isArray(parsed.entries) && parsed.entries.length) {
        setEntries(parsed.entries)
        setDraft(parsed.entries.join("\n"))
      }
      if (typeof parsed.spinTime === "number") {
        setSpinTime(Math.min(30, Math.max(1, parsed.spinTime)))
      }
      if (typeof parsed.removeWinner === "boolean") {
        setRemoveWinner(parsed.removeWinner)
      }
      if (typeof parsed.showWinner === "boolean") {
        setShowWinner(parsed.showWinner)
      }
      if (typeof parsed.muted === "boolean") {
        setMuted(parsed.muted)
      }
      if (typeof parsed.title === "string" && parsed.title.trim()) {
        setTitle(parsed.title.trim())
      }
    } catch {
      // Ignore malformed local wheel data.
    }
  }, [])

  useEffect(() => {
    const saved: SavedWheel = {
      entries,
      spinTime,
      removeWinner,
      showWinner,
      muted,
      title,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  }, [entries, muted, removeWinner, showWinner, spinTime, title])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault()
        const button = document.querySelector<HTMLButtonElement>(
          ".wheel-library-host button",
        )
        button?.click()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleSpinStart = useCallback(() => {
    spinningRef.current = true
    setSpinning(true)
    setWinner(null)
  }, [])

  const handleFinishSpin = useCallback(
    (item: unknown) => {
      const selected = resultName(item)
      spinningRef.current = false
      setSpinning(false)

      if (!selected) {
        toast.error("The wheel finished without returning a winner.")
        return
      }

      setWinner(selected)
      setHistory((current) => [
        { id: crypto.randomUUID(), winner: selected, at: Date.now() },
        ...current,
      ].slice(0, 25))

      if (!muted) playWinnerSound()
      launchConfetti()

      if (removeWinner) {
        setEntries((current) => {
          const index = current.findIndex((entry) => entry === selected)
          if (index < 0) return current
          const next = current.filter((_, entryIndex) => entryIndex !== index)
          setDraft(next.join("\n"))
          return next
        })
      }
    },
    [muted, removeWinner],
  )

  const shuffle = () => {
    if (spinningRef.current) return

    const copy = [...entries]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = secureRandom(index + 1)
      ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
    }

    setEntries(copy)
    setDraft(copy.join("\n"))
    setWinner(null)
  }

  const sortEntries = () => {
    if (spinningRef.current) return

    const sorted = [...entries].sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    )

    setEntries(sorted)
    setDraft(sorted.join("\n"))
    setWinner(null)
  }

  const addEntry = () => {
    if (spinningRef.current) return

    const next = [...entries, `Entry ${entries.length + 1}`]
    setEntries(next)
    setDraft(next.join("\n"))
  }

  const clearEntries = () => {
    if (spinningRef.current) return
    setEntries([])
    setDraft("")
    setWinner(null)
  }

  const reset = () => {
    if (spinningRef.current) return

    setEntries(DEFAULT_ENTRIES)
    setDraft(DEFAULT_ENTRIES.join("\n"))
    setSpinTime(5)
    setRemoveWinner(false)
    setShowWinner(true)
    setMuted(true)
    setTitle("Spin the Wheel")
    setWinner(null)
  }

  const copyWheel = async () => {
    const params = new URLSearchParams({
      entries: entries.join(","),
      spinTime: String(spinTime),
      title,
    })
    const url = `${window.location.origin}/spin-wheel?${params.toString()}`

    try {
      await navigator.clipboard.writeText(url)
      toast.success("Wheel link copied")
    } catch {
      toast.error("Unable to copy the wheel link")
    }
  }

  const saveWheel = () => {
    const payload: SavedWheel = {
      entries,
      spinTime,
      removeWinner,
      showWinner,
      muted,
      title,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "mpd-wheel.wheel"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Wheel saved")
  }

  const openWheel = () => fileInputRef.current?.click()

  const handleWheelFile = async (file: File | undefined) => {
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as Partial<SavedWheel>
      const loadedEntries = Array.isArray(parsed.entries)
        ? parsed.entries.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : []

      if (loadedEntries.length < 2) {
        toast.error("The wheel file needs at least two entries.")
        return
      }

      setEntries(loadedEntries)
      setDraft(loadedEntries.join("\n"))
      if (typeof parsed.spinTime === "number") {
        setSpinTime(Math.min(30, Math.max(1, parsed.spinTime)))
      }
      if (typeof parsed.removeWinner === "boolean") setRemoveWinner(parsed.removeWinner)
      if (typeof parsed.showWinner === "boolean") setShowWinner(parsed.showWinner)
      if (typeof parsed.muted === "boolean") setMuted(parsed.muted)
      if (typeof parsed.title === "string" && parsed.title.trim()) setTitle(parsed.title.trim())
      setWinner(null)
      toast.success("Wheel opened")
    } catch {
      toast.error("That wheel file is not valid.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
    } catch {
      toast.error("Fullscreen is not available in this browser.")
    }
  }

  return (
    <div className="spin-page">
      <Navbar />

      <main className="spin-main">
        <div className="spin-toolbar">
          <div className="spin-brand">
            <div className="spin-brand-mark">MPD</div>
            <div>
              <h1>{title}</h1>
              <p>Enter names in the list, then spin the wheel to pick a random winner.</p>
            </div>
          </div>

          <div className="spin-toolbar-actions">
            <button className="spin-tool-button" onClick={copyWheel} title="Share this wheel">
              <Copy size={16} />
              <span>Share</span>
            </button>
            <button className="spin-tool-button" onClick={saveWheel} title="Save wheel">
              <Check size={16} />
              <span>Save</span>
            </button>
            <button className="spin-tool-button" onClick={openWheel} title="Open wheel">
              <FolderOpen size={16} />
              <span>Open</span>
            </button>
            <button className="spin-tool-button" onClick={shuffle} title="Shuffle entries" disabled={entries.length < 2}>
              <Shuffle size={16} />
              <span>Shuffle</span>
            </button>
            <button className="spin-tool-button" onClick={() => setShowSettings((value) => !value)} title="Customize">
              <Settings2 size={16} />
              <span>Customize</span>
            </button>
            <button className="spin-tool-icon" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".wheel,.json,application/json"
          hidden
          onChange={(event) => void handleWheelFile(event.target.files?.[0])}
        />

        <section className="wheel-workspace">
          <div className="wheel-stage">
            <div className="wheel-library-host">
              <ReactSpinWheel
                key={`${entries.join("\u0001")}-${WHEEL_COLORS.join("\u0001")}`}
                items={entries.length ? entries : ["Add entries", "to spin"]}
                itemColors={WHEEL_COLORS}
                borderColor="#111827"
                size={Math.min(640, Math.max(320, window.innerWidth < 700 ? window.innerWidth - 50 : 620))}
                spinTime={spinTime * 1000}
                spinActionName="SPIN"
                resetActionName="RESET"
                onResult={handleSpinStart}
                onFinishSpin={handleFinishSpin}
                onReset={() => setWinner(null)}
                spinContainerStyle={{
                  background: "transparent",
                  boxShadow: "none",
                  padding: 0,
                }}
                spinWheelStyle={{
                  borderRadius: "50%",
                  boxShadow: "0 16px 34px rgba(0,0,0,.16)",
                }}
                spinButtonStyle={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "1px solid #1d4ed8",
                  borderRadius: 999,
                  fontWeight: 800,
                  minWidth: 118,
                  minHeight: 46,
                  boxShadow: "0 9px 24px rgba(37,99,235,.25)",
                  cursor: "pointer",
                }}
                resetButtonStyle={{ display: "none" }}
                spinFontStyle={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: ".01em",
                }}
                spinItemStyle={{
                  color: "#fff",
                  fontWeight: 700,
                  fontFamily: "Geist Variable, sans-serif",
                }}
              />
            </div>

            <div className="wheel-side-hint">
              Click <strong>SPIN</strong> or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
            </div>
          </div>

          <aside className="entries-panel">
            <div className="entries-panel-header">
              <div>
                <h2>Entries</h2>
                <span>{entryCountLabel}</span>
              </div>
              <div className="entries-header-actions">
                <button onClick={addEntry} title="Add entry" disabled={spinning}>
                  <Plus size={16} />
                </button>
                <button onClick={clearEntries} title="Clear all" disabled={spinning}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <textarea
              value={draft}
              onChange={(event) => syncDraft(event.target.value)}
              placeholder="Enter one name per line…"
              spellCheck={false}
              aria-label="Wheel entries"
              disabled={spinning}
            />

            <div className="entries-actions">
              <button onClick={shuffle} disabled={entries.length < 2}>
                <Shuffle size={14} /> Shuffle
              </button>
              <button onClick={sortEntries} disabled={entries.length < 2}>
                <SlidersHorizontal size={14} /> Sort
              </button>
              <button onClick={() => setDraft(entries.join("\n"))}>
                <Check size={14} /> Apply
              </button>
            </div>

            <div className="entries-footer">
              <span>One entry per line</span>
              <button onClick={() => setShowSettings((value) => !value)}>
                <Settings2 size={14} /> Customize
              </button>
            </div>
          </aside>
        </section>

        {winner && (
          <div className="latest-winner">
            <div>
              <div className="latest-winner-label">Latest Winner</div>
              <div className="latest-winner-name">{winner}</div>
            </div>
            <div className="latest-winner-time">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        )}

        {showSettings && (
          <section className="customize-panel">
            <div className="customize-title">
              <div>
                <h2>Customize</h2>
                <p>Change the wheel behavior while keeping the Wheel of Names-style layout.</p>
              </div>
              <button onClick={() => setShowSettings(false)} aria-label="Close customization">
                <X size={18} />
              </button>
            </div>

            <div className="customize-grid">
              <div className="setting-card">
                <div className="setting-heading">
                  <div>
                    <strong>Spin time</strong>
                    <span>How long each spin lasts.</span>
                  </div>
                  <strong>{spinTime}s</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={spinTime}
                  onChange={(event) => setSpinTime(Number(event.target.value))}
                />
                <div className="range-labels"><span>1s</span><span>30s</span></div>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div>
                    <strong>After spin</strong>
                    <span>Control the result behavior.</span>
                  </div>
                </div>
                <label className="setting-toggle">
                  <input type="checkbox" checked={removeWinner} onChange={(event) => setRemoveWinner(event.target.checked)} />
                  <span className="toggle-ui" />
                  <span>Remove winner after spin</span>
                </label>
                <label className="setting-toggle">
                  <input type="checkbox" checked={showWinner} onChange={(event) => setShowWinner(event.target.checked)} />
                  <span className="toggle-ui" />
                  <span>Show winner dialog</span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div>
                    <strong>Sound</strong>
                    <span>Play a short result sound.</span>
                  </div>
                </div>
                <label className="setting-toggle">
                  <input type="checkbox" checked={!muted} onChange={(event) => setMuted(!event.target.checked)} />
                  <span className="toggle-ui" />
                  <span>Enable winner sound</span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div>
                    <strong>Wheel title</strong>
                    <span>Shown above the wheel.</span>
                  </div>
                </div>
                <input
                  className="setting-input"
                  value={title}
                  maxLength={60}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
            </div>

            <div className="customize-bottom">
              <button onClick={reset}>
                <RotateCcw size={15} /> Reset wheel
              </button>
              <button onClick={() => setShowSettings(false)}>Done</button>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="spin-history">
            <div className="spin-history-header">
              <h2>Spin history</h2>
              <button onClick={() => setHistory([])}>Clear history</button>
            </div>
            <div className="spin-history-list">
              {history.map((item) => (
                <div className="spin-history-row" key={item.id}>
                  <span>{item.winner}</span>
                  <span>{new Date(item.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {winner && showWinner && (
          <div className="winner-overlay" role="dialog" aria-modal="true" onClick={() => setWinner(null)}>
            <div className="winner-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="winner-kicker">WINNER</div>
              <h2>{winner}</h2>
              <p>The wheel has selected a winner.</p>
              <div className="winner-actions">
                <button onClick={() => setWinner(null)}>Close</button>
                <button className="winner-primary" onClick={() => setWinner(null)}>Continue</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
