import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  ChevronDown,
  ImagePlus,
  Maximize2,
  MoreHorizontal,
  Plus,
  Shuffle,
  Sparkles,
  Trophy,
  Trash2,
  Type,
} from "lucide-react"
import { toast } from "sonner"
import { Wheel } from "spin-wheel"

type WheelEntry = {
  id: string
  label: string
  color: string
  hidden: boolean
}

type SpinResult = {
  id: string
  label: string
  timestamp: number
}

const COLORS = [
  "#65b7e7",
  "#b879cf",
  "#f5d45d",
  "#62d19a",
  "#65b7e7",
  "#b879cf",
  "#f5d45d",
  "#62d19a",
]

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

const IDLE_SPEED = 24
const WIN_SPIN_DURATION = 5000
const WIN_REVOLUTIONS = 7

function makeEntry(
  label: string,
  index: number,
): WheelEntry {
  return {
    id: crypto.randomUUID(),
    label,
    color: COLORS[index % COLORS.length],
    hidden: false,
  }
}

function createDefaultEntries(): WheelEntry[] {
  return DEFAULT_ENTRIES.map(
    (label, index) =>
      makeEntry(label, index),
  )
}

function shuffleArray<T>(
  items: T[],
): T[] {
  const result = [...items]

  for (
    let index = result.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
          (index + 1),
      )

    ;[
      result[index],
      result[randomIndex],
    ] = [
      result[randomIndex],
      result[index],
    ]
  }

  return result
}

export default function SpinWheel() {
  const wheelContainerRef =
    useRef<HTMLDivElement | null>(null)

  const wheelRef =
    useRef<Wheel | null>(null)

  const isSpinningRef =
    useRef(false)

  const hideSelectedRef =
    useRef(false)

  const idleRotationRef =
    useRef(false)

  const visibleEntriesRef =
    useRef<WheelEntry[]>([])

  const [entries, setEntries] =
    useState<WheelEntry[]>(
      createDefaultEntries,
    )

  const [results, setResults] =
    useState<SpinResult[]>([])

  const [newEntry, setNewEntry] =
    useState("")

  const [isSpinning, setIsSpinning] =
    useState(false)

  const [showResults, setShowResults] =
    useState(false)

  const [showAdvanced, setShowAdvanced] =
    useState(false)

  const [showMore, setShowMore] =
    useState(false)

  const [hideSelected, setHideSelected] =
    useState(false)

  const visibleEntries =
    entries.filter(
      (entry) => !entry.hidden,
    )

  visibleEntriesRef.current =
    visibleEntries

  hideSelectedRef.current =
    hideSelected

  isSpinningRef.current =
    isSpinning

  /*
   * Start the slow idle rotation.
   *
   * rotationResistance = 0 means
   * the wheel will continue indefinitely.
   */
  const startIdleRotation =
    useCallback(() => {
      const wheel =
        wheelRef.current

      if (
        !wheel ||
        isSpinningRef.current ||
        !visibleEntriesRef.current.length ||
        idleRotationRef.current
      ) {
        return
      }

      idleRotationRef.current =
        true

      wheel.spin(IDLE_SPEED)
    }, [])

  /*
   * Stop the idle rotation before
   * starting the actual winner spin.
   */
  const stopIdleRotation =
    useCallback(() => {
      const wheel =
        wheelRef.current

      if (!wheel) {
        return
      }

      idleRotationRef.current =
        false

      wheel.stop()
    }, [])

  /*
   * Create the wheel.
   *
   * IMPORTANT:
   * This does NOT depend on isSpinning.
   * Recreating the wheel when the spin starts
   * was what caused the previous spin to reset.
   */
  useEffect(() => {
    const container =
      wheelContainerRef.current

    if (!container) {
      return
    }

    wheelRef.current?.remove()
    wheelRef.current = null

    idleRotationRef.current =
      false

    if (!visibleEntries.length) {
      return
    }

    const wheel = new Wheel(
      container,
      {
        items: visibleEntries.map(
          (entry) => ({
            label: entry.label,
            backgroundColor:
              entry.color,
            labelColor:
              "#111111",
          }),
        ),

        /*
         * Pointer is on the right.
         */
        pointerAngle: 90,

        /*
         * Keep the wheel large,
         * but leave a little space around it.
         */
        radius: 0.91,

        lineWidth: 1,

        lineColor:
          "rgba(255,255,255,0.22)",

        /*
         * Radial text like Wheel of Names.
         */
        itemLabelRotation: 0,

        itemLabelAlign:
          "center",

        /*
         * Smaller label region makes
         * long names fit much better.
         */
        itemLabelRadius: 0.68,

        itemLabelRadiusMax:
          0.20,

        /*
         * Maximum font size.
         * The library automatically
         * reduces this when needed.
         */
        itemLabelFontSizeMax: 34,

        itemLabelStrokeWidth: 0,

        itemLabelFont:
          'Arial, Helvetica, sans-serif',

        itemLabelColors: [
          "#111111",
        ],

        pixelRatio: Math.min(
          2,
          typeof window !==
            "undefined"
            ? window.devicePixelRatio ||
              1
            : 1,
        ),

        /*
         * Required for continuous
         * idle spinning.
         */
        rotationResistance: 0,

        /*
         * Prevent the idle rotation
         * from becoming excessively fast.
         */
        rotationSpeedMax: 80,
      },
    )

    wheelRef.current = wheel

    /*
     * Winner spin has finished.
     */
    wheel.onRest = (event) => {
      if (
        !isSpinningRef.current
      ) {
        return
      }

      isSpinningRef.current =
        false

      setIsSpinning(false)

      const currentEntries =
        visibleEntriesRef.current

      const winner =
        currentEntries[
          event.currentIndex
        ]

      if (!winner) {
        window.setTimeout(
          startIdleRotation,
          250,
        )

        return
      }

      const result: SpinResult = {
        id: winner.id,
        label: winner.label,
        timestamp: Date.now(),
      }

      setResults(
        (current) =>
          [
            result,
            ...current,
          ].slice(0, 25),
      )

      /*
       * Optionally remove the winner.
       */
      if (
        hideSelectedRef.current
      ) {
        setEntries(
          (current) =>
            current.map(
              (entry) =>
                entry.id ===
                winner.id
                  ? {
                      ...entry,
                      hidden: true,
                    }
                  : entry,
            ),
        )
      }

      toast.success(
        `${winner.label} was selected`,
      )

      /*
       * Give the result a moment
       * before restarting idle rotation.
       */
      window.setTimeout(
        () => {
          if (
            !isSpinningRef.current &&
            wheelRef.current
          ) {
            startIdleRotation()
          }
        },
        700,
      )
    }

    /*
     * Start idle rotation after the
     * wheel has been rendered.
     */
    const timer =
      window.setTimeout(
        () => {
          if (
            !isSpinningRef.current &&
            wheelRef.current
          ) {
            startIdleRotation()
          }
        },
        250,
      )

    return () => {
      window.clearTimeout(
        timer,
      )

      idleRotationRef.current =
        false

      wheel.remove()

      if (
        wheelRef.current ===
        wheel
      ) {
        wheelRef.current = null
      }
    }
  }, [
    entries,
    startIdleRotation,
  ])

  /*
   * Spin to a randomly selected
   * entry for exactly 5 seconds.
   */
  const spin = useCallback(() => {
    const wheel =
      wheelRef.current

    const currentEntries =
      visibleEntriesRef.current

    if (
      !wheel ||
      !currentEntries.length ||
      isSpinningRef.current
    ) {
      return
    }

    stopIdleRotation()

    const winnerIndex =
      Math.floor(
        Math.random() *
          currentEntries.length,
      )

    const winner =
      currentEntries[winnerIndex]

    if (!winner) {
      return
    }

    isSpinningRef.current =
      true

    setIsSpinning(true)

    /*
     * Exactly 5 seconds.
     *
     * Seven revolutions gives it
     * a proper Wheel of Names style
     * spin rather than barely moving.
     */
    wheel.spinToItem(
      winnerIndex,
      WIN_SPIN_DURATION,
      true,
      WIN_REVOLUTIONS,
      1,
    )
  }, [stopIdleRotation])

  /*
   * Ctrl + Enter spins the wheel.
   */
  useEffect(() => {
    function handleKeyboard(
      event: KeyboardEvent,
    ) {
      if (
        event.ctrlKey &&
        event.key === "Enter"
      ) {
        event.preventDefault()
        spin()
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyboard,
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard,
      )
    }
  }, [spin])

  function addEntry() {
    const value =
      newEntry.trim()

    if (!value) {
      return
    }

    setEntries(
      (current) => [
        ...current,
        makeEntry(
          value,
          current.length,
        ),
      ],
    )

    setNewEntry("")
  }

  function shuffleEntries() {
    if (isSpinning) {
      return
    }

    setEntries(
      (current) =>
        shuffleArray(
          current,
        ).map(
          (entry, index) => ({
            ...entry,
            color:
              COLORS[
                index %
                  COLORS.length
              ],
          }),
        ),
    )

    toast.success(
      "Entries shuffled.",
    )
  }

  function sortEntries() {
    if (isSpinning) {
      return
    }

    setEntries(
      (current) =>
        [...current].sort(
          (a, b) =>
            a.label.localeCompare(
              b.label,
              undefined,
              {
                sensitivity:
                  "base",
              },
            ),
        ),
    )

    toast.success(
      "Entries sorted.",
    )
  }

  function clearEntries() {
    if (isSpinning) {
      return
    }

    setEntries([])
    setResults([])
  }

  function restoreDefaults() {
    if (isSpinning) {
      return
    }

    setEntries(
      createDefaultEntries(),
    )

    setResults([])

    toast.success(
      "Default entries restored.",
    )
  }

  function clearResults() {
    setResults([])
  }

  function toggleFullscreen() {
    if (
      !document.fullscreenElement
    ) {
      void document.documentElement.requestFullscreen?.()
    } else {
      void document.exitFullscreen?.()
    }
  }

  function copyEntries() {
    void navigator.clipboard
      ?.writeText(
        visibleEntries
          .map(
            (entry) =>
              entry.label,
          )
          .join("\n"),
      )
      .then(() => {
        toast.success(
          "Entries copied.",
        )
      })
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#111111] text-white">
      {/* =====================================================
          WHEEL AREA
          ===================================================== */}

      <main className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_48%_42%,#25343e_0%,#172129_45%,#111111_88%)]">
        {/* Top subtle gradient */}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/[0.035] to-transparent" />

        {/* Edit button */}

        <button
          type="button"
          onClick={() =>
            document
              .getElementById(
                "wheel-entry-input",
              )
              ?.focus()
          }
          className="absolute left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#37365f] text-white shadow-lg transition hover:bg-[#48467b]"
          aria-label="Edit entries"
        >
          <Type className="h-4 w-4" />
        </button>

        {/* Actual wheel */}

        <div
          ref={wheelContainerRef}
          className={[
            "absolute inset-0 flex items-center justify-center select-none",
            isSpinning
              ? "cursor-default"
              : "cursor-pointer",
          ].join(" ")}
          onClick={() => {
            if (!isSpinning) {
              spin()
            }
          }}
        />

        {/* =================================================
            POINTER
            ================================================= */}

        <div className="pointer-events-none absolute right-[-1px] top-1/2 z-50 -translate-y-1/2">
          <div
            className="
              h-0
              w-0
              border-y-[22px]
              border-l-0
              border-r-[46px]
              border-y-transparent
              border-r-emerald-300
              drop-shadow-[0_2px_7px_rgba(0,0,0,0.65)]
            "
          />
        </div>

        {/* =================================================
            CENTER INSTRUCTIONS
            ================================================= */}

        {!isSpinning &&
          visibleEntries.length >
            0 && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
              <div className="whitespace-nowrap text-[clamp(25px,2.8vw,48px)] font-black leading-none tracking-tight text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.6)]">
                Click to spin
              </div>

              <div className="mt-4 whitespace-nowrap text-[clamp(13px,1vw,19px)] font-bold text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.65)]">
                or press ctrl+enter
              </div>
            </div>
          )}

        {isSpinning && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-5 py-2 text-sm font-bold text-white shadow-lg backdrop-blur">
            Spinning...
          </div>
        )}

        {/* No entries */}

        {!visibleEntries.length && (
          <div className="absolute inset-0 z-40 flex items-center justify-center">
            <div className="rounded-xl border border-white/10 bg-black/40 px-8 py-7 text-center shadow-2xl backdrop-blur">
              <Sparkles className="mx-auto h-10 w-10 text-blue-300" />

              <h2 className="mt-3 text-xl font-bold">
                Add some entries
              </h2>

              <p className="mt-1 text-sm text-white/55">
                Add entries using the
                panel on the right.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="relative flex w-[330px] shrink-0 flex-col border-l border-white/10 bg-[#1c1c1c] shadow-[-12px_0_35px_rgba(0,0,0,0.25)] xl:w-[380px] 2xl:w-[420px]">
        {/* Tabs */}

        <div className="flex h-[50px] shrink-0 items-center border-b border-white/10 bg-[#202020]">
          <button
            type="button"
            onClick={() =>
              setShowResults(false)
            }
            className={[
              "flex h-full items-center gap-2 border-b-2 px-4 text-sm font-bold",
              !showResults
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white",
            ].join(" ")}
          >
            Entries

            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
              {visibleEntries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setShowResults(true)
            }
            className={[
              "flex h-full items-center gap-2 border-b-2 px-4 text-sm font-bold",
              showResults
                ? "border-white text-white"
                : "border-transparent text-white/50 hover:text-white",
            ].join(" ")}
          >
            Results

            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
              {results.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setShowMore(
                (current) =>
                  !current,
              )
            }
            className="ml-auto mr-2 flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="More"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        {!showResults ? (
          <>
            {/* Controls */}

            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#222222] px-4 py-3">
              <button
                type="button"
                disabled={isSpinning}
                onClick={
                  shuffleEntries
                }
                className="flex items-center gap-2 rounded bg-[#3b3a70] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4a4881] disabled:opacity-40"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Shuffle
              </button>

              <button
                type="button"
                disabled={isSpinning}
                onClick={sortEntries}
                className="flex items-center gap-2 rounded bg-[#3b3a70] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4a4881] disabled:opacity-40"
              >
                <span className="text-sm font-black">
                  A
                </span>
                Sort
              </button>

              <button
                type="button"
                className="flex items-center gap-2 rounded bg-[#3b3a70] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4a4881]"
              >
                <ImagePlus className="h-3.5 w-3.5" />

                <span>
                  Add image
                </span>

                <ChevronDown className="h-3 w-3" />
              </button>

              <label className="ml-auto flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-semibold text-white/75">
                <input
                  type="checkbox"
                  checked={
                    showAdvanced
                  }
                  onChange={(
                    event,
                  ) =>
                    setShowAdvanced(
                      event.target
                        .checked,
                    )
                  }
                  className="h-3.5 w-3.5 accent-white"
                />

                Advanced
              </label>
            </div>

            {/* Entries textarea */}

            <div className="min-h-0 flex-1 p-4">
              <div className="flex h-full min-h-[300px] flex-col overflow-hidden rounded border border-white/25 bg-[#181818]">
                <textarea
                  id="wheel-entry-input"
                  value={entries
                    .map(
                      (entry) =>
                        entry.label,
                    )
                    .join("\n")}
                  onChange={(
                    event,
                  ) => {
                    const lines =
                      event.target.value.split(
                        /\r?\n/,
                      )

                    setEntries(
                      lines.map(
                        (
                          line,
                          index,
                        ) => ({
                          id:
                            entries[
                              index
                            ]?.id ??
                            crypto.randomUUID(),

                          label: line,

                          color:
                            COLORS[
                              index %
                                COLORS.length
                            ],

                          hidden:
                            entries[
                              index
                            ]?.hidden ??
                            false,
                        }),
                      ),
                    )
                  }}
                  disabled={isSpinning}
                  spellCheck={false}
                  className="min-h-0 flex-1 resize-none bg-transparent p-3 text-[14px] leading-[21px] text-white outline-none placeholder:text-white/30"
                  placeholder="Enter one entry per line..."
                />
              </div>
            </div>

            {/* Add entry */}

            <div className="shrink-0 border-t border-white/10 bg-[#202020] p-3">
              <div className="flex gap-2">
                <input
                  value={newEntry}
                  onChange={(
                    event,
                  ) =>
                    setNewEntry(
                      event.target
                        .value,
                    )
                  }
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      event.preventDefault()
                      addEntry()
                    }
                  }}
                  disabled={isSpinning}
                  placeholder="Add entry..."
                  className="min-w-0 flex-1 rounded border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                />

                <button
                  type="button"
                  onClick={
                    addEntry
                  }
                  disabled={
                    isSpinning ||
                    !newEntry.trim()
                  }
                  className="flex items-center gap-1.5 rounded bg-[#3b3a70] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#4a4881] disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Results */

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-bold">
                  Results
                </p>

                <p className="mt-0.5 text-xs text-white/45">
                  Recent selections
                </p>
              </div>

              <button
                type="button"
                onClick={
                  clearResults
                }
                disabled={
                  !results.length
                }
                className="text-xs font-semibold text-white/55 hover:text-white disabled:opacity-30"
              >
                Clear
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {results.length ===
              0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div>
                    <Trophy className="mx-auto h-8 w-8 text-white/30" />

                    <p className="mt-3 text-sm font-bold text-white/70">
                      No results yet
                    </p>

                    <p className="mt-1 text-xs text-white/35">
                      Spin the wheel to
                      create a result.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {results.map(
                    (
                      result,
                      index,
                    ) => (
                      <div
                        key={`${result.id}-${result.timestamp}`}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b3a70] text-xs font-bold">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {
                              result.label
                            }
                          </p>

                          <p className="mt-0.5 text-[10px] text-white/35">
                            {new Date(
                              result.timestamp,
                            ).toLocaleTimeString(
                              "en-GB",
                              {
                                hour: "2-digit",
                                minute:
                                  "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced */}

        {showAdvanced &&
          !showResults && (
            <div className="shrink-0 border-t border-white/10 bg-[#202020] p-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-white/70">
                    Winner spin duration
                  </label>

                  <div className="rounded border border-white/10 bg-[#151515] px-3 py-2 text-xs font-semibold text-white/70">
                    5 seconds
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-white/70">
                    Winner revolutions
                  </label>

                  <div className="rounded border border-white/10 bg-[#151515] px-3 py-2 text-xs font-semibold text-white/70">
                    7 rotations
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  <input
                    type="checkbox"
                    checked={
                      hideSelected
                    }
                    onChange={(
                      event,
                    ) =>
                      setHideSelected(
                        event.target
                          .checked,
                      )
                    }
                    className="h-3.5 w-3.5 accent-white"
                  />

                  Hide selected entries
                </label>
              </div>
            </div>
          )}

        {/* More menu */}

        {showMore && (
          <div className="absolute right-2 top-[48px] z-[100] w-48 rounded-lg border border-white/15 bg-[#242424] p-1.5 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                restoreDefaults()
                setShowMore(false)
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Sparkles className="h-4 w-4" />
              Restore defaults
            </button>

            <button
              type="button"
              onClick={() => {
                copyEntries()
                setShowMore(false)
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Copy entries
            </button>

            <button
              type="button"
              onClick={() => {
                clearEntries()
                setShowMore(false)
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Clear entries
            </button>

            <button
              type="button"
              onClick={() => {
                toggleFullscreen()
                setShowMore(false)
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Maximize2 className="h-4 w-4" />
              Fullscreen
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
