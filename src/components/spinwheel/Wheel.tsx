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
  const saturation = 58 + Math.floor(Math.random() * 18)
  const lightness = 62 + Math.floor(Math.random() * 14)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function useRandomItemColors(items: SpinWheelItem[]) {
  const colorsRef = useRef(new Map<string, string>())

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
        colors.set(item.id, item.color ?? createRandomColor())
      }
    }

    return new Map(colors)
  }, [items])
}

/* -------------------------------------------------------------------------- */
/* Audio                                                                      */
/* -------------------------------------------------------------------------- */

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

  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()

  oscillator.type = "square"

  oscillator.frequency.setValueAtTime(
    1500,
    now,
  )

  oscillator.frequency.exponentialRampToValueAtTime(
    700,
    now + 0.025,
  )

  gain.gain.setValueAtTime(
    0.0001,
    now,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.045,
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

  const master = audioContext.createGain()

  master.gain.setValueAtTime(
    0.0001,
    now,
  )

  master.gain.exponentialRampToValueAtTime(
    0.08,
    now + 0.08,
  )

  master.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 1.05,
  )

  master.connect(
    audioContext.destination,
  )

  for (let index = 0; index < 28; index += 1) {
    const offset =
      Math.random() * 0.85

    const duration =
      0.035 +
      Math.random() * 0.075

    const bufferSize = Math.floor(
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
      0.012 +
        Math.random() * 0.018,
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

/* -------------------------------------------------------------------------- */
/* Confetti                                                                   */
/* -------------------------------------------------------------------------- */

function createConfetti(): ConfettiPiece[] {
  return Array.from(
    { length: 65 },
    (_, index) => ({
      id:
        Date.now() +
        index,

      x:
        20 +
        Math.random() * 60,

      y:
        35 +
        Math.random() * 15,

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

/* -------------------------------------------------------------------------- */
/* Wheel                                                                      */
/* -------------------------------------------------------------------------- */

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

  const randomColors =
    useRandomItemColors(items)

  /*
   * Hidden entries are not placed onto
   * the actual wheel.
   */
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => !item.hidden,
      ),
    [items],
  )

  /*
   * Keep the exact colour associated
   * with each visible entry.
   */
  const visibleColors = useMemo(
    () =>
      visibleItems.map(
        (item) =>
          randomColors.get(item.id) ??
          item.color ??
          "#60a5fa",
      ),
    [
      visibleItems,
      randomColors,
    ],
  )

  /*
   * Keep callbacks supplied by the parent
   * without rebuilding the wheel.
   */
  const itemsRef =
    useRef(visibleItems)

  useEffect(() => {
    itemsRef.current =
      visibleItems
  }, [visibleItems])

  const onResultRef =
    useRef(onResult)

  useEffect(() => {
    onResultRef.current =
      onResult
  }, [onResult])

  /*
   * Web Audio.
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
   * The pointer colour is always taken
   * directly from the entry currently
   * underneath the pointer.
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
   * Confetti.
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

      setConfetti(
        createConfetti(),
      )

      confettiTimerRef.current =
        setTimeout(() => {
          setConfetti([])

          confettiTimerRef.current =
            null
        }, 2800)
    }, [])

  /*
   * Start spinning.
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
   * Ctrl + Enter.
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
   * Create the actual wheel.
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
     * Keep the previous segment selected
     * when possible.
     */
    const initialIndex =
      Math.min(
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
        items:
          visibleItems.map(
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

        /*
         * Large wheel like Wheel of Names.
         */
        radius: 0.975,

        /*
         * Pointer sits on the right.
         */
        pointerAngle: 0,

        /*
         * Only the outside edge remains.
         *
         * Segment divider lines are completely
         * removed to match the reference.
         */
        borderWidth: 3,

        borderColor:
          "rgba(15,23,42,0.58)",

        lineWidth: 0,

        lineColor:
          "transparent",

        /*
         * Large radial labels.
         */
        itemLabelAlign: "right",

        itemLabelRadius: 0.79,

        itemLabelRadiusMax: 0.28,

        itemLabelFont:
          "Inter, ui-sans-serif, system-ui, sans-serif",

        itemLabelFontSizeMax: 43,

        /*
         * Black lettering with a strong
         * white contour so every name stands
         * out from its coloured segment.
         */
        itemLabelStrokeColor:
          "rgba(255,255,255,0.92)",

        itemLabelStrokeWidth: 2.5,

        itemLabelBaselineOffset: 0,

        /*
         * React controls interaction.
         */
        isInteractive: false,

        rotationResistance: -35,

        rotationSpeedMax: 1000,

        /*
         * Update the pointer to the exact
         * segment currently underneath it.
         */
        onCurrentIndexChange: (
          event,
        ) => {
          const index =
            event.currentIndex

          currentIndexRef.current =
            index

          /*
           * This is intentionally based on
           * the same colour array used to
           * create the wheel.
           *
           * Therefore the arrow and segment
           * cannot receive different colours.
           */
          updatePointerColor(index)

          /*
           * Tick once per segment.
           */
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
         * Spin complete.
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

          playApplause(
            audioContextRef.current,
          )

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
   * Cleanup.
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
   * Wheel click.
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
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035),transparent_62%)]" />

      {visibleItems.length > 0 ? (
        <div
          className="
            relative
            aspect-square
            w-[min(78vw,calc(100vh-130px),1000px)]
            max-w-[94%]
            overflow-visible
            drop-shadow-[0_18px_34px_rgba(0,0,0,0.52)]
          "
          onClick={handleWheelClick}
          role="button"
          tabIndex={0}
          aria-label="Spin wheel"
          onKeyDown={
            handleWheelKeyDown
          }
        >
          {/* ---------------------------------------------------------------- */}
          {/* Wheel                                                            */}
          {/* ---------------------------------------------------------------- */}

          <div
            ref={containerRef}
            className="
              absolute
              inset-0
              overflow-visible
              rounded-full
              drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)]
            "
          />

          {/* ---------------------------------------------------------------- */}
          {/* 3D Pointer                                                       */}
          {/* ---------------------------------------------------------------- */}

          <div
            className="
              pointer-events-none
              absolute
              right-[-13px]
              top-1/2
              z-40
              -translate-y-1/2
            "
            aria-hidden="true"
          >
            <div
              className="
                relative
                h-[64px]
                w-[70px]
              "
              style={{
                filter:
                  "drop-shadow(0 5px 6px rgba(0,0,0,0.72)) drop-shadow(0 1px 1px rgba(0,0,0,0.9))",
              }}
            >
              {/* Deep outer contour */}
              <div
                className="absolute inset-0"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 77% 50%)",
                  background:
                    "linear-gradient(180deg,#111827 0%,#020617 48%,#111827 100%)",
                }}
              />

              {/* Metallic/light edge */}
              <div
                className="absolute inset-[2px]"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 77% 50%)",
                  background:
                    "linear-gradient(180deg,rgba(255,255,255,0.95) 0%,rgba(255,255,255,0.58) 48%,rgba(255,255,255,0.9) 100%)",
                }}
              />

              {/* Exact segment colour */}
              <div
                className="absolute inset-[4px]"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 77% 50%)",
                  background:
                    `linear-gradient(180deg, ${pointerColor}, color-mix(in srgb, ${pointerColor} 78%, #000 22%))`,
                  transition:
                    "background 90ms ease",
                }}
              />

              {/* Highlight */}
              <div
                className="absolute inset-[5px]"
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 77% 50%)",
                  background:
                    "linear-gradient(180deg,rgba(255,255,255,0.28) 0%,rgba(255,255,255,0.05) 45%,rgba(0,0,0,0.12) 100%)",
                }}
              />

              {/* Small glossy edge */}
              <div
                className="absolute left-[10%] top-[19%] h-[10%] w-[48%] rounded-full bg-white/35 blur-[1px]"
              />
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Centre                                                           */}
          {/* ---------------------------------------------------------------- */}

          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-1/2
              z-30
              h-[17%]
              w-[17%]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              border
              border-black/10
              bg-white
              shadow-[0_5px_18px_rgba(0,0,0,0.32),inset_0_1px_2px_rgba(255,255,255,0.95)]
            "
          />

          {/* ---------------------------------------------------------------- */}
          {/* Instructions                                                     */}
          {/* ---------------------------------------------------------------- */}

          {!isSpinning && (
            <svg
              className="
                pointer-events-none
                absolute
                inset-0
                z-35
                h-full
                w-full
                overflow-visible
              "
              viewBox="0 0 1000 1000"
              aria-hidden="true"
            >
              <defs>
                <path
                  id="spin-text-top"
                  d="M 235 355 Q 500 170 765 355"
                  fill="none"
                />

                <path
                  id="spin-text-bottom"
                  d="M 270 650 Q 500 775 730 650"
                  fill="none"
                />
              </defs>

              {/* Top heavy shadow */}
              <text
                fill="#ffffff"
                fontSize="48"
                fontWeight="900"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-1.5"
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#111111"
                strokeWidth="8"
              >
                <textPath
                  href="#spin-text-top"
                  startOffset="50%"
                >
                  Click to spin
                </textPath>
              </text>

              {/* Top subtle highlight */}
              <text
                fill="#ffffff"
                fontSize="48"
                fontWeight="900"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-1.5"
                textAnchor="middle"
                opacity="0.98"
              >
                <textPath
                  href="#spin-text-top"
                  startOffset="50%"
                >
                  Click to spin
                </textPath>
              </text>

              {/* Bottom heavy shadow */}
              <text
                fill="#ffffff"
                fontSize="34"
                fontWeight="900"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-0.7"
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#111111"
                strokeWidth="7"
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
                fontWeight="900"
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

          {/* ---------------------------------------------------------------- */}
          {/* Confetti                                                         */}
          {/* ---------------------------------------------------------------- */}

          {confetti.length > 0 && (
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                z-50
                overflow-visible
              "
              aria-hidden="true"
            >
              {confetti.map(
                (piece) => {
                  const style: CSSProperties =
                    {
                      left:
                        `${piece.x}%`,

                      top:
                        `${piece.y}%`,

                      width:
                        `${piece.size}px`,

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
                      className="
                        absolute
                        rounded-[1px]
                        shadow-[0_1px_3px_rgba(0,0,0,0.35)]
                        animate-[confetti-fall_1.8s_ease-out_forwards]
                      "
                      style={style}
                    />
                  )
                },
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="
            flex
            aspect-square
            w-[min(62vw,calc(100vh-180px),760px)]
            max-w-[78%]
            items-center
            justify-center
            rounded-full
            border
            border-border/70
            bg-card/30
            shadow-[0_18px_40px_rgba(0,0,0,0.45)]
          "
        >
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

      {/* ------------------------------------------------------------------ */}
      {/* Confetti animation                                                 */}
      {/* ------------------------------------------------------------------ */}

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
