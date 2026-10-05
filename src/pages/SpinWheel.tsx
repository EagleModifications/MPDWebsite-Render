import { useEffect, useMemo, useState } from "react"
import {
  Check,
  Copy,
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

import { SpinWheel as ReactSpinWheel } from "react-spin-wheel"
import "react-spin-wheel/dist/index.css"

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
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#14b8a6",
  "#0ea5e9",
]

function normalizeEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function readSharedEntries() {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get("entries")

  if (!encoded) return null

  const entries = normalizeEntries(encoded.replace(/,/g, "\n"))
  return entries.length ? entries : null
}

export default function SpinWheel() {
  const [entries, setEntries] = useState<string[]>(DEFAULT_ENTRIES)
  const [draft, setDraft] = useState(DEFAULT_ENTRIES.join("\n"))
  const [winner, setWinner] = useState<string | null>(null)
  const [showWinner, setShowWinner] = useState(true)
  const [removeWinner, setRemoveWinner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [spinTime, setSpinTime] = useState(5)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [centerText, setCenterText] = useState("SPIN")

  useEffect(() => {
    const sharedEntries = readSharedEntries()

    if (sharedEntries) {
      setEntries(sharedEntries)
      setDraft(sharedEntries.join("\n"))
      return
    }

    try {
      const saved = localStorage.getItem("mpd-spin-wheel")

      if (!saved) return

      const parsed = JSON.parse(saved) as {
        entries?: unknown
        spinTime?: unknown
        removeWinner?: unknown
        showWinner?: unknown
      }

      if (
        Array.isArray(parsed.entries) &&
        parsed.entries.every((entry): entry is string => typeof entry === "string") &&
        parsed.entries.length > 0
      ) {
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
    } catch {
      // Ignore invalid local storage.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      "mpd-spin-wheel",
      JSON.stringify({
        entries,
        spinTime,
        removeWinner,
        showWinner,
      }),
    )
  }, [entries, removeWinner, showWinner, spinTime])

  const wheelItems = useMemo(
    () => (entries.length ? entries : ["Add an entry"]),
    [entries],
  )

  const entryCountLabel = `${entries.length} ${
    entries.length === 1 ? "entry" : "entries"
  }`

  const applyDraft = (value: string) => {
    setDraft(value)
    setEntries(normalizeEntries(value))
    setWinner(null)
  }

  const shuffle = () => {
    const copy = [...entries]

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const random = new Uint32Array(1)
      crypto.getRandomValues(random)
      const target = random[0] % (index + 1)
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
    }

    setEntries(copy)
    setDraft(copy.join("\n"))
    setWinner(null)
  }

  const sortEntries = () => {
    const sorted = [...entries].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )

    setEntries(sorted)
    setDraft(sorted.join("\n"))
    setWinner(null)
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
    setShowWinner(true)
    setCenterText("SPIN")
    setWinner(null)
  }

  const copyWheel = async () => {
    const query = encodeURIComponent(entries.join(","))
    const url = `${window.location.origin}/spin-wheel?entries=${query}`

    try {
      await navigator.clipboard.writeText(url)
      toast.success("Wheel link copied")
    } catch {
      toast.error("Unable to copy the wheel link")
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      toast.error("Fullscreen is not available")
    }
  }

  const handleWinner = (value: unknown) => {
    const result = String(value ?? "").trim()

    if (!result || result === "Add an entry") return

    setWinner(result)

    if (removeWinner) {
      const next = entries.filter((entry) => entry !== result)

      setEntries(next)
      setDraft(next.join("\n"))
    }
  }

  return (
    <div className="spin-page">
      <Navbar />

      <main className="spin-main">
        <header className="spin-toolbar">
          <div className="spin-brand">
            <div className="spin-brand-mark">MPD</div>

            <div>
              <h1>Spin the Wheel</h1>
              <p>
                Randomly select a name, officer, assignment or anything else.
              </p>
            </div>
          </div>

          <div className="spin-toolbar-actions">
            <button
              className="spin-tool-button"
              type="button"
              onClick={() => void copyWheel()}
            >
              <Copy size={16} />
              <span>Share</span>
            </button>

            <button
              className="spin-tool-button"
              type="button"
              onClick={shuffle}
              disabled={!entries.length}
            >
              <Shuffle size={16} />
              <span>Shuffle</span>
            </button>

            <button
              className="spin-tool-button"
              type="button"
              onClick={() => setShowSettings((value) => !value)}
            >
              <Settings2 size={16} />
              <span>Customize</span>
            </button>

            <button
              className="spin-tool-icon"
              type="button"
              onClick={() => void toggleFullscreen()}
              title="Fullscreen"
              aria-label="Fullscreen"
            >
              <Maximize2 size={17} />
            </button>
          </div>
        </header>

        <section
          className={`wheel-workspace ${
            showSettings ? "with-settings" : ""
          }`}
        >
          <div className="wheel-stage">
            <div className="wheel-stage-glow" />

            <div className="wheel-library">
              <ReactSpinWheel
                key={wheelItems.join("\u0001")}
                items={wheelItems}
                itemColors={WHEEL_COLORS}
                borderColor="#d1d5db"
                size={Math.min(
                  680,
                  Math.max(
                    360,
                    typeof window !== "undefined"
                      ? Math.min(window.innerWidth - 470, 680)
                      : 680,
                  ),
                )}
                spinTime={spinTime * 1000}
                spinActionName="Spin"
                resetActionName="Reset"
                onFinishSpin={handleWinner}
                spinContainerStyle={{
                  background: "transparent",
                  boxShadow: "none",
                  padding: 0,
                }}
                spinWheelStyle={{
                  borderRadius: "50%",
                  boxShadow:
                    "0 24px 70px rgba(0,0,0,.18), 0 0 0 8px rgba(255,255,255,.9)",
                }}
                spinButtonStyle={{
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "1px solid #1d4ed8",
                  borderRadius: "999px",
                  fontWeight: 800,
                  boxShadow: "0 12px 30px rgba(37,99,235,.28)",
                }}
                spinFontStyle={{
                  fontFamily: "Geist, Inter, Arial, sans-serif",
                  fontWeight: 800,
                }}
                spinItemStyle={{
                  fontFamily: "Geist, Inter, Arial, sans-serif",
                  fontWeight: 700,
                }}
              />
            </div>

            <div className="wheel-center-label">
              <span>{centerText}</span>
            </div>

            <div className="wheel-pointer" aria-hidden="true">
              <span />
            </div>

            <p className="wheel-hint">
              Spin using the button on the wheel
            </p>
          </div>

          <aside className="entries-panel">
            <div className="entries-panel-header">
              <div>
                <h2>Entries</h2>
                <span>{entryCountLabel}</span>
              </div>

              <div className="entries-header-actions">
                <button
                  type="button"
                  onClick={addEntry}
                  title="Add entry"
                  aria-label="Add entry"
                >
                  <Plus size={17} />
                </button>

                <button
                  type="button"
                  onClick={clearEntries}
                  title="Clear all"
                  aria-label="Clear all"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            <textarea
              value={draft}
              onChange={(event) => applyDraft(event.target.value)}
              placeholder="Enter one name per line…"
              spellCheck={false}
              aria-label="Wheel entries"
            />

            <div className="entries-actions">
              <button
                type="button"
                onClick={shuffle}
                disabled={!entries.length}
              >
                <Shuffle size={15} />
                Shuffle
              </button>

              <button
                type="button"
                onClick={sortEntries}
                disabled={!entries.length}
              >
                <SlidersHorizontal size={15} />
                Sort
              </button>

              <button
                type="button"
                onClick={() => applyDraft(draft)}
              >
                <Check size={15} />
                Apply
              </button>
            </div>

            <div className="entries-footer">
              <span>One entry per line</span>

              <button
                type="button"
                onClick={() => setShowSettings((value) => !value)}
              >
                <Settings2 size={15} />
                Customize
              </button>
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

              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Close customize"
              >
                <X size={18} />
              </button>
            </div>

            <div className="customize-grid">
              <div className="setting-card">
                <div className="setting-heading">
                  <div>
                    <strong>Spin time</strong>
                    <span>How long the wheel spins.</span>
                  </div>

                  <strong>{spinTime}s</strong>
                </div>

                <input
                  type="range"
                  min="1"
                  max="30"
                  value={spinTime}
                  onChange={(event) =>
                    setSpinTime(Number(event.target.value))
                  }
                />

                <div className="range-labels">
                  <span>1s</span>
                  <span>30s</span>
                </div>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div>
                    <strong>After spin</strong>
                    <span>Control what happens to the winner.</span>
                  </div>
                </div>

                <label className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={removeWinner}
                    onChange={(event) =>
                      setRemoveWinner(event.target.checked)
                    }
                  />
                  <span className="toggle-ui" />
                  <span>Remove winner after each spin</span>
                </label>

                <label className="setting-toggle">
                  <input
                    type="checkbox"
                    checked={showWinner}
                    onChange={(event) =>
                      setShowWinner(event.target.checked)
                    }
                  />
                  <span className="toggle-ui" />
                  <span>Show winner dialog</span>
                </label>
              </div>

              <div className="setting-card">
                <div className="setting-heading">
                  <div>
                    <strong>Center text</strong>
                    <span>Text displayed above the wheel center.</span>
                  </div>
                </div>

                <input
                  className="setting-input"
                  value={centerText}
                  maxLength={8}
                  onChange={(event) =>
                    setCenterText(event.target.value.toUpperCase())
                  }
                />
              </div>
            </div>

            <div className="customize-bottom">
              <button type="button" onClick={reset}>
                <RotateCcw size={16} />
                Reset wheel
              </button>

              <button
                type="button"
                className="customize-done"
                onClick={() => setShowSettings(false)}
              >
                Done
              </button>
            </div>
          </section>
        )}

        {winner && showWinner && (
          <div
            className="winner-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setWinner(null)}
          >
            <div
              className="winner-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="winner-kicker">WINNER</div>
              <h2>{winner}</h2>
              <p>The wheel has selected a winner.</p>

              <div className="winner-actions">
                <button type="button" onClick={() => setWinner(null)}>
                  Close
                </button>

                <button
                  type="button"
                  className="winner-primary"
                  onClick={() => setWinner(null)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {isFullscreen && (
        <button
          className="fullscreen-exit"
          type="button"
          onClick={() => void toggleFullscreen()}
        >
          Exit fullscreen
        </button>
      )}
    </div>
  )
}
