import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Edit3,
  Eye,
  EyeOff,
  FilePlus2,
  History,
  Maximize2,
  MoreHorizontal,
  Palette,
  Plus,
  RotateCcw,
  Settings2,
  Share2,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react"
import { toast } from "sonner"
import { Wheel } from "spin-wheel"

import Navbar from "@/components/home/Navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  "#66c5f8",
  "#d889e8",
  "#ffd95c",
  "#67dba5",
  "#66c5f8",
  "#d889e8",
  "#ffd95c",
  "#67dba5",
]

const DEFAULT_ENTRIES = [
  "Ali",
  "Beatriz",
  "Charles",
  "Diya",
  "Eric",
  "Fatima",
  "Gabriel",
  "Hanna",
]

function makeEntry(
  label: string,
  index: number,
): WheelEntry {
  return {
    id: crypto.randomUUID(),
    label,
    color: COLORS[index % COLORS.length],
    hidden: false,
  }
}

function createDefaultEntries(): WheelEntry[] {
  return DEFAULT_ENTRIES.map((label, index) =>
    makeEntry(label, index),
  )
}

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1),
    )

    ;[result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index],
    ]
  }

  return result
}

export default function SpinWheel() {
  const wheelContainerRef =
    useRef<HTMLDivElement | null>(null)

  const wheelRef = useRef<Wheel | null>(null)

  const pendingWinnerRef =
    useRef<string | null>(null)

  const [entries, setEntries] = useState<WheelEntry[]>(
    createDefaultEntries,
  )

  const [results, setResults] = useState<
    SpinResult[]
  >([])

  const [selectedResult, setSelectedResult] =
    useState<SpinResult | null>(null)

  const [isSpinning, setIsSpinning] =
    useState(false)

  const [currentIndex, setCurrentIndex] =
    useState(0)

  const [newEntry, setNewEntry] = useState("")

  const [showResults, setShowResults] =
    useState(false)

  const [showAdvanced, setShowAdvanced] =
    useState(false)

  const [showCustomize, setShowCustomize] =
    useState(false)

  const [showMore, setShowMore] = useState(false)

  const [hideSelected, setHideSelected] =
    useState(false)

  const [spinDuration, setSpinDuration] =
    useState(6500)

  const [spinRevolutions, setSpinRevolutions] =
    useState(6)

  const visibleEntries = useMemo(
    () =>
      entries.filter(
        (entry) => !entry.hidden,
      ),
    [entries],
  )

  const selectedEntry =
    visibleEntries[currentIndex] ??
    visibleEntries[0] ??
    null

  const rebuildWheel = useCallback(() => {
    const container = wheelContainerRef.current

    if (!container) {
      return
    }

    wheelRef.current?.remove()
    wheelRef.current = null

    if (!visibleEntries.length) {
      return
    }

    const wheel = new Wheel(container, {
      items: visibleEntries.map((entry) => ({
        label: entry.label,
        backgroundColor: entry.color,
        labelColor: "#111827",
      })),

      radius: 0.94,

      /*
       * 90 degrees places the target point on
       * the right side of the wheel.
       */
      pointerAngle: 90,

      lineWidth: 1,

      lineColor:
        "rgba(255,255,255,0.22)",

      itemLabelFont:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

      itemLabelColors: ["#111827"],

      itemLabelAlign: "center",

      itemLabelRadius: 0.78,

      itemLabelRadiusMax: 0.28,

      itemLabelFontSizeMax: 52,

      itemLabelStrokeWidth: 0,

      pixelRatio: Math.min(
        2,
        typeof window !== "undefined"
          ? window.devicePixelRatio || 1
          : 1,
      ),

      rotationResistance: -35,
    })

    wheel.onCurrentIndexChange = (
      event,
    ) => {
      setCurrentIndex(
        event.currentIndex,
      )
    }

    wheel.onRest = (event) => {
      setIsSpinning(false)

      const winner =
        visibleEntries[event.currentIndex] ??
        visibleEntries.find(
          (entry) =>
            entry.id ===
            pendingWinnerRef.current,
        )

      if (!winner) {
        pendingWinnerRef.current = null
        return
      }

      const result: SpinResult = {
        id: winner.id,
        label: winner.label,
        timestamp: Date.now(),
      }

      setResults((current) => [
        result,
        ...current,
      ].slice(0, 25))

      setSelectedResult(result)

      pendingWinnerRef.current = null

      if (hideSelected) {
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
        `${winner.label} was selected`,
      )
    }

    wheelRef.current = wheel
  }, [
    hideSelected,
    visibleEntries,
  ])

  useEffect(() => {
    rebuildWheel()

    return () => {
      wheelRef.current?.remove()
      wheelRef.current = null
    }
  }, [rebuildWheel])

  const spin = useCallback(() => {
    const wheel = wheelRef.current

    if (
      !wheel ||
      !visibleEntries.length ||
      isSpinning
    ) {
      return
    }

    const randomIndex = Math.floor(
      Math.random() *
        visibleEntries.length,
    )

    const winner =
      visibleEntries[randomIndex]

    if (!winner) {
      return
    }

    pendingWinnerRef.current =
      winner.id

    setSelectedResult(null)
    setIsSpinning(true)

    wheel.spinToItem(
      randomIndex,
      spinDuration,
      true,
      spinRevolutions,
      1,
    )
  }, [
    isSpinning,
    spinDuration,
    spinRevolutions,
    visibleEntries,
  ])

  useEffect(() => {
    function handleKeyboard(
      event: KeyboardEvent,
    ) {
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
      handleKeyboard,
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard,
      )
    }
  }, [spin])

  function addEntry() {
    const value = newEntry.trim()

    if (!value) {
      toast.error("Enter a name first.")
      return
    }

    setEntries((current) => [
      ...current,
      makeEntry(
        value,
        current.length,
      ),
    ])

    setNewEntry("")
  }

  function removeEntry(id: string) {
    if (isSpinning) {
      return
    }

    setEntries((current) =>
      current.filter(
        (entry) => entry.id !== id,
      ),
    )
  }

  function toggleHidden(id: string) {
    if (isSpinning) {
      return
    }

    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              hidden: !entry.hidden,
            }
          : entry,
      ),
    )
  }

  function updateEntry(
    id: string,
    value: string,
  ) {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              label: value,
            }
          : entry,
      ),
    )
  }

  function shuffleEntries() {
    if (isSpinning) {
      return
    }

    setEntries((current) =>
      shuffleArray(current).map(
        (entry, index) => ({
          ...entry,
          color:
            COLORS[
              index % COLORS.length
            ],
        }),
      ),
    )

    toast.success(
      "Entries shuffled.",
    )
  }

  function sortEntries() {
    if (isSpinning) {
      return
    }

    setEntries((current) =>
      [...current].sort(
        (a, b) =>
          a.label.localeCompare(
            b.label,
            undefined,
            {
              sensitivity: "base",
            },
          ),
      ),
    )

    toast.success(
      "Entries sorted.",
    )
  }

  function clearEntries() {
    if (isSpinning) {
      return
    }

    setEntries([])
    setResults([])
    setSelectedResult(null)
  }

  function restoreEntries() {
    if (isSpinning) {
      return
    }

    setEntries(
      createDefaultEntries(),
    )

    setResults([])
    setSelectedResult(null)

    toast.success(
      "Default entries restored.",
    )
  }

  function clearResults() {
    setResults([])
    setSelectedResult(null)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.()
    } else {
      void document.exitFullscreen?.()
    }
  }

  function copyEntries() {
    const text = visibleEntries
      .map((entry) => entry.label)
      .join("\n")

    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        toast.success(
          "Entries copied.",
        )
      })
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="mx-auto w-full max-w-[1700px] px-3 py-4 sm:px-5 lg:px-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-blue-500">
                <Sparkles className="h-4 w-4" />
                TOOLS
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Spin Wheel
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Randomly select a member,
                option, or outcome.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={restoreEntries}
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                New
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyEntries}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2 sm:px-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSpinning}
                onClick={shuffleEntries}
              >
                <Shuffle className="mr-2 h-4 w-4" />
                Shuffle
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSpinning}
                onClick={sortEntries}
              >
                <span className="mr-2 text-sm font-bold">
                  A↓
                </span>
                Sort
              </Button>

              <Button
                type="button"
                variant={
                  showCustomize
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  setShowCustomize(
                    (current) =>
                      !current,
                  )
                }
              >
                <Palette className="mr-2 h-4 w-4" />
                Customize
              </Button>

              <Button
                type="button"
                variant={
                  showAdvanced
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() =>
                  setShowAdvanced(
                    (current) =>
                      !current,
                  )
                }
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Advanced
              </Button>

              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant={
                    showResults
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  onClick={() =>
                    setShowResults(
                      (current) =>
                        !current,
                    )
                  }
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Results

                  {results.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-background/80 px-1.5 text-[10px] font-bold text-foreground">
                      {results.length}
                    </span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setShowMore(
                      (current) =>
                        !current,
                    )
                  }
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {showMore && (
              <div className="border-b border-border/70 bg-muted/20 px-3 py-3 sm:px-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearEntries}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear entries
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={restoreEntries}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore defaults
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearResults}
                  >
                    <History className="mr-2 h-4 w-4" />
                    Clear results
                  </Button>
                </div>
              </div>
            )}

            {showCustomize && (
              <div className="border-b border-border/70 bg-muted/20 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">
                      Spin duration
                    </label>

                    <select
                      value={spinDuration}
                      onChange={(event) =>
                        setSpinDuration(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value={4000}>
                        Fast — 4 seconds
                      </option>

                      <option value={6500}>
                        Normal — 6.5 seconds
                      </option>

                      <option value={9000}>
                        Slow — 9 seconds
                      </option>

                      <option value={12000}>
                        Long — 12 seconds
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold">
                      Revolutions
                    </label>

                    <select
                      value={spinRevolutions}
                      onChange={(event) =>
                        setSpinRevolutions(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value={3}>
                        3 rotations
                      </option>

                      <option value={5}>
                        5 rotations
                      </option>

                      <option value={6}>
                        6 rotations
                      </option>

                      <option value={8}>
                        8 rotations
                      </option>

                      <option value={10}>
                        10 rotations
                      </option>
                    </select>
                  </div>

                  <label className="flex h-10 items-center gap-3 self-end rounded-lg border border-border bg-background px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        hideSelected
                      }
                      onChange={(event) =>
                        setHideSelected(
                          event.target.checked,
                        )
                      }
                      className="h-4 w-4 accent-blue-500"
                    />

                    Hide selected entries
                  </label>
                </div>
              </div>
            )}

            <div className="grid min-h-[650px] lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="relative min-h-[650px] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <div className="pointer-events-none absolute inset-0 opacity-30">
                  <div className="absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
                </div>

                <button
                  type="button"
                  className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white backdrop-blur transition hover:bg-white/15"
                  onClick={() =>
                    document
                      .getElementById(
                        "wheel-entry-input",
                      )
                      ?.focus()
                  }
                  aria-label="Edit entries"
                >
                  <Edit3 className="h-4 w-4" />
                </button>

                <div
                  ref={wheelContainerRef}
                  className={[
                    "absolute inset-4 bottom-14 flex items-center justify-center",
                    "select-none",
                    isSpinning
                      ? "cursor-default"
                      : "cursor-pointer",
                  ].join(" ")}
                  onClick={() => {
                    if (!isSpinning) {
                      spin()
                    }
                  }}
                />

                <div className="pointer-events-none absolute right-[3.5%] top-1/2 z-20 hidden -translate-y-1/2 lg:block">
                  <div className="h-0 w-0 border-y-[20px] border-y-transparent border-l-[42px] border-l-emerald-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" />
                </div>

                {!isSpinning &&
                  visibleEntries.length >
                    0 && (
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                      <div className="rounded-full bg-white px-5 py-2.5 text-center text-base font-extrabold tracking-tight text-slate-900 shadow-xl sm:text-lg">
                        Click to spin
                      </div>

                      <div className="mt-2 text-xs font-semibold text-white/80 drop-shadow">
                        or press ctrl+enter
                      </div>
                    </div>
                  )}

                {isSpinning && (
                  <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                    Spinning...
                  </div>
                )}

                {visibleEntries.length ===
                  0 && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-8 py-7 text-center backdrop-blur">
                      <Sparkles className="mx-auto h-9 w-9 text-blue-300" />

                      <h2 className="mt-3 text-lg font-bold text-white">
                        Add some entries
                      </h2>

                      <p className="mt-1 text-sm text-white/60">
                        Add names on the right to
                        create your wheel.
                      </p>
                    </div>
                  </div>
                )}

                {selectedEntry &&
                  !isSpinning && (
                    <div className="pointer-events-none absolute bottom-5 left-5 hidden max-w-[40%] lg:block">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Current
                      </div>

                      <div className="mt-0.5 truncate text-sm font-semibold text-white/80">
                        {
                          selectedEntry.label
                        }
                      </div>
                    </div>
                  )}
              </div>

              <aside className="flex min-h-[650px] flex-col border-t border-border/70 bg-card lg:border-l lg:border-t-0">
                <div className="flex h-14 shrink-0 items-center border-b border-border/70">
                  <button
                    type="button"
                    onClick={() =>
                      setShowResults(false)
                    }
                    className={[
                      "flex h-full flex-1 items-center justify-center gap-2 border-b-2 text-sm font-bold",
                      !showResults
                        ? "border-blue-500"
                        : "border-transparent text-muted-foreground",
                    ].join(" ")}
                  >
                    Entries

                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                      {
                        visibleEntries.length
                      }
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowResults(true)
                    }
                    className={[
                      "flex h-full flex-1 items-center justify-center gap-2 border-b-2 text-sm font-semibold transition-colors hover:text-foreground",
                      showResults
                        ? "border-blue-500 text-foreground"
                        : "border-transparent text-muted-foreground",
                    ].join(" ")}
                  >
                    Results

                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                      {results.length}
                    </span>
                  </button>
                </div>

                {!showResults ? (
                  <>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 p-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          isSpinning
                        }
                        onClick={
                          shuffleEntries
                        }
                      >
                        <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                        Shuffle
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          isSpinning
                        }
                        onClick={
                          sortEntries
                        }
                      >
                        A–Z
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setShowAdvanced(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                        Advanced
                      </Button>
                    </div>

                    <div className="shrink-0 border-b border-border/70 p-3">
                      <div className="flex gap-2">
                        <Input
                          id="wheel-entry-input"
                          value={newEntry}
                          onChange={(event) =>
                            setNewEntry(
                              event.target
                                .value,
                            )
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              event.preventDefault()
                              addEntry()
                            }
                          }}
                          placeholder="Add an entry..."
                          disabled={
                            isSpinning
                          }
                        />

                        <Button
                          type="button"
                          size="icon"
                          onClick={
                            addEntry
                          }
                          disabled={
                            isSpinning ||
                            !newEntry.trim()
                          }
                          aria-label="Add entry"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Press Enter to add an
                        entry.
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {entries.length ===
                      0 ? (
                        <div className="flex h-full min-h-[250px] items-center justify-center px-6 text-center">
                          <div>
                            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />

                            <p className="mt-3 text-sm font-semibold">
                              No entries
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Add something to
                              the wheel above.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/60">
                          {entries.map(
                            (
                              entry,
                              index,
                            ) => (
                              <div
                                key={
                                  entry.id
                                }
                                className={[
                                  "group flex items-center gap-2 px-3 py-2.5 transition-colors",
                                  entry.hidden
                                    ? "opacity-45"
                                    : "hover:bg-muted/40",
                                ].join(
                                  " ",
                                )}
                              >
                                <span
                                  className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                                  style={{
                                    backgroundColor:
                                      entry.color,
                                  }}
                                />

                                <Input
                                  value={
                                    entry.label
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateEntry(
                                      entry.id,
                                      event
                                        .target
                                        .value,
                                    )
                                  }
                                  disabled={
                                    isSpinning
                                  }
                                  className="h-8 border-transparent bg-transparent px-1 shadow-none focus-visible:border-blue-500/30 focus-visible:bg-background"
                                />

                                <span className="hidden w-5 shrink-0 text-right text-[10px] text-muted-foreground sm:block">
                                  {index +
                                    1}
                                </span>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-muted-foreground"
                                  onClick={() =>
                                    toggleHidden(
                                      entry.id,
                                    )
                                  }
                                  disabled={
                                    isSpinning
                                  }
                                  aria-label={
                                    entry.hidden
                                      ? `Show ${entry.label}`
                                      : `Hide ${entry.label}`
                                  }
                                >
                                  {entry.hidden ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    removeEntry(
                                      entry.id,
                                    )
                                  }
                                  disabled={
                                    isSpinning
                                  }
                                  aria-label={`Remove ${entry.label}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 border-t border-border/70 p-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={
                          isSpinning
                        }
                        onClick={() =>
                          setEntries(
                            (current) => [
                              ...current,
                              makeEntry(
                                `Entry ${
                                  current.length +
                                  1
                                }`,
                                current.length,
                              ),
                            ],
                          )
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add entry
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 items-center justify-between border-b border-border/70 p-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Results
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Your recent wheel
                          selections.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={
                          clearResults
                        }
                        disabled={
                          !results.length
                        }
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {results.length ===
                      0 ? (
                        <div className="flex h-full min-h-[300px] items-center justify-center px-6 text-center">
                          <div>
                            <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />

                            <p className="mt-3 text-sm font-semibold">
                              No results yet
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Spin the wheel to see
                              the winner here.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/60">
                          {results.map(
                            (
                              result,
                              index,
                            ) => (
                              <button
                                key={`${result.id}-${result.timestamp}`}
                                type="button"
                                onClick={() =>
                                  setSelectedResult(
                                    result,
                                  )
                                }
                                className={[
                                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                                  selectedResult?.timestamp ===
                                    result.timestamp
                                    ? "bg-blue-500/5"
                                    : "",
                                ].join(
                                  " ",
                                )}
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-500">
                                  {index +
                                    1}
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold">
                                    {
                                      result.label
                                    }
                                  </span>

                                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                    {new Date(
                                      result.timestamp,
                                    ).toLocaleTimeString(
                                      "en-GB",
                                      {
                                        hour: "2-digit",
                                        minute:
                                          "2-digit",
                                      },
                                    )}
                                  </span>
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </div>

            {showAdvanced && (
              <div className="border-t border-border/70 bg-muted/20 p-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                      Wheel
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {
                        visibleEntries.length
                      }{" "}
                      active entries are
                      currently displayed.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                      Selection
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Winners are selected
                      randomly and the wheel
                      animates to the selected
                      segment.
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-500">
                      Keyboard
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Press Ctrl + Enter to spin
                      the wheel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span>
                  {
                    visibleEntries.length
                  }{" "}
                  {visibleEntries.length ===
                  1
                    ? "entry"
                    : "entries"}
                </span>

                <span className="hidden text-muted-foreground/40 sm:inline">
                  •
                </span>

                <span>
                  {results.length}{" "}
                  {results.length === 1
                    ? "result"
                    : "results"}
                </span>

                {selectedResult && (
                  <>
                    <span className="hidden text-muted-foreground/40 sm:inline">
                      •
                    </span>

                    <span className="font-medium text-foreground/70">
                      Last:{" "}
                      {
                        selectedResult.label
                      }
                    </span>
                  </>
                )}
              </div>

              <span className="font-medium text-foreground/60">
                Metro Police Department
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
