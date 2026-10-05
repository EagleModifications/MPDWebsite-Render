import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  Copy,
  Dices,
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

const COLORS = [
  "#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5",
  "#3949ab", "#8e24aa", "#d81b60", "#6d4c41", "#546e7a", "#00897b",
]

function secureRandom(max: number) {
  if (max <= 1) return 0
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % max
}

function normalizeEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export default function SpinWheel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const rotationRef = useRef(0)
  const spinStartedAtRef = useRef(0)
  const spinFromRef = useRef(0)
  const spinToRef = useRef(0)
  const spinDurationRef = useRef(5000)

  const [entries, setEntries] = useState(DEFAULT_ENTRIES)
  const [draft, setDraft] = useState(DEFAULT_ENTRIES.join("\n"))
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [removeWinner, setRemoveWinner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showWinner, setShowWinner] = useState(true)
  const [spinTime, setSpinTime] = useState(5)
  const [muted, setMuted] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [centerText, setCenterText] = useState("SPIN")

  const syncDraft = useCallback((value: string) => {
    setDraft(value)
    setEntries(normalizeEntries(value))
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem("mpd-spin-wheel")
    if (!saved) return
    try {
      const parsed = JSON.parse(saved) as { entries?: string[]; spinTime?: number; removeWinner?: boolean }
      if (Array.isArray(parsed.entries) && parsed.entries.length) {
        setEntries(parsed.entries)
        setDraft(parsed.entries.join("\n"))
      }
      if (typeof parsed.spinTime === "number") setSpinTime(Math.min(30, Math.max(1, parsed.spinTime)))
      if (typeof parsed.removeWinner === "boolean") setRemoveWinner(parsed.removeWinner)
    } catch {
      // Ignore an invalid local wheel.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      "mpd-spin-wheel",
      JSON.stringify({ entries, spinTime, removeWinner }),
    )
  }, [entries, removeWinner, spinTime])

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const size = Math.min(rect.width, rect.height)
    canvas.width = Math.floor(size * dpr)
    canvas.height = Math.floor(size * dpr)

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 8
    const count = Math.max(entries.length, 1)
    const slice = (Math.PI * 2) / count

    ctx.clearRect(0, 0, size, size)

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)

    if (!entries.length) {
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = "#e5e7eb"
      ctx.fill()
      ctx.strokeStyle = "rgba(0,0,0,.22)"
      ctx.lineWidth = 3
      ctx.stroke()
    } else {
      entries.forEach((entry, index) => {
        const start = -Math.PI / 2 + index * slice
        const end = start + slice
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, radius, start, end)
        ctx.closePath()
        ctx.fillStyle = COLORS[index % COLORS.length]
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,.72)"
        ctx.lineWidth = Math.max(1, size / 480)
        ctx.stroke()

        if (slice > 0.045) {
          const mid = start + slice / 2
          const labelRadius = radius * 0.64
          const maxChars = count > 40 ? 10 : count > 24 ? 14 : 20
          const label = entry.length > maxChars ? `${entry.slice(0, maxChars - 1)}…` : entry
          ctx.save()
          ctx.translate(Math.cos(mid) * labelRadius, Math.sin(mid) * labelRadius)
          ctx.rotate(mid + Math.PI / 2)
          ctx.fillStyle = "#fff"
          ctx.font = `700 ${Math.max(10, Math.min(19, size / (count > 20 ? 30 : 23)))}px Geist, Arial, sans-serif`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.shadowColor = "rgba(0,0,0,.28)"
          ctx.shadowBlur = 2
          ctx.fillText(label, 0, 0)
          ctx.restore()
        }
      })
    }

    ctx.restore()

    // Center cap.
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(42, radius * 0.13), 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.strokeStyle = "rgba(0,0,0,.16)"
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = "#111827"
    ctx.font = `800 ${Math.max(13, Math.min(22, size / 22))}px Geist, Arial, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(centerText, cx, cy)

    // Top pointer.
    ctx.beginPath()
    ctx.moveTo(cx - 18, 4)
    ctx.lineTo(cx + 18, 4)
    ctx.lineTo(cx, 40)
    ctx.closePath()
    ctx.fillStyle = "#111827"
    ctx.fill()
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 2
    ctx.stroke()
  }, [centerText, entries])

  useEffect(() => {
    drawWheel(rotationRef.current)
    const onResize = () => drawWheel(rotationRef.current)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [drawWheel])

  const spin = useCallback(() => {
    if (spinning || entries.length === 0) {
      if (!entries.length) toast.error("Add at least one entry before spinning.")
      return
    }

    const selectedIndex = secureRandom(entries.length)
    const count = entries.length
    const slice = (Math.PI * 2) / count
    const current = rotationRef.current
    const currentNormalized = ((current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const targetLocal = (Math.PI * 2) - (selectedIndex + 0.5) * slice
    let delta = targetLocal - currentNormalized
    if (delta < 0) delta += Math.PI * 2
    delta += (6 + secureRandom(4)) * Math.PI * 2

    spinStartedAtRef.current = performance.now()
    spinFromRef.current = current
    spinToRef.current = current + delta
    spinDurationRef.current = spinTime * 1000
    setSpinning(true)
    setWinner(null)
    setCenterText("…")

    const tick = (now: number) => {
      const elapsed = now - spinStartedAtRef.current
      const progress = Math.min(1, elapsed / spinDurationRef.current)
      const eased = 1 - Math.pow(1 - progress, 4)
      const next = spinFromRef.current + (spinToRef.current - spinFromRef.current) * eased
      rotationRef.current = next
      drawWheel(next)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setSpinning(false)
        setCenterText("SPIN")
        setWinner(entries[selectedIndex])
        if (removeWinner) {
          const nextEntries = entries.filter((_, index) => index !== selectedIndex)
          setEntries(nextEntries)
          setDraft(nextEntries.join("\n"))
        }
        if (!muted) {
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=")
            void audio.play()
          } catch {
            // Browsers may block autoplay.
          }
        }
      }
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [drawWheel, entries, muted, removeWinner, spinTime, spinning])

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault()
        spin()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [spin])

  const shuffle = () => {
    const copy = [...entries]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = secureRandom(i + 1)
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    setEntries(copy)
    setDraft(copy.join("\n"))
  }

  const sortEntries = () => {
    const sorted = [...entries].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    setEntries(sorted)
    setDraft(sorted.join("\n"))
  }

  const addEntry = () => {
    const next = [...entries, `Entry ${entries.length + 1}`]
    setEntries(next)
    setDraft(next.join("\n"))
  }

  const clearEntries = () => {
    setEntries([])
    setDraft("")
    setWinner(null)
  }

  const reset = () => {
    setEntries(DEFAULT_ENTRIES)
    setDraft(DEFAULT_ENTRIES.join("\n"))
    setSpinTime(5)
    setRemoveWinner(false)
    setWinner(null)
    rotationRef.current = 0
  }

  const copyWheel = async () => {
    const url = `${window.location.origin}/spin-wheel?entries=${encodeURIComponent(entries.join(","))}`
    await navigator.clipboard.writeText(url)
    toast.success("Wheel link copied")
  }

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  const entryCountLabel = useMemo(() => `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`, [entries.length])

  return (
    <div className="spin-page">
      <Navbar />

      <main className="spin-main">
        <div className="spin-toolbar">
          <div className="spin-brand">
            <div className="spin-brand-mark">MPD</div>
            <div>
              <h1>Spin the Wheel</h1>
              <p>Randomly select a name, officer, assignment or anything else.</p>
            </div>
          </div>

          <div className="spin-toolbar-actions">
            <button className="spin-tool-button" onClick={copyWheel} title="Copy wheel link"><Copy size={17} /> Share</button>
            <button className="spin-tool-button" onClick={shuffle} title="Shuffle entries"><Shuffle size={17} /> Shuffle</button>
            <button className="spin-tool-button" onClick={() => setShowSettings((value) => !value)}><Settings2 size={17} /> Customize</button>
            <button className="spin-tool-icon" onClick={toggleFullscreen} title="Fullscreen"><Maximize2 size={17} /></button>
          </div>
        </div>

        <section className={`wheel-workspace ${showSettings ? "with-settings" : ""}`}>
          <div className="wheel-stage">
            <div className="wheel-shell">
              <canvas ref={canvasRef} className="wheel-canvas" onClick={spin} aria-label="Spin wheel" />
            </div>
            <button className="wheel-spin-button" onClick={spin} disabled={spinning || entries.length === 0}>
              <Dices size={20} />
              {spinning ? "Spinning…" : "Spin"}
            </button>
            <div className="wheel-hint">Click the wheel or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd></div>
          </div>

          <aside className="entries-panel">
            <div className="entries-panel-header">
              <div>
                <h2>Entries</h2>
                <span>{entryCountLabel}</span>
              </div>
              <div className="entries-header-actions">
                <button onClick={addEntry} title="Add entry"><Plus size={17} /></button>
                <button onClick={clearEntries} title="Clear all"><Trash2 size={17} /></button>
              </div>
            </div>

            <textarea
              value={draft}
              onChange={(event) => syncDraft(event.target.value)}
              placeholder="Enter one name per line…"
              spellCheck={false}
              aria-label="Wheel entries"
            />

            <div className="entries-actions">
              <button onClick={shuffle}><Shuffle size={15} /> Shuffle</button>
              <button onClick={sortEntries}><SlidersHorizontal size={15} /> Sort</button>
              <button onClick={() => setDraft(entries.join("\n"))}><Check size={15} /> Apply</button>
            </div>

            <div className="entries-footer">
              <span>One entry per line</span>
              <button onClick={() => setShowSettings((value) => !value)}><Settings2 size={15} /> Customize</button>
            </div>
          </aside>
        </section>

        {showSettings && (
          <section className="customize-panel">
            <div className="customize-title">
              <div>
                <h2>Customize</h2>
                <p>Adjust how your wheel behaves when you spin it.</p>
              </div>
              <button onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>

            <div className="customize-grid">
              <div className="setting-card">
                <div className="setting-heading">
                  <div><strong>Spin time</strong><span>How long the wheel spins.</span></div>
                  <strong>{spinTime}s</strong>
                </div>
                <input type="range" min="1" max="30" value={spinTime} onChange={(event) => setSpinTime(Number(event.target.value))} />
                <div className="range-labels"><span>1s</span><span>30s</span></div>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div><strong>After spin</strong><span>Control what happens to the winner.</span></div>
                </div>
                <label className="setting-toggle">
                  <input type="checkbox" checked={removeWinner} onChange={(event) => setRemoveWinner(event.target.checked)} />
                  <span className="toggle-ui" />
                  <span>Remove winner after each spin</span>
                </label>
                <label className="setting-toggle">
                  <input type="checkbox" checked={showWinner} onChange={(event) => setShowWinner(event.target.checked)} />
                  <span className="toggle-ui" />
                  <span>Show winner dialog</span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div><strong>Sound</strong><span>Play a result sound after spinning.</span></div>
                </div>
                <label className="setting-toggle">
                  <input type="checkbox" checked={!muted} onChange={(event) => setMuted(!event.target.checked)} />
                  <span className="toggle-ui" />
                  <span>Enable sounds</span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div><strong>Center text</strong><span>Text displayed in the center of the wheel.</span></div>
                </div>
                <input className="setting-input" value={centerText} maxLength={8} onChange={(event) => setCenterText(event.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="customize-bottom">
              <button onClick={reset}><RotateCcw size={16} /> Reset wheel</button>
              <button onClick={() => setShowSettings(false)}>Done</button>
            </div>
          </section>
        )}

        {winner && showWinner && !spinning && (
          <div className="winner-overlay" role="dialog" aria-modal="true" onClick={() => setWinner(null)}>
            <div className="winner-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="winner-kicker">WINNER</div>
              <h2>{winner}</h2>
              <p>The wheel has selected a winner.</p>
              <div className="winner-actions">
                <button onClick={() => setWinner(null)}>Close</button>
                <button className="winner-primary" onClick={() => { setWinner(null); spin() }}>Spin again</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
      {isFullscreen && <button className="fullscreen-exit" onClick={toggleFullscreen}>Exit fullscreen</button>}
    </div>
  )
}
