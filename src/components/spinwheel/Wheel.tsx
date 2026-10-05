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
  size: number
  rotation: number
  delay: number
  duration: number
  drift: number
  color: string
  width: number
  height: number
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
  const saturation = 52 + Math.floor(Math.random() * 12)
  const lightness = 56 + Math.floor(Math.random() * 10)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

/* -------------------------------------------------------------------------- */
/* Stable colours                                                             */
/* -------------------------------------------------------------------------- */

function useRandomItemColors(items: SpinWheelItem[]) {
  const colorsRef = useRef(new Map<string, string>())

  return useMemo(() => {
    const colors = colorsRef.current

    const ids = new Set(items.map((item) => item.id))

    for (const id of colors.keys()) {
      if (!ids.has(id)) {
        colors.delete(id)
      }
    }

    for (const item of items) {
      if (!colors.has(item.id)) {
        colors.set(
          item.id,
          item.color ?? createRandomColor(),
        )
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

  const oscillator =
    audioContext.createOscillator()

  const gain =
    audioContext.createGain()

  oscillator.type = "square"

  oscillator.frequency.setValueAtTime(
    1700,
    now,
  )

  oscillator.frequency.exponentialRampToValueAtTime(
    850,
    now + 0.022,
  )

  gain.gain.setValueAtTime(
    0.0001,
    now,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.028,
    now + 0.0015,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.032,
  )

  oscillator.connect(gain)
  gain.connect(audioContext.destination)

  oscillator.start(now)
  oscillator.stop(now + 0.038)
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

  const master =
    audioContext.createGain()

  master.gain.setValueAtTime(
    0.0001,
    now,
  )

  master.gain.exponentialRampToValueAtTime(
    0.055,
    now + 0.08,
  )

  master.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 1.15,
  )

  master.connect(
    audioContext.destination,
  )

  for (
    let index = 0;
    index < 34;
    index += 1
  ) {
    const offset =
      Math.random() * 0.85

    const duration =
      0.035 +
      Math.random() * 0.07

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
      const envelope =
        1 -
        sample / bufferSize

      data[sample] =
        (Math.random() * 2 - 1) *
        envelope
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
      1100 +
      Math.random() * 2200

    filter.Q.value = 0.65

    const start =
      now + offset

    gain.gain.setValueAtTime(
      0.0001,
      start,
    )

    gain.gain.exponentialRampToValueAtTime(
      0.008 +
        Math.random() * 0.014,
      start + 0.005,
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
    {
      length: 85,
    },
    (_, index) => {
      const size =
        4 + Math.random() * 5

      return {
        id:
          Date.now() +
          index +
          Math.floor(
            Math.random() * 10000,
          ),

        x:
          Math.random() * 100,

        y:
          -5 -
          Math.random() * 18,

        size,

        rotation:
          Math.random() * 360,

        delay:
          Math.random() * 0.55,

        duration:
          2.4 +
          Math.random() * 1.8,

        drift:
          -140 +
          Math.random() * 280,

        color:
          CONFETTI_COLORS[
            Math.floor(
              Math.random() *
                CONFETTI_COLORS.length,
            )
          ],

        width:
          size *
          (0.65 +
            Math.random() * 0.65),

        height:
          size *
          (1.3 +
            Math.random() * 1.2),
      }
    },
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

  const [winner, setWinner] =
    useState<SpinWheelItem | null>(null)

  const [pointerColor, setPointerColor] =
    useState("#5fc78b")

  const [confetti, setConfetti] =
    useState<ConfettiPiece[]>([])

  const randomColors =
    useRandomItemColors(items)

  /*
   * Hidden entries do not appear on
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
          item.color ??
          "#60a5fa",
      ),
    [
      visibleItems,
      randomColors,
    ],
  )

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

  /* ---------------------------------------------------------------------- */
  /* Audio context                                                          */
  /* ---------------------------------------------------------------------- */

  const getAudioContext =
    useCallback(() => {
      if (
        typeof window ===
        "undefined"
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

  /* ---------------------------------------------------------------------- */
  /* Pointer                                                                */
  /* ---------------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------------- */
  /* Confetti                                                               */
  /* ---------------------------------------------------------------------- */

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
        }, 4700)
    }, [])

  /* ---------------------------------------------------------------------- */
  /* Spin                                                                   */
  /* ---------------------------------------------------------------------- */

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

    setWinner(null)
    setConfetti([])

    lastTickIndexRef.current =
      null

    const selectedIndex =
      Math.floor(
        Math.random() *
          visibleItems.length,
      )

    spinningRef.current = true

    setIsSpinning(true)

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

  /* ---------------------------------------------------------------------- */
  /* Ctrl + Enter                                                           */
  /* ---------------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------------- */
  /* Create wheel                                                           */
  /* ---------------------------------------------------------------------- */

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

    if (
      visibleItems.length === 0
    ) {
      currentIndexRef.current = 0

      setPointerColor(
        "#5fc78b",
      )

      return
    }

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
      new SpinWheel(
        container,
        {
          items:
            visibleItems.map(
              (item, index) => ({
                label:
                  item.label ||
                  "Untitled",

                value:
                  item.id,

                weight:
                  item.weight ?? 1,

                backgroundColor:
                  visibleColors[
                    index
                  ],

                labelColor:
                  "#111111",
              }),
            ),

          /*
           * Wheel of Names uses a very
           * clean, almost full-size circle.
           */
          radius: 0.985,

          /*
           * Pointer is on the right.
           */
          pointerAngle: 0,

          /*
           * Thin outer edge.
           */
          borderWidth: 1,

          borderColor:
            "rgba(0,0,0,0.22)",

          /*
           * No obvious segment outlines.
           */
          lineWidth: 0,

          lineColor:
            "transparent",

          /*
           * This is the important part
           * for the Wheel of Names look.
           */
          itemLabelAlign: "right",

          itemLabelRadius: 0.79,

          itemLabelRadiusMax: 0.3,

          itemLabelFont:
            "Arial, Helvetica, sans-serif",

          itemLabelFontSizeMax: 42,

          /*
           * No white outline.
           * The recording has clean black
           * lettering directly on the wheel.
           */
          itemLabelStrokeWidth: 0,

          itemLabelBaselineOffset: 0,

          /*
           * The React wrapper handles
           * the click itself.
           */
          isInteractive: false,

          rotationResistance: -35,

          rotationSpeedMax: 1000,

          /* -------------------------------------------------------------- */
          /* Segment change                                                  */
          /* -------------------------------------------------------------- */

          onCurrentIndexChange:
            (event) => {
              const index =
                event.currentIndex

              currentIndexRef.current =
                index

              updatePointerColor(
                index,
              )

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

          /* -------------------------------------------------------------- */
          /* Winner                                                           */
          /* -------------------------------------------------------------- */

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

            if (selectedItem) {
              setWinner(
                selectedItem,
              )

              playApplause(
                audioContextRef.current,
              )

              launchConfetti()

              onResultRef.current?.(
                selectedItem,
              )
            }
          },
        },
      )

    wheelRef.current =
      wheel

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

      spinningRef.current =
        false
    }
  }, [
    visibleItems,
    visibleColors,
    updatePointerColor,
    launchConfetti,
  ])

  /* ---------------------------------------------------------------------- */
  /* Cleanup                                                                */
  /* ---------------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------------- */
  /* Wheel click                                                             */
  /* ---------------------------------------------------------------------- */

  const handleWheelClick =
    () => {
      if (
        visibleItems.length === 0 ||
        spinningRef.current
      ) {
        return
      }

      spin()
    }

  /* ---------------------------------------------------------------------- */
  /* Keyboard                                                                */
  /* ---------------------------------------------------------------------- */

  const handleWheelKeyDown =
    (
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

  /* ---------------------------------------------------------------------- */
  /* Winner actions                                                          */
  /* ---------------------------------------------------------------------- */

  const closeWinner =
    () => {
      setWinner(null)
    }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className="
        relative
        flex
        h-full
        min-h-0
        w-full
        items-center
        justify-center
        overflow-hidden
        bg-[#080b0e]
      "
    >
      {/* ------------------------------------------------------------------ */}
      {/* Wheel of Names style background                                    */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_38%_38%,rgba(33,70,82,0.42),transparent_48%),radial-gradient(circle_at_80%_25%,rgba(81,42,91,0.32),transparent_45%),linear-gradient(135deg,#07151b_0%,#080b0e_48%,#150b17_100%)]
        "
      />

      {/* ------------------------------------------------------------------ */}
      {/* Confetti                                                            */}
      {/* ------------------------------------------------------------------ */}

      {confetti.length > 0 && (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            z-[80]
            overflow-hidden
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
                    `${piece.width}px`,

                  height:
                    `${piece.height}px`,

                  backgroundColor:
                    piece.color,

                  animationDelay:
                    `${piece.delay}s`,

                  animationDuration:
                    `${piece.duration}s`,

                  ["--confetti-drift" as string]:
                    `${piece.drift}px`,

                  ["--confetti-rotation" as string]:
                    `${piece.rotation}deg`,
                }

              return (
                <span
                  key={piece.id}
                  className="
                    absolute
                    rounded-[1px]
                    opacity-0
                    shadow-[0_1px_3px_rgba(0,0,0,0.35)]
                    animate-[mpd-confetti-fall_linear_forwards]
                  "
                  style={style}
                />
              )
            },
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Wheel                                                               */}
      {/* ------------------------------------------------------------------ */}

      {visibleItems.length > 0 ? (
        <div
          className="
            relative
            aspect-square
            w-[min(56vw,calc(100vh-145px),720px)]
            max-w-[78%]
            overflow-visible
          "
          onClick={
            handleWheelClick
          }
          role="button"
          tabIndex={0}
          aria-label="Spin wheel"
          onKeyDown={
            handleWheelKeyDown
          }
        >
          {/* Actual wheel */}
          <div
            ref={containerRef}
            className="
              absolute
              inset-0
              overflow-visible
              rounded-full
              shadow-[0_8px_25px_rgba(0,0,0,0.45)]
            "
          />

          {/* ---------------------------------------------------------------- */}
          {/* Pointer                                                          */}
          {/* ---------------------------------------------------------------- */}

          <div
            className="
              pointer-events-none
              absolute
              right-[-10px]
              top-1/2
              z-40
              -translate-y-1/2
            "
            aria-hidden="true"
          >
            <div
              className="
                relative
                h-[42px]
                w-[46px]
              "
              style={{
                filter:
                  "drop-shadow(0 2px 3px rgba(0,0,0,0.65))",
              }}
            >
              {/* Dark outline */}
              <div
                className="
                  absolute
                  inset-0
                "
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 79% 50%)",

                  background:
                    "rgba(20,32,27,0.85)",
                }}
              />

              {/* Actual pointer */}
              <div
                className="
                  absolute
                  inset-[2px]
                "
                style={{
                  clipPath:
                    "polygon(100% 0, 0 50%, 100% 100%, 79% 50%)",

                  background:
                    pointerColor,

                  transition:
                    "background-color 90ms ease",
                }}
              />

              {/* Soft pointer highlight */}
              <div
                className="
                  absolute
                  left-[19%]
                  top-[20%]
                  h-[15%]
                  w-[47%]
                  rounded-full
                  bg-white/20
                  blur-[1px]
                "
              />
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* White centre                                                     */}
          {/* ---------------------------------------------------------------- */}

          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-1/2
              z-30
              h-[12%]
              w-[12%]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              bg-white
              shadow-[0_2px_8px_rgba(0,0,0,0.28)]
            "
          />

          {/* ---------------------------------------------------------------- */}
          {/* Instructions                                                     */}
          {/* ---------------------------------------------------------------- */}

          {!isSpinning &&
            !winner && (
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
                    id="wheel-text-top"
                    d="
                      M 285 405
                      Q 500 245 715 405
                    "
                    fill="none"
                  />

                  <path
                    id="wheel-text-bottom"
                    d="
                      M 315 595
                      Q 500 710 685 595
                    "
                    fill="none"
                  />
                </defs>

                {/* Top text outline */}
                <text
                  fill="#ffffff"
                  fontSize="48"
                  fontWeight="800"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-1.2"
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.55)"
                  strokeWidth="5"
                >
                  <textPath
                    href="#wheel-text-top"
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
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-1.2"
                  textAnchor="middle"
                >
                  <textPath
                    href="#wheel-text-top"
                    startOffset="50%"
                  >
                    Click to spin
                  </textPath>
                </text>

                {/* Bottom text outline */}
                <text
                  fill="#ffffff"
                  fontSize="32"
                  fontWeight="800"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-0.5"
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.55)"
                  strokeWidth="4"
                >
                  <textPath
                    href="#wheel-text-bottom"
                    startOffset="50%"
                  >
                    or press ctrl+enter
                  </textPath>
                </text>

                {/* Bottom text */}
                <text
                  fill="#ffffff"
                  fontSize="32"
                  fontWeight="800"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-0.5"
                  textAnchor="middle"
                >
                  <textPath
                    href="#wheel-text-bottom"
                    startOffset="50%"
                  >
                    or press ctrl+enter
                  </textPath>
                </text>
              </svg>
            )}

          {/* ---------------------------------------------------------------- */}
          {/* Winner popup                                                     */}
          {/* ---------------------------------------------------------------- */}

          {winner && (
            <div
              className="
                pointer-events-auto
                absolute
                left-1/2
                top-1/2
                z-[70]
                w-[min(430px,78%)]
                -translate-x-1/2
                -translate-y-1/2
                overflow-hidden
                rounded-[3px]
                bg-[#191919]
                shadow-[0_12px_40px_rgba(0,0,0,0.55)]
              "
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* Green header */}
              <div
                className="
                  flex
                  h-[43px]
                  items-center
                  bg-[#79d99f]
                  px-3
                  text-[14px]
                  font-bold
                  text-[#111]
                "
              >
                We have a winner!
              </div>

              {/* Winner name */}
              <div
                className="
                  flex
                  min-h-[88px]
                  items-center
                  justify-center
                  px-5
                  text-center
                  text-[31px]
                  font-normal
                  tracking-[-0.8px]
                  text-white
                "
              >
                {winner.label}
              </div>

              {/* Actions */}
              <div
                className="
                  flex
                  items-center
                  justify-end
                  gap-2
                  px-3
                  pb-7
                  pt-0
                "
              >
                <button
                  type="button"
                  onClick={
                    closeWinner
                  }
                  className="
                    rounded
                    px-2.5
                    py-1.5
                    text-[10px]
                    font-bold
                    text-white
                    transition
                    hover:bg-white/10
                  "
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={
                    closeWinner
                  }
                  className="
                    rounded-[2px]
                    bg-[#5147bd]
                    px-3
                    py-1.5
                    text-[10px]
                    font-bold
                    text-white
                    shadow-sm
                    transition
                    hover:bg-[#5d53cf]
                  "
                >
                  Remove
                </button>

                <button
                  type="button"
                  onClick={
                    closeWinner
                  }
                  className="
                    rounded-[2px]
                    bg-[#5147bd]
                    px-3
                    py-1.5
                    text-[10px]
                    font-bold
                    text-white
                    shadow-sm
                    transition
                    hover:bg-[#5d53cf]
                  "
                >
                  Hide
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className="
            flex
            aspect-square
            w-[min(52vw,calc(100vh-180px),620px)]
            max-w-[70%]
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-black/20
            shadow-[0_15px_40px_rgba(0,0,0,0.45)]
          "
        >
          <div className="px-6 text-center">
            <p className="text-lg font-semibold text-white">
              Your wheel is empty
            </p>

            <p className="mt-2 text-sm text-white/50">
              Add entries from the sidebar
              to get started.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Confetti animation                                                  */}
      {/* ------------------------------------------------------------------ */}

      <style>
        {`
          @keyframes mpd-confetti-fall {
            0% {
              opacity: 0;
              transform:
                translate3d(0, -20px, 0)
                rotate(0deg);
            }

            8% {
              opacity: 1;
            }

            55% {
              opacity: 1;
            }

            100% {
              opacity: 0;
              transform:
                translate3d(
                  var(--confetti-drift),
                  105vh,
                  0
                )
                rotate(
                  var(--confetti-rotation)
                );
            }
          }
        `}
      </style>
    </div>
  )
}
