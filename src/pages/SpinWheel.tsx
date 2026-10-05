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

const IDLE_SPEED = 18
const WIN_SPIN_DURATION = 5000
const WIN_REVOLUTIONS = 6

function createEntries(names: string[]): WheelEntry[] {
  return names.map((name, index) => ({
    id: `${Date.now()}-${index}-${Math.random()
      .toString(36)
      .slice(2)}`,
    label: name,
    color: COLORS[index % COLORS.length],
    hidden: false,
  }))
}

export default function SpinWheel() {
  const wheelContainerRef = useRef<HTMLDivElement | null>(null)
  const wheelRef = useRef<Wheel | null>(null)

  const isSpinningRef = useRef(false)
  const idleRotationRef = useRef(false)
  const hideSelectedRef = useRef(false)

  const visibleEntriesRef = useRef<WheelEntry[]>([])
  const entriesRef = useRef<WheelEntry[]>([])

  const [entries, setEntries] = useState<WheelEntry[]>(() =>
    createEntries(DEFAULT_NAMES),
  )

  const [results, setResults] = useState<SpinResult[]>([])
  const [activeTab, setActiveTab] = useState<"entries" | "results">(
    "entries",
  )
  const [isSpinning, setIsSpinning] = useState(false)
  const [pointerColor, setPointerColor] = useState("#ffffff")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [newEntry, setNewEntry] = useState("")
  const [fullscreen, setFullscreen] = useState(false)

  const updatePointerColor = useCallback(
    (index: number, source?: WheelEntry[]) => {
      const currentEntries = source ?? visibleEntriesRef.current
      const entry = currentEntries[index]

      if (entry) {
        setPointerColor(entry.color)
      }
    },
    [],
  )

  const startIdleRotation = useCallback(() => {
    const wheel = wheelRef.current

    if (
      !wheel ||
      isSpinningRef.current ||
      visibleEntriesRef.current.length === 0 ||
      idleRotationRef.current
    ) {
      return
    }

    idleRotationRef.current = true

    wheel.rotationResistance = 0
    wheel.spin(IDLE_SPEED)
  }, [])

  const stopIdleRotation = useCallback(() => {
    const wheel = wheelRef.current

    if (!wheel) {
      return
    }

    idleRotationRef.current = false
    wheel.stop()
  }, [])

  /*
   * Keep the refs synchronized with React state.
   *
   * This is important because the Wheel instance is intentionally
   * NOT recreated when Shuffle or Sort changes the entries.
   */
  useEffect(() => {
    entriesRef.current = entries

    const visibleEntries = entries.filter(
      (entry) => !entry.hidden,
    )

    visibleEntriesRef.current = visibleEntries
  }, [entries])

  /*
   * CREATE THE WHEEL ONCE.
   *
   * Do not put `entries`, `isSpinning`, `results`, etc. in this
   * dependency array.
   *
   * Recreating the Wheel was the reason Shuffle/Sort used to
   * stop/reset the rotation.
   */
  useEffect(() => {
    const container = wheelContainerRef.current

    if (!container || wheelRef.current) {
      return
    }

    const initialEntries = entriesRef.current.filter(
      (entry) => !entry.hidden,
    )

    visibleEntriesRef.current = initialEntries

    const wheel = new Wheel(container, {
      items: initialEntries.map((entry) => ({
        label: entry.label,
        backgroundColor: entry.color,
        labelColor: "#111111",
      })),

      /*
       * Our DOM pointer is on the RIGHT side of the wheel.
       */
      pointerAngle: 90,

      radius: 0.91,

      lineWidth: 1,
      lineColor: "rgba(255,255,255,0.24)",

      /*
       * Text
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

      /*
       * Keep the canvas sharp without creating a huge
       * high-DPI rendering performance hit.
       */
      pixelRatio:
        typeof window !== "undefined"
          ? Math.min(
              2,
              window.devicePixelRatio || 1,
            )
          : 1,

      /*
       * 0 = continuous spinning.
       */
      rotationResistance: 0,

      rotationSpeedMax: 160,

      /*
       * Fires whenever the pointer enters another segment.
       */
      onCurrentIndexChange: (event) => {
        const currentEntries =
          visibleEntriesRef.current

        updatePointerColor(
          event.currentIndex,
          currentEntries,
        )
      },

      /*
       * Winner spin finished.
       */
      onRest: (event) => {
        if (!isSpinningRef.current) {
          return
        }

        isSpinningRef.current = false
        idleRotationRef.current = false

        setIsSpinning(false)

        const currentEntries =
          visibleEntriesRef.current

        const winner =
          currentEntries[event.currentIndex]

        if (!winner) {
          window.setTimeout(() => {
            startIdleRotation()
          }, 400)

          return
        }

        setResults((current) => [
          {
            id: winner.id,
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

        toast.success(`${winner.label} won!`)

        /*
         * Give the result a tiny moment before returning
         * to the continuous idle rotation.
         */
        window.setTimeout(() => {
          startIdleRotation()
        }, 700)
      },
    })

    wheelRef.current = wheel

    const initialIndex =
      wheel.getCurrentIndex()

    updatePointerColor(
      initialIndex,
      initialEntries,
    )

    startIdleRotation()

    return () => {
      /*
       * Only destroy the wheel when this component actually
       * unmounts.
       *
       * NEVER destroy it just because entries changed.
       */
      wheel.stop()
      wheel.remove()
      wheelRef.current = null
      idleRotationRef.current = false
    }
  }, [
    startIdleRotation,
    updatePointerColor,
  ])

  /*
   * UPDATE THE EXISTING WHEEL WHEN ENTRIES CHANGE.
   *
   * This is the important Shuffle/Sort fix.
   *
   * We change `wheel.items` instead of doing:
   *
   *     new Wheel(...)
   *
   * This means the existing rotation continues.
   */
  useEffect(() => {
    const wheel = wheelRef.current

    if (!wheel) {
      return
    }

    const visibleEntries = entries.filter(
      (entry) => !entry.hidden,
    )

    visibleEntriesRef.current =
      visibleEntries

    wheel.items = visibleEntries.map(
      (entry) => ({
        label: entry.label,
        backgroundColor: entry.color,
        labelColor: "#111111",
      }),
    )

    if (visibleEntries.length === 0) {
      setPointerColor("#ffffff")
      return
    }

    /*
     * Get whichever item is currently underneath
     * the pointer after the item update.
     */
    const currentIndex =
      wheel.getCurrentIndex()

    updatePointerColor(
      currentIndex,
      visibleEntries,
    )
  }, [entries, updatePointerColor])

  /*
   * SPIN
   */
  const spin = useCallback(() => {
    const wheel = wheelRef.current

    if (!wheel) {
      return
    }

    if (isSpinningRef.current) {
      return
    }

    const currentEntries =
      visibleEntriesRef.current

    if (currentEntries.length === 0) {
      toast.error("Add at least one entry first.")
      return
    }

    /*
     * Stop the infinite idle momentum before starting
     * the controlled winner animation.
     */
    wheel.stop()

    idleRotationRef.current = false
    isSpinningRef.current = true

    setIsSpinning(true)

    /*
     * Choose the winner.
     *
     * The wheel is then told to animate to exactly that
     * item for five seconds.
     */
    const winnerIndex = Math.floor(
      Math.random() * currentEntries.length,
    )

    /*
     * Make sure the pointer colour immediately represents
     * the target segment.
     */
    updatePointerColor(
      winnerIndex,
      currentEntries,
    )

    /*
     * Smooth quartic ease-out.
     *
     * Fast at the beginning and progressively smoother
     * as it approaches the winner.
     */
    const easeOutQuart = (
      progress: number,
    ) => {
      return 1 - Math.pow(1 - progress, 4)
    }

    wheel.spinToItem(
      winnerIndex,
      WIN_SPIN_DURATION,
      true,
      WIN_REVOLUTIONS,
      1,
      easeOutQuart,
    )
  }, [updatePointerColor])

  /*
   * CTRL + ENTER
   */
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.ctrlKey &&
        event.key === "Enter"
      ) {
        event.preventDefault()

        if (!isSpinningRef.current) {
          spin()
        }
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
   * SHUFFLE
   *
   * This only changes React state.
   *
   * The existing Wheel instance remains alive.
   */
  const shuffleEntries = useCallback(() => {
    if (isSpinningRef.current) {
      toast.info(
        "Wait for the current spin to finish.",
      )
      return
    }

    setEntries((current) => {
      const shuffled = [...current]

      for (
        let index = shuffled.length - 1;
        index > 0;
        index--
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
  }, [])

  /*
   * SORT
   *
   * Again, we never stop the wheel here.
   */
  const sortEntries = useCallback(() => {
    if (isSpinningRef.current) {
      toast.info(
        "Wait for the current spin to finish.",
      )
      return
    }

    setEntries((current) =>
      [...current].sort((a, b) =>
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

  /*
   * TEXTAREA EDITING
   */
  const updateEntriesFromText = useCallback(
    (value: string) => {
      const lines = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      setEntries((current) => {
        return lines.map((label, index) => {
          const existing =
            current[index]

          return {
            id:
              existing?.id ??
              `${Date.now()}-${index}-${Math.random()
                .toString(36)
                .slice(2)}`,
            label,
            color:
              existing?.color ??
              COLORS[index % COLORS.length],
            hidden:
              existing?.hidden ?? false,
          }
        })
      })
    },
    [],
  )

  /*
   * ADD ENTRY
   */
  const addEntry = useCallback(() => {
    const label = newEntry.trim()

    if (!label) {
      return
    }

    setEntries((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        label,
        color:
          COLORS[current.length %
            COLORS.length],
        hidden: false,
      },
    ])

    setNewEntry("")
  }, [newEntry])

  /*
   * REMOVE ALL
   */
  const clearEntries = useCallback(() => {
    if (isSpinningRef.current) {
      toast.info(
        "Wait for the current spin to finish.",
      )
      return
    }

    setEntries([])
  }, [])

  /*
   * RESTORE DEFAULTS
   */
  const restoreDefaults = useCallback(() => {
    if (isSpinningRef.current) {
      toast.info(
        "Wait for the current spin to finish.",
      )
      return
    }

    setEntries(
      createEntries(DEFAULT_NAMES),
    )

    toast.success(
      "Default entries restored.",
    )
  }, [])

  /*
   * COPY ENTRIES
   */
  const copyEntries = useCallback(() => {
    const text = entries
      .filter((entry) => !entry.hidden)
      .map((entry) => entry.label)
      .join("\n")

    if (!navigator.clipboard) {
      toast.error(
        "Clipboard access is unavailable.",
      )
      return
    }

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(
          "Entries copied to clipboard.",
        )
      })
      .catch(() => {
        toast.error(
          "Unable to copy entries.",
        )
      })
  }, [entries])

  /*
   * FULLSCREEN
   */
  const toggleFullscreen = useCallback(() => {
    setFullscreen((current) => !current)
  }, [])

  /*
   * RESULTS CLEAR
   */
  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  const visibleEntries = entries.filter(
    (entry) => !entry.hidden,
  )

  const entryText = visibleEntries
    .map((entry) => entry.label)
    .join("\n")

  return (
    <div
      className={[
        "fixed inset-0 z-40 flex overflow-hidden",
        "bg-[#090909] text-white",
        fullscreen
          ? ""
          : "top-[var(--navbar-height,0px)]",
      ].join(" ")}
    >
      {/* ===================================================== */}
      {/* WHEEL                                                  */}
      {/* ===================================================== */}

      <main
        className="relative min-w-0 flex-1 overflow-hidden"
        onClick={(event) => {
          /*
           * Don't accidentally spin when clicking controls
           * positioned over the wheel.
           */
          const target =
            event.target as HTMLElement

          if (
            target.closest(
              "button,input,textarea,[role='button']",
            )
          ) {
            return
          }

          if (!isSpinningRef.current) {
            spin()
          }
        }}
      >
        {/* Background */}
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-[radial-gradient(circle_at_center,#282828_0%,#151515_52%,#080808_100%)]
          "
        />

        {/* Subtle vignette */}
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-[radial-gradient(circle,transparent_45%,rgba(0,0,0,0.45)_100%)]
          "
        />

        {/* Wheel canvas */}
        <div
          ref={wheelContainerRef}
          className="
            absolute
            inset-0
            h-full
            w-full
          "
        />

        {/* ================================================= */}
        {/* TOP LEFT TYPE BUTTON                              */}
        {/* ================================================= */}

        <button
          type="button"
          aria-label="Wheel text settings"
          className="
            absolute
            left-5
            top-5
            z-[70]
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-black/35
            text-white/85
            shadow-lg
            backdrop-blur-md
            transition
            hover:bg-black/55
            hover:text-white
          "
        >
          <Type className="h-5 w-5" />
        </button>

        {/* ================================================= */}
        {/* CENTER TEXT                                       */}
        {/* ================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-[40]
            flex
            items-center
            justify-center
          "
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="
                text-[25px]
                font-medium
                leading-none
                tracking-[-0.02em]
                text-white
                drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]
              "
            >
              {isSpinning
                ? "Spinning..."
                : "Click to spin"}
            </div>

            {!isSpinning && (
              <div
                className="
                  mt-2
                  text-[13px]
                  font-normal
                  leading-none
                  text-white/75
                  drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]
                "
              >
                or press ctrl+enter
              </div>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* RIGHT POINTER                                     */}
        {/* ================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            right-[-2px]
            top-1/2
            z-[80]
            -translate-y-1/2
          "
        >
          <div
            className="
              h-0
              w-0
              border-y-[24px]
              border-l-0
              border-r-[50px]
              border-y-transparent
              drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]
            "
            style={{
              borderRightColor:
                pointerColor,
              transition:
                "border-right-color 120ms ease-out",
            }}
          />
        </div>

        {/* ================================================= */}
        {/* SPINNING INDICATOR                                */}
        {/* ================================================= */}

        {isSpinning && (
          <div
            className="
              pointer-events-none
              absolute
              bottom-6
              left-1/2
              z-[70]
              -translate-x-1/2
              rounded-full
              border
              border-white/10
              bg-black/45
              px-4
              py-2
              text-xs
              font-medium
              text-white/80
              shadow-lg
              backdrop-blur-md
            "
          >
            Spinning for 5 seconds
          </div>
        )}
      </main>

      {/* ===================================================== */}
      {/* SIDEBAR                                                */}
      {/* ===================================================== */}

      <aside
        className="
          relative
          flex
          w-[330px]
          shrink-0
          flex-col
          border-l
          border-white/10
          bg-[#111111]
          sm:w-[360px]
          lg:w-[390px]
          xl:w-[420px]
        "
      >
        {/* ================================================= */}
        {/* HEADER                                            */}
        {/* ================================================= */}

        <div
          className="
            flex
            h-[58px]
            shrink-0
            items-center
            justify-between
            border-b
            border-white/10
            px-4
          "
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setActiveTab("entries")
              }
              className={[
                "relative px-3 py-4 text-sm font-medium transition",
                activeTab === "entries"
                  ? "text-white"
                  : "text-white/45 hover:text-white/75",
              ].join(" ")}
            >
              Entries

              {activeTab === "entries" && (
                <span
                  className="
                    absolute
                    bottom-0
                    left-3
                    right-3
                    h-[2px]
                    rounded-full
                    bg-white
                  "
                />
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("results")
              }
              className={[
                "relative px-3 py-4 text-sm font-medium transition",
                activeTab === "results"
                  ? "text-white"
                  : "text-white/45 hover:text-white/75",
              ].join(" ")}
            >
              Results

              {results.length > 0 && (
                <span
                  className="
                    ml-1.5
                    rounded-full
                    bg-white/10
                    px-1.5
                    py-0.5
                    text-[10px]
                    text-white/70
                  "
                >
                  {results.length}
                </span>
              )}

              {activeTab === "results" && (
                <span
                  className="
                    absolute
                    bottom-0
                    left-3
                    right-3
                    h-[2px]
                    rounded-full
                    bg-white
                  "
                />
              )}
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowMenu(
                  (current) => !current,
                )
              }
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-lg
                text-white/55
                transition
                hover:bg-white/5
                hover:text-white
              "
              aria-label="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showMenu && (
              <div
                className="
                  absolute
                  right-0
                  top-11
                  z-[100]
                  w-52
                  overflow-hidden
                  rounded-xl
                  border
                  border-white/10
                  bg-[#1a1a1a]
                  p-1
                  shadow-2xl
                "
              >
                <button
                  type="button"
                  onClick={() => {
                    restoreDefaults()
                    setShowMenu(false)
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    text-sm
                    text-white/80
                    transition
                    hover:bg-white/5
                    hover:text-white
                  "
                >
                  <Sparkles className="h-4 w-4" />
                  Restore defaults
                </button>

                <button
                  type="button"
                  onClick={() => {
                    copyEntries()
                    setShowMenu(false)
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    text-sm
                    text-white/80
                    transition
                    hover:bg-white/5
                    hover:text-white
                  "
                >
                  <Clipboard className="h-4 w-4" />
                  Copy entries
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearEntries()
                    setShowMenu(false)
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    text-sm
                    text-white/80
                    transition
                    hover:bg-white/5
                    hover:text-white
                  "
                >
                  <Trash2 className="h-4 w-4" />
                  Clear entries
                </button>

                <div className="my-1 border-t border-white/10" />

                <button
                  type="button"
                  onClick={() => {
                    toggleFullscreen()
                    setShowMenu(false)
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-2.5
                    text-left
                    text-sm
                    text-white/80
                    transition
                    hover:bg-white/5
                    hover:text-white
                  "
                >
                  <Maximize2 className="h-4 w-4" />
                  {fullscreen
                    ? "Exit fullscreen"
                    : "Fullscreen"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* TOOLBAR                                           */}
        {/* ================================================= */}

        {activeTab === "entries" && (
          <div
            className="
              flex
              shrink-0
              items-center
              gap-1
              border-b
              border-white/10
              px-3
              py-2
            "
          >
            <button
              type="button"
              onClick={shuffleEntries}
              disabled={isSpinning}
              className="
                flex
                items-center
                gap-1.5
                rounded-lg
                px-2.5
                py-2
                text-xs
                font-medium
                text-white/65
                transition
                hover:bg-white/5
                hover:text-white
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <Shuffle className="h-4 w-4" />
              Shuffle
            </button>

            <button
              type="button"
              onClick={sortEntries}
              disabled={isSpinning}
              className="
                flex
                items-center
                gap-1.5
                rounded-lg
                px-2.5
                py-2
                text-xs
                font-medium
                text-white/65
                transition
                hover:bg-white/5
                hover:text-white
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <ChevronDown className="h-4 w-4" />
              Sort
            </button>

            <button
              type="button"
              className="
                flex
                items-center
                gap-1.5
                rounded-lg
                px-2.5
                py-2
                text-xs
                font-medium
                text-white/65
                transition
                hover:bg-white/5
                hover:text-white
              "
            >
              <ImagePlus className="h-4 w-4" />
              Add image
            </button>

            <button
              type="button"
              onClick={() =>
                setShowAdvanced(
                  (current) => !current,
                )
              }
              className={[
                "ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition",
                showAdvanced
                  ? "bg-white/10 text-white"
                  : "text-white/65 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              Advanced
            </button>
          </div>
        )}

        {/* ================================================= */}
        {/* ADVANCED                                          */}
        {/* ================================================= */}

        {showAdvanced &&
          activeTab === "entries" && (
            <div
              className="
                shrink-0
                border-b
                border-white/10
                bg-[#0d0d0d]
                px-4
                py-3
              "
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-white/80">
                  Spin settings
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setShowAdvanced(false)
                  }
                  className="text-xs text-white/40 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div
                  className="
                    rounded-lg
                    border
                    border-white/10
                    bg-white/[0.025]
                    p-3
                  "
                >
                  <div className="text-[11px] text-white/40">
                    Spin duration
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    5 seconds
                  </div>
                </div>

                <div
                  className="
                    rounded-lg
                    border
                    border-white/10
                    bg-white/[0.025]
                    p-3
                  "
                >
                  <div className="text-[11px] text-white/40">
                    Revolutions
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {WIN_REVOLUTIONS}
                  </div>
                </div>
              </div>

              <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5">
                <div>
                  <div className="text-xs font-medium text-white/80">
                    Hide selected
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/35">
                    Remove winners from future spins
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={hideSelectedRef.current}
                  onChange={(event) => {
                    hideSelectedRef.current =
                      event.target.checked
                  }}
                  className="h-4 w-4 accent-blue-500"
                />
              </label>
            </div>
          )}

        {/* ================================================= */}
        {/* CONTENT                                           */}
        {/* ================================================= */}

        {activeTab === "entries" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Entry count */}
            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                px-4
                py-3
              "
            >
              <div className="text-xs text-white/45">
                {visibleEntries.length}{" "}
                {visibleEntries.length === 1
                  ? "entry"
                  : "entries"}
              </div>

              <div className="text-[10px] text-white/25">
                One entry per line
              </div>
            </div>

            {/* Text area */}
            <div className="min-h-0 flex-1 px-4 pb-3">
              <textarea
                value={entryText}
                onChange={(event) =>
                  updateEntriesFromText(
                    event.target.value,
                  )
                }
                spellCheck={false}
                className="
                  h-full
                  min-h-[180px]
                  w-full
                  resize-none
                  rounded-xl
                  border
                  border-white/10
                  bg-[#181818]
                  p-4
                  text-sm
                  leading-7
                  text-white
                  outline-none
                  placeholder:text-white/25
                  focus:border-white/20
                  focus:ring-1
                  focus:ring-white/10
                "
                placeholder="Enter names here..."
              />
            </div>

            {/* Add entry */}
            <div
              className="
                shrink-0
                border-t
                border-white/10
                p-3
              "
            >
              <div className="flex gap-2">
                <input
                  value={newEntry}
                  onChange={(event) =>
                    setNewEntry(
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addEntry()
                    }
                  }}
                  placeholder="Add an entry..."
                  className="
                    min-w-0
                    flex-1
                    rounded-lg
                    border
                    border-white/10
                    bg-[#181818]
                    px-3
                    py-2.5
                    text-sm
                    text-white
                    outline-none
                    placeholder:text-white/25
                    focus:border-white/20
                  "
                />

                <button
                  type="button"
                  onClick={addEntry}
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-white
                    text-black
                    transition
                    hover:bg-white/90
                  "
                  aria-label="Add entry"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================= */
          /* RESULTS                                           */
          /* ================================================= */

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                border-b
                border-white/10
                px-4
                py-3
              "
            >
              <div>
                <div className="text-sm font-medium">
                  Winners
                </div>
                <div className="mt-0.5 text-xs text-white/35">
                  Your previous results
                </div>
              </div>

              {results.length > 0 && (
                <button
                  type="button"
                  onClick={clearResults}
                  className="
                    text-xs
                    text-white/40
                    transition
                    hover:text-white
                  "
                >
                  Clear
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {results.length === 0 ? (
                <div
                  className="
                    flex
                    h-full
                    min-h-[240px]
                    flex-col
                    items-center
                    justify-center
                    text-center
                  "
                >
                  <div
                    className="
                      flex
                      h-12
                      w-12
                      items-center
                      justify-center
                      rounded-full
                      bg-white/5
                    "
                  >
                    <Trophy className="h-5 w-5 text-white/30" />
                  </div>

                  <div className="mt-4 text-sm text-white/55">
                    No results yet
                  </div>

                  <div className="mt-1 max-w-[220px] text-xs leading-5 text-white/25">
                    Spin the wheel to see your first
                    winner here.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map(
                    (result, index) => (
                      <div
                        key={`${result.id}-${result.timestamp}`}
                        className="
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          border
                          border-white/10
                          bg-[#181818]
                          px-3
                          py-3
                        "
                      >
                        <div
                          className="
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-white/5
                            text-xs
                            font-semibold
                            text-white/50
                          "
                        >
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">
                            {result.label}
                          </div>

                          <div className="mt-0.5 text-[10px] text-white/30">
                            {new Date(
                              result.timestamp,
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        </div>

                        <Trophy className="h-4 w-4 shrink-0 text-white/25" />
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* BOTTOM SPIN BUTTON                                 */}
        {/* ================================================= */}

        <div
          className="
            shrink-0
            border-t
            border-white/10
            bg-[#111111]
            p-3
          "
        >
          <button
            type="button"
            onClick={spin}
            disabled={
              isSpinning ||
              visibleEntries.length === 0
            }
            className="
              flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-white
              px-4
              py-3
              text-sm
              font-semibold
              text-black
              shadow-lg
              transition
              hover:bg-white/90
              active:scale-[0.99]
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <Sparkles className="h-4 w-4" />

            {isSpinning
              ? "Spinning..."
              : "Spin the wheel"}
          </button>
        </div>
      </aside>
    </div>
  )
}
