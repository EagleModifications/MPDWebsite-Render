import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  ChevronDown,
  Eye,
  EyeOff,
  ImagePlus,
  Maximize2,
  MoreHorizontal,
  Plus,
  Settings2,
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
  "#68b7e8",
  "#bd78d1",
  "#f4d35e",
  "#63d29a",
  "#68b7e8",
  "#bd78d1",
  "#f4d35e",
  "#63d29a",
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

  const idleRotationRef =
    useRef(false)

  const winnerRef =
    useRef<string | null>(null)

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

  const [spinDuration, setSpinDuration] =
    useState(6500)

  const [spinRevolutions, setSpinRevolutions] =
    useState(6)

  const visibleEntries =
    entries.filter(
      (entry) => !entry.hidden,
    )

  /*
   * Creates the actual wheel.
   */
  const createWheel =
    useCallback(() => {
      const container =
        wheelContainerRef.current

      if (!container) {
        return
      }

      wheelRef.current?.remove()

      wheelRef.current = null

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

          radius: 0.94,

          lineWidth: 1,

          lineColor:
            "rgba(255,255,255,0.24)",

          itemLabelFont:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

          itemLabelColors: [
            "#111111",
          ],

          itemLabelAlign:
            "center",

          itemLabelRadius: 0.77,

          itemLabelRadiusMax:
            0.30,

          itemLabelFontSizeMax: 48,

          itemLabelStrokeWidth: 0,

          pixelRatio: Math.min(
            2,
            typeof window !==
              "undefined"
              ? window.devicePixelRatio ||
                1
              : 1,
          ),

          /*
           * This is important.
           *
           * The wheel is allowed to rotate
           * forever when idle.
           */
          rotationResistance: 0,
        },
      )

      wheelRef.current = wheel

      wheel.onRest = (event) => {
        /*
         * Real spin has finished.
         */
        setIsSpinning(false)

        const winner =
          visibleEntries[
            event.currentIndex
          ]

        if (!winner) {
          startIdleRotation()
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

        winnerRef.current =
          null

        if (hideSelected) {
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
         * Give the result a moment,
         * then return to idle rotation.
         */
        window.setTimeout(
          () => {
            startIdleRotation()
          },
          650,
        )
      }
    }, [
      hideSelected,
      visibleEntries,
    ])

  /*
   * Start the slow permanent rotation.
   */
  const startIdleRotation =
    useCallback(() => {
      const wheel =
        wheelRef.current

      if (
        !wheel ||
        isSpinning ||
        !visibleEntries.length
      ) {
        return
      }

      if (idleRotationRef.current) {
        return
      }

      idleRotationRef.current =
        true

      /*
       * Very slow clockwise movement.
       *
       * rotationResistance = 0 means
       * this will not slow down.
       */
      wheel.spin(7)
    }, [
      isSpinning,
      visibleEntries.length,
    ])

  /*
   * Stop the permanent idle rotation.
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
   * Rebuild whenever entries change.
   */
  useEffect(() => {
    createWheel()

    return () => {
      wheelRef.current?.remove()
      wheelRef.current = null
      idleRotationRef.current =
        false
    }
  }, [createWheel])

  /*
   * Start idle rotation after
   * the wheel has been created.
   */
  useEffect(() => {
    if (
      wheelRef.current &&
      visibleEntries.length &&
      !isSpinning
    ) {
      const timer =
        window.setTimeout(() => {
          startIdleRotation()
        }, 150)

      return () => {
        window.clearTimeout(
          timer,
        )
      }
    }

    return undefined
  }, [
    visibleEntries.length,
    isSpinning,
    startIdleRotation,
  ])

  /*
   * Real spin.
   */
  const spin = useCallback(() => {
    const wheel =
      wheelRef.current

    if (
      !wheel ||
      !visibleEntries.length ||
      isSpinning
    ) {
      return
    }

    /*
     * Stop the permanent slow rotation
     * before starting the actual spin.
     */
    stopIdleRotation()

    const winnerIndex =
      Math.floor(
        Math.random() *
          visibleEntries.length,
      )

    const winner =
      visibleEntries[winnerIndex]

    if (!winner) {
      return
    }

    winnerRef.current =
      winner.id

    setIsSpinning(true)

    wheel.spinToItem(
      winnerIndex,
      spinDuration,
      true,
      spinRevolutions,
      1,
    )
  }, [
    isSpinning,
    spinDuration,
    spinRevolutions,
    stopIdleRotation,
    visibleEntries,
  ])

  /*
   * Ctrl + Enter.
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

  function updateEntry(
    id: string,
    value: string,
  ) {
    setEntries(
      (current) =>
        current.map(
          (entry) =>
            entry.id === id
              ? {
                  ...entry,
                  label: value,
                }
              : entry,
        ),
    )
  }

  function removeEntry(
    id: string,
  ) {
    if (isSpinning) {
      return
    }

    setEntries(
      (current) =>
        current.filter(
          (entry) =>
            entry.id !== id,
        ),
    )
  }

  function toggleHidden(
    id: string,
  ) {
    if (isSpinning) {
      return
    }

    setEntries(
      (current) =>
        current.map(
          (entry) =>
            entry.id === id
              ? {
                  ...entry,
                  hidden:
                    !entry.hidden,
                }
              : entry,
        ),
    )
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
      ====================================================== */}

      <main className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#26343e_0%,#172129_42%,#111111_82%)]">
        {/* subtle top lighting */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.04] to-transparent" />

        {/* small edit button like screenshot */}
        <button
          type="button"
          onClick={() =>
            document
              .getElementById(
                "wheel-entry-input",
              )
              ?.focus()
          }
          className="absolute left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#36345d] text-white shadow-lg transition hover:bg-[#454274]"
          aria-label="Edit entries"
        >
          <Type className="h-4 w-4" />
        </button>

        {/* wheel */}
        <div
          ref={wheelContainerRef}
          className={[
            "absolute inset-0",
            "flex items-center justify-center",
            "select-none",
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

        {/* right pointer */}
        <div className="pointer-events-none absolute right-0 top-1/2 z-30 -translate-y-1/2">
          <div className="relative">
            <div className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[24px] border-l-0 border-r-[50px] border-y-transparent border-r-emerald-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" />

            <div className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[20px] border-r-[42px] border-y-transparent border-r-[#70e0aa]" />
          </div>
        </div>

        {/* center instruction */}
        {!isSpinning &&
          visibleEntries.length >
            0 && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
              <div className="whitespace-nowrap text-[clamp(28px,3vw,52px)] font-black tracking-tight text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.45)]">
                Click to spin
              </div>

              <div className="mt-2 text-[clamp(14px,1.2vw,22px)] font-bold text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]">
                or press ctrl+enter
              </div>
            </div>
          )}

        {isSpinning && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-5 py-2 text-sm font-semibold text-white backdrop-blur-md">
            Spinning...
          </div>
        )}

        {visibleEntries.length ===
          0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <div className="rounded-xl border border-white/10 bg-black/40 px-8 py-7 text-center backdrop-blur">
              <Sparkles className="mx-auto h-10 w-10 text-blue-300" />

              <h2 className="mt-3 text-xl font-bold">
                Add some entries
              </h2>

              <p className="mt-1 text-sm text-white/60">
                Add entries using the panel
                on the right.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <aside className="flex w-[330px] shrink-0 flex-col border-l border-white/10 bg-[#1d1d1d] shadow-[-10px_0_35px_rgba(0,0,0,0.22)] xl:w-[380px] 2xl:w-[420px]">
        {/* sidebar header */}
        <div className="flex h-[50px] shrink-0 items-center border-b border-white/10 bg-[#202020]">
          <button
            type="button"
            onClick={() =>
              setShowResults(false)
            }
            className={[
              "flex h-full items-center justify-center gap-2 border-b-2 px-4 text-sm font-bold transition",
              !showResults
                ? "border-white text-white"
                : "border-transparent text-white/55 hover:text-white",
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
              "flex h-full items-center justify-center gap-2 border-b-2 px-4 text-sm font-bold transition",
              showResults
                ? "border-white text-white"
                : "border-transparent text-white/55 hover:text-white",
            ].join(" ")}
          >
            Results

            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
              {results.length}
            </span>
          </button>

          <div className="ml-auto flex items-center pr-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() =>
                setShowMore(
                  (current) =>
                    !current,
                )
              }
              aria-label="More"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!showResults ? (
          <>
            {/* controls */}
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#222222] px-4 py-3">
              <button
                type="button"
                disabled={isSpinning}
                onClick={
                  shuffleEntries
                }
                className="flex h-30px items-center gap-2 rounded bg-[#3b3b70] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4a4a84] disabled:opacity-40"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Shuffle
              </button>

              <button
                type="button"
                disabled={isSpinning}
                onClick={sortEntries}
                className="flex items-center gap-2 rounded bg-[#3b3b70] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4a4a84] disabled:opacity-40"
              >
                <span className="text-sm">
                  A
                </span>
                Sort
              </button>

              <button
                type="button"
                className="flex items-center gap-2 rounded bg-[#3b3b70] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4a4a84]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Add image
                <ChevronDown className="h-3 w-3" />
              </button>

              <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-white/80">
                <input
                  type="checkbox"
                  checked={
                    showAdvanced
                  }
                  onChange={(event) =>
                    setShowAdvanced(
                      event.target.checked,
                    )
                  }
                  className="h-3.5 w-3.5 accent-white"
                />
                Advanced
              </label>
            </div>

            {/* entry editor */}
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
                  onChange={(event) => {
                    const lines =
                      event.target.value
                        .split(
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
                          label:
                            line,
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
                  className="min-h-0 flex-1 resize-none bg-transparent p-2.5 text-sm leading-[21px] text-white outline-none placeholder:text-white/30"
                  placeholder="Enter one entry per line..."
                />
              </div>
            </div>

            {/* bottom add wheel */}
            <div className="shrink-0 border-t border-white/10 bg-[#202020] p-3">
              <div className="flex gap-2">
                <input
                  value={newEntry}
                  onChange={(event) =>
                    setNewEntry(
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
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
                  className="flex items-center gap-1.5 rounded bg-[#3b3b70] px-3 py-2 text-xs font-bold text-white hover:bg-[#4a4a84] disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          </>
        ) : (
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
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b3b70] text-xs font-bold">
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

        {/* advanced */}
        {showAdvanced &&
          !showResults && (
            <div className="shrink-0 border-t border-white/10 bg-[#202020] p-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-white/70">
                    Spin duration
                  </label>

                  <select
                    value={
                      spinDuration
                    }
                    onChange={(
                      event,
                    ) =>
                      setSpinDuration(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      )
                    }
                    className="h-9 w-full rounded border border-white/15 bg-[#151515] px-2 text-xs text-white outline-none"
                  >
                    <option value={4000}>
                      4 seconds
                    </option>

                    <option value={6500}>
                      6.5 seconds
                    </option>

                    <option value={9000}>
                      9 seconds
                    </option>

                    <option value={12000}>
                      12 seconds
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-white/70">
                    Spin revolutions
                  </label>

                  <select
                    value={
                      spinRevolutions
                    }
                    onChange={(
                      event,
                    ) =>
                      setSpinRevolutions(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      )
                    }
                    className="h-9 w-full rounded border border-white/15 bg-[#151515] px-2 text-xs text-white outline-none"
                  >
                    <option value={3}>
                      3 rotations
                    </option>

                    <option value={5}>
                      5 rotations
                    </option>

                    <option value={6}>
                      6 rotations
                    </option>

                    <option value={8}>
                      8 rotations
                    </option>

                    <option value={10}>
                      10 rotations
                    </option>
                  </select>
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

        {/* more menu */}
        {showMore && (
          <div className="absolute right-2 top-[48px] z-50 w-48 rounded-lg border border-white/15 bg-[#242424] p-1.5 shadow-2xl">
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
