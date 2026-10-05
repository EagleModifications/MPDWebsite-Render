import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  MoreHorizontal,
  Palette,
  Plus,
  Settings2,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react"

import type { SpinWheelItem } from "./Wheel"

interface SidebarProps {
  open: boolean
  items: SpinWheelItem[]
  results: string[]
  onChange: (items: SpinWheelItem[]) => void
  onClearResults: () => void
  onNewWheel: () => void
}

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
]

type EntryExtras = {
  sound: string
  popupMessage: string
  image?: string
}

const extras = new Map<string, EntryExtras>()

function getExtras(id: string): EntryExtras {
  return (
    extras.get(id) ?? {
      sound: "inherit",
      popupMessage: "",
    }
  )
}

function setEntryExtras(id: string, value: Partial<EntryExtras>) {
  const current = getExtras(id)

  extras.set(id, {
    ...current,
    ...value,
  })
}

function createItemsFromText(
  value: string,
  existingItems: SpinWheelItem[],
): SpinWheelItem[] {
  return value
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: existingItems[index]?.id ?? crypto.randomUUID(),
      label,
      color:
        existingItems[index]?.color ??
        COLORS[index % COLORS.length],
      weight: existingItems[index]?.weight ?? 1,
      hidden: existingItems[index]?.hidden ?? false,
    }))
}

function clampWeight(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(0.01, Math.min(100, value))
}

export default function Sidebar({
  open,
  items,
  results,
  onChange,
  onClearResults,
  onNewWheel,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"entries" | "results">(
    "entries",
  )
  const [advanced, setAdvanced] = useState(false)
  const [text, setText] = useState(() =>
    items.map((item) => item.label).join("\n"),
  )

  const [selectedEntry, setSelectedEntry] = useState<number | null>(
    null,
  )

  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [menuOpen, setMenuOpen] = useState(false)

  const [isTextEditing, setIsTextEditing] = useState(false)

  const textEditingRef = useRef(false)

  useEffect(() => {
    if (textEditingRef.current) return

    setText(
      items
        .map((item) => item.label)
        .join("\n"),
    )
  }, [items])

  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items],
  )

  const hiddenItems = useMemo(
    () => items.filter((item) => item.hidden),
    [items],
  )

  const totalWeight = useMemo(
    () =>
      visibleItems.reduce(
        (total, item) => total + (item.weight ?? 1),
        0,
      ),
    [visibleItems],
  )

  const selectedItem =
    selectedEntry !== null
      ? items[selectedEntry] ?? null
      : null

  const selectedProbability = useMemo(() => {
    if (!selectedItem || selectedItem.hidden || totalWeight <= 0) {
      return 0
    }

    return ((selectedItem.weight ?? 1) / totalWeight) * 100
  }, [selectedItem, totalWeight])

  const updateItems = (next: SpinWheelItem[]) => {
    onChange(next)
  }

  const handleTextChange = (value: string) => {
    textEditingRef.current = true
    setIsTextEditing(true)
    setText(value)

    updateItems(
      createItemsFromText(
        value,
        items,
      ),
    )
  }

  const finishTextEditing = () => {
    textEditingRef.current = false
    setIsTextEditing(false)

    setText(
      items
        .map((item) => item.label)
        .join("\n"),
    )
  }

  const addEntry = () => {
    const newItem: SpinWheelItem = {
      id: crypto.randomUUID(),
      label: `Entry ${items.length + 1}`,
      color: COLORS[items.length % COLORS.length],
      weight: 1,
      hidden: false,
    }

    setEntryExtras(newItem.id, {
      sound: "inherit",
      popupMessage: "",
    })

    const next = [...items, newItem]

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )

    setAdvanced(true)
    setSelectedEntry(next.length - 1)
  }

  const removeEntry = (index: number) => {
    const item = items[index]

    if (item) {
      extras.delete(item.id)
    }

    const next = items.filter((_, itemIndex) => itemIndex !== index)

    updateItems(next)

    setText(
      next
        .map((entry) => entry.label)
        .join("\n"),
    )

    setSelectedEntry((current) => {
      if (current === null) return null
      if (next.length === 0) return null
      if (current >= next.length) return next.length - 1
      return current
    })
  }

  const duplicateEntry = (index: number) => {
    const source = items[index]

    if (!source) return

    const duplicate: SpinWheelItem = {
      ...source,
      id: crypto.randomUUID(),
      label: `${source.label} copy`,
    }

    const sourceExtras = getExtras(source.id)

    setEntryExtras(duplicate.id, {
      ...sourceExtras,
    })

    const next = [
      ...items.slice(0, index + 1),
      duplicate,
      ...items.slice(index + 1),
    ]

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )

    setSelectedEntry(index + 1)
  }

  const updateEntry = (
    index: number,
    patch: Partial<SpinWheelItem>,
  ) => {
    const next = items.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            ...patch,
          }
        : item,
    )

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )
  }

  const moveEntry = (
    index: number,
    direction: "up" | "down",
  ) => {
    const targetIndex =
      direction === "up"
        ? index - 1
        : index + 1

    if (
      targetIndex < 0 ||
      targetIndex >= items.length
    ) {
      return
    }

    const next = [...items]

    const current = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = current

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )

    setSelectedEntry(targetIndex)
  }

  const shuffleEntries = () => {
    const next = [...items]

    for (let index = next.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(
        Math.random() * (index + 1),
      )

      const current = next[index]
      next[index] = next[randomIndex]
      next[randomIndex] = current
    }

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )
  }

  const sortEntries = () => {
    const next = [...items].sort((a, b) =>
      a.label.localeCompare(b.label),
    )

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )
  }

  const revealHidden = () => {
    const next = items.map((item) => ({
      ...item,
      hidden: false,
    }))

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )
  }

  const hideAll = () => {
    const next = items.map((item) => ({
      ...item,
      hidden: true,
    }))

    updateItems(next)

    setText(
      next
        .map((item) => item.label)
        .join("\n"),
    )
  }

  const handleImageUpload = (
    index: number,
    file: File | undefined,
  ) => {
    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== "string") return

      setEntryExtras(items[index]?.id ?? "", {
        image: reader.result,
      })
    }

    reader.readAsDataURL(file)
  }

  const openEntrySettings = (index: number) => {
    setSelectedEntry(index)
    setAdvancedOpen(true)
  }

  const closeEntrySettings = () => {
    setAdvancedOpen(false)
    setSelectedEntry(null)
  }

  const updateSelectedEntry = (
    patch: Partial<SpinWheelItem>,
  ) => {
    if (selectedEntry === null) return

    updateEntry(selectedEntry, patch)
  }

  const updateSelectedExtras = (
    patch: Partial<EntryExtras>,
  ) => {
    if (selectedEntry === null) return

    const item = items[selectedEntry]

    if (!item) return

    setEntryExtras(item.id, patch)

    /*
     * Force a re-render so the modal immediately reflects
     * the changed value.
     */
    setSelectedEntry((current) => current)
  }

  const selectedExtras =
    selectedItem !== null
      ? getExtras(selectedItem.id)
      : null

  if (!open) {
    return null
  }

  return (
    <>
      <aside className="absolute inset-y-0 right-0 z-50 flex w-full max-w-[468px] flex-col border-l border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-5">
          <div>
            <h2 className="text-base font-bold">
              Spin Wheel
            </h2>

            <p className="text-xs text-muted-foreground">
              {items.length}{" "}
              {items.length === 1 ? "entry" : "entries"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="More options"
              title="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-4 top-14 z-[80] w-48 rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    shuffleEntries()
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <Shuffle className="h-4 w-4" />
                  Shuffle entries
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sortEntries()
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Sort entries
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hideAll()
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <EyeOff className="h-4 w-4" />
                  Hide all
                </button>

                <button
                  type="button"
                  onClick={() => {
                    revealHidden()
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <Eye className="h-4 w-4" />
                  Reveal all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border/70">
          <button
            type="button"
            onClick={() => setActiveTab("entries")}
            className={`relative flex-1 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "entries"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Entries

            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              {items.length}
            </span>

            {activeTab === "entries" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={`relative flex-1 px-4 py-3 text-sm font-semibold transition ${
              activeTab === "results"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Results

            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              {results.length}
            </span>

            {activeTab === "results" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />
            )}
          </button>
        </div>

        {activeTab === "entries" ? (
          <>
            {/* Editor mode */}
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  Entries
                </p>

                <p className="text-xs text-muted-foreground">
                  One entry per line
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Advanced</span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={advanced}
                  onClick={() => {
                    textEditingRef.current = false
                    setIsTextEditing(false)
                    setAdvanced((value) => !value)
                  }}
                  className={`relative h-6 w-11 rounded-full transition ${
                    advanced
                      ? "bg-blue-600"
                      : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      advanced
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            </div>

            {!advanced ? (
              <>
                <div className="min-h-0 flex-1 p-4">
                  <textarea
                    value={text}
                    onChange={(event) =>
                      handleTextChange(
                        event.target.value,
                      )
                    }
                    onFocus={() => {
                      textEditingRef.current = true
                      setIsTextEditing(true)
                    }}
                    onBlur={finishTextEditing}
                    placeholder="Enter one entry per line..."
                    spellCheck={false}
                    className="h-full min-h-[300px] w-full resize-none rounded-xl border border-border/70 bg-background/70 p-3 text-sm leading-[22px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>

                <div className="border-t border-border/70 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={addEntry}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      <Plus className="h-4 w-4" />
                      Add entry
                    </button>

                    <button
                      type="button"
                      onClick={shuffleEntries}
                      disabled={items.length < 2}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Shuffle className="h-4 w-4" />
                      Shuffle
                    </button>
                  </div>

                  {hiddenItems.length > 0 && (
                    <button
                      type="button"
                      onClick={revealHidden}
                      className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-xs font-semibold transition hover:bg-muted"
                    >
                      <Eye className="h-4 w-4" />
                      Reveal {hiddenItems.length} hidden{" "}
                      {hiddenItems.length === 1
                        ? "entry"
                        : "entries"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Advanced list */}
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="space-y-2">
                    {items.map((item, index) => {
                      const itemExtras =
                        getExtras(item.id)

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border transition ${
                            item.hidden
                              ? "border-border/50 bg-muted/20 opacity-60"
                              : "border-border/70 bg-background/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 p-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateEntry(index, {
                                  hidden: !item.hidden,
                                })
                              }
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                                item.hidden
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-blue-500/10 text-blue-500"
                              }`}
                              title={
                                item.hidden
                                  ? "Show entry"
                                  : "Hide entry"
                              }
                            >
                              {item.hidden ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>

                            <div
                              className="h-7 w-7 shrink-0 rounded-md border border-border/70"
                              style={{
                                backgroundColor:
                                  item.color ??
                                  COLORS[
                                    index %
                                      COLORS.length
                                  ],
                              }}
                            />

                            <input
                              value={item.label}
                              onChange={(event) =>
                                updateEntry(index, {
                                  label: event.target.value,
                                })
                              }
                              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none transition focus:border-border focus:bg-background"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                moveEntry(index, "up")
                              }
                              disabled={index === 0}
                              className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-25 sm:flex"
                              title="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                moveEntry(index, "down")
                              }
                              disabled={
                                index ===
                                items.length - 1
                              }
                              className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-25 sm:flex"
                              title="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEntrySettings(index)
                              }
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              title="Entry settings"
                            >
                              <Settings2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                removeEntry(index)
                              }
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500"
                              title="Delete entry"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-background transition hover:bg-muted">
                                <Palette className="h-4 w-4" />

                                <input
                                  type="color"
                                  value={
                                    item.color ??
                                    COLORS[
                                      index %
                                        COLORS.length
                                    ]
                                  }
                                  onChange={(event) =>
                                    updateEntry(index, {
                                      color:
                                        event.target.value,
                                    })
                                  }
                                  className="sr-only"
                                />
                              </label>

                              <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-background transition hover:bg-muted">
                                <ImagePlus className="h-4 w-4" />

                                <input
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  onChange={(event) => {
                                    handleImageUpload(
                                      index,
                                      event.target.files?.[0],
                                    )
                                    event.currentTarget.value =
                                      ""
                                  }}
                                />
                              </label>

                              {itemExtras.image && (
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  Image added
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateEntry(index, {
                                    weight: clampWeight(
                                      (item.weight ??
                                        1) - 1,
                                    ),
                                  })
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                              >
                                −
                              </button>

                              <span className="min-w-[38px] text-center text-xs font-semibold">
                                {item.weight ?? 1}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  updateEntry(index, {
                                    weight: clampWeight(
                                      (item.weight ??
                                        1) + 1,
                                    ),
                                  })
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {items.length === 0 && (
                    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <p className="text-sm font-semibold">
                        No entries yet
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Add an entry to start building
                        your wheel.
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-border/70 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={addEntry}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      <Plus className="h-4 w-4" />
                      Add entry
                    </button>

                    <button
                      type="button"
                      onClick={revealHidden}
                      disabled={hiddenItems.length === 0}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Eye className="h-4 w-4" />
                      Reveal hidden
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          /* Results */
          <div className="min-h-0 flex-1">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  Spin results
                </p>

                <p className="text-xs text-muted-foreground">
                  {results.length} result
                  {results.length === 1 ? "" : "s"}
                </p>
              </div>

              {results.length > 0 && (
                <button
                  type="button"
                  onClick={onClearResults}
                  className="text-xs font-semibold text-muted-foreground transition hover:text-red-500"
                >
                  Clear
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Check className="h-5 w-5 text-muted-foreground" />
                </div>

                <p className="text-sm font-semibold">
                  No results yet
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Spin the wheel to see results here.
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto p-3">
                <div className="space-y-2">
                  {[...results]
                    .reverse()
                    .map((result, index) => (
                      <div
                        key={`${result}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-3"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-500">
                          {results.length - index}
                        </span>

                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {result}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom actions */}
        <div className="shrink-0 border-t border-border/70 p-3">
          <button
            type="button"
            onClick={onNewWheel}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-semibold transition hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            New wheel
          </button>
        </div>
      </aside>

      {/* Entry settings modal */}
      {advancedOpen &&
        selectedItem &&
        selectedExtras && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
            <div
              className="w-full max-w-[640px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Advanced entry settings"
            >
              {/* Modal header */}
              <div className="flex h-16 items-center justify-between border-b border-border/70 px-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  <h2 className="text-lg font-bold">
                    Advanced
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeEntrySettings}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Entry navigation */}
              <div className="border-b border-border/70 px-4 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEntry === null) return

                      setSelectedEntry(
                        Math.max(
                          0,
                          selectedEntry - 1,
                        ),
                      )
                    }}
                    disabled={
                      selectedEntry === null ||
                      selectedEntry === 0
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    title="Previous entry"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <span className="flex-1 text-sm font-medium">
                    Entry{" "}
                    {(selectedEntry ?? 0) + 1} /{" "}
                    {items.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEntry === null) return

                      setSelectedEntry(
                        Math.min(
                          items.length - 1,
                          selectedEntry + 1,
                        ),
                      )
                    }}
                    disabled={
                      selectedEntry === null ||
                      selectedEntry ===
                        items.length - 1
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    title="Next entry"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      addEntry()

                      setSelectedEntry(
                        items.length,
                      )
                    }}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                    title="Add entry"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="max-h-[calc(100vh-270px)] overflow-y-auto p-4">
                {/* Visible + actions */}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedEntry({
                        hidden:
                          !selectedItem.hidden,
                      })
                    }
                    className="flex items-center gap-2"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        !selectedItem.hidden
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-border bg-background"
                      }`}
                    >
                      {!selectedItem.hidden && (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </span>

                    <span className="text-sm font-medium">
                      Visible
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        duplicateEntry(
                          selectedEntry ?? 0,
                        )
                      }
                      className="flex h-9 items-center gap-2 rounded-md bg-muted px-3 text-sm font-semibold transition hover:bg-muted/80"
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const index =
                          selectedEntry ?? 0

                        removeEntry(index)

                        if (items.length <= 1) {
                          closeEntrySettings()
                        } else {
                          setSelectedEntry(
                            Math.min(
                              index,
                              items.length - 2,
                            ),
                          )
                        }
                      }}
                      className="flex h-9 items-center gap-2 rounded-md bg-red-500/80 px-3 text-sm font-semibold text-white transition hover:bg-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mb-4 border-t border-border/70" />

                <div className="space-y-4">
                  {/* Text */}
                  <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label className="text-sm font-medium">
                      Text
                    </label>

                    <input
                      value={selectedItem.label}
                      onChange={(event) =>
                        updateSelectedEntry({
                          label: event.target.value,
                        })
                      }
                      className="h-10 rounded-md border border-border bg-muted/70 px-3 text-sm font-medium outline-none transition focus:border-blue-500"
                    />
                  </div>

                  {/* Color */}
                  <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label className="text-sm font-medium">
                      Color
                    </label>

                    <div className="flex items-center gap-3">
                      <label
                        className="flex h-10 w-12 cursor-pointer items-center justify-center rounded-md border border-border"
                        style={{
                          backgroundColor:
                            selectedItem.color ??
                            "#3b82f6",
                        }}
                      >
                        <Palette className="h-5 w-5 text-black/70 mix-blend-multiply" />

                        <input
                          type="color"
                          value={
                            selectedItem.color ??
                            "#3b82f6"
                          }
                          onChange={(event) =>
                            updateSelectedEntry({
                              color:
                                event.target.value,
                            })
                          }
                          className="sr-only"
                        />
                      </label>

                      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md bg-muted px-4 text-sm font-semibold transition hover:bg-muted/80">
                        <ImagePlus className="h-4 w-4" />
                        Add image

                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => {
                            handleImageUpload(
                              selectedEntry ?? 0,
                              event.target.files?.[0],
                            )
                            event.currentTarget.value =
                              ""
                          }}
                        />
                      </label>

                      {selectedExtras.image && (
                        <span className="text-xs text-muted-foreground">
                          Image added
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sound */}
                  <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label className="text-sm font-medium">
                      Sound
                    </label>

                    <div className="relative">
                      <select
                        value={
                          selectedExtras.sound
                        }
                        onChange={(event) =>
                          updateSelectedExtras({
                            sound:
                              event.target.value,
                          })
                        }
                        className="h-10 w-full appearance-none rounded-md border border-border bg-muted/70 px-3 pr-10 text-sm font-medium outline-none transition focus:border-blue-500"
                      >
                        <option value="inherit">
                          Inherit from wheel
                        </option>
                        <option value="none">
                          None
                        </option>
                        <option value="tick">
                          Tick
                        </option>
                        <option value="bell">
                          Bell
                        </option>
                        <option value="pop">
                          Pop
                        </option>
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Popup message */}
                  <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label className="text-sm font-medium">
                      Popup message
                    </label>

                    <input
                      value={
                        selectedExtras.popupMessage
                      }
                      onChange={(event) =>
                        updateSelectedExtras({
                          popupMessage:
                            event.target.value,
                        })
                      }
                      placeholder=""
                      className="h-10 rounded-md border border-border bg-muted/70 px-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>

                  {/* Weight */}
                  <div className="grid grid-cols-[140px_1fr] items-center gap-3">
                    <label className="text-sm font-medium">
                      Weight
                    </label>

                    <div className="flex items-center gap-3">
                      <div className="flex h-10 flex-1 items-center overflow-hidden rounded-md border border-border bg-muted/70">
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedEntry({
                              weight: clampWeight(
                                (selectedItem.weight ??
                                  1) - 1,
                              ),
                            })
                          }
                          className="flex h-full w-12 items-center justify-center text-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={
                            selectedItem.weight ??
                            1
                          }
                          onChange={(event) =>
                            updateSelectedEntry({
                              weight: clampWeight(
                                Number(
                                  event.target
                                    .value,
                                ),
                              ),
                            })
                          }
                          className="h-full min-w-0 flex-1 bg-transparent text-center text-sm font-medium outline-none"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedEntry({
                              weight: clampWeight(
                                (selectedItem.weight ??
                                  1) + 1,
                              ),
                            })
                          }
                          className="flex h-full w-12 items-center justify-center text-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          +
                        </button>
                      </div>

                      <span className="whitespace-nowrap text-sm font-medium">
                        Probability:{" "}
                        {selectedProbability.toFixed(
                          selectedProbability >=
                            10
                            ? 0
                            : 1,
                        )}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
                <button
                  type="button"
                  onClick={closeEntrySettings}
                  className="h-10 rounded-md px-4 text-sm font-semibold transition hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={closeEntrySettings}
                  className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  )
}
