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
  compact?: boolean
  spinTrigger?: number
}

type ConfettiPiece = {
  id: number
  startX: number
  startY: number
  endX: number
  endY: number
  size: number
  rotation: number
  delay: number
  duration: number
  color: string
  width: number
  height: number
  scale: number
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
  const colorsRef = useRef(
    new Map<string, string>(),
  )

  return useMemo(() => {
    const colors = colorsRef.current

    const ids = new Set(
      items.map((item) => item.id),
    )

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

      /*
       * If an explicit colour was supplied by the
       * entry editor, always use it.
       */
      if (item.color) {
        colors.set(item.id, item.color)
      }
    }

    return new Map(colors)
  }, [items])
}

/* -------------------------------------------------------------------------- */
/* Audio                                                                      */
/* -------------------------------------------------------------------------- */

type AudioContextWithWebkit = typeof AudioContext & {
  new (): AudioContext
}

function getAudioContextClass() {
  if (
    typeof window === "undefined"
  ) {
    return null
  }

  const windowWithWebkit =
    window as Window & {
      webkitAudioContext?: AudioContextWithWebkit
    }

  return (
    window.AudioContext ??
    windowWithWebkit.webkitAudioContext ??
    null
  )
}

/*
 * Short mechanical wheel click.
 *
 * This deliberately uses:
 * - a triangle oscillator
 * - a tiny burst of filtered noise
 * - a very short envelope
 *
 * This sounds much closer to the sharp click heard
 * when Wheel of Names passes an entry.
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

  const now =
    audioContext.currentTime

  const master =
    audioContext.createGain()

  master.gain.setValueAtTime(
    0.0001,
    now,
  )

  master.gain.exponentialRampToValueAtTime(
    0.075,
    now + 0.001,
  )

  master.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.045,
  )

  master.connect(
    audioContext.destination,
  )

  /* Tonal click */

  const oscillator =
    audioContext.createOscillator()

  const oscillatorGain =
    audioContext.createGain()

  oscillator.type = "triangle"

  oscillator.frequency.setValueAtTime(
    1450,
    now,
  )

  oscillator.frequency.exponentialRampToValueAtTime(
    620,
    now + 0.028,
  )

  oscillatorGain.gain.setValueAtTime(
    0.0001,
    now,
  )

  oscillatorGain.gain.exponentialRampToValueAtTime(
    0.7,
    now + 0.001,
  )

  oscillatorGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.035,
  )

  oscillator.connect(
    oscillatorGain,
  )

  oscillatorGain.connect(master)

  oscillator.start(now)
  oscillator.stop(now + 0.045)

  /* Mechanical noise */

  const duration = 0.035

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
    let index = 0;
    index < bufferSize;
    index += 1
  ) {
    const envelope =
      Math.pow(
        1 - index / bufferSize,
        3,
      )

    data[index] =
      (Math.random() * 2 - 1) *
      envelope
  }

  const source =
    audioContext.createBufferSource()

  const filter =
    audioContext.createBiquadFilter()

  const noiseGain =
    audioContext.createGain()

  source.buffer = buffer

  filter.type = "highpass"
  filter.frequency.value = 1800
  filter.Q.value = 0.8

  noiseGain.gain.setValueAtTime(
    0.0001,
    now,
  )

  noiseGain.gain.exponentialRampToValueAtTime(
    0.22,
    now + 0.001,
  )

  noiseGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration,
  )

  source.connect(filter)
  filter.connect(noiseGain)
  noiseGain.connect(master)

  source.start(now)
  source.stop(
    now + duration + 0.005,
  )
}

/*
 * Short celebratory sound.
 *
 * This is intentionally musical rather than
 * sounding like broadband static.
 */
function playWinnerSound(
  audioContext: AudioContext | null,
) {
  if (!audioContext) {
    return
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume()
  }

  const now =
    audioContext.currentTime

  const master =
    audioContext.createGain()

  master.gain.setValueAtTime(
    0.0001,
    now,
  )

  master.gain.exponentialRampToValueAtTime(
    0.085,
    now + 0.035,
  )

  master.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 1.05,
  )

  master.connect(
    audioContext.destination,
  )

  /*
   * Three-note winner chime.
   */
  const notes = [
    {
      frequency: 523.25,
      start: 0,
      duration: 0.24,
    },
    {
      frequency: 659.25,
      start: 0.12,
      duration: 0.3,
    },
    {
      frequency: 783.99,
      start: 0.25,
      duration: 0.55,
    },
  ]

  for (const note of notes) {
    const oscillator =
      audioContext.createOscillator()

    const gain =
      audioContext.createGain()

    oscillator.type = "sine"

    const start =
      now + note.start

    const end =
      start + note.duration

    oscillator.frequency.setValueAtTime(
      note.frequency,
      start,
    )

    gain.gain.setValueAtTime(
      0.0001,
      start,
    )

    gain.gain.exponentialRampToValueAtTime(
      0.55,
      start + 0.025,
    )

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      end,
    )

    oscillator.connect(gain)
    gain.connect(master)

    oscillator.start(start)
    oscillator.stop(end + 0.03)
  }

  /*
   * Very subtle clap-like texture underneath
   * the chime so the result doesn't sound sterile.
   */
  for (
    let index = 0;
    index < 18;
    index += 1
  ) {
    const offset =
      0.18 +
      Math.random() * 0.75

    const duration =
      0.025 +
      Math.random() * 0.045

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
        Math.pow(
          1 - sample / bufferSize,
          4,
        )

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

    const start =
      now + offset

    source.buffer = buffer

    filter.type = "bandpass"

    filter.frequency.value =
      1600 +
      Math.random() * 1800

    filter.Q.value = 1.2

    gain.gain.setValueAtTime(
      0.0001,
      start,
    )

    gain.gain.exponentialRampToValueAtTime(
      0.035,
      start + 0.003,
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
      length: 105,
    },
    (_, index) => {
      const angle =
        Math.random() *
        Math.PI *
        2

      const distance =
        10 +
        Math.random() * 48

      const startX =
        50 +
        Math.cos(angle) *
          (3 + Math.random() * 4)

      const startY =
        50 +
        Math.sin(angle) *
          (3 + Math.random() * 4)

      const endX =
        50 +
        Math.cos(angle) *
          distance

      const endY =
        42 +
        Math.sin(angle) *
          distance

      const size =
        3 +
        Math.random() * 4

      return {
        id:
          Date.now() +
          index +
          Math.floor(
            Math.random() * 10000,
          ),

        startX,
        startY,
        endX,
        endY,

        size,

        rotation:
          Math.random() * 720 -
          360,

        delay:
          Math.random() *
          0.28,

        duration:
          1.8 +
          Math.random() * 1.6,

        color:
          CONFETTI_COLORS[
            Math.floor(
              Math.random() *
                CONFETTI_COLORS.length,
            )
          ],

        width:
          size *
          (0.7 +
            Math.random() * 0.7),

        height:
          size *
          (1.4 +
            Math.random() * 1.5),

        scale:
          0.7 +
          Math.random() * 0.7,
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
  compact = false,
  spinTrigger = 0,
}: WheelProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const wheelRef =
    useRef<SpinWheel | null>(null)

  const pointerRef =
    useRef<HTMLDivElement | null>(null)

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
    useState("#5fc78b")

  const [confetti, setConfetti] =
    useState<ConfettiPiece[]>([])

  /*
   * Hidden entries are not rendered.
   */
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => !item.hidden,
      ),
    [items],
  )

  const randomColors =
    useRandomItemColors(
      visibleItems,
    )

  const visibleColors = useMemo(
    () =>
      visibleItems.map(
        (item) =>
          item.color ??
          randomColors.get(item.id) ??
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

  const colorsRef =
    useRef(visibleColors)

  useEffect(() => {
    colorsRef.current =
      visibleColors
  }, [visibleColors])

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
          getAudioContextClass()

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

  /*
   * This updates the DOM immediately.
   *
   * Previously this was only React state, which could
   * leave the arrow one frame behind the actual slice.
   */
  const setPointerForIndex =
    useCallback(
      (index: number) => {
        const colors =
          colorsRef.current

        if (
          colors.length === 0
        ) {
          return
        }

        const safeIndex =
          ((index %
            colors.length) +
            colors.length) %
          colors.length

        const color =
          colors[safeIndex]

        if (!color) {
          return
        }

        pointerColorRef.current =
          color

        setPointerColor(color)

        if (
          pointerRef.current
        ) {
          pointerRef.current.style.setProperty(
            "--pointer-color",
            color,
          )
        }
      },
      [],
    )

  const pointerColorRef =
    useRef("#5fc78b")

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
        }, 3900)
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

    setConfetti([])

    lastTickIndexRef.current =
      null

    const selectedIndex =
      Math.floor(
        Math.random() *
          visibleItems.length,
      )

    spinningRef.current =
      true

    setIsSpinning(true)

    /*
     * Match the recording more closely:
     * a little longer, with a controlled
     * multi-revolution spin.
     */
    wheel.spinToItem(
      selectedIndex,
      4600,
      true,
      5,
      1,
    )
  }, [
    getAudioContext,
    visibleItems.length,
  ])

  const previousSpinTriggerRef = useRef(spinTrigger)

  useEffect(() => {
    if (previousSpinTriggerRef.current === spinTrigger) {
      return
    }

    previousSpinTriggerRef.current = spinTrigger
    getAudioContext()
    spin()
  }, [getAudioContext, spin, spinTrigger])

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

    spinningRef.current =
      false

    setIsSpinning(false)

    if (
      visibleItems.length === 0
    ) {
      currentIndexRef.current = 0

      setPointerColor(
        "#5fc78b",
      )

      pointerColorRef.current =
        "#5fc78b"

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
      visibleColors[
        initialIndex
      ]

    if (initialColor) {
      setPointerColor(
        initialColor,
      )

      pointerColorRef.current =
        initialColor

      if (
        pointerRef.current
      ) {
        pointerRef.current.style.setProperty(
          "--pointer-color",
          initialColor,
        )
      }
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
           * Match Wheel of Names proportions.
           */
          radius: 0.95,

          /*
           * Pointer is exactly on
           * the right-hand side.
           */
          pointerAngle: 0,

          borderWidth: 1,

          borderColor:
            "rgba(0,0,0,0.22)",

          /*
           * Keep the slices clean.
           */
          lineWidth: 0,

          lineColor:
            "transparent",

          /*
           * Wheel of Names style labels.
           */
          itemLabelAlign: "right",

          itemLabelRadius: 0.79,

          itemLabelRadiusMax: 0.3,

          itemLabelFont:
            "Arial, Helvetica, sans-serif",

          itemLabelFontSizeMax: 42,

          itemLabelStrokeWidth: 0,

          itemLabelBaselineOffset: 0,

          isInteractive: false,

          rotationResistance: -35,

          rotationSpeedMax: 1000,

          /* -------------------------------------------------------------- */
          /* Current item                                                     */
          /* -------------------------------------------------------------- */

          onCurrentIndexChange:
            (event) => {
              const index =
                event.currentIndex

              currentIndexRef.current =
                index

              /*
               * Use the actual index reported
               * by spin-wheel. This is explicitly
               * the item the pointer is pointing at.
               */
              setPointerForIndex(
                index,
              )

              /*
               * Only play one click per
               * newly pointed-at segment.
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

          /* -------------------------------------------------------------- */
          /* Rest                                                             */
          /* -------------------------------------------------------------- */

          onRest: (event) => {
            /*
             * Read the final index directly
             * from the wheel rather than relying
             * on stale state.
             */
            const finalIndex =
              wheel.getCurrentIndex()

            const eventIndex =
              event.currentIndex

            const selectedIndex =
              Number.isInteger(
                finalIndex,
              )
                ? finalIndex
                : eventIndex

            const selectedItem =
              itemsRef.current[
                selectedIndex
              ]

            currentIndexRef.current =
              selectedIndex

            setPointerForIndex(
              selectedIndex,
            )

            spinningRef.current =
              false

            setIsSpinning(false)

            if (selectedItem) {
              playWinnerSound(
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

    /*
     * Synchronise the pointer with the
     * actual rendered wheel immediately.
     */
    const actualIndex =
      wheel.getCurrentIndex()

    currentIndexRef.current =
      actualIndex

    setPointerForIndex(
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
    setPointerForIndex,
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
  /* Winner                                                                  */
  /* ---------------------------------------------------------------------- */

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
        bg-transparent
      "
    >
      {/* Background */}
      {!compact && (
        <div
          className="
            pointer-events-none
            absolute
            inset-0
            bg-[radial-gradient(circle_at_38%_38%,rgba(33,70,82,0.42),transparent_48%),radial-gradient(circle_at_80%_25%,rgba(81,42,91,0.32),transparent_45%),linear-gradient(135deg,#07151b_0%,#080b0e_48%,#150b17_100%)]
          "
        />
      )}

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
                    `${piece.startX}%`,

                  top:
                    `${piece.startY}%`,

                  width:
                    `${piece.width}px`,

                  height:
                    `${piece.height}px`,

                  backgroundColor:
                    piece.color,

                  ["--confetti-x" as string]:
                    `${piece.endX - piece.startX}%`,

                  ["--confetti-y" as string]:
                    `${piece.endY - piece.startY}vh`,

                  ["--confetti-rotation" as string]:
                    `${piece.rotation}deg`,

                  ["--confetti-scale" as string]:
                    piece.scale,

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
                    opacity-0
                    animate-[mpd-confetti-burst_ease-out_forwards]
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
            h-full
            w-auto
            max-h-full
            max-w-full
            shrink-0
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
            ref={pointerRef}
            className="
              pointer-events-none
              absolute
              right-[-5px]
              top-1/2
              z-40
              h-[22px]
              w-[26px]
              -translate-y-1/2
            "
            style={
              {
                "--pointer-color":
                  pointerColor,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            {/* Dark outline */}
            <div
              className="
                absolute
                inset-0
              "
              style={{
                clipPath:
                  "polygon(100% 0, 0 50%, 100% 100%, 82% 50%)",

                background:
                  "rgba(22,35,29,0.9)",
              }}
            />

            {/* Exact slice colour */}
            <div
              className="
                absolute
                inset-[1.5px]
                transition-colors
                duration-75
              "
              style={{
                clipPath:
                  "polygon(100% 0, 0 50%, 100% 100%, 82% 50%)",

                background:
                  "var(--pointer-color)",
              }}
            />
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
          {/* Wheel of Names idle text                                        */}
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
                  {/* Exact upper arc used by the recording */}
                  <path
                    id="wheel-click-text"
                    d="
                      M 285 405
                      Q 500 275 715 405
                    "
                    fill="none"
                  />

                  {/* Lower instruction arc */}
                  <path
                    id="wheel-control-text"
                    d="
                      M 325 590
                      Q 500 700 675 590
                    "
                    fill="none"
                  />
                </defs>

                {/* Click to spin shadow */}
                <text
                  fill="#ffffff"
                  fontSize="47"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-1"
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth="5"
                >
                  <textPath
                    href="#wheel-click-text"
                    startOffset="50%"
                  >
                    Click to spin
                  </textPath>
                </text>

                {/* Click to spin */}
                <text
                  fill="#ffffff"
                  fontSize="47"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-1"
                  textAnchor="middle"
                >
                  <textPath
                    href="#wheel-click-text"
                    startOffset="50%"
                  >
                    Click to spin
                  </textPath>
                </text>

                {/* Ctrl + Enter shadow */}
                <text
                  fill="#ffffff"
                  fontSize="30"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-0.35"
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth="4"
                >
                  <textPath
                    href="#wheel-control-text"
                    startOffset="50%"
                  >
                    or press ctrl+enter
                  </textPath>
                </text>

                {/* Ctrl + Enter */}
                <text
                  fill="#ffffff"
                  fontSize="30"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-0.35"
                  textAnchor="middle"
                >
                  <textPath
                    href="#wheel-control-text"
                    startOffset="50%"
                  >
                    or press ctrl+enter
                  </textPath>
                </text>
              </svg>
            )}

        </div>
      ) : (
        <div
          className="
            flex
            h-full
            max-h-full
            w-auto
            max-w-full
            shrink-0
            aspect-square
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
      {/* Animations                                                          */}
      {/* ------------------------------------------------------------------ */}

      <style>
        {`
          @keyframes mpd-confetti-burst {
            0% {
              opacity: 0;
              transform:
                translate3d(0, 0, 0)
                scale(0.35)
                rotate(0deg);
            }

            8% {
              opacity: 1;
            }

            70% {
              opacity: 1;
            }

            100% {
              opacity: 0;
              transform:
                translate3d(
                  var(--confetti-x),
                  var(--confetti-y),
                  0
                )
                scale(var(--confetti-scale))
                rotate(var(--confetti-rotation));
            }
          }
        `}
      </style>
    </div>
  )
}
