import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clipboard,
  FilePlus,
  FolderOpen,
  Globe,
  ImagePlus,
  Maximize,
  Menu,
  MoreHorizontal,
  Palette,
  Plus,
  Save,
  Search,
  Share2,
  Shuffle,
  Sparkles,
  Trophy,
  Type,
  X,
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
  "#69b9e8",
  "#b978cf",
  "#f5d45d",
  "#63d29a",
  "#69b9e8",
  "#b978cf",
  "#f5d45d",
  "#63d29a",
  "#69b9e8",
  "#b978cf",
  "#f5d45d",
  "#63d29a",
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

const WIN_SPIN_DURATION = 5000
const WIN_REVOLUTIONS = 6

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function createEntries(names: string[]): WheelEntry[] {
  return names.map((name, index) => ({
    id: makeId(),
    label: name,
    color: COLORS[index % COLORS.length],
    hidden: false,
  }))
}

export default function SpinWheel() {
  const wheelContainerRef =
    useRef<HTMLDivElement | null>(null)

  const wheelRef = useRef<Wheel | null>(null)

  const entriesRef =
    useRef<WheelEntry[]>([])

  const visibleEntriesRef =
    useRef<WheelEntry[]>([])

  const isSpinningRef =
    useRef(false)

  const hideSelectedRef =
    useRef(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

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
    useState("#6ee7b7")

  const [showAdvanced, setShowAdvanced] =
    useState(false)

  const [showMore, setShowMore] =
    useState(false)

  const [showCustomize, setShowCustomize] =
    useState(false)

  const [showAddImage, setShowAddImage] =
    useState(false)

  const [showLanguage, setShowLanguage] =
    useState(false)

  const [newEntry, setNewEntry] =
    useState("")

  const [fullscreen, setFullscreen] =
    useState(false)

  const [wheelName, setWheelName] =
    useState("Wheel of Names")

  const [background, setBackground] =
    useState("#16232c")

  const [textColor, setTextColor] =
    useState("#111111")

  const [spinDuration, setSpinDuration] =
    useState(WIN_SPIN_DURATION / 1000)

  const [revolutions, setRevolutions] =
    useState(WIN_REVOLUTIONS)

  const [removeWinner, setRemoveWinner] =
    useState(false)

  /*
   * Synchronise refs.
   */
  useEffect(() => {
    entriesRef.current = entries

    visibleEntriesRef.current =
      entries.filter(
        (entry) => !entry.hidden,
      )
  }, [entries])

  /*
   * Update pointer colour.
   */
  const updatePointerColor =
    useCallback(
      (
        index: number,
        source?: WheelEntry[],
      ) => {
        const list =
          source ??
          visibleEntriesRef.current

        if (list.length === 0) {
          setPointerColor("#6ee7b7")
          return
        }

        const entry =
          list[
            ((index % list.length) +
              list.length) %
              list.length
          ]

        if (entry) {
          setPointerColor(entry.color)
        }
      },
      [],
    )

  /*
   * Build/update wheel items.
   */
  const updateWheelItems =
    useCallback(
      (source: WheelEntry[]) => {
        const wheel = wheelRef.current

        if (!wheel) {
          return
        }

        const visible =
          source.filter(
            (entry) => !entry.hidden,
          )

        visibleEntriesRef.current =
          visible

        wheel.items = visible.map(
          (entry) => ({
            label: entry.label,
            backgroundColor:
              entry.color,
            labelColor: textColor,
          }),
        )

        if (visible.length > 0) {
          const currentIndex =
            wheel.getCurrentIndex()

          updatePointerColor(
            currentIndex,
            visible,
          )
        } else {
          setPointerColor("#6ee7b7")
        }
      },
      [
        textColor,
        updatePointerColor,
      ],
    )

  /*
   * Create wheel once.
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

    const wheel = new Wheel(container, {
      items: initialEntries.map(
        (entry) => ({
          label: entry.label,
          backgroundColor:
            entry.color,
          labelColor: textColor,
        }),
      ),

      /*
       * Wheel of Names has the
       * pointer on the right.
       */
      pointerAngle: 90,

      radius: 0.92,

      lineWidth: 1,
      lineColor:
        "rgba(255,255,255,0.22)",

      /*
       * Large radial labels like
       * Wheel of Names.
       */
      itemLabelRotation: 0,
      itemLabelAlign: "center",
      itemLabelRadius: 0.67,
      itemLabelRadiusMax: 0.20,
      itemLabelFontSizeMax: 30,
      itemLabelStrokeWidth: 0,
      itemLabelFont:
        "Arial, Helvetica, sans-serif",
      itemLabelColors: [textColor],

      pixelRatio:
        typeof window !==
        "undefined"
          ? Math.min(
              2,
              window.devicePixelRatio ||
                1,
            )
          : 1,

      rotationResistance: -1,

      rotationSpeedMax: 160,

      onCurrentIndexChange:
        (event) => {
          updatePointerColor(
            event.currentIndex,
            visibleEntriesRef.current,
          )
        },

      onRest: (event) => {
        if (!isSpinningRef.current) {
          return
        }

        isSpinningRef.current = false
        setIsSpinning(false)

        const currentEntries =
          visibleEntriesRef.current

        const winner =
          currentEntries[
            event.currentIndex
          ]

        if (!winner) {
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

        toast.success(
          `${winner.label} won!`,
        )
      },
    })

    wheelRef.current = wheel

    updatePointerColor(
      wheel.getCurrentIndex(),
      initialEntries,
    )

    return () => {
      wheel.stop()
      wheelRef.current = null
      isSpinningRef.current = false
    }
  }, [
    textColor,
    updatePointerColor,
  ])

  /*
   * Update wheel when entries change.
   */
  useEffect(() => {
    if (!wheelRef.current) {
      return
    }

    updateWheelItems(entries)
  }, [
    entries,
    updateWheelItems,
  ])

  /*
   * Update wheel label colour.
   */
  useEffect(() => {
    const wheel = wheelRef.current

    if (!wheel) {
      return
    }

    wheel.items =
      visibleEntriesRef.current.map(
        (entry) => ({
          label: entry.label,
          backgroundColor:
            entry.color,
          labelColor: textColor,
        }),
      )
  }, [textColor])

  /*
   * Spin.
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
      toast.error(
        "Add at least one entry first.",
      )
      return
    }

    const winnerIndex =
      Math.floor(
        Math.random() *
          currentEntries.length,
      )

    isSpinningRef.current = true
    setIsSpinning(true)

    updatePointerColor(
      winnerIndex,
      currentEntries,
    )

    const easeOutQuart =
      (progress: number) =>
        1 -
        Math.pow(
          1 - progress,
          4,
        )

    wheel.spinToItem(
      winnerIndex,
      spinDuration * 1000,
      true,
      revolutions,
      1,
      easeOutQuart,
    )
  }, [
    revolutions,
    spinDuration,
    updatePointerColor,
  ])

  /*
   * Keyboard shortcut.
   */
  useEffect(() => {
    const handler = (
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
      handler,
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handler,
      )
    }
  }, [spin])

  /*
   * Shuffle.
   */
  const shuffleEntries =
    useCallback(() => {
      if (isSpinningRef.current) {
        return
      }

      setEntries((current) => {
        const shuffled = [
          ...current,
        ]

        for (
          let i =
            shuffled.length - 1;
          i > 0;
          i--
        ) {
          const j =
            Math.floor(
              Math.random() *
                (i + 1),
            )

          ;[
            shuffled[i],
            shuffled[j],
          ] = [
            shuffled[j],
            shuffled[i],
          ]
        }

        return shuffled
      })
    }, [])

  /*
   * Sort.
   */
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

  /*
   * Textarea.
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
              const old =
                current[index]

              return {
                id:
                  old?.id ??
                  makeId(),
                label,
                color:
                  old?.color ??
                  COLORS[
                    index %
                      COLORS.length
                  ],
                hidden:
                  old?.hidden ??
                  false,
              }
            },
          ),
        )
      },
      [],
    )

  /*
   * Add entry.
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
          id: makeId(),
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
   * New wheel.
   */
  const newWheel =
    useCallback(() => {
      if (isSpinningRef.current) {
        toast.info(
          "Wait for the current spin to finish.",
        )
        return
      }

      setEntries([])
      setResults([])
      setWheelName(
        "Wheel of Names",
      )
      setActiveTab("entries")
      setShowMore(false)

      toast.success(
        "New wheel created.",
      )
    }, [])

  /*
   * Restore defaults.
   */
  const restoreDefaults =
    useCallback(() => {
      if (isSpinningRef.current) {
        return
      }

      setEntries(
        createEntries(
          DEFAULT_NAMES,
        ),
      )

      setResults([])

      toast.success(
        "Default wheel restored.",
      )
    }, [])

  /*
   * Clear.
   */
  const clearEntries =
    useCallback(() => {
      if (isSpinningRef.current) {
        return
      }

      setEntries([])

      toast.success(
        "Entries cleared.",
      )
    }, [])

  /*
   * Copy.
   */
  const copyEntries =
    useCallback(() => {
      const text = entries
        .filter(
          (entry) => !entry.hidden,
        )
        .map(
          (entry) => entry.label,
        )
        .join("\n")

      void navigator.clipboard
        ?.writeText(text)
        .then(() => {
          toast.success(
            "Entries copied.",
          )
        })
        .catch(() => {
          toast.error(
            "Unable to copy entries.",
          )
        })
    }, [entries])

  /*
   * Open a text file.
   */
  const openFile =
    useCallback(
      (file: File) => {
        const reader =
          new FileReader()

        reader.onload = () => {
          const text =
            String(
              reader.result ?? "",
            )

          updateEntriesFromText(
            text,
          )

          toast.success(
            "Wheel opened.",
          )
        }

        reader.readAsText(file)
      },
      [updateEntriesFromText],
    )

  /*
   * Save wheel.
   */
  const saveWheel =
    useCallback(() => {
      const data = {
        name: wheelName,
        entries,
        results,
      }

      const blob =
        new Blob(
          [
            JSON.stringify(
              data,
              null,
              2,
            ),
          ],
          {
            type:
              "application/json",
          },
        )

      const url =
        URL.createObjectURL(blob)

      const anchor =
        document.createElement(
          "a",
        )

      anchor.href = url
      anchor.download =
        `${wheelName
          .replace(
            /[^a-z0-9]+/gi,
            "-",
          )
          .toLowerCase()}.json`

      anchor.click()

      URL.revokeObjectURL(url)

      toast.success(
        "Wheel saved.",
      )
    }, [
      entries,
      results,
      wheelName,
    ])

  /*
   * Share.
   */
  const shareWheel =
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

      if (
        navigator.share
      ) {
        try {
          await navigator.share({
            title: wheelName,
            text,
          })

          return
        } catch {
          return
        }
      }

      await navigator.clipboard
        ?.writeText(text)

      toast.success(
        "Wheel entries copied for sharing.",
      )
    }, [
      entries,
      wheelName,
    ])

  /*
   * Fullscreen.
   */
  const toggleFullscreen =
    useCallback(() => {
      setFullscreen(
        (current) => !current,
      )
    }, [])

  /*
   * Image button.
   *
   * The selected image is used as
   * the colour source for a new
   * wheel entry.
   */
  const addImage =
    useCallback(
      (file: File) => {
        const reader =
          new FileReader()

        reader.onload = () => {
          const label =
            file.name.replace(
              /\.[^/.]+$/,
              "",
            )

          setEntries(
            (current) => [
              ...current,
              {
                id: makeId(),
                label,
                color:
                  COLORS[
                    current.length %
                      COLORS.length
                  ],
                hidden: false,
              },
            ],
          )

          toast.success(
            "Image entry added.",
          )
        }

        reader.readAsDataURL(file)
      },
      [],
    )

  const visibleEntries =
    useMemo(
      () =>
        entries.filter(
          (entry) =>
            !entry.hidden,
        ),
      [entries],
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
        "fixed inset-0 z-50 flex flex-col overflow-hidden",
        fullscreen
          ? ""
          : "top-[var(--navbar-height,0px)]",
      ].join(" ")}
      style={{
        background,
      }}
    >
      {/* ================================================= */}
      {/* WHEEL OF NAMES HEADER                              */}
      {/* ================================================= */}

      <header
        className="
          z-[200]
          flex
          h-[44px]
          shrink-0
          items-center
          border-b
          border-white/10
          bg-[#202020]
          px-2
          text-white
        "
      >
        {/* Logo */}
        <div className="flex min-w-[245px] items-center gap-2.5">
          <div
            className="
              relative
              flex
              h-[35px]
              w-[35px]
              shrink-0
              items-center
              justify-center
              overflow-hidden
              rounded-[8px]
              bg-gradient-to-br
              from-[#69c6ef]
              via-[#f3df5a]
              to-[#bd7bd2]
            "
          >
            <div className="absolute left-0 top-0 h-1/2 w-1/2 bg-[#68b7e8]" />
            <div className="absolute right-0 top-0 h-1/2 w-1/2 bg-[#c17bd2]" />
            <div className="absolute bottom-0 left-0 h-1/2 w-1/2 bg-[#66d49d]" />
            <div className="absolute bottom-0 right-0 h-1/2 w-1/2 bg-[#f5d55d]" />

            <div className="z-10 h-[11px] w-[11px] rounded-full bg-white/90 shadow" />
          </div>

          <div className="text-[19px] font-semibold tracking-[-0.02em]">
            {wheelName}
          </div>
        </div>

        {/* Desktop menu */}
        <nav className="hidden min-w-0 flex-1 items-center justify-end gap-0.5 lg:flex">
          <button
            type="button"
            onClick={() =>
              setShowCustomize(
                true,
              )
            }
            className="
              flex
              h-10
              items-center
              gap-2
              rounded-md
              px-3
              text-[12px]
              font-semibold
              text-white/90
              hover:bg-white/10
            "
          >
            <Palette className="h-4 w-4" />
            Customize
          </button>

          <button
            type="button"
            onClick={newWheel}
            className="
              flex
              h-10
              items-center
              gap-2
              rounded-md
              px-3
              text-[12px]
              font-semibold
              text-white/90
              hover:bg-white/10
            "
          >
            <FilePlus className="h-4 w-4" />
            New
          </button>

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="
              flex
              h-10
              items-center
              gap-2
              rounded-md
              px-3
              text-[12px]
              font-semibold
              text-white/90
              hover:bg-white/10
            "
          >
            <FolderOpen className="h-4 w-4" />
            Open
          </button>

          <button
            type="button"
            onClick={saveWheel}
            className="
              flex
              h-10
              items-center
              gap-2
              rounded-md
              px-3
              text-[12px]
              font-semibold
              text-white/90
              hover:bg-white/10
            "
          >
            <Save className="h-4 w-4" />
            Save
          </button>

          <button
            type="button"
            onClick={() => {
              void shareWheel()
            }}
            className="
              flex
              h-10
              items-center
              gap-2
              rounded-md
              px-3
              text-[12px]
              font-semibold
              text-white/90
              hover:bg-white/10
            "
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          <button
            type="button"
            className="
              flex
              h-10
              items-center
              gap-2
              rounded-md
              px-3
              text-[12px]
              font-semibold
              text-white/90
              hover:bg-white/10
            "
          >
            <Search className="h-4 w-4" />
            Gallery
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-md
              text-white/90
              hover:bg-white/10
            "
            aria-label="Fullscreen"
          >
            <Maximize className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setShowMore(
                  (current) =>
                    !current,
                )
              }
              className="
                flex
                h-10
                items-center
                gap-1.5
                rounded-md
                px-3
                text-[12px]
                font-semibold
                text-white/90
                hover:bg-white/10
              "
            >
              <MoreHorizontal className="h-4 w-4" />
              More
              <ChevronDown className="h-3 w-3" />
            </button>

            {showMore && (
              <div
                className="
                  absolute
                  right-0
                  top-[42px]
                  z-[500]
                  w-52
                  rounded-lg
                  border
                  border-white/10
                  bg-[#262626]
                  p-1
                  shadow-2xl
                "
              >
                <button
                  type="button"
                  onClick={() => {
                    restoreDefaults()
                    setShowMore(false)
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-md
                    px-3
                    py-2.5
                    text-left
                    text-sm
                    text-white/80
                    hover:bg-white/10
                  "
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
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-md
                    px-3
                    py-2.5
                    text-left
                    text-sm
                    text-white/80
                    hover:bg-white/10
                  "
                >
                  <Clipboard className="h-4 w-4" />
                  Copy entries
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearEntries()
                    setShowMore(false)
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-md
                    px-3
                    py-2.5
                    text-left
                    text-sm
                    text-white/80
                    hover:bg-white/10
                  "
                >
                  <X className="h-4 w-4" />
                  Clear entries
                </button>
              </div>
            )}
          </div>

          <div className="relative ml-1">
            <button
              type="button"
              onClick={() =>
                setShowLanguage(
                  (current) =>
                    !current,
                )
              }
              className="
                flex
                h-10
                items-center
                gap-2
                rounded-md
                px-3
                text-[12px]
                font-semibold
                text-white/90
                hover:bg-white/10
              "
            >
              <Globe className="h-4 w-4" />
              English
            </button>

            {showLanguage && (
              <div
                className="
                  absolute
                  right-0
                  top-[42px]
                  z-[500]
                  w-36
                  rounded-lg
                  border
                  border-white/10
                  bg-[#262626]
                  p-1
                  shadow-2xl
                "
              >
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                >
                  English
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Mobile menu */}
        <button
          type="button"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10 lg:hidden"
          onClick={() =>
            setShowMore(
              (current) =>
                !current,
            )
          }
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ================================================= */}
      {/* MAIN AREA                                         */}
      {/* ================================================= */}

      <div className="flex min-h-0 flex-1">
        {/* ================================================= */}
        {/* WHEEL AREA                                        */}
        {/* ================================================= */}

        <main
          className="
            relative
            min-w-0
            flex-1
            overflow-hidden
          "
          style={{
            background:
              "radial-gradient(circle at 50% 42%, #263642 0%, #1b2932 42%, #11191f 100%)",
          }}
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
          {/* subtle background */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              opacity-60
            "
            style={{
              background:
                "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,.35) 100%)",
            }}
          />

          {/* floating text editor */}
          <button
            type="button"
            aria-label="Wheel text settings"
            onClick={() =>
              setShowCustomize(true)
            }
            className="
              absolute
              left-4
              top-4
              z-[100]
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              border
              border-white/20
              bg-[#373c67]
              text-white/90
              shadow-lg
              transition
              hover:bg-[#454b7e]
            "
          >
            <Type className="h-5 w-5" />
          </button>

          {/* actual wheel */}
          <div
            className="
              absolute
              left-1/2
              top-1/2
              aspect-square
              w-[min(82vh,calc(100vw-440px))]
              max-w-[850px]
              min-w-[500px]
              -translate-x-1/2
              -translate-y-1/2
            "
          >
            <div
              ref={wheelContainerRef}
              className="absolute inset-0"
            />
          </div>

          {/* pointer */}
          <div
            className="
              pointer-events-none
              absolute
              right-[-1px]
              top-1/2
              z-[150]
              -translate-y-1/2
            "
          >
            <div
              className="
                h-0
                w-0
                border-y-[24px]
                border-r-[52px]
                border-l-0
                border-y-transparent
                drop-shadow-[0_2px_5px_rgba(0,0,0,.65)]
              "
              style={{
                borderRightColor:
                  pointerColor,
                transition:
                  "border-right-color 120ms ease",
              }}
            />
          </div>

          {/* center click text */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              z-[80]
              flex
              items-center
              justify-center
            "
          >
            <div
              className="
                -mt-1
                text-center
                font-sans
                font-bold
                tracking-[-0.035em]
                text-white
                drop-shadow-[0_3px_4px_rgba(0,0,0,.85)]
              "
              style={{
                fontSize:
                  "clamp(28px, 2.4vw, 44px)",
              }}
            >
              {isSpinning
                ? "Spinning..."
                : "Click to spin"}

              {!isSpinning && (
                <div
                  className="
                    mt-4
                    text-[17px]
                    font-semibold
                    tracking-normal
                    text-white
                  "
                >
                  or press ctrl+enter
                </div>
              )}
            </div>
          </div>

          {/* spinning indicator */}
          {isSpinning && (
            <div
              className="
                pointer-events-none
                absolute
                bottom-5
                left-1/2
                z-[100]
                -translate-x-1/2
                rounded-full
                bg-black/45
                px-4
                py-2
                text-xs
                font-medium
                text-white/80
                backdrop-blur
              "
            >
              Spinning for{" "}
              {spinDuration} seconds
            </div>
          )}
        </main>

        {/* ================================================= */}
        {/* RIGHT SIDEBAR                                     */}
        {/* ================================================= */}

        <aside
          className="
            relative
            flex
            w-[395px]
            shrink-0
            flex-col
            border-l
            border-black/50
            bg-[#202020]
            shadow-[-8px_0_30px_rgba(0,0,0,.18)]
            xl:w-[405px]
          "
        >
          {/* tabs */}
          <div
            className="
              flex
              h-[39px]
              shrink-0
              items-center
              border-b
              border-white/10
              bg-[#222222]
            "
          >
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "entries",
                )
              }
              className={[
                "flex h-full items-center gap-1.5 border-b-2 px-4 text-[12px] font-semibold",
                activeTab ===
                "entries"
                  ? "border-white text-white"
                  : "border-transparent text-white/55 hover:text-white",
              ].join(" ")}
            >
              Entries

              <span
                className="
                  rounded-full
                  bg-white/10
                  px-1.5
                  py-[1px]
                  text-[10px]
                  text-white/65
                "
              >
                {visibleEntries.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "results",
                )
              }
              className={[
                "flex h-full items-center gap-1.5 border-b-2 px-4 text-[12px] font-semibold",
                activeTab ===
                "results"
                  ? "border-white text-white"
                  : "border-transparent text-white/55 hover:text-white",
              ].join(" ")}
            >
              Results

              <span
                className="
                  rounded-full
                  bg-white/10
                  px-1.5
                  py-[1px]
                  text-[10px]
                  text-white/65
                "
              >
                {results.length}
              </span>
            </button>

            <button
              type="button"
              className="
                ml-auto
                mr-1
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-md
                text-white/70
                hover:bg-white/10
              "
              aria-label="Collapse panel"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {activeTab ===
          "entries" ? (
            <>
              {/* toolbar */}
              <div
                className="
                  flex
                  h-[52px]
                  shrink-0
                  items-center
                  gap-1.5
                  border-b
                  border-white/10
                  px-3
                "
              >
                <button
                  type="button"
                  onClick={
                    shuffleEntries
                  }
                  disabled={
                    isSpinning
                  }
                  className="
                    flex
                    h-32px
                    items-center
                    gap-1.5
                    rounded-md
                    bg-[#41446d]
                    px-3
                    py-2
                    text-[12px]
                    font-semibold
                    text-white
                    hover:bg-[#4b4f7d]
                    disabled:opacity-40
                  "
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Shuffle
                </button>

                <button
                  type="button"
                  onClick={
                    sortEntries
                  }
                  disabled={
                    isSpinning
                  }
                  className="
                    flex
                    items-center
                    gap-1.5
                    rounded-md
                    bg-[#41446d]
                    px-3
                    py-2
                    text-[12px]
                    font-semibold
                    text-white
                    hover:bg-[#4b4f7d]
                    disabled:opacity-40
                  "
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Sort
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddImage(
                        (current) =>
                          !current,
                      )
                    }
                    className="
                      flex
                      items-center
                      gap-1.5
                      rounded-md
                      bg-[#41446d]
                      px-3
                      py-2
                      text-[12px]
                      font-semibold
                      text-white
                      hover:bg-[#4b4f7d]
                    "
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Add image
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showAddImage && (
                    <div
                      className="
                        absolute
                        left-0
                        top-[38px]
                        z-[300]
                        w-44
                        rounded-lg
                        border
                        border-white/10
                        bg-[#292929]
                        p-1
                        shadow-2xl
                      "
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddImage(
                            false,
                          )

                          fileInputRef.current?.click()
                        }}
                        className="
                          flex
                          w-full
                          items-center
                          gap-2
                          rounded-md
                          px-3
                          py-2
                          text-left
                          text-sm
                          text-white/80
                          hover:bg-white/10
                        "
                      >
                        <ImagePlus className="h-4 w-4" />
                        Upload image
                      </button>
                    </div>
                  )}
                </div>

                <label
                  className="
                    ml-auto
                    flex
                    cursor-pointer
                    items-center
                    gap-2
                    text-[12px]
                    font-medium
                    text-white/80
                  "
                >
                  <input
                    type="checkbox"
                    checked={
                      showAdvanced
                    }
                    onChange={(event) =>
                      setShowAdvanced(
                        event.target
                          .checked,
                      )
                    }
                    className="
                      h-4
                      w-4
                      rounded
                      border-white/20
                      accent-[#666baf]
                    "
                  />
                  Advanced
                </label>
              </div>

              {/* advanced panel */}
              {showAdvanced && (
                <div
                  className="
                    shrink-0
                    border-b
                    border-white/10
                    bg-[#191919]
                    p-3
                  "
                >
                  <div className="mb-2 text-[12px] font-semibold text-white">
                    Advanced settings
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="text-[10px] text-white/45">
                        Spin duration
                      </div>

                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={
                          spinDuration
                        }
                        onChange={(event) =>
                          setSpinDuration(
                            Math.max(
                              1,
                              Math.min(
                                30,
                                Number(
                                  event
                                    .target
                                    .value,
                                ) ||
                                  1,
                              ),
                            ),
                          )
                        }
                        className="
                          mt-1
                          w-full
                          bg-transparent
                          text-sm
                          font-semibold
                          text-white
                          outline-none
                        "
                      />
                    </label>

                    <label className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="text-[10px] text-white/45">
                        Revolutions
                      </div>

                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={
                          revolutions
                        }
                        onChange={(event) =>
                          setRevolutions(
                            Math.max(
                              1,
                              Math.min(
                                30,
                                Number(
                                  event
                                    .target
                                    .value,
                                ) ||
                                  1,
                              ),
                            ),
                          )
                        }
                        className="
                          mt-1
                          w-full
                          bg-transparent
                          text-sm
                          font-semibold
                          text-white
                          outline-none
                        "
                      />
                    </label>
                  </div>

                  <label
                    className="
                      mt-2
                      flex
                      cursor-pointer
                      items-center
                      justify-between
                      rounded-md
                      border
                      border-white/10
                      bg-white/[0.03]
                      px-3
                      py-2.5
                    "
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Hide selected
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/40">
                        Remove the winner after each spin
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={
                        removeWinner
                      }
                      onChange={(
                        event,
                      ) => {
                        const checked =
                          event.target
                            .checked

                        setRemoveWinner(
                          checked,
                        )

                        hideSelectedRef.current =
                          checked
                      }}
                      className="h-4 w-4 accent-[#6970b4]"
                    />
                  </label>
                </div>
              )}

              {/* count */}
              <div
                className="
                  flex
                  h-[44px]
                  shrink-0
                  items-center
                  justify-between
                  px-4
                "
              >
                <span className="text-[12px] text-white/70">
                  {visibleEntries.length}{" "}
                  entries
                </span>

                <span className="text-[10px] text-white/35">
                  One entry per line
                </span>
              </div>

              {/* entry editor */}
              <div
                className="
                  min-h-0
                  flex-1
                  px-4
                  pb-3
                "
              >
                <textarea
                  value={entryText}
                  onChange={(event) =>
                    updateEntriesFromText(
                      event.target
                        .value,
                    )
                  }
                  spellCheck={false}
                  className="
                    h-full
                    min-h-[200px]
                    w-full
                    resize-none
                    rounded-md
                    border
                    border-[#555]
                    bg-[#191919]
                    px-3
                    py-2
                    font-sans
                    text-[13px]
                    leading-[18px]
                    text-white
                    outline-none
                    focus:border-[#7277ba]
                    focus:ring-1
                    focus:ring-[#7277ba]
                  "
                  placeholder="Enter names here..."
                />
              </div>

              {/* Add wheel */}
              <div
                className="
                  shrink-0
                  px-4
                  pb-4
                "
              >
                <div className="flex">
                  <button
                    type="button"
                    onClick={addEntry}
                    className="
                      flex
                      h-[37px]
                      flex-1
                      items-center
                      justify-center
                      gap-2
                      rounded-l-md
                      bg-[#41446d]
                      text-[12px]
                      font-semibold
                      text-white
                      hover:bg-[#4b4f7d]
                    "
                  >
                    <Plus className="h-4 w-4" />
                    Add wheel
                  </button>

                  <button
                    type="button"
                    className="
                      flex
                      h-[37px]
                      w-[40px]
                      items-center
                      justify-center
                      rounded-r-md
                      border-l
                      border-white/10
                      bg-[#41446d]
                      text-white
                      hover:bg-[#4b4f7d]
                    "
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* results */}
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
                <div>
                  <div className="text-sm font-semibold text-white">
                    Results
                  </div>

                  <div className="mt-0.5 text-[10px] text-white/40">
                    Previous winners
                  </div>
                </div>

                {results.length >
                  0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setResults([])
                    }
                    className="
                      text-[11px]
                      text-white/45
                      hover:text-white
                    "
                  >
                    Clear
                  </button>
                )}
              </div>

              <div
                className="
                  min-h-0
                  flex-1
                  overflow-y-auto
                  p-3
                "
              >
                {results.length ===
                0 ? (
                  <div
                    className="
                      flex
                      h-full
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

                    <div className="mt-3 text-sm text-white/55">
                      No results yet
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
                            rounded-md
                            border
                            border-white/10
                            bg-[#191919]
                            px-3
                            py-3
                          "
                        >
                          <div
                            className="
                              flex
                              h-7
                              w-7
                              items-center
                              justify-center
                              rounded-full
                              bg-[#41446d]
                              text-[11px]
                              font-bold
                              text-white
                            "
                          >
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">
                              {
                                result.label
                              }
                            </div>

                            <div className="mt-0.5 text-[10px] text-white/35">
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

                          <Trophy className="h-4 w-4 text-white/25" />
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* footer */}
          <div
            className="
              flex
              h-[32px]
              shrink-0
              items-center
              justify-between
              border-t
              border-white/10
              px-3
              text-[10px]
              text-white/45
            "
          >
            <span>Version 432</span>

            <button
              type="button"
              className="underline hover:text-white"
            >
              Changelog
            </button>
          </div>
        </aside>
      </div>

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,.json,image/*"
        className="hidden"
        onChange={(event) => {
          const file =
            event.target.files?.[0]

          if (!file) {
            return
          }

          if (
            file.type.startsWith(
              "image/",
            )
          ) {
            addImage(file)
          } else if (
            file.name.endsWith(
              ".json",
            )
          ) {
            const reader =
              new FileReader()

            reader.onload = () => {
              try {
                const data =
                  JSON.parse(
                    String(
                      reader.result ??
                        "",
                    ),
                  )

                if (
                  Array.isArray(
                    data.entries,
                  )
                ) {
                  setEntries(
                    data.entries,
                  )

                  if (
                    typeof data.name ===
                    "string"
                  ) {
                    setWheelName(
                      data.name,
                    )
                  }

                  if (
                    Array.isArray(
                      data.results,
                    )
                  ) {
                    setResults(
                      data.results,
                    )
                  }

                  toast.success(
                    "Wheel opened.",
                  )
                }
              } catch {
                toast.error(
                  "Invalid wheel file.",
                )
              }
            }

            reader.readAsText(file)
          } else {
            openFile(file)
          }

          event.target.value = ""
        }}
      />

      {/* ================================================= */}
      {/* CUSTOMIZE DIALOG                                  */}
      {/* ================================================= */}

      {showCustomize && (
        <div
          className="
            fixed
            inset-0
            z-[1000]
            flex
            items-center
            justify-center
            bg-black/60
            p-4
            backdrop-blur-sm
          "
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCustomize(
                false,
              )
            }
          }}
        >
          <div
            className="
              w-full
              max-w-[430px]
              overflow-hidden
              rounded-xl
              border
              border-white/10
              bg-[#242424]
              shadow-2xl
            "
          >
            <div
              className="
                flex
                h-[55px]
                items-center
                justify-between
                border-b
                border-white/10
                px-5
              "
            >
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-white/70" />
                <span className="text-sm font-semibold">
                  Customize
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCustomize(
                    false,
                  )
                }
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-md
                  text-white/50
                  hover:bg-white/10
                  hover:text-white
                "
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <div className="mb-2 text-xs font-medium text-white/60">
                  Wheel name
                </div>

                <input
                  value={wheelName}
                  onChange={(event) =>
                    setWheelName(
                      event.target
                        .value ||
                        "Wheel of Names",
                    )
                  }
                  className="
                    w-full
                    rounded-lg
                    border
                    border-white/10
                    bg-[#181818]
                    px-3
                    py-2.5
                    text-sm
                    text-white
                    outline-none
                    focus:border-white/25
                  "
                />
              </label>

              <label className="block">
                <div className="mb-2 text-xs font-medium text-white/60">
                  Background
                </div>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      background
                    }
                    onChange={(event) =>
                      setBackground(
                        event.target
                          .value,
                      )
                    }
                    className="
                      h-10
                      w-12
                      cursor-pointer
                      rounded-md
                      border
                      border-white/10
                      bg-transparent
                    "
                  />

                  <input
                    value={
                      background
                    }
                    onChange={(event) =>
                      setBackground(
                        event.target
                          .value,
                      )
                    }
                    className="
                      min-w-0
                      flex-1
                      rounded-lg
                      border
                      border-white/10
                      bg-[#181818]
                      px-3
                      text-sm
                      text-white
                      outline-none
                    "
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-2 text-xs font-medium text-white/60">
                  Wheel text
                </div>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={
                      textColor
                    }
                    onChange={(event) =>
                      setTextColor(
                        event.target
                          .value,
                      )
                    }
                    className="
                      h-10
                      w-12
                      cursor-pointer
                      rounded-md
                      border
                      border-white/10
                      bg-transparent
                    "
                  />

                  <input
                    value={
                      textColor
                    }
                    onChange={(event) =>
                      setTextColor(
                        event.target
                          .value,
                      )
                    }
                    className="
                      min-w-0
                      flex-1
                      rounded-lg
                      border
                      border-white/10
                      bg-[#181818]
                      px-3
                      text-sm
                      text-white
                      outline-none
                    "
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={() => {
                  setBackground(
                    "#16232c",
                  )
                  setTextColor(
                    "#111111",
                  )
                }}
                className="
                  w-full
                  rounded-lg
                  border
                  border-white/10
                  bg-white/5
                  py-2.5
                  text-sm
                  font-medium
                  text-white/75
                  hover:bg-white/10
                  hover:text-white
                "
              >
                Reset appearance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {showMore && (
        <div
          className="
            fixed
            left-2
            right-2
            top-[50px]
            z-[900]
            rounded-xl
            border
            border-white/10
            bg-[#252525]
            p-2
            shadow-2xl
            lg:hidden
          "
        >
          <button
            type="button"
            onClick={() => {
              setShowCustomize(
                true,
              )
              setShowMore(false)
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-white/80 hover:bg-white/10"
          >
            <Palette className="h-4 w-4" />
            Customize
          </button>

          <button
            type="button"
            onClick={() => {
              newWheel()
              setShowMore(false)
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-white/80 hover:bg-white/10"
          >
            <FilePlus className="h-4 w-4" />
            New
          </button>

          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click()
              setShowMore(false)
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-white/80 hover:bg-white/10"
          >
            <FolderOpen className="h-4 w-4" />
            Open
          </button>

          <button
            type="button"
            onClick={() => {
              saveWheel()
              setShowMore(false)
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-white/80 hover:bg-white/10"
          >
            <Save className="h-4 w-4" />
            Save
          </button>

          <button
            type="button"
            onClick={() => {
              toggleFullscreen()
              setShowMore(false)
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-white/80 hover:bg-white/10"
          >
            <Maximize className="h-4 w-4" />
            Fullscreen
          </button>
        </div>
      )}
    </div>
  )
}
