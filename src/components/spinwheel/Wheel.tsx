import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Wheel as SpinWheel } from "spin-wheel"

export type SpinWheelItem = {
  id: string
  label: string
  color?: string
  weight?: number
}

type WheelProps = {
  items: SpinWheelItem[]
  onResult?: (item: SpinWheelItem) => void
}

/*
 * Generates a bright/pastel random colour.
 *
 * HSL gives us a much wider range of colours than a
 * fixed palette while keeping the wheel readable.
 */
function createRandomColor() {
  const hue = Math.floor(
    Math.random() * 360,
  )

  const saturation =
    58 + Math.floor(Math.random() * 18)

  const lightness =
    62 + Math.floor(Math.random() * 14)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

/*
 * Convert HSL/CSS colours to a hex colour where possible.
 * The pointer can use the CSS colour directly, so this
 * helper isn't required for rendering.
 */

/*
 * Creates stable random colours for entries.
 *
 * The colour is keyed by the entry ID so typing/editing
 * the list doesn't constantly change every existing
 * segment's colour.
 */
function useRandomItemColors(
  items: SpinWheelItem[],
) {
  const colorsRef = useRef(
    new Map<string, string>(),
  )

  return useMemo(() => {
    const colors =
      colorsRef.current

    const activeIds = new Set(
      items.map((item) => item.id),
    )

    for (const id of colors.keys()) {
      if (!activeIds.has(id)) {
        colors.delete(id)
      }
    }

    return items.map((item) => {
      let color = colors.get(item.id)

      if (!color) {
        color = createRandomColor()
        colors.set(item.id, color)
      }

      return color
    })
  }, [items])
}

export default function Wheel({
  items,
  onResult,
}: WheelProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const wheelRef =
    useRef<SpinWheel | null>(null)

  const spinningRef =
    useRef(false)

  const [isSpinning, setIsSpinning] =
    useState(false)

  const [currentIndex, setCurrentIndex] =
    useState(0)

  const [pointerColor, setPointerColor] =
    useState("#60a5fa")

  /*
   * Generate completely random colours for the
   * current set of entries.
   */
  const randomColors =
    useRandomItemColors(items)

  /*
   * Keep the winning item accessible to the
   * onRest callback without recreating the wheel
   * unnecessarily.
   */
  const itemsRef =
    useRef(items)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  /*
   * Keep the callback current without forcing
   * the wheel to be recreated.
   */
  const onResultRef =
    useRef(onResult)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  /*
   * Change the pointer colour to match the
   * segment currently underneath it.
   */
  const updatePointerColor = useCallback(
    (index: number) => {
      const color =
        randomColors[index]

      if (color) {
        setPointerColor(color)
      }
    },
    [randomColors],
  )

  /*
   * Spin the wheel to a random item.
   */
  const spin = useCallback(() => {
    const wheel = wheelRef.current

    if (
      !wheel ||
      itemsRef.current.length === 0 ||
      spinningRef.current
    ) {
      return
    }

    const currentItems =
      itemsRef.current

    const selectedIndex =
      Math.floor(
        Math.random() *
          currentItems.length,
      )

    spinningRef.current = true
    setIsSpinning(true)

    wheel.spinToItem(
      selectedIndex,
      4200,
      true,
      6,
      1,
    )
  }, [])

  /*
   * Ctrl + Enter spins the wheel.
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
   * Create/recreate the wheel whenever the
   * entries change.
   */
  useEffect(() => {
    const container =
      containerRef.current

    if (!container) {
      return
    }

    container.innerHTML = ""
    wheelRef.current = null
    spinningRef.current = false
    setIsSpinning(false)

    if (items.length === 0) {
      setCurrentIndex(0)
      setPointerColor("#60a5fa")
      return
    }

    const initialIndex = Math.min(
      currentIndex,
      items.length - 1,
    )

    setCurrentIndex(initialIndex)

    const initialColor =
      randomColors[initialIndex]

    if (initialColor) {
      setPointerColor(initialColor)
    }

    const wheel =
      new SpinWheel(container, {
        items: items.map(
          (item, index) => ({
            label:
              item.label ||
              "Untitled",

            value: item.id,

            weight:
              item.weight ?? 1,

            /*
             * Ignore the colour supplied by the
             * sidebar and use a random colour.
             */
            backgroundColor:
              randomColors[index],

            /*
             * Matches the screenshot:
             * dark/black labels on pastel segments.
             */
            labelColor: "#111111",
          }),
        ),

        /*
         * Make the wheel fill almost the
         * entire container.
         */
        radius: 0.96,

        /*
         * Pointer is positioned on the right
         * side of the wheel.
         */
        pointerAngle: 0,

        /*
         * Thin clean outer border.
         */
        borderWidth: 2,
        borderColor:
          "rgba(255,255,255,0.28)",

        /*
         * Very subtle segment separators.
         */
        lineWidth: 1,
        lineColor:
          "rgba(255,255,255,0.28)",

        /*
         * Radial labels like the screenshot.
         */
        itemLabelAlign: "right",
        itemLabelRadius: 0.82,
        itemLabelRadiusMax: 0.28,

        itemLabelFont:
          "Inter, ui-sans-serif, system-ui, sans-serif",

        itemLabelFontSizeMax: 42,

        itemLabelStrokeWidth: 0,

        /*
         * We handle the spin ourselves so clicking
         * the wheel doesn't trigger the package's
         * drag interaction.
         */
        isInteractive: false,

        rotationResistance: -35,
        rotationSpeedMax: 1000,

        /*
         * Fired whenever the pointer moves onto
         * another segment.
         */
        onCurrentIndexChange: (event) => {
          const index =
            event.currentIndex

          setCurrentIndex(index)
          updatePointerColor(index)
        },

        onRest: (event) => {
          const selectedIndex =
            event.currentIndex

          const selectedItem =
            itemsRef.current[
              selectedIndex
            ]

          setCurrentIndex(
            selectedIndex,
          )

          updatePointerColor(
            selectedIndex,
          )

          spinningRef.current = false
          setIsSpinning(false)

          if (selectedItem) {
            onResultRef.current?.(
              selectedItem,
            )
          }
        },
      })

    wheelRef.current = wheel

    /*
     * Set the initial pointer colour using
     * the wheel's actual current index.
     */
    const actualIndex =
      wheel.getCurrentIndex()

    setCurrentIndex(actualIndex)
    updatePointerColor(actualIndex)

    return () => {
      wheel.remove()
      wheelRef.current = null
      spinningRef.current = false
    }
  }, [
    items,
    randomColors,
    updatePointerColor,
  ])

  /*
   * Clicking the wheel itself starts a spin.
   */
  const handleWheelClick = () => {
    if (
      items.length === 0 ||
      spinningRef.current
    ) {
      return
    }

    spin()
  }

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-background">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035),transparent_58%)]" />

      {items.length > 0 ? (
        <div
          className="relative aspect-square w-[min(78vw,calc(100vh-130px),1000px)] max-w-[94%]"
          onClick={handleWheelClick}
          role="button"
          tabIndex={0}
          aria-label="Spin wheel"
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault()
              handleWheelClick()
            }
          }}
        >
          {/* Actual wheel */}
          <div
            ref={containerRef}
            className="absolute inset-0"
          />

          {/* Right-side pointer */}
          <div
            className="pointer-events-none absolute right-[-27px] top-1/2 z-30 -translate-y-1/2"
            aria-hidden="true"
          >
            <div
              className="relative h-[48px] w-[54px] drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)] transition-colors duration-100"
              style={{
                filter:
                  "drop-shadow(0 0 3px rgba(255,255,255,0.35))",
              }}
            >
              {/* Outer arrow */}
              <div
                className="absolute inset-0"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 76% 50%)",
                  backgroundColor:
                    "rgba(255,255,255,0.55)",
                }}
              />

              {/* Coloured arrow */}
              <div
                className="absolute inset-[2px]"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 76% 50%)",
                  backgroundColor:
                    pointerColor,
                  transition:
                    "background-color 100ms ease",
                }}
              />
            </div>
          </div>

          {/* White centre */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[17%] w-[17%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_1px_8px_rgba(0,0,0,0.18)]" />

          {/* Wheel of Names style overlay text */}
          {!isSpinning && (
            <div className="pointer-events-none absolute inset-0 z-25">
              <div className="absolute left-1/2 top-[26%] -translate-x-1/2 -rotate-[8deg] whitespace-nowrap text-[clamp(24px,3vw,42px)] font-extrabold tracking-tight text-white drop-shadow-[0_4px_5px_rgba(0,0,0,0.75)]">
                Click to spin
              </div>

              <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 rotate-[8deg] whitespace-nowrap text-[clamp(18px,2.2vw,30px)] font-extrabold tracking-tight text-white drop-shadow-[0_4px_5px_rgba(0,0,0,0.75)]">
                or press ctrl+enter
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-square w-[min(62vw,calc(100vh-180px),760px)] max-w-[78%] items-center justify-center rounded-full border border-border/70 bg-card/30">
          <div className="px-6 text-center">
            <p className="text-lg font-semibold">
              Your wheel is empty
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Add entries from the sidebar to
              get started.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
