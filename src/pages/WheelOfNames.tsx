import { useState } from "react"

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
  "#4285f4",
  "#ea4335",
  "#fbbc05",
  "#34a853",
  "#8e44ad",
  "#00acc1",
  "#ff7043",
  "#7cb342",
]

export default function WheelOfNames() {
  const [entries, setEntries] =
    useState<WheelEntry[]>(INITIAL_ENTRIES)

  const [results, setResults] = useState<string[]>([])
  const [activeTab, setActiveTab] =
    useState<"entries" | "results">("entries")

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)

  const [newEntry, setNewEntry] = useState("")

  const [showCustomize, setShowCustomize] =
    useState(false)

  const [showOpen, setShowOpen] =
    useState(false)

  const [showSave, setShowSave] =
    useState(false)

  const [showShare, setShowShare] =
    useState(false)

  function spinWheel() {
    if (entries.length === 0 || spinning) {
      return
    }

    setSpinning(true)

    const winnerIndex = Math.floor(
      Math.random() * entries.length,
    )

    const winner = entries[winnerIndex]

    const segmentAngle = 360 / entries.length

    const winnerAngle =
      winnerIndex * segmentAngle +
      segmentAngle / 2

    const targetRotation =
      rotation +
      360 * 6 +
      (360 - winnerAngle)

    setRotation(targetRotation)

    window.setTimeout(() => {
      setResults((current) => [
        ...current,
        winner.name,
      ])

      setActiveTab("results")
      setSpinning(false)
    }, 4200)
  }

  function handleWheelKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault()
      spinWheel()
    }
  }

  function shuffleEntries() {
    setEntries((current) => {
      const shuffled = [...current]

      for (
        let index = shuffled.length - 1;
        index > 0;
        index -= 1
      ) {
        const randomIndex = Math.floor(
          Math.random() * (index + 1),
        )

        ;[
          shuffled[index],
          shuffled[randomIndex],
        ] = [
          shuffled[randomIndex],
          shuffled[index],
        ]
      }

      return shuffled
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

  function removeEntry(id: number) {
    setEntries((current) =>
      current.filter((entry) => entry.id !== id),
    )
  }

  function updateEntry(
    id: number,
    value: string,
  ) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              name: value,
            }
          : entry,
      ),
    )
  }

  function newWheel() {
    setEntries(INITIAL_ENTRIES)
    setResults([])
    setRotation(0)
    setActiveTab("entries")
  }

  function copyShareLink() {
    void navigator.clipboard
      ?.writeText(window.location.href)

    setShowShare(true)
  }

  const wheelGradient =
    entries.length > 0
      ? `conic-gradient(${entries
          .map((_, index) => {
            const start =
              (index / entries.length) * 100

            const end =
              ((index + 1) / entries.length) * 100

            return `${WHEEL_COLORS[index % WHEEL_COLORS.length]} ${start}% ${end}%`
          })
          .join(", ")})`
      : "#333"

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#111827] text-white">
      <main className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, rgba(30,64,175,0.18), transparent 42%), radial-gradient(circle at 15% 85%, rgba(37,99,235,0.10), transparent 35%), #111827",
          }}
        />

        <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-3 py-3 sm:px-5 lg:px-6">
          <div className="grid min-h-[calc(100vh-24px)] grid-cols-1 gap-3 lg:grid-cols-[56px_minmax(0,1fr)_390px]">
            {/* LEFT COLUMN */}
            <aside className="hidden items-start justify-center pt-2 lg:flex">
              <button
                type="button"
                aria-label="Edit"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#1f2937] text-gray-300 shadow-sm transition hover:bg-[#273449] hover:text-white"
              >
                <span className="text-lg">
                  ✎
                </span>
              </button>
            </aside>

            {/* CENTER COLUMN */}
            <section className="relative flex min-h-[600px] min-w-0 flex-col items-center justify-center rounded-xl border border-white/5 bg-black/10 p-4">
              <div className="relative flex w-full max-w-[760px] flex-1 items-center justify-center">
                <div className="relative aspect-square w-[min(72vw,700px)] max-w-[700px]">
                  {/* POINTER */}
                  <div className="absolute left-1/2 top-[-7px] z-20 -translate-x-1/2">
                    <div
                      className="h-0 w-0"
                      style={{
                        borderLeft:
                          "15px solid transparent",
                        borderRight:
                          "15px solid transparent",
                        borderTop:
                          "32px solid #ffffff",
                        filter:
                          "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
                      }}
                    />
                  </div>

                  {/* WHEEL */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Spin wheel"
                    onClick={spinWheel}
                    onKeyDown={handleWheelKeyDown}
                    className="relative h-full w-full cursor-pointer rounded-full border-[10px] border-[#202938] shadow-[0_10px_45px_rgba(0,0,0,0.45)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-blue-500/60"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: spinning
                        ? "transform 4.2s cubic-bezier(0.12, 0.8, 0.18, 1)"
                        : "none",
                      background:
                        wheelGradient,
                    }}
                  >
                    {/* WHEEL LABELS */}
                    <div className="absolute inset-0">
                      {entries.map(
                        (entry, index) => {
                          const angle =
                            (360 / entries.length) *
                              index +
                            360 /
                              entries.length /
                              2

                          return (
                            <div
                              key={entry.id}
                              className="absolute left-1/2 top-1/2 h-1/2 w-[1px] origin-bottom"
                              style={{
                                transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                              }}
                            >
                              <span
                                className="absolute bottom-5 left-1/2 max-w-[110px] -translate-x-1/2 -rotate-[var(--label-rotation)] whitespace-nowrap text-xs font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] sm:text-sm"
                                style={
                                  {
                                    "--label-rotation": `${angle}deg`,
                                    transform: `translateX(-50%) rotate(${-angle}deg)`,
                                  } as React.CSSProperties
                                }
                              >
                                {entry.name}
                              </span>
                            </div>
                          )
                        },
                      )}
                    </div>

                    {/* CENTER */}
                    <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[7px] border-[#111827] bg-white shadow-[0_3px_12px_rgba(0,0,0,0.45)] sm:h-32 sm:w-32">
                      <span className="text-center text-sm font-bold text-gray-800 sm:text-base">
                        Click to spin
                      </span>

                      <span className="mt-1 text-[10px] text-gray-500">
                        or press Ctrl+Enter
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={spinWheel}
                disabled={
                  spinning ||
                  entries.length === 0
                }
                className="mt-3 rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {spinning
                  ? "Spinning..."
                  : "SPIN"}
              </button>
            </section>

            {/* RIGHT COLUMN */}
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1b2431] shadow-xl">
              {/* SIDE TOOLBAR */}
              <div className="flex shrink-0 items-center border-b border-white/10 bg-[#202a38]">
                <button
                  type="button"
                  onClick={() =>
                    setShowCustomize(
                      (current) => !current,
                    )
                  }
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-3 text-[11px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="text-base">
                    ⚙
                  </span>
                  <span>Customize</span>
                </button>

                <button
                  type="button"
                  onClick={newWheel}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-l border-white/10 px-2 py-3 text-[11px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="text-base">
                    ＋
                  </span>
                  <span>New</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowOpen(true)
                  }
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-l border-white/10 px-2 py-3 text-[11px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="text-base">
                    📂
                  </span>
                  <span>Open</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowSave(true)
                  }
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-l border-white/10 px-2 py-3 text-[11px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="text-base">
                    💾
                  </span>
                  <span>Save</span>
                </button>

                <button
                  type="button"
                  onClick={copyShareLink}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-l border-white/10 px-2 py-3 text-[11px] font-medium text-gray-300 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="text-base">
                    ↗
                  </span>
                  <span>Share</span>
                </button>
              </div>

              {/* CUSTOMIZE PANEL */}
              {showCustomize && (
                <div className="shrink-0 border-b border-white/10 bg-[#161e29] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      Customize
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setShowCustomize(false)
                      }
                      className="text-gray-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>

                  <p className="mt-1 text-xs text-gray-400">
                    Customize your wheel settings.
                  </p>
                </div>
              )}

              {/* EDITOR */}
              <div className="flex min-h-0 flex-1 flex-col">
                {/* TABS */}
                <div className="flex shrink-0 border-b border-white/10 bg-[#202a38]">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab("entries")
                    }
                    className={[
                      "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition",
                      activeTab === "entries"
                        ? "border-b-2 border-blue-500 text-white"
                        : "text-gray-400 hover:text-white",
                    ].join(" ")}
                  >
                    <span>Entries</span>

                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                      {entries.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab("results")
                    }
                    className={[
                      "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition",
                      activeTab === "results"
                        ? "border-b-2 border-blue-500 text-white"
                        : "text-gray-400 hover:text-white",
                    ].join(" ")}
                  >
                    <span>Results</span>

                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                      {results.length}
                    </span>
                  </button>
                </div>

                {/* ENTRIES */}
                {activeTab === "entries" && (
                  <>
                    <div className="flex shrink-0 items-center gap-2 border-b border-white/10 p-3">
                      <button
                        type="button"
                        onClick={shuffleEntries}
                        className="rounded-md border border-white/10 bg-[#202a38] px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Shuffle
                      </button>

                      <button
                        type="button"
                        onClick={sortEntries}
                        className="rounded-md border border-white/10 bg-[#202a38] px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Sort
                      </button>

                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-[#202a38] px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Add image
                      </button>

                      <button
                        type="button"
                        className="ml-auto rounded-md border border-white/10 bg-[#202a38] px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Advanced
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <div className="divide-y divide-white/5">
                        {entries.map(
                          (entry, index) => (
                            <div
                              key={entry.id}
                              className="group flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]"
                            >
                              <span className="w-5 text-center text-xs text-gray-500">
                                {index + 1}
                              </span>

                              <input
                                type="text"
                                value={entry.name}
                                onChange={(event) =>
                                  updateEntry(
                                    entry.id,
                                    event.target.value,
                                  )
                                }
                                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  removeEntry(
                                    entry.id,
                                  )
                                }
                                aria-label={`Remove ${entry.name}`}
                                className="invisible rounded p-1 text-gray-500 transition hover:bg-white/10 hover:text-red-400 group-hover:visible"
                              >
                                ×
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 border-t border-white/10 p-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
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
                          placeholder="Add entry..."
                          className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500/60"
                        />

                        <button
                          type="button"
                          onClick={addEntry}
                          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="shrink-0 border-t border-white/10 p-3">
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                      >
                        <span>＋</span>
                        Add wheel
                      </button>
                    </div>
                  </>
                )}

                {/* RESULTS */}
                {activeTab === "results" && (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {results.length === 0 ? (
                      <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
                        <div className="text-4xl opacity-40">
                          🎯
                        </div>

                        <p className="mt-3 text-sm font-medium text-gray-300">
                          No results yet
                        </p>

                        <p className="mt-1 max-w-[250px] text-xs leading-5 text-gray-500">
                          Spin the wheel to see your
                          results here.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {results.map(
                          (result, index) => (
                            <div
                              key={`${result}-${index}`}
                              className="flex items-center gap-3 px-4 py-3"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-400">
                                {index + 1}
                              </span>

                              <span className="text-sm text-white">
                                {result}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* HIDE EDITOR */}
              <button
                type="button"
                aria-label="Hide editor"
                className="hidden shrink-0 border-t border-white/10 bg-[#202a38] py-2 text-center text-xs text-gray-500 transition hover:text-white sm:block"
              >
                Hide editor
              </button>
            </aside>
          </div>

          {/* ABOUT */}
          <section className="mx-auto mt-6 w-full max-w-5xl pb-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#1b2431]/80 p-4">
                <h2 className="text-sm font-semibold">
                  Wheel of Names
                </h2>

                <p className="mt-1 text-xs leading-5 text-gray-400">
                  Enter names and spin the wheel to
                  randomly select a winner.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#1b2431]/80 p-4">
                <h2 className="text-sm font-semibold">
                  Random Selection
                </h2>

                <p className="mt-1 text-xs leading-5 text-gray-400">
                  Every entry gets its own section of
                  the wheel for a quick random draw.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#1b2431]/80 p-4">
                <h2 className="text-sm font-semibold">
                  Results
                </h2>

                <p className="mt-1 text-xs leading-5 text-gray-400">
                  Previous winners are kept in the
                  results panel on the right.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col items-center justify-between gap-2 text-xs text-gray-500 sm:flex-row">
              <span>
                Wheel of Names
              </span>

              <span>
                Version 432 · Changelog
              </span>
            </div>
          </section>
        </div>
      </main>

      {/* OPEN MODAL */}
      {showOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              setShowOpen(false)
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1b2431] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Open
              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowOpen(false)
                }
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-400">
              Open a saved wheel.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowOpen(false)
              }
              className="mt-5 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* SAVE MODAL */}
      {showSave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              setShowSave(false)
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1b2431] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Save
              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowSave(false)
                }
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-400">
              Your current wheel contains{" "}
              {entries.length} entries.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowSave(false)
              }
              className="mt-5 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {showShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              setShowShare(false)
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1b2431] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Share
              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowShare(false)
                }
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-400">
              The current wheel link has been copied
              to your clipboard.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowShare(false)
              }
              className="mt-5 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
