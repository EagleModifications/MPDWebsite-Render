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
 * Wheel of Names-style idle movement.
 *
 * spin-wheel uses degrees/second.
 * A low value keeps the idle movement subtle.
 */
const IDLE_SPEED = 7

const WIN_SPIN_DURATION = 5000
const WIN_REVOLUTIONS = 6

function createId(index = 0) {
  return `${Date.now()}-${index}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function createEntries(names: string[]): WheelEntry[] {
  return names.map((name, index) => ({
    id: createId(index),
    label: name,
    color: COLORS[index % COLORS.length],
    hidden: false,
  }))
}

export default function SpinWheel() {
  const wheelContainerRef =
    useRef<HTMLDivElement | null>(null)

  const wheelRef =
    useRef<Wheel | null>(null)

  const resizeObserverRef =
    useRef<ResizeObserver | null>(null)

  const pointerAnimationFrameRef =
    useRef<number | null>(null)

  const isSpinningRef =
    useRef(false)

  const idleRotationRef =
    useRef(false)

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
    useState("#f5d45d")

  /*
   * The pointer is positioned from the actual
   * wheel canvas instead of using a hard-coded
   * right offset.
   */
  const [pointerPosition, setPointerPosition] =
    useState({
      left: 0,
      top: 0,
      visible: false,
    })

  const [showAdvanced, setShowAdvanced] =
    useState(false)

  const [showMenu, setShowMenu] =
    useState(false)

  const [newEntry, setNewEntry] =
    useState("")

  const [fullscreen, setFullscreen] =
    useState(false)

  /*
   * Keep refs synchronized with React state.
   */
  useEffect(() => {
    entriesRef.current = entries

    visibleEntriesRef.current =
      entries.filter(
        (entry) => !entry.hidden,
      )
  }, [entries])

  /*
   * Update pointer colour from the segment
   * currently under the pointer.
   */
  const updatePointerColor =
    useCallback(
      (
        index: number,
        source?: WheelEntry[],
      ) => {
        const currentEntries =
          source ??
          visibleEntriesRef.current

        const entry =
          currentEntries[index]

        if (entry) {
          setPointerColor(entry.color)
        }
      },
      [],
    )

  /*
   * --------------------------------------------------
   * FIND THE REAL WHEEL EDGE
   * --------------------------------------------------
   *
   * spin-wheel creates a canvas that contains the
   * wheel. The canvas itself is larger than the
   * actual circle.
   *
   * We inspect the middle row of the canvas and find
   * the last non-transparent pixel. This gives us the
   * exact rendered right edge of the wheel.
   *
   * This means the pointer remains correctly aligned
   * when the browser/window is resized.
   */
  const updatePointerPosition =
    useCallback(() => {
      const container =
        wheelContainerRef.current

      if (!container) {
        return
      }

      const canvas =
        container.querySelector(
          "canvas",
        ) as HTMLCanvasElement | null

      if (!canvas) {
        setPointerPosition(
          (current) => ({
            ...current,
            visible: false,
          }),
        )

        return
      }

      const containerRect =
        container.getBoundingClientRect()

      const canvasRect =
        canvas.getBoundingClientRect()

      if (
        canvas.width === 0 ||
        canvas.height === 0 ||
        canvasRect.width === 0 ||
        canvasRect.height === 0
      ) {
        return
      }

      try {
        const context =
          canvas.getContext("2d", {
            willReadFrequently: true,
          })

        if (!context) {
          return
        }

        /*
         * Look at the horizontal center of the
         * canvas. At this row the wheel is a simple
         * circle, so the final non-transparent pixel
         * represents the right-hand wheel edge.
         */
        const y =
          Math.floor(
            canvas.height / 2,
          )

        const pixels =
          context.getImageData(
            0,
            y,
            canvas.width,
            1,
          ).data

        let rightMostPixel = -1

        for (
          let x = canvas.width - 1;
          x >= 0;
          x--
        ) {
          const alpha =
            pixels[x * 4 + 3]

          if (alpha > 8) {
            rightMostPixel = x
            break
          }
        }

        if (rightMostPixel < 0) {
          return
        }

        /*
         * Convert canvas pixels into CSS pixels.
         */
        const scaleX =
          canvasRect.width /
          canvas.width

        const wheelRight =
          canvasRect.left +
          rightMostPixel * scaleX

        const wheelCenterY =
          canvasRect.top +
          canvasRect.height / 2

        setPointerPosition({
          left:
            wheelRight -
            containerRect.left,
          top:
            wheelCenterY -
            containerRect.top,
          visible: true,
        })
      } catch {
        /*
         * If canvas inspection fails, simply keep
         * the previous pointer position.
         */
      }
    }, [])

  /*
   * Schedule pointer measurement on the next
   * animation frame.
   */
  const schedulePointerPosition =
    useCallback(() => {
      if (
        pointerAnimationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          pointerAnimationFrameRef.current,
        )
      }

      pointerAnimationFrameRef.current =
        requestAnimationFrame(() => {
          pointerAnimationFrameRef.current =
            null

          updatePointerPosition()
        })
    }, [updatePointerPosition])

  /*
   * --------------------------------------------------
   * IDLE ROTATION
   * --------------------------------------------------
   *
   * This intentionally uses spin-wheel's native
   * continuous spin mode.
   *
   * rotationResistance = 0 means it does not
   * naturally slow down or stop.
   */
  const startIdleRotation =
    useCallback(() => {
      const wheel =
        wheelRef.current

      if (!wheel) {
        return
      }

      if (
        isSpinningRef.current ||
        visibleEntriesRef.current.length ===
          0
      ) {
        return
      }

      /*
       * Do not accidentally start multiple
       * animation loops.
       */
      if (
        idleRotationRef.current &&
        wheel.rotationSpeed !== 0
      ) {
        return
      }

      idleRotationRef.current = true

      wheel.rotationResistance = 0

      /*
       * Positive = clockwise.
       */
      wheel.spin(IDLE_SPEED)
    }, [])

  /*
   * Stop idle rotation only.
   */
  const stopIdleRotation =
    useCallback(() => {
      const wheel =
        wheelRef.current

      if (!wheel) {
        return
      }

      wheel.stop()

      idleRotationRef.current = false
    }, [])

  /*
   * --------------------------------------------------
   * CREATE WHEEL
   * --------------------------------------------------
   */
  useEffect(() => {
    const container =
      wheelContainerRef.current

    if (
      !container ||
      wheelRef.current
    ) {
      return
    }

    const initialEntries =
      entriesRef.current.filter(
        (entry) => !entry.hidden,
      )

    visibleEntriesRef.current =
      initialEntries

    const wheel =
      new Wheel(container, {
        items: initialEntries.map(
          (entry) => ({
            label: entry.label,
            backgroundColor:
              entry.color,
            labelColor: "#111111",
          }),
        ),

        /*
         * Wheel of Names pointer position:
         * right side of the wheel.
         */
        pointerAngle: 90,

        /*
         * Size.
         */
        radius: 0.91,

        /*
         * Thin dark/transparent segment
         * boundaries like Wheel of Names.
         */
        lineWidth: 1,
        lineColor:
          "rgba(0,0,0,0.22)",

        /*
         * Labels follow the wheel rotation.
         *
         * spin-wheel rotates these labels with
         * the wheel canvas, giving the radial/
         * arched-looking Wheel of Names effect.
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
         * Keep the canvas sharp.
         */
        pixelRatio:
          typeof window !== "undefined"
            ? Math.min(
                2,
                window.devicePixelRatio ||
                  1,
              )
            : 1,

        /*
         * IMPORTANT:
         *
         * Zero resistance means native
         * spin() continues forever.
         */
        rotationResistance: 0,

        rotationSpeedMax: 160,

        /*
         * Keep pointer colour synchronized
         * with the currently selected segment.
         */
        onCurrentIndexChange: (
          event,
        ) => {
          updatePointerColor(
            event.currentIndex,
            visibleEntriesRef.current,
          )
        },

        /*
         * Winner spin finished.
         */
        onRest: (event) => {
          if (
            !isSpinningRef.current
          ) {
            return
          }

          isSpinningRef.current =
            false

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
            window.setTimeout(() => {
              startIdleRotation()
            }, 500)

            return
          }

          /*
           * Add result.
           */
          setResults((current) => [
            {
              id: winner.id,
              label: winner.label,
              timestamp: Date.now(),
            },
            ...current,
          ])

          /*
           * Hide selected winner if enabled.
           */
          if (
            hideSelectedRef.current
          ) {
            setEntries((current) =>
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
            `${winner.label} won!`,
          )

          /*
           * Restart idle rotation after
           * the winner has been displayed.
           */
          window.setTimeout(() => {
            startIdleRotation()
          }, 700)
        },
      })

    wheelRef.current = wheel

    /*
     * Initial pointer colour.
     */
    updatePointerColor(
      wheel.getCurrentIndex(),
      initialEntries,
    )

    /*
     * The canvas needs one frame to render before
     * we can calculate the exact wheel edge.
     */
    schedulePointerPosition()

    /*
     * Observe the wheel container.
     */
    resizeObserverRef.current =
      new ResizeObserver(() => {
        schedulePointerPosition()
      })

    resizeObserverRef.current.observe(
      container,
    )

    /*
     * START IDLE ROTATION AFTER INITIALIZATION.
     *
     * This is deliberately delayed one frame.
     * It prevents the first entries synchronization
     * from immediately killing the idle spin.
     */
    const idleTimer =
      window.setTimeout(() => {
        startIdleRotation()
      }, 100)

    /*
     * Cleanup.
     */
    return () => {
      window.clearTimeout(
        idleTimer,
      )

      if (
        pointerAnimationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          pointerAnimationFrameRef.current,
        )

        pointerAnimationFrameRef.current =
          null
      }

      resizeObserverRef.current?.disconnect()

      resizeObserverRef.current =
        null

      wheel.stop()

      /*
       * spin-wheel provides remove() to unregister
       * its canvas/event handlers.
       */
      wheel.remove()

      wheelRef.current = null

      idleRotationRef.current =
        false

      isSpinningRef.current =
        false
    }
  }, [
    schedulePointerPosition,
    startIdleRotation,
    updatePointerColor,
  ])

  /*
   * --------------------------------------------------
   * UPDATE WHEEL ITEMS
   * --------------------------------------------------
   *
   * The previous version had a subtle bug here:
   *
   * 1. idle spin starts
   * 2. React updates entries
   * 3. wheel.items is replaced
   * 4. spin-wheel stops/reinitializes animation
   * 5. idleRotationRef still says "true"
   * 6. startIdleRotation refuses to restart it
   *
   * We explicitly stop -> update -> restart.
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
     * If we're editing the list while the winner
     * animation isn't running, safely rebuild the
     * items and then restart idle rotation.
     */
    const wasIdle =
      idleRotationRef.current

    if (
      wasIdle &&
      !isSpinningRef.current
    ) {
      wheel.stop()

      idleRotationRef.current =
        false
    }

    /*
     * Never interrupt the controlled winner
     * animation.
     */
    wheel.items = visible.map(
      (entry) => ({
        label: entry.label,
        backgroundColor:
          entry.color,
        labelColor: "#111111",
      }),
    )

    schedulePointerPosition()

    if (visible.length === 0) {
      setPointerColor("#ffffff")
      return
    }

    /*
     * Current index can change after replacing
     * the item list.
     */
    const currentIndex =
      wheel.getCurrentIndex()

    updatePointerColor(
      currentIndex,
      visible,
    )

    /*
     * ALWAYS ensure idle rotation is running
     * when the wheel is not performing a winner
     * spin.
     */
    if (
      !isSpinningRef.current
    ) {
      window.setTimeout(() => {
        if (
          wheelRef.current === wheel &&
          !isSpinningRef.current
        ) {
          startIdleRotation()
        }
      }, 20)
    }
  }, [
    entries,
    schedulePointerPosition,
    startIdleRotation,
    updatePointerColor,
  ])

  /*
   * --------------------------------------------------
   * MAIN WINNER SPIN
   * --------------------------------------------------
   */
  const spin = useCallback(() => {
    const wheel =
      wheelRef.current

    if (!wheel) {
      return
    }

    if (
      isSpinningRef.current
    ) {
      return
    }

    const currentEntries =
      visibleEntriesRef.current

    if (
      currentEntries.length ===
      0
    ) {
      toast.error(
        "Add at least one entry first.",
      )
      return
    }

    /*
     * Stop continuous idle rotation.
     */
    wheel.stop()

    idleRotationRef.current =
      false

    isSpinningRef.current =
      true

    setIsSpinning(true)

    /*
     * Choose winner.
     */
    const winnerIndex =
      Math.floor(
        Math.random() *
          currentEntries.length,
      )

    /*
     * DO NOT immediately change pointer
     * colour to the winner.
     *
     * onCurrentIndexChange will update the
     * pointer as the wheel physically passes
     * each segment.
     */

    /*
     * Smooth ease-out.
     */
    const easeOutQuart = (
      progress: number,
    ) =>
      1 -
      Math.pow(
        1 - progress,
        4,
      )

    wheel.spinToItem(
      winnerIndex,
      WIN_SPIN_DURATION,
      true,
      WIN_REVOLUTIONS,
      1,
      easeOutQuart,
    )
  }, [])

  /*
   * --------------------------------------------------
   * CTRL + ENTER
   * --------------------------------------------------
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

        if (
          !isSpinningRef.current
        ) {
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
   * --------------------------------------------------
   * SHUFFLE
   * --------------------------------------------------
   */
  const shuffleEntries =
    useCallback(() => {
      if (
        isSpinningRef.current
      ) {
        toast.info(
          "Wait for the current spin to finish.",
        )
        return
      }

      setEntries((current) => {
        const shuffled = [
          ...current,
        ]

        for (
          let index =
            shuffled.length - 1;
          index > 0;
          index--
        ) {
          const randomIndex =
            Math.floor(
              Math.random() *
                (index + 1),
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
   * --------------------------------------------------
   * SORT
   * --------------------------------------------------
   */
  const sortEntries =
    useCallback(() => {
      if (
        isSpinningRef.current
      ) {
        toast.info(
          "Wait for the current spin to finish.",
        )
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
                sensitivity:
                  "base",
              },
            ),
        ),
      )
    }, [])

  /*
   * --------------------------------------------------
   * TEXTAREA
   * --------------------------------------------------
   */
  const updateEntriesFromText =
    useCallback(
      (value: string) => {
        const lines = value
          .split(/\r?\n/)
          .map((line) =>
            line.trim(),
          )
          .filter(Boolean)

        setEntries((current) =>
          lines.map(
            (label, index) => {
              const existing =
                current[index]

              return {
                id:
                  existing?.id ??
                  createId(index),

                label,

                color:
                  existing?.color ??
                  COLORS[
                    index %
                      COLORS.length
                  ],

                hidden:
                  existing?.hidden ??
                  false,
              }
            },
          ),
        )
      },
      [],
    )

  /*
   * --------------------------------------------------
   * ADD ENTRY
   * --------------------------------------------------
   */
  const addEntry =
    useCallback(() => {
      const label =
        newEntry.trim()

      if (!label) {
        return
      }

      setEntries((current) => [
        ...current,
        {
          id: createId(
            current.length,
          ),
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

  /*
   * --------------------------------------------------
   * CLEAR
   * --------------------------------------------------
   */
  const clearEntries =
    useCallback(() => {
      if (
        isSpinningRef.current
      ) {
        toast.info(
          "Wait for the current spin to finish.",
        )
        return
      }

      setEntries([])
    }, [])

  /*
   * --------------------------------------------------
   * RESTORE DEFAULTS
   * --------------------------------------------------
   */
  const restoreDefaults =
    useCallback(() => {
      if (
        isSpinningRef.current
      ) {
        toast.info(
          "Wait for the current spin to finish.",
        )
        return
      }

      setEntries(
        createEntries(
          DEFAULT_NAMES,
        ),
      )

      toast.success(
        "Default entries restored.",
      )
    }, [])

  /*
   * --------------------------------------------------
   * COPY
   * --------------------------------------------------
   */
  const copyEntries =
    useCallback(() => {
      const text = entries
        .filter(
          (entry) =>
            !entry.hidden,
        )
        .map(
          (entry) =>
            entry.label,
        )
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
   * --------------------------------------------------
   * FULLSCREEN
   * --------------------------------------------------
   */
  const toggleFullscreen =
    useCallback(() => {
      setFullscreen(
        (current) => !current,
      )
    }, [])

  /*
   * --------------------------------------------------
   * CLEAR RESULTS
   * --------------------------------------------------
   */
  const clearResults =
    useCallback(() => {
      setResults([])
    }, [])

  const visibleEntries =
    entries.filter(
      (entry) => !entry.hidden,
    )

  const entryText =
    visibleEntries
      .map(
        (entry) => entry.label,
      )
      .join("\n")

  return (
    <div
      className={[
        "fixed inset-0 z-40 flex overflow-hidden",
        "bg-[#0b1115] text-white",
        fullscreen
          ? ""
          : "top-[var(--navbar-height,0px)]",
      ].join(" ")}
    >
      {/* ================================================= */}
      {/* WHEEL AREA                                        */}
      {/* ================================================= */}

      <main
        className="relative min-w-0 flex-1 overflow-hidden"
        onClick={(event) => {
          const target =
            event.target as HTMLElement

          if (
            target.closest(
              "button,input,textarea,[role='button']",
            )
          ) {
            return
          }

          if (
            !isSpinningRef.current
          ) {
            spin()
          }
        }}
      >
        {/* Wheel of Names style background */}
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-[radial-gradient(circle_at_50%_50%,#20313b_0%,#14222a_48%,#0b1115_100%)]
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-[radial-gradient(circle,transparent_42%,rgba(0,0,0,0.28)_100%)]
          "
        />

        {/* Actual wheel */}
        <div
          ref={wheelContainerRef}
          className="
            absolute
            inset-0
            h-full
            w-full
          "
        />

        {/* Text settings button */}
        <button
          type="button"
          aria-label="Wheel text settings"
          className="
            absolute
            left-4
            top-4
            z-[70]
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            border
            border-white/15
            bg-[#30365e]
            text-white
            shadow-lg
            transition
            hover:bg-[#3b4270]
          "
        >
          <Type className="h-5 w-5" />
        </button>

        {/* Center text */}
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
                text-[26px]
                font-semibold
                leading-none
                tracking-[-0.03em]
                text-white
                drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]
              "
            >
              {isSpinning
                ? "Spinning..."
                : "Click to spin"}
            </div>

            {!isSpinning && (
              <div
                className="
                  mt-3
                  text-[13px]
                  font-semibold
                  leading-none
                  text-white/90
                  drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]
                "
              >
                or press ctrl+enter
              </div>
            )}
          </div>
        </div>

        {/* ================================================= */}
        {/* POINTER                                            */}
        {/* ================================================= */}

        {pointerPosition.visible && (
          <div
            className="
              pointer-events-none
              absolute
              z-[80]
              -translate-y-1/2
            "
            style={{
              left: pointerPosition.left,
              top: pointerPosition.top,
            }}
          >
            <div
              className="
                h-0
                w-0
                border-y-[23px]
                border-l-0
                border-r-[48px]
                border-y-transparent
                drop-shadow-[0_2px_7px_rgba(0,0,0,0.65)]
              "
              style={{
                borderRightColor:
                  pointerColor,
                transition:
                  "border-right-color 120ms ease-out",
              }}
            />
          </div>
        )}

        {/* Spin status */}
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

      {/* ================================================= */}
      {/* SIDEBAR                                           */}
      {/* ================================================= */}

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
        {/* Header */}
        <div
          className="
            flex
            h-[58px]
            shrink-0
            items-center
            justify-between
            border-b
            border-white/10
            px-3
          "
        >
          <div className="flex items-center">
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "entries",
                )
              }
              className={[
                "relative px-3 py-4 text-sm font-semibold transition",
                activeTab ===
                "entries"
                  ? "text-white"
                  : "text-white/45 hover:text-white/80",
              ].join(" ")}
            >
              Entries

              <span
                className="
                  ml-1.5
                  rounded-full
                  bg-white/10
                  px-1.5
                  py-0.5
                  text-[10px]
                  text-white/60
                "
              >
                {visibleEntries.length}
              </span>

              {activeTab ===
                "entries" && (
                <span
                  className="
                    absolute
                    bottom-0
                    left-2
                    right-2
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
                setActiveTab(
                  "results",
                )
              }
              className={[
                "relative px-3 py-4 text-sm font-semibold transition",
                activeTab ===
                "results"
                  ? "text-white"
                  : "text-white/45 hover:text-white/80",
              ].join(" ")}
            >
              Results

              <span
                className="
                  ml-1.5
                  rounded-full
                  bg-white/10
                  px-1.5
                  py-0.5
                  text-[10px]
                  text-white/60
                "
              >
                {results.length}
              </span>

              {activeTab ===
                "results" && (
                <span
                  className="
                    absolute
                    bottom-0
                    left-2
                    right-2
                    h-[2px]
                    rounded-full
                    bg-white
                  "
                />
              )}
            </button>
          </div>

          {/* More */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowMenu(
                  (current) =>
                    !current,
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
                  <Trophy className="h-4 w-4" />
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

        {/* Toolbar */}
        {activeTab ===
          "entries" && (
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
              onClick={
                shuffleEntries
              }
              disabled={isSpinning}
              className="
                flex
                items-center
                gap-1.5
                rounded-lg
                bg-[#4d4d80]
                px-3
                py-2
                text-xs
                font-semibold
                text-white
                transition
                hover:bg-[#5a5a91]
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <Shuffle className="h-4 w-4" />
              Shuffle
            </button>

            <button
              type="button"
              onClick={
                sortEntries
              }
              disabled={isSpinning}
              className="
                flex
                items-center
                gap-1.5
                rounded-lg
                bg-[#4d4d80]
                px-3
                py-2
                text-xs
                font-semibold
                text-white
                transition
                hover:bg-[#5a5a91]
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
                bg-[#4d4d80]
                px-3
                py-2
                text-xs
                font-semibold
                text-white
                transition
                hover:bg-[#5a5a91]
              "
            >
              <ImagePlus className="h-4 w-4" />
              Add image
            </button>

            <button
              type="button"
              onClick={() =>
                setShowAdvanced(
                  (current) =>
                    !current,
                )
              }
              className="
                ml-auto
                flex
                items-center
                gap-2
                rounded-lg
                px-2.5
                py-2
                text-xs
                font-medium
                text-white/70
                transition
                hover:bg-white/5
                hover:text-white
              "
            >
              <span
                className="
                  h-4
                  w-4
                  rounded-sm
                  border
                  border-white/50
                "
              />

              Advanced
            </button>
          </div>
        )}

        {/* Advanced */}
        {showAdvanced &&
          activeTab ===
            "entries" && (
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
                    setShowAdvanced(
                      false,
                    )
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

              <label
                className="
                  mt-3
                  flex
                  cursor-pointer
                  items-center
                  justify-between
                  rounded-lg
                  border
                  border-white/10
                  bg-white/[0.025]
                  px-3
                  py-2.5
                "
              >
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
                  checked={
                    hideSelectedRef.current
                  }
                  onChange={(
                    event,
                  ) => {
                    hideSelectedRef.current =
                      event.target.checked
                  }}
                  className="h-4 w-4 accent-blue-500"
                />
              </label>
            </div>
          )}

        {/* Content */}
        {activeTab ===
        "entries" ? (
          <div className="flex min-h-0 flex-1 flex-col">
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
              <div className="text-xs text-white/55">
                {visibleEntries.length}{" "}
                {visibleEntries.length ===
                1
                  ? "entry"
                  : "entries"}
              </div>

              <div className="text-[10px] text-white/35">
                One entry per line
              </div>
            </div>

            <div className="min-h-0 flex-1 px-4 pb-3">
              <textarea
                value={entryText}
                onChange={(
                  event,
                ) =>
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
                  border-white/15
                  bg-[#181818]
                  p-4
                  text-sm
                  leading-7
                  text-white
                  outline-none
                  placeholder:text-white/25
                  focus:border-white/25
                  focus:ring-1
                  focus:ring-white/10
                "
                placeholder="Enter names here..."
              />
            </div>

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
                  onChange={(
                    event,
                  ) =>
                    setNewEntry(
                      event.target.value,
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

              {results.length >
                0 && (
                <button
                  type="button"
                  onClick={
                    clearResults
                  }
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
              {results.length ===
              0 ? (
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
                    Spin the wheel to
                    see your first
                    winner here.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map(
                    (
                      result,
                      index,
                    ) => (
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
                            {
                              result.label
                            }
                          </div>

                          <div className="mt-0.5 text-[10px] text-white/30">
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

        {/* Bottom spin */}
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
              visibleEntries.length ===
                0
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
