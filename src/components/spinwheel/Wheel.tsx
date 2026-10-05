import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react"
import { Wheel as SpinWheel } from "spin-wheel"

export type SpinWheelItem = {
  id: string
  label: string
  color?: string
  weight?: number
  hidden?: boolean
}

type WheelProps = {
  items: SpinWheelItem[]
  onResult?: (item: SpinWheelItem) => void
}

type ConfettiPiece = {
  id: number
  x: number
  y: number
  rotation: number
  delay: number
  duration: number
  size: number
  color: string
  shape: "square" | "rectangle"
}

const CONFETTI_COLORS = [
  "#3b82f6",
  "#60a5fa",
  "#22c55e",
  "#86efac",
  "#facc15",
  "#fde68a",
  "#f472b6",
  "#c084fc",
  "#fb7185",
  "#38bdf8",
]

function createRandomColor() {
  const hue = Math.floor(Math.random() * 360)

  const saturation =
    58 + Math.floor(Math.random() * 18)

  const lightness =
    62 + Math.floor(Math.random() * 14)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function useRandomItemColors(
  items: SpinWheelItem[],
) {
  const colorsRef = useRef(
    new Map<string, string>(),
  )

  return useMemo(() => {
    const colors = colorsRef.current

    const activeIds = new Set(
      items.map((item) => item.id),
    )

    for (const id of colors.keys()) {
      if (!activeIds.has(id)) {
        colors.delete(id)
      }
    }

    for (const item of items) {
      if (!colors.has(item.id)) {
        colors.set(
          item.id,
          createRandomColor(),
        )
      }
    }

    return new Map(colors)
  }, [items])
}

/*
 * Short mechanical ticking sound.
 */
function playTick(
  audioContext: AudioContext | null,
) {
  if (!audioContext) {
    return
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume()
  }

  const now = audioContext.currentTime

  const oscillator =
    audioContext.createOscillator()

  const gain =
    audioContext.createGain()

  oscillator.type = "square"

  oscillator.frequency.setValueAtTime(
    1450,
    now,
  )

  oscillator.frequency.exponentialRampToValueAtTime(
    720,
    now + 0.025,
  )

  gain.gain.setValueAtTime(
    0.0001,
    now,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.055,
    now + 0.002,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.035,
  )

  oscillator.connect(gain)
  gain.connect(audioContext.destination)

  oscillator.start(now)
  oscillator.stop(now + 0.04)
}

/*
 * Generates a quiet applause sound using
 * filtered noise bursts.
 */
function playApplause(
  audioContext: AudioContext | null,
) {
  if (!audioContext) {
    return
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume()
  }

  const now = audioContext.currentTime

  const master =
    audioContext.createGain()

  master.gain.setValueAtTime(
    0.0001,
    now,
  )

  master.gain.exponentialRampToValueAtTime(
    0.12,
    now + 0.08,
  )

  master.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 1.05,
  )

  master.connect(
    audioContext.destination,
  )

  for (
    let index = 0;
    index < 28;
    index += 1
  ) {
    const offset =
      Math.random() * 0.85

    const duration =
      0.035 +
      Math.random() * 0.075

    const bufferSize =
      Math.floor(
        audioContext.sampleRate *
          duration,
      )

    const buffer =
      audioContext.createBuffer(
        1,
        bufferSize,
        audioContext.sampleRate,
      )

    const data =
      buffer.getChannelData(0)

    for (
      let sample = 0;
      sample < bufferSize;
      sample += 1
    ) {
      data[sample] =
        (Math.random() * 2 - 1) *
        (1 - sample / bufferSize)
    }

    const source =
      audioContext.createBufferSource()

    const filter =
      audioContext.createBiquadFilter()

    const gain =
      audioContext.createGain()

    source.buffer = buffer

    filter.type = "bandpass"

    filter.frequency.value =
      1500 +
      Math.random() * 1800

    filter.Q.value = 0.7

    const start =
      now + offset

    gain.gain.setValueAtTime(
      0.0001,
      start,
    )

    gain.gain.exponentialRampToValueAtTime(
      0.018 +
        Math.random() * 0.025,
      start + 0.006,
    )

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration,
    )

    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)

    source.start(start)

    source.stop(
      start + duration + 0.01,
    )
  }
}

function createConfetti(): ConfettiPiece[] {
  return Array.from(
    { length: 65 },
    (_, index) => ({
      id:
        Date.now() +
        index,

      x:
        25 +
        Math.random() * 50,

      y:
        38 +
        Math.random() * 12,

      rotation:
        Math.random() * 360,

      delay:
        Math.random() * 0.18,

      duration:
        1.3 +
        Math.random() * 1.2,

      size:
        5 +
        Math.random() * 7,

      color:
        CONFETTI_COLORS[
          Math.floor(
            Math.random() *
              CONFETTI_COLORS.length,
          )
        ],

      shape:
        Math.random() > 0.5
          ? "square"
          : "rectangle",
    }),
  )
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

  const currentIndexRef =
    useRef(0)

  const audioContextRef =
    useRef<AudioContext | null>(null)

  const lastTickIndexRef =
    useRef<number | null>(null)

  const confettiTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null)

  const [isSpinning, setIsSpinning] =
    useState(false)

  const [pointerColor, setPointerColor] =
    useState("#60a5fa")

  const [confetti, setConfetti] =
    useState<ConfettiPiece[]>([])

  /*
   * Stable random colours.
   */
  const randomColors =
    useRandomItemColors(items)

  /*
   * Hidden entries are excluded from
   * the actual wheel.
   */
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => !item.hidden,
      ),
    [items],
  )

  const visibleColors = useMemo(
    () =>
      visibleItems.map(
        (item) =>
          randomColors.get(item.id) ??
          createRandomColor(),
      ),
    [visibleItems, randomColors],
  )

  /*
   * Keep the latest visible items
   * available to the wheel callbacks.
   */
  const itemsRef =
    useRef(visibleItems)

  useEffect(() => {
    itemsRef.current =
      visibleItems
  }, [visibleItems])

  /*
   * Keep the latest result callback
   * without recreating the wheel.
   */
  const onResultRef =
    useRef(onResult)

  useEffect(() => {
    onResultRef.current =
      onResult
  }, [onResult])

  /*
   * Initialise Web Audio after interaction.
   */
  const getAudioContext =
    useCallback(() => {
      if (
        typeof window === "undefined"
      ) {
        return null
      }

      if (
        !audioContextRef.current
      ) {
        const AudioContextClass =
          window.AudioContext ??
          (
            window as Window & {
              webkitAudioContext?: typeof AudioContext
            }
          ).webkitAudioContext

        if (!AudioContextClass) {
          return null
        }

        audioContextRef.current =
          new AudioContextClass()
      }

      if (
        audioContextRef.current.state ===
        "suspended"
      ) {
        void audioContextRef.current.resume()
      }

      return audioContextRef.current
    }, [])

  /*
   * Update the arrow colour to match
   * the segment currently underneath it.
   */
  const updatePointerColor =
    useCallback(
      (index: number) => {
        const color =
          visibleColors[index]

        if (color) {
          setPointerColor(color)
        }
      },
      [visibleColors],
    )

  /*
   * Launch the confetti celebration.
   */
  const launchConfetti =
    useCallback(() => {
      if (
        confettiTimerRef.current
      ) {
        clearTimeout(
          confettiTimerRef.current,
        )
      }

      setConfetti(createConfetti())

      confettiTimerRef.current =
        setTimeout(() => {
          setConfetti([])

          confettiTimerRef.current =
            null
        }, 2800)
    }, [])

  /*
   * Spin to a random visible entry.
   */
  const spin = useCallback(() => {
    const wheel =
      wheelRef.current

    if (
      !wheel ||
      visibleItems.length === 0 ||
      spinningRef.current
    ) {
      return
    }

    const audio =
      getAudioContext()

    if (audio) {
      void audio.resume()
    }

    const selectedIndex =
      Math.floor(
        Math.random() *
          visibleItems.length,
      )

    spinningRef.current = true

    setIsSpinning(true)

    setConfetti([])

    lastTickIndexRef.current = null

    wheel.spinToItem(
      selectedIndex,
      4400,
      true,
      6,
      1,
    )
  }, [
    getAudioContext,
    visibleItems.length,
  ])

  /*
   * Ctrl + Enter shortcut.
   */
  useEffect(() => {
    const handleKeyDown = (
      event: globalThis.KeyboardEvent,
    ) => {
      if (
        event.ctrlKey &&
        event.key === "Enter"
      ) {
        event.preventDefault()

        getAudioContext()

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
  }, [
    getAudioContext,
    spin,
  ])

  /*
   * Create the actual spin-wheel instance.
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

    if (visibleItems.length === 0) {
      currentIndexRef.current = 0

      setPointerColor("#60a5fa")

      return
    }

    /*
     * Preserve the current segment where possible.
     */
    const initialIndex = Math.min(
      currentIndexRef.current,
      visibleItems.length - 1,
    )

    currentIndexRef.current =
      initialIndex

    const initialColor =
      visibleColors[initialIndex]

    if (initialColor) {
      setPointerColor(
        initialColor,
      )
    }

    const wheel =
      new SpinWheel(container, {
        items: visibleItems.map(
          (item, index) => ({
            label:
              item.label ||
              "Untitled",

            value: item.id,

            weight:
              item.weight ?? 1,

            backgroundColor:
              visibleColors[index],

            labelColor:
              "#111111",
          }),
        ),

        radius: 0.965,

        /*
         * Pointer is positioned on the
         * right-hand side.
         */
        pointerAngle: 0,

        borderWidth: 2.5,

        borderColor:
          "rgba(255,255,255,0.72)",

        lineWidth: 1.5,

        lineColor:
          "rgba(255,255,255,0.42)",

        /*
         * Radial entry labels.
         */
        itemLabelAlign: "right",

        itemLabelRadius: 0.79,

        itemLabelRadiusMax: 0.27,

        itemLabelFont:
          "Inter, ui-sans-serif, system-ui, sans-serif",

        itemLabelFontSizeMax: 43,

        /*
         * Strong white outline around
         * the entry text.
         */
        itemLabelStrokeColor:
          "rgba(255,255,255,0.78)",

        itemLabelStrokeWidth: 1.7,

        itemLabelBaselineOffset: 0,

        /*
         * Wheel controls are handled by
         * our React component.
         */
        isInteractive: false,

        rotationResistance: -35,

        rotationSpeedMax: 1000,

        /*
         * Tick whenever the pointer enters
         * another segment.
         */
        onCurrentIndexChange: (
          event,
        ) => {
          const index =
            event.currentIndex

          currentIndexRef.current =
            index

          updatePointerColor(index)

          if (
            lastTickIndexRef.current !==
            index
          ) {
            lastTickIndexRef.current =
              index

            if (
              spinningRef.current
            ) {
              playTick(
                audioContextRef.current,
              )
            }
          }
        },

        /*
         * Winner.
         */
        onRest: (event) => {
          const selectedIndex =
            event.currentIndex

          const selectedItem =
            itemsRef.current[
              selectedIndex
            ]

          currentIndexRef.current =
            selectedIndex

          updatePointerColor(
            selectedIndex,
          )

          spinningRef.current =
            false

          setIsSpinning(false)

          /*
           * Subdued applause.
           */
          playApplause(
            audioContextRef.current,
          )

          /*
           * Confetti celebration.
           */
          launchConfetti()

          if (selectedItem) {
            onResultRef.current?.(
              selectedItem,
            )
          }
        },
      })

    wheelRef.current = wheel

    const actualIndex =
      wheel.getCurrentIndex()

    currentIndexRef.current =
      actualIndex

    updatePointerColor(
      actualIndex,
    )

    lastTickIndexRef.current =
      actualIndex

    return () => {
      wheel.remove()

      wheelRef.current = null

      spinningRef.current = false
    }
  }, [
    visibleItems,
    visibleColors,
    updatePointerColor,
    launchConfetti,
  ])

  /*
   * Cleanup audio and confetti.
   */
  useEffect(() => {
    return () => {
      if (
        confettiTimerRef.current
      ) {
        clearTimeout(
          confettiTimerRef.current,
        )
      }

      if (
        audioContextRef.current
      ) {
        void audioContextRef.current.close()
      }
    }
  }, [])

  /*
   * Clicking the wheel starts spinning.
   */
  const handleWheelClick = () => {
    if (
      visibleItems.length === 0 ||
      spinningRef.current
    ) {
      return
    }

    spin()
  }

  /*
   * Keyboard activation.
   */
  const handleWheelKeyDown = (
    event: KeyboardEvent,
  ) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault()

      handleWheelClick()
    }
  }

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-background">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.045),transparent_60%)]" />

      {visibleItems.length > 0 ? (
        <div
          className="relative aspect-square w-[min(78vw,calc(100vh-130px),1000px)] max-w-[94%] drop-shadow-[0_14px_28px_rgba(0,0,0,0.42)]"
          onClick={handleWheelClick}
          role="button"
          tabIndex={0}
          aria-label="Spin wheel"
          onKeyDown={handleWheelKeyDown}
        >
          {/* Wheel */}
          <div
            ref={containerRef}
            className="absolute inset-0 overflow-visible"
          />

          {/* Pointer */}
          <div
            className="pointer-events-none absolute right-[-13px] top-1/2 z-40 -translate-y-1/2"
            aria-hidden="true"
          >
            <div
              className="relative h-[62px] w-[64px]"
              style={{
                filter:
                  "drop-shadow(0 3px 5px rgba(0,0,0,0.75)) drop-shadow(0 0 2px rgba(255,255,255,0.65))",
              }}
            >
              {/* Dark outline */}
              <div
                className="absolute inset-0"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 77% 50%)",
                  background:
                    "rgba(15,23,42,0.92)",
                }}
              />

              {/* White outline */}
              <div
                className="absolute inset-[2px]"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 77% 50%)",
                  background:
                    "rgba(255,255,255,0.78)",
                }}
              />

              {/* Coloured pointer */}
              <div
                className="absolute inset-[4px]"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 77% 50%)",
                  backgroundColor:
                    pointerColor,
                  transition:
                    "background-color 90ms ease",
                  boxShadow:
                    "inset 0 1px 2px rgba(255,255,255,0.45)",
                }}
              />
            </div>
          </div>

          {/* White centre */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[17%] w-[17%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_3px_14px_rgba(0,0,0,0.24)]" />

          {/* Curved instructions */}
          {!isSpinning && (
            <svg
              className="pointer-events-none absolute inset-0 z-35 h-full w-full overflow-visible"
              viewBox="0 0 1000 1000"
              aria-hidden="true"
            >
              <defs>
                <path
                  id="spin-text-top"
                  d="M 230 355 A 300 300 0 0 1 770 355"
                  fill="none"
                />

                <path
                  id="spin-text-bottom"
                  d="M 275 650 A 265 265 0 0 0 725 650"
                  fill="none"
                />
              </defs>

              {/* Top shadow */}
              <text
                fill="rgba(0,0,0,0.58)"
                fontSize="48"
                fontWeight="800"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-1.5"
                textAnchor="middle"
                paintOrder="stroke"
                stroke="rgba(0,0,0,0.42)"
                strokeWidth="5"
                dy="6"
              >
                <textPath
                  href="#spin-text-top"
                  startOffset="50%"
                >
                  Click to spin
                </textPath>
              </text>

              {/* Top text */}
              <text
                fill="#ffffff"
                fontSize="48"
                fontWeight="800"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-1.5"
                textAnchor="middle"
                paintOrder="stroke"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
              >
                <textPath
                  href="#spin-text-top"
                  startOffset="50%"
                >
                  Click to spin
                </textPath>
              </text>

              {/* Bottom shadow */}
              <text
                fill="rgba(0,0,0,0.58)"
                fontSize="34"
                fontWeight="800"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-0.7"
                textAnchor="middle"
                paintOrder="stroke"
                stroke="rgba(0,0,0,0.42)"
                strokeWidth="4"
                dy="6"
              >
                <textPath
                  href="#spin-text-bottom"
                  startOffset="50%"
                >
                  or press ctrl+enter
                </textPath>
              </text>

              {/* Bottom text */}
              <text
                fill="#ffffff"
                fontSize="34"
                fontWeight="800"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-0.7"
                textAnchor="middle"
              >
                <textPath
                  href="#spin-text-bottom"
                  startOffset="50%"
                >
                  or press ctrl+enter
                </textPath>
              </text>
            </svg>
          )}

          {/* Confetti */}
          {confetti.length > 0 && (
            <div
              className="pointer-events-none absolute inset-0 z-50 overflow-visible"
              aria-hidden="true"
            >
              {confetti.map(
                (piece) => {
                  const style: CSSProperties = {
                    left: `${piece.x}%`,
                    top: `${piece.y}%`,
                    width: `${piece.size}px`,
                    height:
                      piece.shape ===
                      "rectangle"
                        ? `${piece.size * 1.8}px`
                        : `${piece.size}px`,
                    backgroundColor:
                      piece.color,
                    transform:
                      `rotate(${piece.rotation}deg)`,
                    animationDelay:
                      `${piece.delay}s`,
                    animationDuration:
                      `${piece.duration}s`,
                  }

                  return (
                    <span
                      key={piece.id}
                      className="absolute rounded-[1px] shadow-sm animate-[confetti-fall_1.8s_ease-out_forwards]"
                      style={style}
                    />
                  )
                },
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-square w-[min(62vw,calc(100vh-180px),760px)] max-w-[78%] items-center justify-center rounded-full border border-border/70 bg-card/30 shadow-xl">
          <div className="px-6 text-center">
            <p className="text-lg font-semibold">
              Your wheel is empty
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Add entries from the sidebar
              to get started.
            </p>
          </div>
        </div>
      )}

      {/* Confetti animation */}
      <style>
        {`
          @keyframes confetti-fall {
            0% {
              opacity: 0;
              transform:
                translate3d(0, -10px, 0)
                rotate(0deg)
                scale(0.7);
            }

            8% {
              opacity: 1;
            }

            100% {
              opacity: 0;
              transform:
                translate3d(0, 420px, 0)
                rotate(720deg)
                scale(1);
            }
          }
        `}
      </style>
    </div>
  )
}
