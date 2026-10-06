import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  History,
  ListPlus,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { Wheel } from "spin-wheel"
import { toast } from "sonner"

import Footer from "@/components/Footer"
import Navbar from "@/components/home/Navbar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const STORAGE_KEY = "mpd-wheel-of-names"

const DEFAULT_ENTRIES = [
  "Option 1",
  "Option 2",
  "Option 3",
  "Option 4",
  "Option 5",
  "Option 6",
  "Option 7",
  "Option 8",
]

const WHEEL_COLORS = [
  "#2563eb",
  "#0f172a",
  "#3b82f6",
  "#1e293b",
  "#60a5fa",
  "#334155",
  "#1d4ed8",
  "#475569",
]

const MAX_HISTORY = 25

type WheelSettings = {
  duration: number
  removeWinner: boolean
  sound: boolean
}

type StoredWheelState = {
  entries?: string[]
  history?: string[]
  settings?: Partial<WheelSettings>
}

function loadStoredState(): StoredWheelState {
  try {
    const value = localStorage.getItem(STORAGE_KEY)

    if (!value) {
      return {}
    }

    const parsed = JSON.parse(value) as StoredWheelState

    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function getRandomIndex(length: number) {
  if (length <= 1) {
    return 0
  }

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return values[0] % length
  }

  return Math.floor(Math.random() * length)
}

type WheelItem = {
  label: string
  backgroundColor: string
  labelColor: string
}

function createWheelItems(entries: string[]): WheelItem[] {
  return entries.map((label, index) => ({
    label,
    backgroundColor: WHEEL_COLORS[index % WHEEL_COLORS.length],
    labelColor: "#ffffff",
  }))
}

function playTone(
  type: "tick" | "winner",
  enabled: boolean,
) {
  if (!enabled || typeof window === "undefined") {
    return
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }).webkitAudioContext

    if (!AudioContextClass) {
      return
    }

    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    const now = context.currentTime

    oscillator.type = type === "winner" ? "sine" : "triangle"
    oscillator.frequency.setValueAtTime(
      type === "winner" ? 620 : 180,
      now,
    )

    if (type === "winner") {
      oscillator.frequency.exponentialRampToValueAtTime(
        880,
        now + 0.16,
      )
    }

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(
      type === "winner" ? 0.08 : 0.035,
      now + 0.01,
    )
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (type === "winner" ? 0.24 : 0.06),
    )

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + (type === "winner" ? 0.25 : 0.07))

    window.setTimeout(() => {
      void context.close()
    }, 350)
  } catch {
    // Audio is optional and can be unavailable in restricted browsers.
  }
}

export default function WheelOfNames() {
  const stored = useMemo(() => loadStoredState(), [])

  const [entries, setEntries] = useState<string[]>(() => {
    const saved = stored.entries?.filter(Boolean)

    return saved && saved.length > 0 ? saved : DEFAULT_ENTRIES
  })

  const [history, setHistory] = useState<string[]>(() =>
    stored.history?.slice(0, MAX_HISTORY) ?? [],
  )

  const [settings, setSettings] = useState<WheelSettings>(() => ({
    duration:
      typeof stored.settings?.duration === "number"
        ? stored.settings.duration
        : 5,
    removeWinner: stored.settings?.removeWinner ?? false,
    sound: stored.settings?.sound ?? true,
  }))

  const [winner, setWinner] = useState<string | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [listText, setListText] = useState(() =>
    (stored.entries?.filter(Boolean) ?? DEFAULT_ENTRIES).join("\n"),
  )

  const wheelContainerRef = useRef<HTMLDivElement | null>(null)
  const wheelRef = useRef<Wheel | null>(null)
  const entriesRef = useRef(entries)
  const settingsRef = useRef(settings)
  const spinningRef = useRef(false)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        entries,
        history,
        settings,
      }),
    )
  }, [entries, history, settings])

  const applyListText = useCallback(() => {
    const nextEntries = listText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (nextEntries.length === 0) {
      toast.error("Add at least one entry to the wheel.")
      return
    }

    setEntries(nextEntries)
    setWinner(null)
    toast.success(`${nextEntries.length} entries loaded`)
  }, [listText])

  const shuffleEntries = useCallback(() => {
    if (isSpinning) {
      return
    }

    const shuffled = [...entries]

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = getRandomIndex(index + 1)
      ;[shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ]
    }

    setEntries(shuffled)
    setListText(shuffled.join("\n"))
    setWinner(null)
  }, [entries, isSpinning])

  const clearEntries = useCallback(() => {
    if (isSpinning) {
      return
    }

    setEntries([])
    setListText("")
    setWinner(null)
  }, [isSpinning])

  const resetWheel = useCallback(() => {
    if (isSpinning) {
      return
    }

    setEntries(DEFAULT_ENTRIES)
    setListText(DEFAULT_ENTRIES.join("\n"))
    setWinner(null)
    setHistory([])
    toast.success("Wheel reset")
  }, [isSpinning])

  const removeEntry = useCallback(
    (index: number) => {
      if (isSpinning) {
        return
      }

      const nextEntries = entries.filter((_, entryIndex) => entryIndex !== index)

      setEntries(nextEntries)
      setListText(nextEntries.join("\n"))

      if (winner === entries[index]) {
        setWinner(null)
      }
    },
    [entries, isSpinning, winner],
  )

  const spin = useCallback(() => {
    if (isSpinning || entries.length === 0 || !wheelRef.current) {
      return
    }

    if (entries.length === 1) {
      const selected = entries[0]

      setWinner(selected)
      setHistory((current) => [selected, ...current].slice(0, MAX_HISTORY))
      playTone("winner", settings.sound)

      if (settings.removeWinner) {
        setEntries([])
        setListText("")
      }

      return
    }

    const index = getRandomIndex(entries.length)
    setWinner(null)
    setIsSpinning(true)
    spinningRef.current = true

    wheelRef.current.spinToItem(
      index,
      settings.duration * 1000,
      true,
      5,
      1,
    )
  }, [entries, isSpinning, settings.duration, settings.sound])

  useEffect(() => {
    if (!wheelContainerRef.current) {
      return
    }

    const wheel = new Wheel(
      wheelContainerRef.current,
      {
        items: createWheelItems(entries),
        radius: 0.92,
        pointerAngle: 0,
        lineWidth: 1,
        lineColor: "rgba(255,255,255,0.28)",
        itemLabelFont: "Geist Variable, sans-serif",
        itemLabelFontSizeMax: 34,
        itemLabelRadius: 0.66,
        itemLabelRadiusMax: 0.78,
        itemLabelAlign: "right",
        itemLabelColors: ["#ffffff"],
        borderWidth: 0,
        pixelRatio: 2,
        isInteractive: false,
      },
    )

    wheelRef.current = wheel

    wheel.onCurrentIndexChange = () => {
      playTone("tick", settingsRef.current.sound)
    }

    wheel.onRest = (event) => {
      const currentEntries = entriesRef.current
      const index = event.currentIndex
      const selected = currentEntries[index]

      if (!selected || !spinningRef.current) {
        return
      }

      setWinner(selected)
      setHistory((current) => [selected, ...current].slice(0, MAX_HISTORY))
      setIsSpinning(false)
      spinningRef.current = false
      playTone("winner", settingsRef.current.sound)

      if (settingsRef.current.removeWinner) {
        const nextEntries = currentEntries.filter(
          (_, entryIndex) => entryIndex !== index,
        )

        setEntries(nextEntries)
        setListText(nextEntries.join("\n"))
      }
    }

    return () => {
      wheel.remove()
      wheelRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!wheelRef.current || isSpinning) {
      return
    }

    wheelRef.current.items = createWheelItems(entries)
  }, [entries, isSpinning])

  const itemCountLabel = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto max-w-[1600px] px-6 pb-20 pt-28 lg:px-8">
        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-500">
              MPD Tools
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Wheel of Names
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Randomly select an entry from your list. Everything runs directly
              inside the Metro Police Department website.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">
              {itemCountLabel}
            </span>
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">
              {settings.removeWinner ? "Remove winners" : "Keep winners"}
            </span>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,0.12),transparent_44%)]" />

            <div className="relative flex min-h-[560px] flex-col items-center justify-center">
              <div className="relative h-[min(72vw,620px)] max-h-[620px] min-h-[320px] w-full max-w-[620px]">
                <div
                  ref={wheelContainerRef}
                  className="absolute inset-0"
                />

                <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
                  <div className="h-0 w-0 border-l-[13px] border-r-[13px] border-t-[28px] border-b-0 border-l-transparent border-r-transparent border-t-blue-500 drop-shadow-[0_3px_8px_rgba(0,0,0,0.35)]" />
                </div>

                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-foreground shadow-xl">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={isSpinning || entries.length === 0}
                  onClick={spin}
                  className="min-w-40 bg-blue-600 px-8 text-white shadow-lg shadow-blue-500/15 hover:bg-blue-500"
                >
                  <Trophy />
                  {isSpinning ? "Spinning..." : "Spin the wheel"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={isSpinning || entries.length === 0}
                  onClick={shuffleEntries}
                >
                  <Shuffle />
                  Shuffle
                </Button>
              </div>

              {winner && !isSpinning && (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-5 py-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                      Winner
                    </p>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {winner}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Entries</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add one name or option per line.
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isSpinning}
                    onClick={() => setListText((value) => `${value}\nNew entry`)}
                    aria-label="Add entry"
                  >
                    <Plus />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isSpinning || entries.length === 0}
                    onClick={clearEntries}
                    aria-label="Clear entries"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <Textarea
                value={listText}
                onChange={(event) => setListText(event.target.value)}
                disabled={isSpinning}
                className="mt-4 min-h-56 resize-none rounded-xl bg-background/50 text-sm leading-6"
                placeholder={"Officer 1\nOfficer 2\nOfficer 3"}
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {listText.split(/\r?\n/).filter((item) => item.trim()).length} lines
                </span>

                <Button
                  type="button"
                  size="sm"
                  disabled={isSpinning}
                  onClick={applyListText}
                >
                  <ListPlus />
                  Update wheel
                </Button>
              </div>

              {entries.length > 0 && (
                <div className="mt-4 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {entries.map((entry, index) => (
                    <div
                      key={`${entry}-${index}`}
                      className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs transition-colors hover:border-border/70 hover:bg-muted/40"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            WHEEL_COLORS[index % WHEEL_COLORS.length],
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground group-hover:text-foreground">
                        {entry}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={isSpinning}
                        onClick={() => removeEntry(index)}
                        aria-label={`Remove ${entry}`}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <span>
                  <span className="block text-sm font-semibold">Wheel settings</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Spin time, winners and sound
                  </span>
                </span>
                {settingsOpen ? <ChevronUp /> : <ChevronDown />}
              </button>

              {settingsOpen && (
                <div className="border-t border-border/60 px-5 py-4">
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium">
                          Spin duration
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {settings.duration}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="10"
                        step="1"
                        value={settings.duration}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            duration: Number(event.target.value),
                          }))
                        }
                        className="mt-3 w-full accent-blue-600"
                        disabled={isSpinning}
                      />
                    </div>

                    <label className="flex cursor-pointer items-center justify-between gap-4">
                      <span className="flex items-center gap-3">
                        {settings.sound ? <Volume2 /> : <VolumeX />}
                        <span>
                          <span className="block text-sm font-medium">Sound</span>
                          <span className="block text-xs text-muted-foreground">
                            Tick and winner tones
                          </span>
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.sound}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            sound: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between gap-4">
                      <span>
                        <span className="block text-sm font-medium">
                          Remove winner
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Remove the selected entry after each spin
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={settings.removeWinner}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            removeWinner: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border/70 bg-card/70 shadow-sm backdrop-blur-xl">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setHistoryOpen((open) => !open)}
              >
                <span className="flex items-center gap-3">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span>
                    <span className="block text-sm font-semibold">Recent winners</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {history.length} recorded results
                    </span>
                  </span>
                </span>
                {historyOpen ? <ChevronUp /> : <ChevronDown />}
              </button>

              {historyOpen && (
                <div className="border-t border-border/60 px-5 py-4">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Winners will appear here after you spin the wheel.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2"
                        >
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            #{history.length - index}
                          </span>
                          <span className="truncate text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSpinning}
                onClick={resetWheel}
              >
                <RotateCcw />
                Reset
              </Button>

              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                <CircleHelp className="h-3.5 w-3.5" />
                Your list is saved locally in this browser.
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
