import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  ChevronDown,
  Clipboard,
  ImagePlus,
  Maximize2,
  MoreHorizontal,
  Plus,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
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
  "#65b7e7",
  "#b879cf",
  "#f5d45d",
  "#62d19a",
]

const DEFAULT_NAMES = [
  "Ali",
  "Beatriz",
  "Charles",
  "Diya",
  "Eric",
  "Fatima",
  "Gabriel",
  "Hanna",
]

/*
 * spin-wheel uses degrees per second.
 *
 * A low idle speed gives the same subtle continuous movement
 * as Wheel of Names rather than looking like a normal spin.
 */
const IDLE_SPEED = 7
const WIN_SPIN_DURATION = 5000
const WIN_REVOLUTIONS = 6

function createEntries(names: string[]): WheelEntry[] {
  return names.map((label, index) => ({
    id: `${Date.now()}-${index}-${Math.random()
      .toString(36)
      .slice(2, 9)}`,
    label,
    color: COLORS[index % COLORS.length],
    hidden: false,
  }))
}

function normalizeNames(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function createRandomId(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

export default function SpinWheel() {
  const wheelContainerRef =
    useRef<HTMLDivElement | null>(null)

  const wheelRef = useRef<Wheel | null>(null)

  const isSpinningRef =
    useRef(false)

  const idleRotationRef =
    useRef(false)

  const idleRestartTimerRef =
    useRef<number | null>(null)

  const hideSelectedRef =
    useRef(false)

  const entriesRef =
    useRef<WheelEntry[]>([])

  const visibleEntriesRef =
    useRef<WheelEntry[]>([])

  const [entries, setEntries] =
    useState<WheelEntry[]>(() =>
      createEntries(DEFAULT_NAMES),
    )

  const [results, setResults] =
    useState<SpinResult[]>([])

  const [activeTab, setActiveTab] =
    useState<"entries" | "results">(
      "entries",
    )

  const [isSpinning, setIsSpinning] =
    useState(false)

  const [pointerColor, setPointerColor] =
    useState("#ffffff")

  const [showAdvanced, setShowAdvanced] =
    useState(false)

  const [showMenu, setShowMenu] =
    useState(false)

  const [newEntry, setNewEntry] =
    useState("")

  const [fullscreen, setFullscreen] =
    useState(false)

  const [spinDuration, setSpinDuration] =
    useState(WIN_SPIN_DURATION)

  const [spinRevolutions, setSpinRevolutions] =
    useState(WIN_REVOLUTIONS)

  const [hideSelected, setHideSelected] =
    useState(false)

  const visibleEntries = entries.filter(
    (entry) => !entry.hidden,
  )

  entriesRef.current = entries
  visibleEntriesRef.current =
    visibleEntries

  hideSelectedRef.current =
    hideSelected

  /*
   * Keep the pointer color synced with the
   * segment currently underneath it.
   */
  const updatePointerColor = useCallback(
    (
      index: number,
      currentEntries: WheelEntry[],
    ) => {
      const entry =
        currentEntries[index]

      setPointerColor(
        entry?.color ?? "#ffffff",
      )
    },
    [],
  )

  /*
   * Cancel only the delayed restart.
   *
   * We deliberately do NOT have a stopIdleRotation
   * function anymore. The wheel is stopped directly
   * with wheel.stop() whenever a real spin starts.
   *
   * This fixes TS6133 because there is no unused
   * stopIdleRotation function.
   */
  const clearIdleRestartTimer =
    useCallback(() => {
      if (
        idleRestartTimerRef.current !== null
      ) {
        window.clearTimeout(
          idleRestartTimerRef.current,
        )

        idleRestartTimerRef.current =
          null
      }
    }, [])

  /*
   * Start the subtle continuous idle rotation.
   */
  const startIdleRotation =
    useCallback(() => {
      const wheel =
        wheelRef.current

      if (
        !wheel ||
        isSpinningRef.current ||
        visibleEntriesRef.current.length ===
          0
      ) {
        return
      }

      clearIdleRestartTimer()

      /*
       * spin() with rotationResistance 0
       * continues indefinitely.
       */
      idleRotationRef.current = true
      wheel.rotationResistance = 0
      wheel.rotationSpeedMax = 160
      wheel.spin(IDLE_SPEED)
    }, [clearIdleRestartTimer])

  /*
   * Schedule idle rotation after a winner.
   */
  const scheduleIdleRotation =
    useCallback(
      (delay: number) => {
        clearIdleRestartTimer()

        idleRestartTimerRef.current =
          window.setTimeout(() => {
            idleRestartTimerRef.current =
              null

            if (
              !isSpinningRef.current &&
              visibleEntriesRef.current
                .length > 0
            ) {
              idleRotationRef.current =
                false

              startIdleRotation()
            }
          }, delay)
      },
      [
        clearIdleRestartTimer,
        startIdleRotation,
      ],
    )

  /*
   * Build the Wheel instance.
   */
  useEffect(() => {
    const container =
      wheelContainerRef.current

    if (!container) {
      return
    }

    /*
     * Prevent duplicate canvases if React
     * remounts this effect.
     */
    container.innerHTML = ""

    const initialEntries =
      visibleEntriesRef.current

    const wheel = new Wheel(
      container,
      {
        items: initialEntries.map(
          (entry) => ({
            label: entry.label,
            backgroundColor:
              entry.color,
            labelColor: "#111111",
          }),
        ),

        /*
         * 90 degrees is the right side of the
         * wheel in spin-wheel's coordinate system.
         */
        pointerAngle: 90,

        /*
         * Wheel occupies 91% of the container.
         * The CSS pointer below uses the same
         * radius so its tip touches the wheel.
         */
        radius: 0.91,

        lineWidth: 1,

        lineColor:
          "rgba(255,255,255,0.30)",

        /*
         * Keep labels upright relative to their
         * wheel segment. As the wheel rotates,
         * the labels rotate around the wheel too.
         */
        itemLabelRotation: 0,

        itemLabelAlign: "center",

        itemLabelRadius: 0.67,

        itemLabelRadiusMax: 0.19,

        itemLabelFontSizeMax: 30,

        itemLabelStrokeWidth: 0,

        itemLabelFont:
          "Arial, Helvetica, sans-serif",

        itemLabelColors: ["#111111"],

        pixelRatio: Math.min(
          2,
          window.devicePixelRatio || 1,
        ),

        rotationResistance: 0,

        rotationSpeedMax: 160,

        onCurrentIndexChange: (
          event: {
            currentIndex: number
          },
        ) => {
          updatePointerColor(
            event.currentIndex,
            visibleEntriesRef.current,
          )
        },

        onRest: (
          event: {
            currentIndex: number
          },
        ) => {
          /*
           * Ignore the rest event caused by
           * manually stopping the idle wheel.
           */
          if (!isSpinningRef.current) {
            return
          }

          isSpinningRef.current = false
          idleRotationRef.current =
            false

          setIsSpinning(false)

          const currentEntries =
            visibleEntriesRef.current

          const winner =
            currentEntries[
              event.currentIndex
            ]

          if (!winner) {
            scheduleIdleRotation(400)
            return
          }

          setResults((current) => [
            {
              id: createRandomId(),
              label: winner.label,
              timestamp: Date.now(),
            },
            ...current,
          ])

          if (hideSelectedRef.current) {
            setEntries((current) =>
              current.map((entry) =>
                entry.id === winner.id
                  ? {
                      ...entry,
                      hidden: true,
                    }
                  : entry,
              ),
            )
          }

          toast.success(
            `${winner.label} won!`,
          )

          scheduleIdleRotation(700)
        },
      },
    )

    wheelRef.current = wheel

    if (initialEntries.length > 0) {
      updatePointerColor(
        wheel.getCurrentIndex(),
        initialEntries,
      )
    }

    /*
     * Start idle rotation after the wheel has
     * actually been mounted.
     */
    requestAnimationFrame(() => {
      if (
        wheelRef.current === wheel &&
        !isSpinningRef.current &&
        visibleEntriesRef.current.length >
          0
      ) {
        idleRotationRef.current =
          false

        startIdleRotation()
      }
    })

    return () => {
      clearIdleRestartTimer()

      wheel.stop()

      idleRotationRef.current =
        false

      if (wheelRef.current === wheel) {
        wheelRef.current = null
      }

      wheel.remove()
    }
  }, [
    clearIdleRestartTimer,
    scheduleIdleRotation,
    startIdleRotation,
    updatePointerColor,
  ])

  /*
   * Update wheel items whenever entries change.
   *
   * Important:
   * Setting wheel.items recreates the segments.
   * That can stop the current idle animation,
   * so we explicitly restart it afterwards.
   */
  useEffect(() => {
    const wheel =
      wheelRef.current

    if (!wheel) {
      return
    }

    const visible =
      entries.filter(
        (entry) => !entry.hidden,
      )

    visibleEntriesRef.current =
      visible

    /*
     * Stop the old idle animation before
     * replacing the wheel items.
     */
    if (
      !isSpinningRef.current
    ) {
      wheel.stop()
      idleRotationRef.current =
        false
    }

    wheel.items = visible.map(
      (entry) => ({
        label: entry.label,
        backgroundColor:
          entry.color,
        labelColor: "#111111",
      }),
    )

    if (visible.length === 0) {
      setPointerColor("#ffffff")
      return
    }

    const currentIndex =
      wheel.getCurrentIndex()

    updatePointerColor(
      currentIndex,
      visible,
    )

    /*
     * Always restart idle after changing
     * the items.
     */
    if (
      !isSpinningRef.current
    ) {
      requestAnimationFrame(() => {
        if (
          !isSpinningRef.current &&
          wheelRef.current === wheel &&
          visibleEntriesRef.current
            .length > 0
        ) {
          idleRotationRef.current =
            false

          startIdleRotation()
        }
      })
    }
  }, [
    entries,
    startIdleRotation,
    updatePointerColor,
  ])

  /*
   * Keep the wheel responsive when the page
   * or sidebar changes size.
   */
  useEffect(() => {
    const container =
      wheelContainerRef.current

    const wheel =
      wheelRef.current

    if (!container || !wheel) {
      return
    }

    const resizeObserver =
      new ResizeObserver(() => {
        wheel.resize()
      })

    resizeObserver.observe(
      container,
    )

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  /*
   * Main spin function.
   */
  const spin = useCallback(() => {
    const wheel =
      wheelRef.current

    const currentEntries =
      visibleEntriesRef.current

    if (!wheel) {
      return
    }

    if (isSpinningRef.current) {
      return
    }

    if (currentEntries.length === 0) {
      toast.error(
        "Add at least one entry before spinning.",
      )
      return
    }

    clearIdleRestartTimer()

    /*
     * Stop the continuous idle rotation.
     */
    wheel.stop()

    idleRotationRef.current =
      false

    isSpinningRef.current =
      true

    setIsSpinning(true)

    /*
     * Pick the winner before spinning.
     */
    const winnerIndex =
      Math.floor(
        Math.random() *
          currentEntries.length,
      )

    updatePointerColor(
      winnerIndex,
      currentEntries,
    )

    wheel.spinToItem(
      winnerIndex,
      spinDuration,
      true,
      spinRevolutions,
      1,
      (progress: number) =>
        1 -
        Math.pow(1 - progress, 4),
    )
  }, [
    clearIdleRestartTimer,
    spinDuration,
    spinRevolutions,
    updatePointerColor,
  ])

  /*
   * Ctrl + Enter / Cmd + Enter.
   */
  useEffect(() => {
    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key === "Enter"
        ) {
          event.preventDefault()
          spin()
        }
      }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [spin])

  /*
   * Prevent the wheel's click-to-spin
   * from firing when a control is clicked.
   */
  const handleMainClick =
    useCallback(
      (
        event: React.MouseEvent<HTMLDivElement>,
      ) => {
        const target =
          event.target as HTMLElement

        if (
          target.closest(
            "button, input, textarea, select, a",
          )
        ) {
          return
        }

        spin()
      },
      [spin],
    )

  /*
   * Replace the entries from the textarea.
   */
  const updateEntriesFromText =
    useCallback(
      (value: string) => {
        const names =
          normalizeNames(value)

        setEntries((current) => {
          return names.map(
            (name, index) => {
              const existing =
                current.find(
                  (entry) =>
                    entry.label === name,
                )

              return (
                existing ?? {
                  id: createRandomId(),
                  label: name,
                  color:
                    COLORS[
                      index %
                        COLORS.length
                    ],
                  hidden: false,
                }
              )
            },
          )
        })
      },
      [],
    )

  const addEntry = useCallback(() => {
    const label =
      newEntry.trim()

    if (!label) {
      return
    }

    setEntries((current) => [
      ...current,
      {
        id: createRandomId(),
        label,
        color:
          COLORS[
            current.length %
              COLORS.length
          ],
        hidden: false,
      },
    ])

    setNewEntry("")
  }, [newEntry])

  const removeEntry =
    useCallback((id: string) => {
      setEntries((current) =>
        current.filter(
          (entry) =>
            entry.id !== id,
        ),
      )
    }, [])

  const shuffleEntries =
    useCallback(() => {
      if (isSpinningRef.current) {
        return
      }

      setEntries((current) => {
        const copy = [...current]

        for (
          let index =
            copy.length - 1;
          index > 0;
          index--
        ) {
          const randomIndex =
            Math.floor(
              Math.random() *
                (index + 1),
            )

          ;[
            copy[index],
            copy[randomIndex],
          ] = [
            copy[randomIndex],
            copy[index],
          ]
        }

        return copy
      })
    }, [])

  const sortEntries =
    useCallback(() => {
      if (isSpinningRef.current) {
        return
      }

      setEntries((current) =>
        [...current].sort(
          (a, b) =>
            a.label.localeCompare(
              b.label,
              undefined,
              {
                numeric: true,
                sensitivity: "base",
              },
            ),
        ),
      )
    }, [])

  const clearEntries =
    useCallback(() => {
      if (isSpinningRef.current) {
        return
      }

      setEntries([])
      setResults([])
      setNewEntry("")
    }, [])

  const restoreDefaults =
    useCallback(() => {
      if (isSpinningRef.current) {
        return
      }

      setEntries(
        createEntries(DEFAULT_NAMES),
      )

      setResults([])

      setSpinDuration(
        WIN_SPIN_DURATION,
      )

      setSpinRevolutions(
        WIN_REVOLUTIONS,
      )

      setHideSelected(false)

      setShowMenu(false)
    }, [])

  const copyEntries =
    useCallback(async () => {
      const text =
        entries
          .filter(
            (entry) =>
              !entry.hidden,
          )
          .map(
            (entry) =>
              entry.label,
          )
          .join("\n")

      try {
        await navigator.clipboard.writeText(
          text,
        )

        toast.success(
          "Entries copied to clipboard.",
        )
      } catch {
        toast.error(
          "Unable to copy entries.",
        )
      }

      setShowMenu(false)
    }, [entries])

  const toggleFullscreen =
    useCallback(async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
          setFullscreen(true)
        } else {
          await document.exitFullscreen()
          setFullscreen(false)
        }
      } catch {
        toast.error(
          "Fullscreen is not available.",
        )
      }
    }, [])

  /*
   * Keep fullscreen state correct if the user
   * exits with Escape.
   */
  useEffect(() => {
    const handleFullscreen =
      () => {
        setFullscreen(
          Boolean(
            document.fullscreenElement,
          ),
        )
      }

    document.addEventListener(
      "fullscreenchange",
      handleFullscreen,
    )

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreen,
      )
    }
  }, [])

  /*
   * Cleanup timers.
   */
  useEffect(() => {
    return () => {
      clearIdleRestartTimer()

      const wheel =
        wheelRef.current

      if (wheel) {
        wheel.stop()
        wheel.remove()
      }

      wheelRef.current = null
    }
  }, [clearIdleRestartTimer])

  const textareaValue =
    entries
      .map(
        (entry) =>
          entry.label,
      )
      .join("\n")

  return (
    <div
      className={[
        "min-h-screen w-full overflow-hidden",
        "bg-[#090909] text-white",
        fullscreen
          ? "fixed inset-0 z-[9999]"
          : "",
      ].join(" ")}
      onClick={handleMainClick}
    >
      <div className="flex h-screen min-h-[700px] w-full">
        {/* ─────────────────────────────
            MAIN WHEEL AREA
        ───────────────────────────── */}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.035] blur-[130px]" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.025),transparent_55%)]" />
          </div>

          {/* Top-left type button */}
          <div className="absolute left-5 top-5 z-50">
            <button
              type="button"
              title="Text entries"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171717] text-white shadow-lg transition hover:border-white/20 hover:bg-[#202020]"
            >
              <Type size={18} />
            </button>
          </div>

          {/* Top-right utility */}
          <div className="absolute right-5 top-5 z-50">
            <button
              type="button"
              title="More options"
              onClick={(event) => {
                event.stopPropagation()
                setShowMenu(
                  (current) => !current,
                )
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171717] text-white shadow-lg transition hover:border-white/20 hover:bg-[#202020]"
            >
              <MoreHorizontal
                size={19}
              />
            </button>

            {showMenu && (
              <div
                onClick={(event) =>
                  event.stopPropagation()
                }
                className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#181818] p-1.5 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={restoreDefaults}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/5"
                >
                  <Sparkles
                    size={16}
                  />
                  Restore defaults
                </button>

                <button
                  type="button"
                  onClick={copyEntries}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/5"
                >
                  <Clipboard
                    size={16}
                  />
                  Copy entries
                </button>

                <button
                  type="button"
                  onClick={clearEntries}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/10"
                >
                  <Trash2
                    size={16}
                  />
                  Clear entries
                </button>

                <div className="my-1 border-t border-white/5" />

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/5"
                >
                  <Maximize2
                    size={16}
                  />
                  {fullscreen
                    ? "Exit fullscreen"
                    : "Fullscreen"}
                </button>
              </div>
            )}
          </div>

          {/* Wheel content */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-12">
            <div className="relative aspect-square w-[min(76vh,calc(100vw-430px),720px)] min-w-[420px] max-w-[720px]">
              {/* Wheel shadow */}
              <div className="pointer-events-none absolute inset-[5%] rounded-full bg-black/60 blur-[35px]" />

              {/* Actual spin-wheel container */}
              <div
                ref={wheelContainerRef}
                className="relative z-10 h-full w-full overflow-visible"
              />

              {/* ───────────────────────
                  FIXED RIGHT POINTER
                  ───────────────────────

                  radius = 0.91

                  The wheel radius therefore occupies
                  45.5% of the container width from
                  the center.

                  50% + 45.5% = 95.5%.

                  The left edge/tip of the triangle is
                  placed exactly there, so the arrow
                  touches the wheel instead of floating
                  at the edge of the page.
              */}
              <div
                className="pointer-events-none absolute left-[95.5%] top-1/2 z-[80] -translate-y-1/2"
                style={{
                  filter:
                    "drop-shadow(0 3px 8px rgba(0,0,0,.65))",
                }}
              >
                <div
                  className="h-0 w-0 border-y-[23px] border-l-0 border-r-[48px] border-y-transparent"
                  style={{
                    borderRightColor:
                      pointerColor,
                    transition:
                      "border-right-color 120ms ease-out",
                  }}
                />
              </div>

              {/* Center overlay */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                <div className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-bold text-black shadow-[0_5px_25px_rgba(0,0,0,.25)]">
                  {isSpinning
                    ? "Spinning..."
                    : "Click to spin"}
                </div>

                <div className="mt-2 rounded-full bg-black/50 px-3 py-1 text-[10px] font-medium text-white/60 backdrop-blur-md">
                  or press ctrl+enter
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ─────────────────────────────
            RIGHT SIDEBAR
        ───────────────────────────── */}

        <aside
          className="relative z-[100] flex h-full w-[380px] shrink-0 flex-col border-l border-white/10 bg-[#111111]"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          {/* Tabs */}
          <div className="flex h-[61px] shrink-0 items-center border-b border-white/10 px-4">
            <div className="flex items-center rounded-lg bg-[#191919] p-1">
              <button
                type="button"
                onClick={() =>
                  setActiveTab("entries")
                }
                className={[
                  "rounded-md px-4 py-2 text-sm font-semibold transition",
                  activeTab ===
                  "entries"
                    ? "bg-[#292929] text-white shadow-sm"
                    : "text-white/45 hover:text-white/75",
                ].join(" ")}
              >
                Entries
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveTab("results")
                }
                className={[
                  "rounded-md px-4 py-2 text-sm font-semibold transition",
                  activeTab ===
                  "results"
                    ? "bg-[#292929] text-white shadow-sm"
                    : "text-white/45 hover:text-white/75",
                ].join(" ")}
              >
                Results
              </button>
            </div>

            <div className="ml-auto">
              <button
                type="button"
                title="More"
                onClick={() =>
                  setShowMenu(
                    (current) => !current,
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/5 hover:text-white"
              >
                <MoreHorizontal
                  size={18}
                />
              </button>
            </div>
          </div>

          {activeTab ===
          "entries" ? (
            <>
              {/* Toolbar */}
              <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <button
                  type="button"
                  title="Shuffle"
                  disabled={isSpinning}
                  onClick={shuffleEntries}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-[#191919] px-3 text-xs font-semibold text-white/75 transition hover:bg-[#222] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Shuffle
                    size={14}
                  />
                  Shuffle
                </button>

                <button
                  type="button"
                  title="Sort"
                  disabled={isSpinning}
                  onClick={sortEntries}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-[#191919] px-3 text-xs font-semibold text-white/75 transition hover:bg-[#222] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronDown
                    size={14}
                  />
                  Sort
                </button>

                <button
                  type="button"
                  title="Add image"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#191919] text-white/60 transition hover:bg-[#222] hover:text-white"
                >
                  <ImagePlus
                    size={15}
                  />
                </button>

                <button
                  type="button"
                  title="Advanced"
                  onClick={() =>
                    setShowAdvanced(
                      (current) =>
                        !current,
                    )
                  }
                  className={[
                    "ml-auto flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition",
                    showAdvanced
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                      : "border-white/10 bg-[#191919] text-white/60 hover:bg-[#222] hover:text-white",
                  ].join(" ")}
                >
                  Advanced
                </button>
              </div>

              {/* Advanced */}
              {showAdvanced && (
                <div className="shrink-0 border-b border-white/10 bg-[#0e0e0e] px-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-white/45">
                        Spin duration
                      </span>

                      <div className="flex items-center rounded-lg border border-white/10 bg-[#181818]">
                        <input
                          type="number"
                          min={1000}
                          max={30000}
                          step={500}
                          value={
                            spinDuration
                          }
                          onChange={(
                            event,
                          ) =>
                            setSpinDuration(
                              Math.min(
                                30000,
                                Math.max(
                                  1000,
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ) || 1000,
                                ),
                              ),
                            )
                          }
                          className="h-9 w-full bg-transparent px-3 text-sm text-white outline-none"
                        />

                        <span className="pr-3 text-[10px] text-white/35">
                          ms
                        </span>
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-white/45">
                        Revolutions
                      </span>

                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={
                          spinRevolutions
                        }
                        onChange={(
                          event,
                        ) =>
                          setSpinRevolutions(
                            Math.min(
                              20,
                              Math.max(
                                1,
                                Number(
                                  event
                                    .target
                                    .value,
                                ) || 1,
                              ),
                            ),
                          )
                        }
                        className="h-9 w-full rounded-lg border border-white/10 bg-[#181818] px-3 text-sm text-white outline-none focus:border-blue-500/50"
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center gap-3">
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
                      className="h-4 w-4 accent-blue-500"
                    />

                    <span>
                      <span className="block text-xs font-semibold text-white/80">
                        Hide selected
                      </span>

                      <span className="block text-[10px] text-white/35">
                        Remove the winner from future spins.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {/* Entries editor */}
              <div className="min-h-0 flex-1 p-4">
                <textarea
                  value={
                    textareaValue
                  }
                  disabled={isSpinning}
                  onChange={(
                    event,
                  ) =>
                    updateEntriesFromText(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Enter one entry per line..."
                  spellCheck={false}
                  className="h-full min-h-[280px] w-full resize-none rounded-xl border border-white/10 bg-[#181818] p-4 text-sm leading-6 text-white outline-none transition placeholder:text-white/20 focus:border-blue-500/40"
                />
              </div>

              {/* Add entry */}
              <div className="shrink-0 border-t border-white/10 p-4">
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
                    placeholder="Add an entry..."
                    className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#191919] px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-blue-500/50"
                  />

                  <button
                    type="button"
                    onClick={
                      addEntry
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition hover:bg-blue-400"
                  >
                    <Plus
                      size={18}
                    />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-white/30">
                    {
                      visibleEntries.length
                    }{" "}
                    {visibleEntries.length ===
                    1
                      ? "entry"
                      : "entries"}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setEntries(
                        (current) =>
                          current.map(
                            (
                              entry,
                            ) => ({
                              ...entry,
                              hidden:
                                false,
                            }),
                          ),
                      )
                    }
                    className="text-[11px] font-medium text-blue-400 transition hover:text-blue-300"
                  >
                    Show all
                  </button>
                </div>
              </div>

              {/* Spin button */}
              <div className="shrink-0 border-t border-white/10 p-4">
                <button
                  type="button"
                  disabled={
                    isSpinning ||
                    visibleEntries.length ===
                      0
                  }
                  onClick={spin}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-black shadow-lg transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles
                    size={17}
                  />

                  {isSpinning
                    ? "Spinning..."
                    : "Spin the wheel"}
                </button>
              </div>
            </>
          ) : (
            /* ─────────────────────
               RESULTS
            ───────────────────── */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Results
                  </h2>

                  <p className="mt-0.5 text-[11px] text-white/35">
                    Previous winners
                  </p>
                </div>

                {results.length >
                  0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setResults(
                        [],
                      )
                    }
                    className="text-[11px] font-semibold text-red-400 transition hover:text-red-300"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {results.length ===
                0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/25">
                      <Trophy
                        size={21}
                      />
                    </div>

                    <p className="text-sm font-semibold text-white/60">
                      No results yet
                    </p>

                    <p className="mt-1 max-w-[220px] text-xs leading-5 text-white/30">
                      Spin the wheel and your winners will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {results.map(
                      (
                        result,
                        index,
                      ) => (
                        <div
                          key={
                            result.id
                          }
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#181818] p-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-400">
                            {index +
                              1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {
                                result.label
                              }
                            </p>

                            <p className="mt-0.5 text-[10px] text-white/30">
                              {new Date(
                                result.timestamp,
                              ).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute:
                                    "2-digit",
                                },
                              )}
                            </p>
                          </div>

                          <Trophy
                            size={15}
                            className="shrink-0 text-white/20"
                          />
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-white/10 p-4">
                <button
                  type="button"
                  disabled={
                    isSpinning ||
                    visibleEntries.length ===
                      0
                  }
                  onClick={spin}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles
                    size={17}
                  />
                  Spin the wheel
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
