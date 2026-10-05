import {
  useCallback,
  useEffect,
  useId,
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
  afterSound?: string
  afterVolume?: number
  duringSound?: string
  duringVolume?: number
}


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

/* -------------------------------------------------------------------------- */
/* During-spin audio                                                         */
/* -------------------------------------------------------------------------- */

function playTick(volume: number) {
  const audio = new Audio("/sounds/during-spin/ding.mp3")
  audio.volume = Math.max(0, Math.min(1, volume / 100))
  void audio.play().catch(() => undefined)
}

export const DURING_SOUND_CATEGORIES: Record<string, Record<string, string>> = {
  "Sound effects": {
    "Ticking sound": "ding.mp3",
    "Drum roll": "drum-roll.mp3",
    "Microwave oven": "microwave-oven.mp3",
  },
  "Pop music": {
    "A better life": "pop-music/a-better-life.mp3",
    "Beyond the cloudy sky": "pop-music/beyond-the-cloudy-sky.mp3",
    "Floor breaker": "pop-music/floor-breaker.mp3",
    "Fun times all the time": "pop-music/fun-times-all-the-time.mp3",
    "Heaven's smile": "pop-music/heavens-smile.mp3",
    "Life of Riley": "pop-music/life-of-riley.mp3",
    "Lush life": "pop-music/lush-life.mp3",
    "Make the drive": "pop-music/make-the-drive.mp3",
    "Spaceship": "pop-music/spaceship.mp3",
    "Time and time again": "pop-music/time-and-time-again.mp3",
    "Vibrance": "pop-music/vibrance.mp3",
    "We can't slow down": "pop-music/we-cant-slow-down.mp3",
  },
  "Easy listening": {
    "A simple way to be happy": "easy-listening/a-simple-way-to-be-happy.mp3",
    "Genius minds": "easy-listening/genius-minds.mp3",
    "Glitter blast": "easy-listening/glitter-blast.mp3",
    "Groundwork": "easy-listening/groundwork.mp3",
    "Happy bee": "easy-listening/happy-bee.mp3",
    "Lucky in life": "easy-listening/lucky-in-life.mp3",
    "Upbeat forever": "easy-listening/upbeat-forever.mp3",
  },
  "Cinematic music": {
    "Enter sentinel": "cinematic-music/enter-sentinel.mp3",
    "Fire with fire": "cinematic-music/fire-with-fire.mp3",
    "Midnight diving": "cinematic-music/midnight-diving.mp3",
    "Strength of the Titans": "cinematic-music/strength-of-the-titans.mp3",
    "Ripples in time": "cinematic-music/ripples-in-time.mp3",
    "Wretched destroyer": "cinematic-music/wretched-destroyer.mp3",
  },
  "Reggae & Reggaeton": {
    "BehBuBah": "reggae-reggaeton/behbubah.mp3",
    "Cairo reggaeton": "reggae-reggaeton/cairo-reggaeton.mp3",
    "Dancing monkey": "reggae-reggaeton/dancing-monkey.mp3",
    "Easy jam": "reggae-reggaeton/easy-jam.mp3",
    "Steel drum": "reggae-reggaeton/steel-drum.mp3",
    "Sun island waves": "reggae-reggaeton/sun-island-waves.mp3",
  },
  "8-Bit": {
    "8 Bits racing car game theme": "8-bit/8-bits-racing-car-game-theme.mp3",
    "Game of rings": "8-bit/game-of-rings.mp3",
    "Sweet tale": "8-bit/sweet-tale.mp3",
  },
  "Folk": {
    "Falling leaf": "folk/falling-leaf.mp3",
    "Meeting the backcountry": "folk/meeting-the-backcountry.mp3",
    "Steel and gold": "folk/steel-and-gold.mp3",
    "Uke can swing": "folk/uke-can-swing.mp3",
    "Window of opportunity": "folk/window-of-opportunity.mp3",
  },
  "Silent film score": {
    "Amazing plan": "silent-film-score/amazing-plan.mp3",
    "Le grand chase": "silent-film-score/le-grand-chase.mp3",
    "Merry-go-round": "silent-film-score/merry-go-round.mp3",
    "Super circus": "silent-film-score/super-circus.mp3",
  },
  "Dance & Techno": {
    "Crazy clown": "dance-techno/crazy-clown.mp3",
    "Defiant dance": "dance-techno/defiant-dance.mp3",
    "Give me that": "dance-techno/give-me-that.mp3",
    "Move forward": "dance-techno/move-forward.mp3",
    "Overclock": "dance-techno/overclock.mp3",
    "Race for survival": "dance-techno/race-for-survival.mp3",
    "Raving energy": "dance-techno/raving-energy-faster.mp3",
    "So bright": "dance-techno/so-bright.mp3",
    "Strike out": "dance-techno/strike-out.mp3",
    "Whistle & flow": "dance-techno/whistle-and-flow.mp3",
  },
  "Hip hop": {
    "Bananas": "hip-hop/bananas.mp3",
    "Drop zone": "hip-hop/drop-zone.mp3",
    "Gassed up": "hip-hop/gassed-up.mp3",
    "Going all the way": "hip-hop/going-all-the-way.mp3",
    "Hard trap bounce": "hip-hop/hard-trap-bounce.mp3",
    "Ice cream truck": "hip-hop/ice-cream-truck.mp3",
    "It's alive": "hip-hop/its-alive.mp3",
    "Put your hand up": "hip-hop/put-your-hand-up.mp3",
    "Ready for some action": "hip-hop/ready-for-some-action.mp3",
    "The trap mission": "hip-hop/the-trap-mission.mp3",
  },
  "Disco": {
    "Mexican jackpot": "disco/mexican-jackpot.mp3",
    "Ocean wave": "disco/ocean-wave.mp3",
    "Saturn airlines": "disco/saturn-airlines.mp3",
    "Stringed disco": "disco/stringed-disco.mp3",
    "Vintage disco": "disco/vintage-disco.mp3",
  },
  "Electronica": {
    "Ambient chillhop groove": "electronica/ambient-chillhop-groove.mp3",
    "Beautiful Yumiko": "electronica/beautiful-yumiko.mp3",
    "Better better": "electronica/better-better.mp3",
    "Deep and dirty": "electronica/deep-and-dirty.mp3",
    "On TV": "electronica/on-tv.mp3",
    "Phat sketch": "electronica/phat-sketch.mp3",
    "Son of a rocket": "electronica/son-of-a-rocket.mp3",
  },
  "Funk": {
    "Bounce like this": "funk/bounce-like-this.mp3",
    "Celebration": "funk/celebration.mp3",
    "Funk overflow": "funk/funk-overflow.mp3",
    "Funk the buzz": "funk/funk-the-buzz.mp3",
    "Like we do it": "funk/like-we-do-it.mp3",
  },
  "Ballroom dancing": {
    "Happy happy game show": "ballroom-dancing/happy-happy-game-show.mp3",
    "Lobby time": "ballroom-dancing/lobby-time.mp3",
    "The ballroom waltz": "ballroom-dancing/the-ballroom-waltz.mp3",
  },
  "Rock music": {
    "Give it a try": "rock-music/give-it-a-try.mp3",
    "In love with the good life": "rock-music/in-love-with-the-good-life.mp3",
    "Learn to believe it": "rock-music/learn-to-believe-it.mp3",
    "Welcome to the show": "rock-music/welcome-to-the-show.mp3",
  },
  "World music": {
    "Arabic celebration": "world-music/arabic-celebration.mp3",
    "Ban ban": "world-music/ban-ban.mp3",
    "Banda macho": "world-music/banda-macho.mp3",
    "Dance of the harpy": "world-music/dance-of-the-harpy.mp3",
    "Dance with the moon": "world-music/dance-with-the-moon.mp3",
    "Desert sand": "world-music/desert-sand.mp3",
    "Diwali": "world-music/diwali.mp3",
    "Every heartbeat": "world-music/every-heartbeat.mp3",
    "Galway": "world-music/galway.mp3",
    "Great Wall of China": "world-music/great-wall-of-china.mp3",
    "Kage": "world-music/kage-shutterstock-543763-loop-4.mp3",
    "Khaek mon Thai": "world-music/khaek-mon-thai-traditional.mp3",
    "Ma re lah": "world-music/ma-re-lah.mp3",
    "Modern India": "world-music/modern-india.mp3",
    "Serviko": "world-music/serviko.mp3",
    "Verano sensual": "world-music/verano-sensual.mp3",
  },
  "Rockabilly": {
    "Dark pathways": "rockabilly/dark-pathways.mp3",
    "Lone heart blues": "rockabilly/lone-heart-blues.mp3",
    "Whiskey bar": "rockabilly/whiskey-bar.mp3",
  },
  "Polka": {
    "Festive polka": "polka/festive-polka.mp3",
    "Tiroler polka": "polka/tiroler-polka.mp3",
  },
  "Retro-Rock": {
    "Fashion power": "retro-rock/fashion-power.mp3",
    "Groovy shoes": "retro-rock/groovy-shoes.mp3",
    "Small fry": "retro-rock/small-fry.mp3",
    "Surf wax": "retro-rock/surf-wax.mp3",
    "Surfing waves": "retro-rock/surfing-waves.mp3",
  },
  "Winter holiday music": {
    "Auld Lang Syne": "winter-holiday-music/auld-lang-syne.mp3",
    "Christmas energy": "winter-holiday-music/christmas-energy.mp3",
    "Christmas soul": "winter-holiday-music/christmas-soul.mp3",
    "Crispy snow": "winter-holiday-music/crispy-snow.mp3",
    "Deck the halls": "winter-holiday-music/deck-the-halls.mp3",
    "Dreidel song": "winter-holiday-music/dreidel-song.mp3",
    "Holiday bustle": "winter-holiday-music/holiday-bustle.mp3",
    "Jolly old Saint Nicholas": "winter-holiday-music/jolly-old-saint-nicholas.mp3",
    "Log cabin Christmas": "winter-holiday-music/log-cabin-christmas.mp3",
    "New Year's resolution": "winter-holiday-music/new-years-resolution.mp3",
    "Oh Christmas tree": "winter-holiday-music/oh-christmas-tree.mp3",
  },
}

export const DURING_SOUND_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(DURING_SOUND_CATEGORIES).flatMap(([, files]) =>
    Object.entries(files).map(([name, path]) => [name, path]),
  ),
)

export const DURING_SOUND_CATEGORY_NAMES = Object.keys(DURING_SOUND_CATEGORIES)

function pickDuringSound(sound: string) {
  if (sound === "No sound") return null
  if (sound === "Ticking sound") return "ding.mp3"

  const randomCategory = sound.match(/^Random (.+)$/)?.[1]
  if (randomCategory) {
    const files = DURING_SOUND_CATEGORIES[randomCategory]
    if (!files) return null
    const values = Object.values(files)
    return values[Math.floor(Math.random() * values.length)] ?? null
  }

  return DURING_SOUND_FILES[sound] ?? null
}

function isTickingSound(sound: string) {
  return sound === "Ticking sound"
}

const AFTER_SPIN_SOUND_FILES: Record<string, string> = {
  "Subdued applause": "subdued-applause.mp3",
  "Joke punchline": "joke-punchline.mp3",
  "Announcement bell": "announcement-bell.mp3",
  "Twinkling star": "twinkling-star.mp3",
  "Correct answer ding": "correct-answer-ding.mp3",
  "Synth bell": "synth-bell.mp3",
  "Notification bell": "notification-bell.mp3",
  "Loud applause": "loud-applause.mp3",
  "Fanfare": "fanfare.mp3",
  "Bell ringing": "bell-ringing.mp3",
  "Cymbals": "cymbals.mp3",
  "Thunder": "thunder.mp3",
  "Cash register": "cash-register.mp3",
  "Evil laugh": "evil-laugh.mp3",
  "Microwave ding": "microwave-ding.mp3",
  "Old phone ringing": "old-phone-ringing.mp3",
  "Alarm clock": "alarm-clock.mp3",
  "Fireworks": "fireworks.mp3",
  "Game win ding": "game-win-ding.mp3",
  "Wrong answer": "wrong-answer.mp3",
  "Punch": "punch.mp3",
  "Cat meow": "cat-meow.mp3",
  "Wolf howl": "wolf-howl.mp3",
  "Horse": "horse.mp3",
  "Lion roar": "lion-roar.mp3",
  "Sad trombone": "sad-trombone.mp3",
  "Cinematic drum impact": "cinematic-drum-impact.mp3",
  "Water splash": "water-splash.mp3",
  "Gong": "gong.mp3",
  "Doorbell": "doorbell.mp3",
  "Church bell": "church-bell.mp3",
  "Referee whistle": "referee-whistle.mp3",
  "Boing": "boing.mp3",
  "Angel choir": "angel-choir.mp3",
  "Harp strum": "harp-strum.mp3",
  "Breaker switch": "breaker-switch.mp3",
  "Camera shutter & flash": "camera-shutter-flash.mp3",
  "Lost game": "lost-game.mp3",
  "Horror scream": "horror-scream.mp3",
}

function playAfterSpinSound(sound: string, volume: number) {
  if (sound === "No sound" || sound === "Inherit from wheel" || sound.startsWith("Speak result")) return

  let file = AFTER_SPIN_SOUND_FILES[sound]

  if (sound === "Random sound") {
    const files = Object.values(AFTER_SPIN_SOUND_FILES)
    file = files[Math.floor(Math.random() * files.length)]
  }

  if (!file) return

  const audio = new Audio(`/sounds/after-spin/${file}`)
  audio.volume = Math.max(0, Math.min(1, volume / 100))
  void audio.play().catch(() => undefined)
}

/* -------------------------------------------------------------------------- */
/* Wheel                                                                      */
/* -------------------------------------------------------------------------- */

/** Fast launch with a smooth, natural ease-out into the final slice. */
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3)

export default function Wheel({
  items,
  onResult,
  compact = false,
  spinTrigger = 0,
  afterSound = "Subdued applause",
  afterVolume = 50,
  duringSound = "Ticking sound",
  duringVolume = 50,
}: WheelProps) {
  const wheelTextId = useId().replace(/:/g, "")

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

  const duringSpinAudioRef =
    useRef<HTMLAudioElement | null>(null)

  const duringSoundRef = useRef(duringSound)
  const duringVolumeRef = useRef(duringVolume)


  const [isSpinning, setIsSpinning] =
    useState(false)

  const [pointerColor, setPointerColor] =
    useState("#5fc78b")


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

  const stopDuringSpinAudio = useCallback(() => {
    const audio = duringSpinAudioRef.current

    if (!audio) {
      return
    }

    audio.pause()
    audio.currentTime = 0
    duringSpinAudioRef.current = null
  }, [])

  const startDuringSpinAudio = useCallback((sound: string, volume: number) => {
    stopDuringSpinAudio()

    if (sound === "No sound" || isTickingSound(sound)) return

    const file = pickDuringSound(sound)
    if (!file) return

    const audio = new Audio(`/sounds/during-spin/${file}`)
    audio.volume = Math.max(0, Math.min(1, volume / 100))
    audio.loop = true
    duringSpinAudioRef.current = audio
    void audio.play().catch(() => undefined)
  }, [stopDuringSpinAudio])

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

    startDuringSpinAudio(
      duringSoundRef.current,
      duringVolumeRef.current,
    )

    /*
     * Match the recording more closely:
     * a little longer, with a controlled
     * multi-revolution spin.
     */
    wheel.spinToItem(
      selectedIndex,
      4200,
      true,
      6,
      1,
      cubicOut,
    )
  }, [
    getAudioContext,
    startDuringSpinAudio,
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
                  spinningRef.current &&
                  isTickingSound(duringSoundRef.current)
                ) {
                  playTick(duringVolumeRef.current)
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

            stopDuringSpinAudio()

            spinningRef.current =
              false

            setIsSpinning(false)

            if (selectedItem) {
              playAfterSpinSound(
                afterSound,
                afterVolume,
              )

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
    stopDuringSpinAudio,
    afterSound,
    afterVolume,
  ])

  /* ---------------------------------------------------------------------- */
  /* Cleanup                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    return () => {

      stopDuringSpinAudio()

      if (
        audioContextRef.current
      ) {
        void audioContextRef.current.close()
      }
    }
  }, [stopDuringSpinAudio])

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
          {/* Dark outer rim / bevel.  The actual canvas stays inside this rim. */}
          <div
            className="
              pointer-events-none
              absolute
              inset-[-10px]
              rounded-full
              border-[10px]
              border-black/75
              shadow-[0_16px_34px_rgba(0,0,0,0.62),inset_0_2px_3px_rgba(255,255,255,0.2),inset_0_-7px_12px_rgba(0,0,0,0.55)]
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              inset-[-3px]
              rounded-full
              border-[3px]
              border-white/15
              shadow-[0_2px_4px_rgba(255,255,255,0.08)]
            "
          />

          <div
            ref={containerRef}
            className="
              absolute
              inset-0
              overflow-visible
              rounded-full
              shadow-[0_10px_28px_rgba(0,0,0,0.48)]
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
              right-[-17px]
              top-1/2
              z-50
              h-[54px]
              w-[70px]
              -translate-y-1/2
            "
            style={
              {
                "--pointer-color": pointerColor,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            {/* Deep outline gives the arrow the same raised/bevelled look as the reference. */}
            <div
              className="absolute inset-0 drop-shadow-[0_4px_5px_rgba(0,0,0,0.58)]"
              style={{
                clipPath: "polygon(100% 0, 0 50%, 100% 100%, 84% 50%)",
                background: "linear-gradient(180deg,#111827 0%,#030712 48%,#111827 100%)",
              }}
            />

            {/* Exact colour of the entry currently under the pointer. */}
            <div
              className="absolute inset-[3px] transition-[background] duration-75"
              style={{
                clipPath: "polygon(100% 0, 0 50%, 100% 100%, 84% 50%)",
                background: "var(--pointer-color)",
              }}
            />

            {/* Small highlight along the upper edge. */}
            <div
              className="absolute inset-[6px] opacity-45"
              style={{
                clipPath: "polygon(100% 0, 0 50%, 100% 100%, 88% 50%)",
                background: "linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0) 48%)",
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
              z-40
              h-[15%]
              w-[15%]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              border-[3px]
              border-white/90
              bg-white
              shadow-[0_5px_14px_rgba(0,0,0,0.42),inset_0_1px_2px_rgba(0,0,0,0.12)]
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
                    id={`wheel-click-text-${wheelTextId}`}
                    d="
                      M 265 405
                      Q 500 245 735 405
                    "
                    fill="none"
                  />

                  {/* Lower instruction arc */}
                  <path
                    id={`wheel-control-text-${wheelTextId}`}
                    d="
                      M 300 590
                      Q 500 735 700 590
                    "
                    fill="none"
                  />
                </defs>

                {/* Click to spin shadow */}
                <text
                  fill="#ffffff"
                  fontSize="50"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-1"
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth="6"
                >
                  <textPath
                    href={`#wheel-click-text-${wheelTextId}`}
                    startOffset="50%"
                  >
                    Click to spin
                  </textPath>
                </text>

                {/* Click to spin */}
                <text
                  fill="#ffffff"
                  fontSize="50"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-1"
                  textAnchor="middle"
                >
                  <textPath
                    href={`#wheel-click-text-${wheelTextId}`}
                    startOffset="50%"
                  >
                    Click to spin
                  </textPath>
                </text>

                {/* Ctrl + Enter shadow */}
                <text
                  fill="#ffffff"
                  fontSize="31"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-0.35"
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth="5"
                >
                  <textPath
                    href={`#wheel-control-text-${wheelTextId}`}
                    startOffset="50%"
                  >
                    or press ctrl+enter
                  </textPath>
                </text>

                {/* Ctrl + Enter */}
                <text
                  fill="#ffffff"
                  fontSize="31"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  letterSpacing="-0.35"
                  textAnchor="middle"
                >
                  <textPath
                    href={`#wheel-control-text-${wheelTextId}`}
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

    </div>
  )
}
