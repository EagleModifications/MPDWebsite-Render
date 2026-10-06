import React, { useEffect, useMemo, useRef, useState } from "react"
import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

type WheelEntry = {
  id: number
  name: string
}

const DEFAULT_ENTRIES = [
  "Ali",
  "Beatriz",
  "Charles",
  "Diya",
  "Eric",
  "Fatima",
  "Gabriel",
  "Hanna",
]

const COLORS = [
  "#4a45b0",
  "#e85d75",
  "#f2b84b",
  "#4c9f70",
  "#4d8fd6",
  "#9a62c7",
  "#e47a45",
  "#3aa6a0",
]

function secureRandom(max: number) {
  if (max <= 0) return 0

  const cryptoObject = globalThis.crypto

  if (cryptoObject?.getRandomValues) {
    const values = new Uint32Array(1)
    cryptoObject.getRandomValues(values)
    return values[0] / 0xffffffff * max
  }

  return Math.random() * max
}

function randomIndex(length: number) {
  return Math.min(length - 1, Math.floor(secureRandom(length)))
}

function getNamesFromText(text: string) {
  return text
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
}

export default function WheelOfNames(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wheelFrameRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<number | null>(null)

  const [entries, setEntries] = useState<WheelEntry[]>(
    DEFAULT_ENTRIES.map((name, id) => ({ id, name })),
  )
  const [results, setResults] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"entries" | "results">("entries")
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [winner, setWinner] = useState<string | null>(null)
  const [showWinner, setShowWinner] = useState(false)

  const names = useMemo(() => entries.map((entry) => entry.name), [entries])

  const drawWheel = (angle = rotation) => {
    const canvas = canvasRef.current
    const frame = wheelFrameRef.current
    if (!canvas || !frame) return

    const size = Math.max(
      280,
      Math.min(frame.clientWidth, window.innerHeight * 0.68),
    )

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const center = size / 2
    const radius = size / 2 - 5

    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(angle)

    if (names.length === 0) {
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = "#777"
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = "rgba(255,255,255,.75)"
      ctx.stroke()
      ctx.restore()
      return
    }

    const slice = (Math.PI * 2) / names.length

    for (let i = 0; i < names.length; i += 1) {
      const start = -Math.PI / 2 + i * slice
      const end = start + slice

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius, start, end)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = "rgba(255,255,255,.8)"
      ctx.stroke()

      ctx.save()
      ctx.rotate(start + slice / 2)
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"

      const fontSize = Math.max(
        12,
        Math.min(22, size / Math.max(14, names.length * 1.65)),
      )

      ctx.font = `800 ${fontSize}px Quicksand, Arial, sans-serif`
      ctx.fillStyle = "#fff"
      ctx.shadowColor = "rgba(0,0,0,.35)"
      ctx.shadowBlur = 3

      let label = names[i]
      const maxWidth = radius * 0.62

      if (ctx.measureText(label).width > maxWidth) {
        while (
          label.length > 3 &&
          ctx.measureText(`${label}…`).width > maxWidth
        ) {
          label = label.slice(0, -1)
        }
        label += "…"
      }

      ctx.fillText(label, radius - 18, 0)
      ctx.restore()
    }

    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.lineWidth = 5
    ctx.strokeStyle = "rgba(255,255,255,.9)"
    ctx.stroke()

    ctx.restore()

    // Centre button.
    ctx.beginPath()
    ctx.arc(center, center, Math.max(30, radius * 0.115), 0, Math.PI * 2)
    ctx.fillStyle = "#29265f"
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = "rgba(255,255,255,.9)"
    ctx.stroke()

    ctx.fillStyle = "#fff"
    ctx.font = `800 ${Math.max(11, size * 0.028)}px Quicksand, Arial, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("SPIN", center, center)

    // Original-style pointer.
    ctx.beginPath()
    ctx.moveTo(center - 18, 3)
    ctx.lineTo(center + 18, 3)
    ctx.lineTo(center, 31)
    ctx.closePath()
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = "#29265f"
    ctx.stroke()
  }

  useEffect(() => {
    const handleResize = () => drawWheel()

    drawWheel()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [names.length, rotation])

  useEffect(() => {
    drawWheel(rotation)
  }, [names, rotation])

  function updateEntriesFromText(text: string) {
    const nextNames = getNamesFromText(text)

    setEntries(
      nextNames.map((name, index) => ({
        id: Date.now() + index,
        name,
      })),
    )

    setWinner(null)
    setShowWinner(false)
  }

  function handleEditorInput(event: React.FormEvent<HTMLDivElement>) {
    const text = event.currentTarget.innerText
    updateEntriesFromText(text)
  }

  function spin() {
    if (spinning || entries.length === 0) return

    const selectedIndex = randomIndex(entries.length)
    const slice = (Math.PI * 2) / entries.length

    // The pointer is at the top. Rotate the chosen segment's centre to the top.
    const current = rotation
    const currentNormalized = ((current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const segmentCentre = selectedIndex * slice + slice / 2
    const targetBase = -segmentCentre

    let delta = targetBase - currentNormalized
    while (delta < 0) delta += Math.PI * 2

    const extraTurns = 6 + Math.floor(secureRandom(3))
    const target = current + delta + extraTurns * Math.PI * 2
    const start = current
    const duration = 4800
    const startedAt = performance.now()

    setSpinning(true)
    setWinner(null)
    setShowWinner(false)

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 4)
      const next = start + (target - start) * eased

      setRotation(next)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      animationRef.current = null
      const selected = entries[selectedIndex]?.name

      if (selected) {
        setWinner(selected)
        setResults((currentResults) => [selected, ...currentResults])
        setActiveTab("results")
        setShowWinner(true)
      }

      setSpinning(false)
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  function removeWinner() {
    if (!winner) return

    setEntries((current) => current.filter((entry) => entry.name !== winner))
    setWinner(null)
    setShowWinner(false)
    setActiveTab("entries")
  }

  function clearEntries() {
    setEntries([])
    setWinner(null)
    setShowWinner(false)
  }

  function restoreDefaults() {
    setEntries(DEFAULT_ENTRIES.map((name, id) => ({ name, id })))
    setWinner(null)
    setShowWinner(false)
  }

  function handleWheelClick() {
    if (!spinning) spin()
  }

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        event.key === "Enter" &&
        document.activeElement?.getAttribute("contenteditable") !== "true"
      ) {
        event.preventDefault()
        spin()
      }
    }

    window.addEventListener("keydown", handleKeyboard)
    return () => window.removeEventListener("keydown", handleKeyboard)
  }, [spinning, entries])

  return (
    <div className="wheel-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css?family=Quicksand');

        .wheel-page {
          min-height: 100vh;
          background: #121212;
          color: #fff;
          font-family: Quicksand, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        .wheel-main {
          min-height: calc(100vh - 70px);
          padding-top: 70px;
        }

        .wheel-layout {
          width: 100%;
          min-height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
        }

        .wheel-left,
        .wheel-center,
        .wheel-right {
          width: 100%;
          box-sizing: border-box;
        }

        .wheel-left {
          padding: 16px 16px 0;
        }

        .wheel-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 10px 16px 20px;
        }

        .wheel-right {
          padding: 0 16px 16px;
        }

        .wheel-shell {
          width: min(100%, calc(100vh - 210px));
          margin: auto;
          position: relative;
        }

        .wheel-canvas-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          cursor: pointer;
          user-select: none;
        }

        .wheel-canvas {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          filter: drop-shadow(0 0 10px rgba(0,0,0,.85));
        }

        .spin-hint {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          text-align: center;
          font-size: 15px;
          font-weight: 800;
          text-shadow: 0 2px 4px rgba(0,0,0,.8);
        }

        .spin-hint span {
          transform: translateY(-34%);
          opacity: .95;
        }

        .wheel-panel {
          background: #1d1d1d;
          border-radius: 4px;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 10px rgba(0,0,0,.35);
          overflow: hidden;
        }

        .tabs {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }

        .tab {
          flex: 1;
          min-height: 44px;
          border: 0;
          background: transparent;
          color: rgba(255,255,255,.7);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          background: rgba(255,255,255,.05);
          color: #fff;
        }

        .tab.active {
          color: #fff;
          border-bottom-color: #4a45b0;
        }

        .panel-content {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: 12px;
          gap: 10px;
        }

        .basic-editor {
          border: 1px solid #777;
          border-radius: 4px;
          flex: 1;
          min-height: 260px;
          padding: 10px;
          font-family: BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          overflow: auto;
          outline: none;
          line-height: 1.5;
          background: rgba(0,0,0,.08);
          color: #fff;
        }

        .basic-editor:focus {
          border-color: #aaa;
          box-shadow: 0 0 0 1px rgba(255,255,255,.08);
        }

        .entry-line {
          min-height: 24px;
        }

        .panel-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .original-btn {
          appearance: none;
          border: 0;
          border-radius: 3px;
          background: #ebecf8;
          color: #29265f;
          padding: 8px 12px;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .original-btn:hover {
          filter: brightness(.94);
        }

        .original-btn.secondary {
          background: #4a45b0;
          color: #fff;
        }

        .original-btn.danger {
          background: #be525e;
          color: #fff;
        }

        .original-btn:disabled {
          opacity: .45;
          cursor: default;
        }

        .results-box {
          flex: 1;
          min-height: 260px;
          border: 1px solid #777;
          border-radius: 4px;
          padding: 10px;
          overflow: auto;
          font-family: BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }

        .result-item {
          padding: 9px 4px;
          border-bottom: 1px solid rgba(255,255,255,.1);
        }

        .result-item:last-child {
          border-bottom: 0;
        }

        .result-number {
          opacity: .5;
          margin-right: 8px;
        }

        .empty-results {
          opacity: .55;
          text-align: center;
          padding: 40px 10px;
        }

        .wheel-status {
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-weight: 800;
        }

        .winner-dialog {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0,0,0,.72);
          backdrop-filter: blur(5px);
        }

        .winner-card {
          width: min(500px, 100%);
          background: #202020;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 10px;
          padding: 30px;
          text-align: center;
          box-shadow: 0 15px 60px rgba(0,0,0,.55);
        }

        .winner-card small {
          display: block;
          color: #aaa;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 12px;
        }

        .winner-name {
          font-size: clamp(32px, 8vw, 58px);
          line-height: 1.05;
          font-weight: 800;
          color: #fff;
          overflow-wrap: anywhere;
          margin-bottom: 24px;
        }

        .version-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #aaa;
          font-size: 12px;
          padding: 8px 12px;
          border-top: 1px solid rgba(255,255,255,.1);
        }

        .page-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .page-heading h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
        }

        .page-heading span {
          color: #aaa;
          font-size: 13px;
        }

        @media (min-width: 900px) and (min-height: 450px) and (orientation: landscape) {
          .wheel-layout {
            flex-direction: row;
            height: calc(100vh - 120px);
            min-height: 0;
          }

          .wheel-left {
            flex: 1;
            padding: 16px 0 16px 16px;
          }

          .wheel-center {
            flex: 2;
            min-width: 0;
            padding: 16px;
          }

          .wheel-right {
            flex: 1;
            max-width: 25%;
            height: 100%;
            padding: 16px 16px 16px 0;
          }

          .wheel-panel {
            height: 100%;
          }

          .wheel-shell {
            width: min(100%, calc(100vh - 170px));
          }

          .page-heading {
            margin-bottom: 0;
          }
        }

        @media (max-width: 899px) {
          .wheel-main {
            padding-top: 78px;
          }

          .wheel-center {
            order: 1;
          }

          .wheel-right {
            order: 2;
          }

          .wheel-left {
            display: none;
          }

          .wheel-shell {
            width: min(92vw, 620px);
          }

          .wheel-right {
            height: 480px;
          }
        }
      `}</style>

      <Navbar />

      <main className="wheel-main">
        <div className="wheel-layout">
          <aside className="wheel-left">
            <div className="page-heading">
              <h1>Wheel of Names</h1>
              <span>Version 432</span>
            </div>
          </aside>

          <section className="wheel-center">
            <div
              ref={wheelFrameRef}
              className="wheel-shell"
              aria-label="Wheel of Names"
            >
              <div
                className="wheel-canvas-wrap"
                onClick={handleWheelClick}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    handleWheelClick()
                  }
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="wheel-canvas"
                  aria-label="wheel"
                />
                <div className="spin-hint">
                  <span>
                    {spinning ? "Spinning..." : "Click to spin"}
                    <br />
                    {!spinning && (
                      <small style={{ opacity: 0.8 }}>
                        or press ctrl+enter
                      </small>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="wheel-status">
              {entries.length === 0
                ? "Add at least one entry to spin."
                : spinning
                  ? "The wheel is spinning..."
                  : winner
                    ? `Winner: ${winner}`
                    : `${entries.length} entries`}
            </div>
          </section>

          <aside className="wheel-right">
            <div className="wheel-panel">
              <div className="tabs" role="tablist">
                <button
                  type="button"
                  className={`tab ${activeTab === "entries" ? "active" : ""}`}
                  onClick={() => setActiveTab("entries")}
                  role="tab"
                  aria-selected={activeTab === "entries"}
                >
                  Entries
                  <span style={{ marginLeft: 6, opacity: 0.55 }}>
                    {entries.length}
                  </span>
                </button>

                <button
                  type="button"
                  className={`tab ${activeTab === "results" ? "active" : ""}`}
                  onClick={() => setActiveTab("results")}
                  role="tab"
                  aria-selected={activeTab === "results"}
                >
                  Results
                  <span style={{ marginLeft: 6, opacity: 0.55 }}>
                    {results.length}
                  </span>
                </button>
              </div>

              <div className="panel-content">
                {activeTab === "entries" ? (
                  <>
                    <div
                      className="basic-editor"
                      contentEditable={!spinning}
                      suppressContentEditableWarning
                      spellCheck={false}
                      role="textbox"
                      aria-label="Wheel entries"
                      onInput={handleEditorInput}
                    >
                      {entries.map((entry) => (
                        <div className="entry-line" key={entry.id}>
                          {entry.name}
                        </div>
                      ))}
                    </div>

                    <div className="panel-actions">
                      <button
                        type="button"
                        className="original-btn secondary"
                        onClick={spin}
                        disabled={spinning || entries.length === 0}
                      >
                        {spinning ? "Spinning..." : "Spin"}
                      </button>

                      <button
                        type="button"
                        className="original-btn danger"
                        onClick={clearEntries}
                        disabled={spinning || entries.length === 0}
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        className="original-btn"
                        onClick={restoreDefaults}
                        disabled={spinning}
                      >
                        Restore
                      </button>
                    </div>

                    {winner && (
                      <div className="panel-actions">
                        <button
                          type="button"
                          className="original-btn"
                          onClick={removeWinner}
                          disabled={spinning}
                        >
                          Remove winner
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="results-box">
                      {results.length === 0 ? (
                        <div className="empty-results">
                          No results yet.
                          <br />
                          Spin the wheel to pick a winner.
                        </div>
                      ) : (
                        results.map((result, index) => (
                          <div className="result-item" key={`${result}-${index}`}>
                            <span className="result-number">
                              {results.length - index}.
                            </span>
                            {result}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="panel-actions">
                      <button
                        type="button"
                        className="original-btn"
                        onClick={() => setResults([])}
                        disabled={results.length === 0}
                      >
                        Clear results
                      </button>

                      <button
                        type="button"
                        className="original-btn secondary"
                        onClick={spin}
                        disabled={spinning || entries.length === 0}
                      >
                        Spin again
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="version-row">
                <span>Wheel of Names</span>
                <span>Version 432</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />

      {showWinner && winner && (
        <div
          className="winner-dialog"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setShowWinner(false)
            }
          }}
        >
          <div className="winner-card">
            <small>Winner</small>
            <div className="winner-name">{winner}</div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="original-btn secondary"
                onClick={() => setShowWinner(false)}
              >
                Close
              </button>

              <button
                type="button"
                className="original-btn danger"
                onClick={removeWinner}
              >
                Remove winner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
