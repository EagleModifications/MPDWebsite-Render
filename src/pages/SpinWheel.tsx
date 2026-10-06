import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  CircleHelp,
  Copy,
  Dices,
  Download,
  Eraser,
  List,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  Shuffle,
  Sparkles,
  Trophy,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import Wheel, { type SpinWheelItem } from "@/components/spinwheel/Wheel"

const STORAGE_KEY = "mpd-spin-wheel-v2"

const DEFAULT_ENTRIES = ["1", "2", "3", "4", "5", "6"]

const COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
  "#2563eb",
  "#475569",
  "#0284c7",
  "#1d4ed8",
]

function makeItems(values: string[]): SpinWheelItem[] {
  return values.map((label, index) => ({
    id: crypto.randomUUID(),
    label,
    color: COLORS[index % COLORS.length],
    weight: 1,
    hidden: false,
  }))
}

function parseEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export default function SpinWheel() {
  const [items, setItems] = useState<SpinWheelItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return makeItems(DEFAULT_ENTRIES)

      const parsed = JSON.parse(stored) as unknown
      if (!Array.isArray(parsed)) return makeItems(DEFAULT_ENTRIES)

      const values = parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)

      return makeItems(values.length ? values : DEFAULT_ENTRIES)
    } catch {
      return makeItems(DEFAULT_ENTRIES)
    }
  })

  const [tab, setTab] = useState<"entries" | "results">("entries")
  const [entriesText, setEntriesText] = useState(() =>
    DEFAULT_ENTRIES.join("\n"),
  )
  const [results, setResults] = useState<string[]>([])
  const [spinTrigger, setSpinTrigger] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [duration, setDuration] = useState(6)
  const [removeAfterSpin, setRemoveAfterSpin] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.map((item) => item.label)),
    )
  }, [items])

  useEffect(() => {
    setEntriesText(items.map((item) => item.label).join("\n"))
  }, [items])

  useEffect(() => {
    if (!spinning) return

    const timeout = window.setTimeout(() => {
      setSpinning(false)
    }, Math.max(5500, duration * 1000 + 250))

    return () => window.clearTimeout(timeout)
  }, [spinning, duration])

  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items],
  )

  const syncEntries = (value: string) => {
    setEntriesText(value)
    const values = parseEntries(value)
    setItems(makeItems(values.length ? values : ["Entry"]))
  }

  const spin = () => {
    if (spinning || visibleItems.length < 1) return

    setWinner(null)
    setSpinning(true)
    setSpinTrigger((value) => value + 1)
  }

  const handleResult = (item: SpinWheelItem) => {
    setSpinning(false)
    setWinner(item.label)
    setResults((current) => [item.label, ...current])
    setTab("results")

    if (removeAfterSpin) {
      setItems((current) =>
        current.filter((entry) => entry.id !== item.id),
      )
    }
  }

  const shuffleEntries = () => {
    setItems((current) => {
      const shuffled = [...current]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        ;[shuffled[index], shuffled[randomIndex]] = [
          shuffled[randomIndex],
          shuffled[index],
        ]
      }
      return shuffled
    })
    toast.success("Entries shuffled")
  }

  const sortEntries = () => {
    setItems((current) =>
      [...current].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true }),
      ),
    )
    toast.success("Entries sorted")
  }

  const addEntry = () => {
    const next = {
      id: crypto.randomUUID(),
      label: `Entry ${items.length + 1}`,
      color: COLORS[items.length % COLORS.length],
      weight: 1,
      hidden: false,
    }
    setItems((current) => [...current, next])
  }

  const removeEntry = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const clearEntries = () => {
    setItems([])
    setEntriesText("")
    toast.success("Entries cleared")
  }

  const resetWheel = () => {
    setItems(makeItems(DEFAULT_ENTRIES))
    setResults([])
    setWinner(null)
    setEntriesText(DEFAULT_ENTRIES.join("\n"))
    toast.success("Wheel reset")
  }

  const copyResults = async () => {
    if (!results.length) return
    await navigator.clipboard.writeText(results.join("\n"))
    toast.success("Results copied")
  }

  const exportResults = () => {
    if (!results.length) return
    const blob = new Blob([results.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "mpd-spin-results.txt"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-7">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
                <Dices className="h-4 w-4" />
                COMMUNITY
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Spin Wheel
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Add entries and spin the Metro Police Department wheel to pick a winner.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetWheel}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-xs font-semibold shadow-sm transition hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((value) => !value)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-xs font-semibold shadow-sm transition hover:bg-muted"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Settings
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
                </button>

                {settingsOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-72 rounded-xl border border-border bg-popover p-4 shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Wheel settings</p>
                        <p className="text-xs text-muted-foreground">Control the spin behaviour.</p>
                      </div>
                      <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <label className="mb-4 block">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium">
                        <span>Spin duration</span>
                        <span className="text-muted-foreground">{duration}s</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="12"
                        value={duration}
                        onChange={(event) => setDuration(Number(event.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                      <span className="text-xs font-medium">Sound effects</span>
                      <input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} className="h-4 w-4 accent-blue-500" />
                    </label>
                    <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                      <span className="text-xs font-medium">Remove winner after spin</span>
                      <input type="checkbox" checked={removeAfterSpin} onChange={(event) => setRemoveAfterSpin(event.target.checked)} className="h-4 w-4 accent-blue-500" />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <div className="grid min-h-[680px] lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden border-b border-border/70 bg-muted/10 p-5 sm:p-8 lg:min-h-[680px] lg:border-b-0 lg:border-r">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_55%)]" />
                <div className="relative h-[min(68vw,610px)] w-[min(68vw,610px)] max-h-[610px] max-w-[610px] min-h-[320px] min-w-[320px]">
                  <Wheel
                    items={items}
                    spinTrigger={spinTrigger}
                    spinTime={duration}
                    afterSound={soundEnabled ? "Subdued applause" : "No sound"}
                    afterVolume={55}
                    duringSound={soundEnabled ? "Ticking sound" : "No sound"}
                    duringVolume={42}
                    onResult={handleResult}
                  />
                </div>

                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 sm:bottom-7">
                  <button
                    type="button"
                    onClick={spin}
                    disabled={spinning || visibleItems.length === 0}
                    className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {spinning ? "Spinning…" : "Spin"}
                  </button>
                </div>

                <div className="absolute right-4 top-4 hidden items-center gap-1.5 rounded-lg border border-border/70 bg-background/85 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur sm:flex">
                  <CircleHelp className="h-3.5 w-3.5" />
                  Click the wheel or press Ctrl + Enter
                </div>
              </div>

              <aside className="flex min-h-[680px] flex-col bg-background/60">
                <div className="grid grid-cols-2 border-b border-border/70">
                  <button
                    type="button"
                    onClick={() => setTab("entries")}
                    className={`relative flex h-12 items-center justify-center gap-2 text-xs font-semibold transition hover:bg-muted/60 ${tab === "entries" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}
                  >
                    <List className="h-4 w-4" />
                    Entries
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{visibleItems.length}</span>
                    {tab === "entries" && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("results")}
                    className={`relative flex h-12 items-center justify-center gap-2 text-xs font-semibold transition hover:bg-muted/60 ${tab === "results" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}
                  >
                    <Trophy className="h-4 w-4" />
                    Results
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{results.length}</span>
                    {tab === "results" && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />}
                  </button>
                </div>

                {tab === "entries" ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="border-b border-border/70 p-3">
                      <textarea
                        value={entriesText}
                        onChange={(event) => syncEntries(event.target.value)}
                        spellCheck={false}
                        className="min-h-[330px] w-full resize-none rounded-xl border border-input bg-background px-3 py-3 font-mono text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15"
                        placeholder="Enter one entry per line…"
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        One entry per line. Duplicate entries are allowed.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
                      <button type="button" onClick={shuffleEntries} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-medium hover:bg-muted">
                        <Shuffle className="h-3.5 w-3.5" /> Shuffle
                      </button>
                      <button type="button" onClick={sortEntries} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-medium hover:bg-muted">
                        <Dices className="h-3.5 w-3.5" /> Sort
                      </button>
                      <button type="button" onClick={addEntry} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-medium hover:bg-muted">
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                      <button type="button" onClick={clearEntries} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                        <Eraser className="h-3.5 w-3.5" /> Clear
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto p-3">
                      <div className="space-y-1.5">
                        {items.map((item, index) => (
                          <div key={item.id} className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-2 transition hover:border-blue-500/30 hover:bg-muted/40">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{index + 1}. {item.label}</span>
                            <button type="button" onClick={() => removeEntry(item.id)} className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100" aria-label={`Remove ${item.label}`}>
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {!items.length && (
                          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                            Add some entries to start spinning.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex items-center justify-between border-b border-border/70 p-3">
                      <div>
                        <p className="text-sm font-semibold">Spin results</p>
                        <p className="text-[11px] text-muted-foreground">Newest result appears first.</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={copyResults} disabled={!results.length} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" title="Copy results">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={exportResults} disabled={!results.length} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" title="Export results">
                          <Download className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setResults([])} disabled={!results.length} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" title="Clear results">
                          <Eraser className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto p-3">
                      {results.length ? (
                        <div className="space-y-2">
                          {results.map((result, index) => (
                            <div key={`${result}-${index}`} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-600 dark:text-blue-400">{results.length - index}</span>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{result}</span>
                              {index === 0 && <Sparkles className="h-4 w-4 shrink-0 text-blue-500" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                          <Trophy className="mb-3 h-8 w-8 text-muted-foreground/40" />
                          <p className="text-sm font-semibold">No results yet</p>
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Spin the wheel and your winners will appear here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>

        <Footer />
      </main>

      {winner && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setWinner(null)
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold">We have a winner!</p>
                  <p className="text-[11px] text-muted-foreground">Metro Police Department Spin Wheel</p>
                </div>
              </div>
              <button type="button" onClick={() => setWinner(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-8 text-center">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">Selected entry</div>
              <div className="break-words text-3xl font-extrabold tracking-tight sm:text-4xl">{winner}</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-3">
              <button type="button" onClick={() => setWinner(null)} className="rounded-lg border border-input px-3 py-2 text-xs font-semibold hover:bg-muted">Close</button>
              <button type="button" onClick={() => { setWinner(null); setTab("entries") }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">Spin again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
