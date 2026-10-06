import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react"

type WheelEntry = {
  id: number
  name: string
}

const INITIAL_ENTRIES: WheelEntry[] = [
  { id: 1, name: "Ali" },
  { id: 2, name: "Beatriz" },
  { id: 3, name: "Charles" },
  { id: 4, name: "Diya" },
  { id: 5, name: "Eric" },
  { id: 6, name: "Fatima" },
  { id: 7, name: "Gabriel" },
  { id: 8, name: "Hanna" },
]

const WHEEL_COLORS = [
  "#4285F4",
  "#F44336",
  "#FFC107",
  "#34A853",
  "#8E44AD",
  "#00ACC1",
  "#FF7043",
  "#7CB342",
]

function drawWheel(
  canvas: HTMLCanvasElement,
  entries: WheelEntry[],
  rotation: number,
) {
  const context = canvas.getContext("2d")

  if (!context) {
    return
  }

  const size = 700
  const center = size / 2
  const radius = 318

  canvas.width = size
  canvas.height = size

  context.clearRect(0, 0, size, size)

  context.save()

  context.translate(center, center)
  context.rotate((rotation * Math.PI) / 180)

  if (entries.length === 0) {
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.fillStyle = "#4b5563"
    context.fill()
    context.restore()
    return
  }

  const slice = (Math.PI * 2) / entries.length

  entries.forEach((entry, index) => {
    const start = -Math.PI / 2 + index * slice
    const end = start + slice

    context.beginPath()
    context.moveTo(0, 0)
    context.arc(0, 0, radius, start, end)
    context.closePath()

    context.fillStyle =
      WHEEL_COLORS[index % WHEEL_COLORS.length]

    context.fill()

    context.strokeStyle = "rgba(255,255,255,0.08)"
    context.lineWidth = 1
    context.stroke()

    const textAngle = start + slice / 2
    const textRadius = radius * 0.68

    context.save()

    context.rotate(textAngle)
    context.translate(textRadius, 0)

    context.rotate(Math.PI / 2)

    if (
      textAngle > Math.PI / 2 &&
      textAngle < (Math.PI * 3) / 2
    ) {
      context.rotate(Math.PI)
    }

    context.fillStyle = "#ffffff"
    context.font =
      "700 18px Arial, Helvetica, sans-serif"
    context.textAlign = "center"
    context.textBaseline = "middle"

    context.shadowColor = "rgba(0,0,0,0.45)"
    context.shadowBlur = 3

    context.fillText(entry.name, 0, 0)

    context.restore()
  })

  context.restore()

  /*
   * Outer wheel border.
   */
  context.beginPath()
  context.arc(center, center, radius + 7, 0, Math.PI * 2)
  context.strokeStyle = "#182435"
  context.lineWidth = 12
  context.stroke()

  /*
   * Small centre hub.
   */
  context.beginPath()
  context.arc(center, center, 57, 0, Math.PI * 2)
  context.fillStyle = "#ffffff"
  context.fill()

  context.strokeStyle = "#101827"
  context.lineWidth = 6
  context.stroke()

  /*
   * Centre text.
   */
  context.save()

  context.translate(center, center)

  context.rotate(-Math.PI / 2)

  context.fillStyle = "#111827"
  context.font =
    "800 17px Arial, Helvetica, sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"

  context.fillText("Click to spin", 0, -7)

  context.fillStyle = "#6b7280"
  context.font =
    "500 9px Arial, Helvetica, sans-serif"

  context.fillText(
    "or press Ctrl+Enter",
    0,
    10,
  )

  context.restore()
}

export default function WheelOfNames() {
  const canvasRef = useRef<HTMLCanvasElement | null>(
    null,
  )

  const [entries, setEntries] =
    useState<WheelEntry[]>(INITIAL_ENTRIES)

  const [results, setResults] = useState<string[]>([])

  const [activeTab, setActiveTab] = useState<
    "entries" | "results"
  >("entries")

  const [rotation, setRotation] = useState(0)

  const [spinning, setSpinning] = useState(false)

  const [showCustomize, setShowCustomize] =
    useState(false)

  const [showOpen, setShowOpen] = useState(false)

  const [showSave, setShowSave] = useState(false)

  const [showShare, setShowShare] = useState(false)

  const [newEntry, setNewEntry] = useState("")

  const [showAdvanced, setShowAdvanced] =
    useState(false)

  const [showImageMenu, setShowImageMenu] =
    useState(false)

  const [showMore, setShowMore] = useState(false)

  const [showLanguage, setShowLanguage] =
    useState(false)

  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    drawWheel(
      canvasRef.current,
      entries,
      rotation,
    )
  }, [entries, rotation])

  function getRandomIndex() {
    if (entries.length === 0) {
      return -1
    }

    if (
      typeof crypto !== "undefined" &&
      crypto.getRandomValues
    ) {
      const random = new Uint32Array(1)

      crypto.getRandomValues(random)

      return random[0] % entries.length
    }

    return Math.floor(
      Math.random() * entries.length,
    )
  }

  function spinWheel() {
    if (spinning || entries.length === 0) {
      return
    }

    const winnerIndex = getRandomIndex()

    if (winnerIndex < 0) {
      return
    }

    const segment =
      360 / entries.length

    const winnerCenter =
      winnerIndex * segment +
      segment / 2

    const currentNormalized =
      ((rotation % 360) + 360) % 360

    const desired =
      360 - winnerCenter

    let difference =
      desired - currentNormalized

    if (difference < 0) {
      difference += 360
    }

    const extraTurns = 6 * 360

    const target =
      rotation +
      extraTurns +
      difference

    setSpinning(true)
    setRotation(target)

    window.setTimeout(() => {
      const winner = entries[winnerIndex]

      setResults((current) => [
        ...current,
        winner.name,
      ])

      setActiveTab("results")
      setSpinning(false)
    }, 4300)
  }

  function handleWheelKeyDown(
    event: KeyboardEvent<HTMLCanvasElement>,
  ) {
    if (
      event.key === "Enter" &&
      event.ctrlKey
    ) {
      event.preventDefault()
      spinWheel()
    }
  }

  function shuffleEntries() {
    setEntries((current) => {
      const copy = [...current]

      for (
        let i = copy.length - 1;
        i > 0;
        i -= 1
      ) {
        const randomIndex = Math.floor(
          Math.random() * (i + 1),
        )

        const temporary = copy[i]

        copy[i] = copy[randomIndex]
        copy[randomIndex] = temporary
      }

      return copy
    })
  }

  function sortEntries() {
    setEntries((current) =>
      [...current].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    )
  }

  function addEntry() {
    const value = newEntry.trim()

    if (!value) {
      return
    }

    setEntries((current) => [
      ...current,
      {
        id: Date.now(),
        name: value,
      },
    ])

    setNewEntry("")
  }

  function updateEntry(
    id: number,
    name: string,
  ) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              name,
            }
          : entry,
      ),
    )
  }

  function removeEntry(id: number) {
    setEntries((current) =>
      current.filter(
        (entry) => entry.id !== id,
      ),
    )
  }

  function newWheel() {
    setEntries(
      INITIAL_ENTRIES.map((entry) => ({
        ...entry,
      })),
    )

    setResults([])
    setRotation(0)
    setActiveTab("entries")
  }

  function shareWheel() {
    setShowShare(true)

    if (
      navigator.clipboard &&
      window.location.href
    ) {
      void navigator.clipboard.writeText(
        window.location.href,
      )
    }
  }

  function toggleFullscreen() {
    setFullscreen((current) => !current)
  }

  const rootStyle: CSSProperties = fullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
      }
    : {}

  return (
    <div
      className="wheel-page"
      style={rootStyle}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }

        .wheel-page {
          min-height: 100vh;
          background:
            radial-gradient(
              at 0% 0%,
              rgba(93, 173, 226, 0.30) 0px,
              rgba(0, 0, 0, 0) 50%
            ),
            radial-gradient(
              at 98% 1%,
              rgba(175, 122, 197, 0.30) 0px,
              rgba(0, 0, 0, 0) 50%
            ),
            #101827;
          color: #ffffff;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          overflow-x: hidden;
        }

        .wheel-header {
          height: 50px;
          display: flex;
          align-items: stretch;
          background: #172131;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .wheel-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px;
          color: white;
          text-decoration: none;
          white-space: nowrap;
        }

        .wheel-brand-mark {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #26364c;
          font-size: 18px;
        }

        .wheel-brand-title {
          font-size: 17px;
          font-weight: 500;
        }

        .wheel-header-spacer {
          flex: 1;
        }

        .wheel-toolbar {
          display: flex;
          align-items: stretch;
        }

        .wheel-toolbar-button {
          height: 50px;
          min-width: 72px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-left: 1px solid rgba(255,255,255,0.05);
          background: transparent;
          color: #e5e7eb;
          font-size: 13px;
          cursor: pointer;
        }

        .wheel-toolbar-button:hover {
          background: rgba(255,255,255,0.06);
        }

        .wheel-toolbar-icon {
          font-size: 14px;
        }

        .wheel-toolbar-dropdown {
          position: relative;
        }

        .wheel-dropdown {
          position: absolute;
          right: 0;
          top: 50px;
          min-width: 170px;
          padding: 6px;
          border-radius: 0 0 6px 6px;
          background: #1d2938;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          z-index: 300;
        }

        .wheel-dropdown-item {
          width: 100%;
          display: block;
          text-align: left;
          padding: 9px 11px;
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: #d1d5db;
          cursor: pointer;
          font-size: 13px;
        }

        .wheel-dropdown-item:hover {
          background: rgba(255,255,255,0.07);
          color: white;
        }

        .wheel-content {
          width: 100%;
          min-height: calc(100vh - 50px);
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) 365px;
          gap: 10px;
          padding: 10px;
        }

        .wheel-left-column {
          padding-top: 9px;
        }

        .wheel-pencil {
          width: 40px;
          height: 40px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: #1d2a3a;
          color: #dbeafe;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
        }

        .wheel-pencil:hover {
          background: #27374c;
        }

        .wheel-center-column {
          min-width: 0;
          min-height: 820px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: rgba(10, 18, 31, 0.38);
          border: 1px solid rgba(255,255,255,0.035);
          position: relative;
        }

        .wheel-container {
          width: min(700px, 78vw);
          height: min(700px, 78vw);
          max-width: 700px;
          max-height: 700px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wheel-canvas {
          width: 100%;
          height: 100%;
          display: block;
          cursor: pointer;
          outline: none;
        }

        .wheel-pointer {
          position: absolute;
          top: -3px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          width: 0;
          height: 0;
          border-left: 15px solid transparent;
          border-right: 15px solid transparent;
          border-top: 31px solid white;
          filter:
            drop-shadow(0 2px 4px rgba(0,0,0,0.65));
          pointer-events: none;
        }

        .wheel-spin-button {
          margin-top: 5px;
          min-width: 82px;
          height: 42px;
          border: 0;
          border-radius: 8px;
          background: #1769ff;
          color: white;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }

        .wheel-spin-button:hover {
          background: #2c78ff;
        }

        .wheel-spin-button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .wheel-right-column {
          min-height: 820px;
          position: relative;
        }

        .wheel-card {
          height: 100%;
          min-height: 820px;
          display: flex;
          flex-direction: column;
          background: #1c2735;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 9px;
          overflow: hidden;
          color: #ffffff;
        }

        .wheel-tabs {
          height: 45px;
          display: flex;
          flex-shrink: 0;
          background: #1b2634;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .wheel-tab {
          flex: 1;
          border: 0;
          background: transparent;
          color: #9ca3af;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          position: relative;
        }

        .wheel-tab:hover {
          color: white;
        }

        .wheel-tab.active {
          color: white;
        }

        .wheel-tab.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: #2196f3;
        }

        .wheel-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          margin-left: 6px;
          border-radius: 10px;
          background: #4b5563;
          color: #e5e7eb;
          font-size: 10px;
        }

        .wheel-editor {
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .wheel-editor-controls {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 11px 10px;
          flex-wrap: wrap;
        }

        .editor-button {
          height: 29px;
          padding: 0 9px;
          border: 0;
          border-radius: 4px;
          background: #45566b;
          color: white;
          font-size: 12px;
          cursor: pointer;
        }

        .editor-button:hover {
          background: #52677f;
        }

        .editor-button-icon {
          margin-right: 5px;
        }

        .editor-button-right {
          margin-left: auto;
        }

        .wheel-entry-editor {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0 10px 10px;
        }

        .wheel-entry-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 38px;
          border-bottom: 1px solid rgba(255,255,255,0.035);
        }

        .wheel-entry-number {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          border-radius: 50%;
          background: rgba(23,105,255,0.16);
          color: #70a5ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
        }

        .wheel-entry-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: 0;
          outline: none;
          color: #f3f4f6;
          font-size: 13px;
        }

        .wheel-entry-input:focus {
          background: rgba(255,255,255,0.04);
        }

        .wheel-entry-delete {
          opacity: 0;
          border: 0;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          font-size: 17px;
        }

        .wheel-entry-row:hover .wheel-entry-delete {
          opacity: 1;
        }

        .wheel-entry-delete:hover {
          color: #ef4444;
        }

        .wheel-add-area {
          display: flex;
          gap: 7px;
          padding: 9px 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .wheel-add-input {
          min-width: 0;
          flex: 1;
          height: 34px;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 4px;
          outline: none;
          background: #121c29;
          color: white;
          padding: 0 9px;
          font-size: 12px;
        }

        .wheel-add-input:focus {
          border-color: #2196f3;
        }

        .wheel-add-button {
          height: 34px;
          padding: 0 12px;
          border: 0;
          border-radius: 4px;
          background: #45566b;
          color: white;
          cursor: pointer;
          font-size: 12px;
        }

        .wheel-add-button:hover {
          background: #536a83;
        }

        .wheel-add-wheel {
          padding: 0 10px 10px;
        }

        .wheel-add-wheel-button {
          width: 100%;
          height: 38px;
          border: 0;
          border-radius: 4px;
          background: #45566b;
          color: white;
          font-size: 14px;
          cursor: pointer;
        }

        .wheel-add-wheel-button:hover {
          background: #536a83;
        }

        .wheel-results {
          flex: 1;
          overflow-y: auto;
        }

        .wheel-result {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 39px;
          padding: 5px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.035);
        }

        .wheel-result-number {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          background: rgba(23,105,255,0.14);
          color: #70a5ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
        }

        .wheel-result-name {
          font-size: 13px;
          font-weight: 600;
          color: #f3f4f6;
        }

        .wheel-empty-results {
          padding: 30px 20px;
          color: #6b7280;
          text-align: center;
          font-size: 13px;
        }

        .wheel-footer-bar {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 11px;
          color: #6b7280;
        }

        .wheel-footer-bar a {
          color: #7d8ba0;
          text-decoration: none;
        }

        .wheel-footer-bar a:hover {
          color: white;
        }

        .wheel-hide-editor {
          position: absolute;
          left: -17px;
          top: 19px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.08);
          background: #45566b;
          color: white;
          cursor: pointer;
          z-index: 20;
        }

        .wheel-hide-editor:hover {
          background: #536a83;
        }

        .wheel-about {
          padding: 20px 10px 30px;
        }

        .wheel-about-divider {
          height: 1px;
          background: rgba(255,255,255,0.10);
          margin-bottom: 0;
        }

        .wheel-about-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 16px;
        }

        .wheel-about-column {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wheel-about-card {
          background: #1c2735;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 5px;
          color: #d1d5db;
        }

        .wheel-about-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 15px 15px 5px;
        }

        .wheel-about-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #26364c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
        }

        .wheel-about-title {
          font-size: 18px;
          font-weight: 500;
          color: #f3f4f6;
        }

        .wheel-about-body {
          padding: 10px 15px 15px;
          font-size: 13px;
          line-height: 1.55;
        }

        .wheel-about-body p {
          margin: 0 0 10px;
        }

        .wheel-about-body p:last-child {
          margin-bottom: 0;
        }

        .wheel-about-body ul {
          margin: 8px 0 0;
          padding-left: 20px;
        }

        .wheel-about-body li {
          margin: 5px 0;
        }

        .wheel-about-body a {
          color: #42a5f5;
          text-decoration: none;
        }

        .wheel-about-body a:hover {
          text-decoration: underline;
        }

        .wheel-stat {
          margin-bottom: 22px;
        }

        .wheel-stat:last-child {
          margin-bottom: 0;
        }

        .wheel-stat-label {
          font-size: 13px;
        }

        .wheel-stat-number {
          margin-top: 2px;
          font-size: 30px;
          font-weight: 400;
          color: white;
        }

        .wheel-about-footer {
          display: flex;
          justify-content: space-between;
          padding: 0 16px 16px;
          font-size: 12px;
          color: #7d8ba0;
        }

        .wheel-about-footer a {
          color: #7d8ba0;
          text-decoration: none;
        }

        .wheel-about-footer a:hover {
          color: white;
        }

        .wheel-site-footer {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 30px;
          padding: 25px 20px 35px;
          border-top: 1px solid rgba(255,255,255,0.10);
          color: #7d8ba0;
          font-size: 12px;
        }

        .wheel-site-footer-column {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .wheel-site-footer a {
          color: #9ca3af;
          text-decoration: none;
        }

        .wheel-site-footer a:hover {
          color: white;
        }

        .wheel-site-footer-icon {
          margin-right: 7px;
        }

        .wheel-build {
          text-align: right;
          align-self: end;
          white-space: nowrap;
        }

        .wheel-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0,0,0,0.62);
        }

        .wheel-modal {
          width: min(440px, 100%);
          border-radius: 7px;
          background: #1c2735;
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          overflow: hidden;
        }

        .wheel-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .wheel-modal-title {
          font-size: 16px;
          font-weight: 600;
        }

        .wheel-modal-close {
          border: 0;
          background: transparent;
          color: #9ca3af;
          font-size: 20px;
          cursor: pointer;
        }

        .wheel-modal-body {
          padding: 15px;
          color: #9ca3af;
          font-size: 13px;
          line-height: 1.5;
        }

        .wheel-modal-action {
          margin-top: 15px;
          width: 100%;
          height: 36px;
          border: 0;
          border-radius: 4px;
          background: #1976d2;
          color: white;
          cursor: pointer;
        }

        @media (max-width: 1100px) {
          .wheel-content {
            grid-template-columns:
              48px minmax(0, 1fr) 330px;
          }

          .wheel-toolbar-button {
            min-width: 60px;
            padding: 0 8px;
          }

          .wheel-brand-title {
            display: none;
          }

          .wheel-about-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 850px) {
          .wheel-header {
            overflow-x: auto;
          }

          .wheel-toolbar-button {
            min-width: 62px;
          }

          .wheel-content {
            grid-template-columns: 1fr;
            padding: 8px;
          }

          .wheel-left-column {
            display: none;
          }

          .wheel-center-column {
            min-height: 650px;
          }

          .wheel-right-column {
            min-height: 650px;
          }

          .wheel-card {
            min-height: 650px;
          }

          .wheel-hide-editor {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .wheel-brand {
            padding: 0 8px;
          }

          .wheel-brand-title {
            display: none;
          }

          .wheel-toolbar-button {
            min-width: 55px;
            padding: 0 5px;
            font-size: 10px;
          }

          .wheel-toolbar-icon {
            display: none;
          }

          .wheel-center-column {
            min-height: 500px;
          }

          .wheel-container {
            width: min(94vw, 520px);
            height: min(94vw, 520px);
          }

          .wheel-about-grid {
            grid-template-columns: 1fr;
          }

          .wheel-site-footer {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      {/* HEADER */}

      <header className="wheel-header">
        <a
          href="/"
          className="wheel-brand"
        >
          <div className="wheel-brand-mark">
            🎡
          </div>

          <h1 className="wheel-brand-title">
            Wheel of Names
          </h1>
        </a>

        <div className="wheel-header-spacer" />

        <div className="wheel-toolbar">
          <button
            type="button"
            className="wheel-toolbar-button"
            onClick={() =>
              setShowCustomize(
                (current) => !current,
              )
            }
          >
            <span className="wheel-toolbar-icon">
              🎨
            </span>
            Customize
          </button>

          <button
            type="button"
            className="wheel-toolbar-button"
            onClick={newWheel}
          >
            <span className="wheel-toolbar-icon">
              📄
            </span>
            New
          </button>

          <button
            type="button"
            className="wheel-toolbar-button"
            onClick={() => setShowOpen(true)}
          >
            <span className="wheel-toolbar-icon">
              📂
            </span>
            Open
          </button>

          <button
            type="button"
            className="wheel-toolbar-button"
            onClick={() => setShowSave(true)}
          >
            <span className="wheel-toolbar-icon">
              💾
            </span>
            Save
          </button>

          <button
            type="button"
            className="wheel-toolbar-button"
            onClick={shareWheel}
          >
            <span className="wheel-toolbar-icon">
              ↗
            </span>
            Share
          </button>

          <a
            href="/gallery"
            className="wheel-toolbar-button"
          >
            <span className="wheel-toolbar-icon">
              🔍
            </span>
            Gallery
          </a>

          <button
            type="button"
            className="wheel-toolbar-button"
            onClick={toggleFullscreen}
          >
            <span className="wheel-toolbar-icon">
              ⛶
            </span>
            Fullscreen
          </button>

          <div className="wheel-toolbar-dropdown">
            <button
              type="button"
              className="wheel-toolbar-button"
              onClick={() =>
                setShowMore(
                  (current) => !current,
                )
              }
            >
              More ▾
            </button>

            {showMore && (
              <div className="wheel-dropdown">
                <button
                  type="button"
                  className="wheel-dropdown-item"
                >
                  Settings
                </button>

                <button
                  type="button"
                  className="wheel-dropdown-item"
                >
                  Help
                </button>
              </div>
            )}
          </div>

          <div className="wheel-toolbar-dropdown">
            <button
              type="button"
              className="wheel-toolbar-button"
              onClick={() =>
                setShowLanguage(
                  (current) => !current,
                )
              }
            >
              🌐 English
            </button>

            {showLanguage && (
              <div className="wheel-dropdown">
                <button
                  type="button"
                  className="wheel-dropdown-item"
                >
                  English
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}

      <main className="wheel-content">
        {/* LEFT COLUMN */}

        <aside className="wheel-left-column">
          <button
            type="button"
            className="wheel-pencil"
            aria-label="Edit"
          >
            ✎
          </button>
        </aside>

        {/* WHEEL */}

        <section className="wheel-center-column">
          <div className="wheel-container">
            <div className="wheel-pointer" />

            <canvas
              ref={canvasRef}
              className="wheel-canvas"
              width={700}
              height={700}
              aria-label="wheel"
              role="button"
              tabIndex={0}
              onClick={spinWheel}
              onKeyDown={
                handleWheelKeyDown
              }
              style={{
                transition: spinning
                  ? "transform 4.3s cubic-bezier(0.12, 0.8, 0.18, 1)"
                  : undefined,
                transform: spinning
                  ? "scale(1)"
                  : undefined,
              }}
            />
          </div>

          <button
            type="button"
            className="wheel-spin-button"
            onClick={spinWheel}
            disabled={
              spinning ||
              entries.length === 0
            }
          >
            {spinning
              ? "SPINNING..."
              : "SPIN"}
          </button>
        </section>

        {/* RIGHT EDITOR */}

        <aside className="wheel-right-column">
          <div className="wheel-card">
            <div className="wheel-tabs">
              <button
                type="button"
                className={[
                  "wheel-tab",
                  activeTab === "entries"
                    ? "active"
                    : "",
                ].join(" ")}
                onClick={() =>
                  setActiveTab("entries")
                }
              >
                Entries
                <span className="wheel-badge">
                  {entries.length}
                </span>
              </button>

              <button
                type="button"
                className={[
                  "wheel-tab",
                  activeTab === "results"
                    ? "active"
                    : "",
                ].join(" ")}
                onClick={() =>
                  setActiveTab("results")
                }
              >
                Results
                <span className="wheel-badge">
                  {results.length}
                </span>
              </button>
            </div>

            <div className="wheel-editor">
              {activeTab === "entries" ? (
                <>
                  <div className="wheel-editor-controls">
                    <button
                      type="button"
                      className="editor-button"
                      onClick={
                        shuffleEntries
                      }
                    >
                      <span className="editor-button-icon">
                        🔀
                      </span>
                      Shuffle
                    </button>

                    <button
                      type="button"
                      className="editor-button"
                      onClick={sortEntries}
                    >
                      <span className="editor-button-icon">
                        ↕
                      </span>
                      Sort
                    </button>

                    <div className="wheel-toolbar-dropdown">
                      <button
                        type="button"
                        className="editor-button"
                        onClick={() =>
                          setShowImageMenu(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        <span className="editor-button-icon">
                          🖼
                        </span>
                        Add image ▾
                      </button>

                      {showImageMenu && (
                        <div className="wheel-dropdown">
                          <button
                            type="button"
                            className="wheel-dropdown-item"
                          >
                            Upload image
                          </button>

                          <button
                            type="button"
                            className="wheel-dropdown-item"
                          >
                            Image gallery
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={[
                        "editor-button",
                        "editor-button-right",
                      ].join(" ")}
                      onClick={() =>
                        setShowAdvanced(
                          (current) =>
                            !current,
                        )
                      }
                    >
                      Advanced
                    </button>
                  </div>

                  {showAdvanced && (
                    <div
                      style={{
                        padding:
                          "0 10px 10px",
                        color: "#9ca3af",
                        fontSize: "11px",
                      }}
                    >
                      Advanced entry settings
                    </div>
                  )}

                  <div className="wheel-entry-editor">
                    {entries.map(
                      (entry, index) => (
                        <div
                          key={entry.id}
                          className="wheel-entry-row"
                        >
                          <span className="wheel-entry-number">
                            {index + 1}
                          </span>

                          <input
                            className="wheel-entry-input"
                            value={entry.name}
                            onChange={(event) =>
                              updateEntry(
                                entry.id,
                                event.target.value,
                              )
                            }
                            aria-label={`Entry ${index + 1}`}
                          />

                          <button
                            type="button"
                            className="wheel-entry-delete"
                            onClick={() =>
                              removeEntry(
                                entry.id,
                              )
                            }
                            aria-label={`Remove ${entry.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ),
                    )}

                    {entries.length === 0 && (
                      <div
                        style={{
                          padding: 20,
                          textAlign: "center",
                          color: "#6b7280",
                          fontSize: 12,
                        }}
                      >
                        No entries
                      </div>
                    )}
                  </div>

                  <div className="wheel-add-area">
                    <input
                      className="wheel-add-input"
                      value={newEntry}
                      onChange={(event) =>
                        setNewEntry(
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter"
                        ) {
                          addEntry()
                        }
                      }}
                      placeholder="Add entry"
                    />

                    <button
                      type="button"
                      className="wheel-add-button"
                      onClick={addEntry}
                    >
                      Add
                    </button>
                  </div>

                  <div className="wheel-add-wheel">
                    <button
                      type="button"
                      className="wheel-add-wheel-button"
                    >
                      ＋ Add wheel
                    </button>
                  </div>
                </>
              ) : (
                <div className="wheel-results">
                  {results.length === 0 ? (
                    <div className="wheel-empty-results">
                      No results yet.
                    </div>
                  ) : (
                    results.map(
                      (result, index) => (
                        <div
                          key={`${result}-${index}`}
                          className="wheel-result"
                        >
                          <span className="wheel-result-number">
                            {index + 1}
                          </span>

                          <span className="wheel-result-name">
                            {result}
                          </span>
                        </div>
                      ),
                    )
                  )}
                </div>
              )}
            </div>

            <div className="wheel-footer-bar">
              <span>
                Version 432
              </span>

              <a href="/changelog">
                Changelog
              </a>
            </div>
          </div>

          <button
            type="button"
            className="wheel-hide-editor"
            aria-label="Hide editor"
          >
            ‹
          </button>
        </aside>
      </main>

      {/* ABOUT */}

      <section className="wheel-about">
        <div className="wheel-about-divider" />

        <div className="wheel-about-grid">
          <div className="wheel-about-column">
            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  🎡
                </div>

                <span className="wheel-about-title">
                  What is the wheel spinner for?
                </span>
              </div>

              <div className="wheel-about-body">
                Every day we hear from people who use
                our website in new ways:

                <ul>
                  <li>
                    Random name picker in the
                    classroom: pick which student
                    will answer the next question.
                  </li>

                  <li>
                    If you are a retailer, spin the
                    wheel to pick which loyal customer
                    will get the monthly giveaway.
                  </li>

                  <li>
                    When you give a presentation, use
                    the wheel spinner to pick a lucky
                    winner among the attendees who
                    turned in the survey.
                  </li>

                  <li>
                    Random name picker at work: in
                    your daily standup meeting at
                    work, randomize who speaks first.
                  </li>

                  <li>
                    If you are overwhelmed by your to
                    do items, put them on a wheel and
                    spin to find which one to start
                    with.
                  </li>

                  <li>
                    Lucky draw name picker at a party:
                    put all your friends&apos; names on
                    the wheel and spin to pick who
                    will go first in a game.
                  </li>

                  <li>
                    If you can&apos;t agree on what to
                    have for dinner, put the
                    alternatives on the wheel and
                    spin.
                  </li>
                </ul>
              </div>
            </article>

            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  🎯
                </div>

                <span className="wheel-about-title">
                  How to use the wheel spinner
                </span>
              </div>

              <div className="wheel-about-body">
                <p>
                  It&apos;s easy: type in your entries
                  in the textbox to the right of the
                  wheel, then click the wheel to spin
                  it and get a random winner.
                </p>

                <p>
                  To make the wheel your own by
                  customizing the colors, sounds, and
                  spin time, click Customize at the top
                  of the page.
                </p>

                <p>
                  <a href="/user-reviews-and-tutorials">
                    Video reviews and tutorials by users
                  </a>
                </p>
              </div>
            </article>

            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  📊
                </div>

                <span className="wheel-about-title">
                  Activity in 2026
                </span>
              </div>

              <div className="wheel-about-body">
                <div className="wheel-stat">
                  <div className="wheel-stat-label">
                    Wheel spins
                  </div>

                  <div className="wheel-stat-number">
                    {results.length}
                  </div>
                </div>

                <div className="wheel-stat">
                  <div className="wheel-stat-label">
                    Hours of spinning
                  </div>

                  <div className="wheel-stat-number">
                    0
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div className="wheel-about-column">
            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  ⭐
                </div>

                <span className="wheel-about-title">
                  Wheel features
                </span>
              </div>

              <div className="wheel-about-body">
                We aim to provide the most flexible
                and easy-to-use wheel spinner on the
                web.

                <ul>
                  <li>
                    <b>Rich audio library:</b> Choose
                    from music tracks and sound effects
                    to set the mood.
                  </li>

                  <li>
                    <b>Multi-wheel management:</b>
                    Handle multiple wheels on the same
                    page.
                  </li>

                  <li>
                    <b>Weighted wheels:</b> Use weights
                    for entries to optionally set the
                    size of each segment.
                  </li>

                  <li>
                    <b>Instant sharing:</b> Generate a
                    short link to share your wheel.
                  </li>

                  <li>
                    <b>Your own visuals:</b> Customize
                    the wheel background and color
                    theme.
                  </li>

                  <li>
                    <b>Privacy-first storage:</b> Save
                    wheels locally or to the cloud.
                  </li>

                  <li>
                    <b>Authentic physics:</b> The wheel
                    is designed to feel like a physical
                    spinning wheel.
                  </li>

                  <li>
                    <b>Built for large groups:</b>
                    Handle large lists without slowing
                    down.
                  </li>

                  <li>
                    <b>Global localization:</b> Access
                    the tool in multiple languages.
                  </li>
                </ul>
              </div>
            </article>

            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  🔒
                </div>

                <span className="wheel-about-title">
                  Is my data private?
                </span>
              </div>

              <div className="wheel-about-body">
                <p>
                  We are committed to protecting and
                  respecting your privacy and the
                  security of your data.
                </p>

                <p>
                  <a href="/privacy-policy">
                    How we safeguard your privacy
                  </a>
                </p>
              </div>
            </article>

            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  📺
                </div>

                <span className="wheel-about-title">
                  Can I close the ads?
                </span>
              </div>

              <div className="wheel-about-body">
                <p>
                  We rely on ads to keep the website
                  free for everyone. However, ads can be
                  closed for the duration of a session.
                </p>

                <p>
                  <a href="/faq#ads">
                    Ads policy
                  </a>
                </p>
              </div>
            </article>
          </div>

          <div className="wheel-about-column">
            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  🎥
                </div>

                <span className="wheel-about-title">
                  Can I use the wheel in OBS or
                  Streamlabs?
                </span>
              </div>

              <div className="wheel-about-body">
                <p>
                  Yes! You can add the wheel as a
                  browser source in streaming software.
                </p>

                <p>
                  Common streamer uses:
                </p>

                <ul>
                  <li>
                    In-game challenges.
                  </li>

                  <li>
                    Character builds.
                  </li>

                  <li>
                    Viewer giveaways.
                  </li>
                </ul>
              </div>
            </article>

            <article className="wheel-about-card">
              <div className="wheel-about-card-header">
                <div className="wheel-about-icon">
                  🎲
                </div>

                <span className="wheel-about-title">
                  Is the wheel truly random?
                </span>
              </div>

              <div className="wheel-about-body">
                <p>
                  Yes. Each spin selects a result from
                  the entries currently on the wheel.
                </p>

                <p>
                  <button
                    type="button"
                    className="editor-button"
                    style={{
                      background: "#1976d2",
                    }}
                  >
                    Run 10,000 Spins
                  </button>
                </p>

                <p>
                  If you want to make sure that a
                  winner doesn&apos;t get picked again,
                  remove the winner after each spin.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* FOOTER */}

      <footer className="wheel-site-footer">
        <div className="wheel-site-footer-column">
          <span>
            ⚖{" "}
            <a href="/terms">
              Terms &amp; conditions
            </a>
          </span>

          <span>
            🕵{" "}
            <a href="/privacy-policy">
              Privacy policy
            </a>
          </span>
        </div>

        <div className="wheel-site-footer-column">
          <span>
            ❓{" "}
            <a href="/faq">
              FAQ
            </a>
          </span>

          <span>
            💬{" "}
            <a href="#">
              Feedback
            </a>
          </span>
        </div>

        <div className="wheel-site-footer-column">
          <span>
            &lt;/&gt;{" "}
            <a href="/api-doc">
              API
            </a>
          </span>

          <span>
            📢{" "}
            <a href="https://blog.wheelofnames.com">
              Blog
            </a>
          </span>
        </div>

        <div className="wheel-site-footer-column">
          <span>
            🎥{" "}
            <a href="/streaming">
              Streaming
            </a>
          </span>

          <span className="wheel-build">
            7a6d / ?
          </span>
        </div>
      </footer>

      {/* MODALS */}

      {showCustomize && (
        <div
          className="wheel-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCustomize(false)
            }
          }}
        >
          <div className="wheel-modal">
            <div className="wheel-modal-header">
              <span className="wheel-modal-title">
                Customize
              </span>

              <button
                type="button"
                className="wheel-modal-close"
                onClick={() =>
                  setShowCustomize(false)
                }
              >
                ×
              </button>
            </div>

            <div className="wheel-modal-body">
              Customize the wheel colors, sounds,
              spin time, and other wheel settings.

              <button
                type="button"
                className="wheel-modal-action"
                onClick={() =>
                  setShowCustomize(false)
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpen && (
        <div
          className="wheel-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowOpen(false)
            }
          }}
        >
          <div className="wheel-modal">
            <div className="wheel-modal-header">
              <span className="wheel-modal-title">
                Open
              </span>

              <button
                type="button"
                className="wheel-modal-close"
                onClick={() =>
                  setShowOpen(false)
                }
              >
                ×
              </button>
            </div>

            <div className="wheel-modal-body">
              Open a previously saved wheel.

              <button
                type="button"
                className="wheel-modal-action"
                onClick={() =>
                  setShowOpen(false)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showSave && (
        <div
          className="wheel-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowSave(false)
            }
          }}
        >
          <div className="wheel-modal">
            <div className="wheel-modal-header">
              <span className="wheel-modal-title">
                Save
              </span>

              <button
                type="button"
                className="wheel-modal-close"
                onClick={() =>
                  setShowSave(false)
                }
              >
                ×
              </button>
            </div>

            <div className="wheel-modal-body">
              Your current wheel contains{" "}
              {entries.length} entries.

              <button
                type="button"
                className="wheel-modal-action"
                onClick={() =>
                  setShowSave(false)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <div
          className="wheel-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowShare(false)
            }
          }}
        >
          <div className="wheel-modal">
            <div className="wheel-modal-header">
              <span className="wheel-modal-title">
                Share
              </span>

              <button
                type="button"
                className="wheel-modal-close"
                onClick={() =>
                  setShowShare(false)
                }
              >
                ×
              </button>
            </div>

            <div className="wheel-modal-body">
              The current wheel URL has been copied
              to your clipboard.

              <button
                type="button"
                className="wheel-modal-action"
                onClick={() =>
                  setShowShare(false)
                }
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
