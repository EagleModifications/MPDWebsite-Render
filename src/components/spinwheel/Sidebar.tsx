import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"

import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ChevronDown,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Minus,
  Palette,
  Plus,
  Scale,
  Shuffle,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"

import type { SpinWheelItem } from "./Wheel"

type SidebarProps = {
  open: boolean
  items: SpinWheelItem[]
  results: string[]
  onChange: (items: SpinWheelItem[]) => void
  onClearResults: () => void
  onNewWheel: () => void
}

type Tab = "entries" | "results"

const COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
]

type SaveFilePickerOptions = {
  suggestedName?: string
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}

type SaveFilePickerHandle = {
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>
    close: () => Promise<void>
  }>
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<SaveFilePickerHandle>
}

function createItemsFromText(
  text: string,
  existingItems: SpinWheelItem[],
): SpinWheelItem[] {
  return text
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id:
        existingItems[index]?.id ??
        crypto.randomUUID(),

      label,

      color:
        existingItems[index]?.color ??
        COLORS[index % COLORS.length],

      weight:
        existingItems[index]?.weight ?? 1,

      hidden:
        existingItems[index]?.hidden ?? false,
    }))
}

function getWeightPercentage(
  item: SpinWheelItem,
  items: SpinWheelItem[],
) {
  const visibleItems = items.filter(
    (entry) => !entry.hidden,
  )

  const totalWeight = visibleItems.reduce(
    (total, entry) =>
      total + Math.max(0, entry.weight ?? 1),
    0,
  )

  if (totalWeight <= 0) {
    return 0
  }

  const weight = Math.max(
    0,
    item.weight ?? 1,
  )

  return Math.round(
    (weight / totalWeight) * 100,
  )
}

export default function Sidebar({
  open,
  items,
  results,
  onChange,
  onClearResults,
  onNewWheel,
}: SidebarProps) {
  const [tab, setTab] =
    useState<Tab>("entries")

  const [text, setText] = useState(() =>
    items
      .map((item) => item.label)
      .join("\n"),
  )

  const [advanced, setAdvanced] =
    useState(false)

  const [imageMenuOpen, setImageMenuOpen] =
    useState(false)

  const [wheelMenuOpen, setWheelMenuOpen] =
    useState(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  const imageMenuRef =
    useRef<HTMLDivElement | null>(null)

  const wheelMenuRef =
    useRef<HTMLDivElement | null>(null)

  /*
   * Keep the text editor synchronized if the
   * parent changes the entries externally.
   */
  useEffect(() => {
    setText(
      items
        .map((item) => item.label)
        .join("\n"),
    )
  }, [items])

  /*
   * Close dropdowns when clicking outside.
   */
  useEffect(() => {
    if (
      !imageMenuOpen &&
      !wheelMenuOpen
    ) {
      return
    }

    const handleDocumentClick = (
      event: MouseEvent,
    ) => {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      const clickedImageMenu =
        imageMenuRef.current?.contains(
          target,
        ) ?? false

      const clickedWheelMenu =
        wheelMenuRef.current?.contains(
          target,
        ) ?? false

      if (!clickedImageMenu) {
        setImageMenuOpen(false)
      }

      if (!clickedWheelMenu) {
        setWheelMenuOpen(false)
      }
    }

    document.addEventListener(
      "mousedown",
      handleDocumentClick,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handleDocumentClick,
      )
    }
  }, [
    imageMenuOpen,
    wheelMenuOpen,
  ])

  const handleTextChange = (
    value: string,
  ) => {
    setText(value)

    onChange(
      createItemsFromText(
        value,
        items,
      ),
    )
  }

  /*
   * Shuffle entries.
   */
  const shuffleEntries = () => {
    if (items.length < 2) {
      return
    }

    const shuffled = [...items]

    for (
      let index = shuffled.length - 1;
      index > 0;
      index -= 1
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
            (index + 1),
        )

      ;[
        shuffled[index],
        shuffled[randomIndex],
      ] = [
        shuffled[randomIndex],
        shuffled[index],
      ]
    }

    setText(
      shuffled
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(shuffled)
  }

  /*
   * Sort entries alphabetically.
   */
  const sortEntries = () => {
    if (items.length < 2) {
      return
    }

    const sorted = [...items].sort(
      (a, b) =>
        a.label.localeCompare(
          b.label,
          undefined,
          {
            sensitivity: "base",
            numeric: true,
          },
        ),
    )

    setText(
      sorted
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(sorted)
  }

  /*
   * Add image entries.
   */
  const handleImageFiles = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(
      event.target.files ?? [],
    )

    if (files.length === 0) {
      return
    }

    const imageEntries =
      files.map(
        (file, index) => ({
          id: crypto.randomUUID(),

          label:
            file.name.replace(
              /\.[^/.]+$/,
              "",
            ),

          color:
            COLORS[
              (items.length +
                index) %
                COLORS.length
            ],

          weight: 1,

          hidden: false,
        }),
      )

    const nextItems = [
      ...items,
      ...imageEntries,
    ]

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)

    event.target.value = ""
    setImageMenuOpen(false)
  }

  /*
   * Add a single blank entry.
   */
  const addEntry = () => {
    const newItem: SpinWheelItem = {
      id: crypto.randomUUID(),

      label: `Entry ${items.length + 1}`,

      color:
        COLORS[
          items.length %
            COLORS.length
        ],

      weight: 1,

      hidden: false,
    }

    const nextItems = [
      ...items,
      newItem,
    ]

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)
  }

  /*
   * Update one entry.
   */
  const updateEntry = (
    id: string,
    changes: Partial<SpinWheelItem>,
  ) => {
    const nextItems =
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...changes,
            }
          : item,
      )

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)
  }

  /*
   * Remove an entry.
   */
  const removeEntry = (
    id: string,
  ) => {
    const nextItems =
      items.filter(
        (item) => item.id !== id,
      )

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)
  }

  /*
   * Move an entry up or down.
   */
  const moveEntry = (
    index: number,
    direction: -1 | 1,
  ) => {
    const targetIndex =
      index + direction

    if (
      targetIndex < 0 ||
      targetIndex >= items.length
    ) {
      return
    }

    const nextItems = [...items]

    ;[
      nextItems[index],
      nextItems[targetIndex],
    ] = [
      nextItems[targetIndex],
      nextItems[index],
    ]

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)
  }

  /*
   * Change weight.
   */
  const changeWeight = (
    id: string,
    amount: number,
  ) => {
    const current =
      items.find(
        (item) => item.id === id,
      )

    if (!current) {
      return
    }

    const currentWeight =
      current.weight ?? 1

    const nextWeight =
      Math.max(
        0,
        Math.round(
          (currentWeight +
            amount) *
            100,
        ) / 100,
      )

    updateEntry(id, {
      weight: nextWeight,
    })
  }

  /*
   * Reveal every hidden entry.
   */
  const revealHidden = () => {
    const nextItems =
      items.map((item) => ({
        ...item,
        hidden: false,
      }))

    onChange(nextItems)
  }

  /*
   * Export results.
   */
  const exportResults = async () => {
    if (results.length === 0) {
      return
    }

    const content =
      results.join("\r\n")

    const saveWindow =
      window as SaveFilePickerWindow

    if (
      saveWindow.showSaveFilePicker
    ) {
      try {
        const fileHandle =
          await saveWindow.showSaveFilePicker(
            {
              suggestedName:
                "spin-wheel-results.txt",

              types: [
                {
                  description:
                    "Text file",

                  accept: {
                    "text/plain": [
                      ".txt",
                    ],
                  },
                },
              ],
            },
          )

        const writable =
          await fileHandle.createWritable()

        await writable.write(content)
        await writable.close()

        return
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name ===
            "AbortError"
        ) {
          return
        }
      }
    }

    const blob = new Blob(
      [content],
      {
        type:
          "text/plain;charset=utf-8",
      },
    )

    const url =
      URL.createObjectURL(blob)

    const anchor =
      document.createElement("a")

    anchor.href = url
    anchor.download =
      "spin-wheel-results.txt"

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    URL.revokeObjectURL(url)
  }

  const handleNewWheel = () => {
    setText("")
    setWheelMenuOpen(false)
    setImageMenuOpen(false)
    onNewWheel()
  }

  const handleOpenWheel = () => {
    setWheelMenuOpen(false)
  }

  const toggleImageMenu = (
    event: ReactMouseEvent,
  ) => {
    event.stopPropagation()

    setImageMenuOpen(
      (current) => !current,
    )

    setWheelMenuOpen(false)
  }

  const toggleWheelMenu = (
    event: ReactMouseEvent,
  ) => {
    event.stopPropagation()

    setWheelMenuOpen(
      (current) => !current,
    )

    setImageMenuOpen(false)
  }

  const hiddenCount =
    items.filter(
      (item) => item.hidden,
    ).length

  return (
    <aside
      className={`absolute right-0 top-0 z-50 h-full w-[468px] max-w-[calc(100vw-8px)] border-l border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
        open
          ? "translate-x-0"
          : "translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Tabs */}
        <div className="flex h-12 shrink-0 items-end border-b border-border/70 bg-card/80 px-1">
          <button
            type="button"
            onClick={() =>
              setTab("entries")
            }
            className={`flex h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
              tab === "entries"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Entries</span>

            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-[11px] font-bold leading-none text-muted-foreground">
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("results")
            }
            className={`flex h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
              tab === "results"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Results</span>

            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-[11px] font-bold leading-none text-muted-foreground">
              {results.length}
            </span>
          </button>
        </div>

        {tab === "entries" ? (
          <>
            {/* Toolbar */}
            <div className="shrink-0 border-b border-border/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={
                    shuffleEntries
                  }
                  disabled={
                    items.length < 2
                  }
                  className="h-9 gap-1.5 rounded-md border border-border/70 bg-muted/60 px-3 text-xs font-semibold shadow-sm hover:bg-muted"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Shuffle
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={sortEntries}
                  disabled={
                    items.length < 2
                  }
                  className="h-9 gap-1.5 rounded-md border border-border/70 bg-muted/60 px-3 text-xs font-semibold shadow-sm hover:bg-muted"
                >
                  <ArrowDownAZ className="h-3.5 w-3.5" />
                  Sort
                </Button>

                {/* Add image */}
                <div
                  ref={imageMenuRef}
                  className="relative"
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={
                      toggleImageMenu
                    }
                    className="h-9 gap-1.5 rounded-md border border-border/70 bg-muted/60 px-3 text-xs font-semibold shadow-sm hover:bg-muted"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />

                    Add image

                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        imageMenuOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </Button>

                  {imageMenuOpen && (
                    <div className="absolute left-0 top-11 z-[80] w-56 overflow-hidden rounded-xl border border-border/70 bg-card p-1.5 shadow-2xl">
                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        Add background image
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        Add center image
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        Add image as entry
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={
                      handleImageFiles
                    }
                  />
                </div>

                {/* Advanced */}
                <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={advanced}
                    onChange={(event) =>
                      setAdvanced(
                        event.target.checked,
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-blue-500"
                  />

                  Advanced
                </label>
              </div>
            </div>

            {advanced ? (
              /*
               * ADVANCED ENTRY EDITOR
               */
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
                  <div className="divide-y divide-border/70">
                    {items.length === 0 ? (
                      <div className="flex min-h-[260px] items-center justify-center px-5 text-center">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            No entries
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            Add an entry below to
                            start building your
                            wheel.
                          </p>
                        </div>
                      </div>
                    ) : (
                      items.map(
                        (
                          item,
                          index,
                        ) => {
                          const percentage =
                            getWeightPercentage(
                              item,
                              items,
                            )

                          const hidden =
                            item.hidden ===
                            true

                          return (
                            <div
                              key={item.id}
                              className={`relative py-2 transition-opacity ${
                                hidden
                                  ? "opacity-35"
                                  : ""
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {/* Move controls */}
                                <div className="flex w-6 shrink-0 flex-col items-center">
                                  <button
                                    type="button"
                                    aria-label={`Move ${item.label} up`}
                                    disabled={
                                      index ===
                                      0
                                    }
                                    onClick={() =>
                                      moveEntry(
                                        index,
                                        -1,
                                      )
                                    }
                                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    aria-label={`Move ${item.label} down`}
                                    disabled={
                                      index ===
                                      items.length -
                                        1
                                    }
                                    onClick={() =>
                                      moveEntry(
                                        index,
                                        1,
                                      )
                                    }
                                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                </div>

                                {/* Entry content */}
                                <div className="min-w-0 flex-1">
                                  {/* Name */}
                                  <input
                                    value={
                                      item.label
                                    }
                                    disabled={
                                      hidden
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateEntry(
                                        item.id,
                                        {
                                          label:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                    }
                                    className="h-10 w-full rounded-md border border-transparent bg-muted/80 px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-500/60 focus:bg-muted"
                                  />

                                  {/* Controls row */}
                                  <div className="mt-2 flex items-center gap-2">
                                    {/* Color */}
                                    <label
                                      className="relative flex h-9 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border/50 shadow-sm"
                                      style={{
                                        backgroundColor:
                                          item.color ??
                                          COLORS[
                                            index %
                                              COLORS.length
                                          ],
                                      }}
                                      title="Change color"
                                    >
                                      <Palette className="h-4 w-4 text-black/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]" />

                                      <input
                                        type="color"
                                        value={
                                          item.color ??
                                          "#3b82f6"
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateEntry(
                                            item.id,
                                            {
                                              color:
                                                event
                                                  .target
                                                  .value,
                                            },
                                          )
                                        }
                                        className="absolute inset-0 cursor-pointer opacity-0"
                                      />
                                    </label>

                                    {/* Image */}
                                    <button
                                      type="button"
                                      aria-label={`Add image to ${item.label}`}
                                      className="flex h-9 w-10 shrink-0 items-center justify-center rounded-md text-foreground transition hover:bg-muted"
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                    </button>

                                    {/* Weight */}
                                    <div className="flex h-9 min-w-0 flex-1 items-center rounded-md bg-muted/80">
                                      <Scale className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />

                                      <span className="ml-2 min-w-[22px] text-sm font-medium text-foreground">
                                        {item.weight ??
                                          1}
                                      </span>

                                      <div className="ml-auto flex items-center">
                                        <button
                                          type="button"
                                          disabled={
                                            hidden ||
                                            (item.weight ??
                                              1) <=
                                              0
                                          }
                                          aria-label="Decrease weight"
                                          onClick={() =>
                                            changeWeight(
                                              item.id,
                                              -1,
                                            )
                                          }
                                          className="flex h-9 w-7 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                                        >
                                          <Minus className="h-4 w-4" />
                                        </button>

                                        <button
                                          type="button"
                                          disabled={
                                            hidden
                                          }
                                          aria-label="Increase weight"
                                          onClick={() =>
                                            changeWeight(
                                              item.id,
                                              1,
                                            )
                                          }
                                          className="flex h-9 w-7 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </button>

                                        <span className="mr-2 min-w-[38px] text-right text-sm font-medium text-muted-foreground">
                                          {
                                            percentage
                                          }
                                          %
                                        </span>
                                      </div>
                                    </div>

                                    {/* Settings */}
                                    <button
                                      type="button"
                                      aria-label={`Entry settings for ${item.label}`}
                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-[0_2px_6px_rgba(79,70,229,0.35)] transition hover:bg-indigo-500"
                                    >
                                      <SlidersHorizontal className="h-4 w-4" />
                                    </button>

                                    {/* Delete */}
                                    <button
                                      type="button"
                                      aria-label={`Remove ${item.label}`}
                                      onClick={() =>
                                        removeEntry(
                                          item.id,
                                        )
                                      }
                                      className="flex h-9 w-7 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground"
                                    >
                                      <X className="h-5 w-5" />
                                    </button>

                                    {/* Visible */}
                                    <label
                                      className="flex h-9 w-6 shrink-0 cursor-pointer items-center justify-center"
                                      title={
                                        hidden
                                          ? "Reveal entry"
                                          : "Hide entry"
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          !hidden
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateEntry(
                                            item.id,
                                            {
                                              hidden:
                                                !event
                                                  .target
                                                  .checked,
                                            },
                                          )
                                        }
                                        className="h-4 w-4 cursor-pointer rounded border-border accent-indigo-500"
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        },
                      )
                    )}
                  </div>
                </div>

                {/* Advanced bottom actions */}
                <div className="shrink-0 border-t border-border/70 bg-card px-4 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={addEntry}
                      className="flex h-11 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.99]"
                    >
                      Add entry
                    </button>

                    <button
                      type="button"
                      onClick={
                        revealHidden
                      }
                      disabled={
                        hiddenCount === 0
                      }
                      className="flex h-11 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Reveal hidden
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /*
               * NORMAL ENTRY EDITOR
               */
              <div className="min-h-0 flex-1 p-4">
                <textarea
                  value={text}
                  onChange={(event) =>
                    handleTextChange(
                      event.target.value,
                    )
                  }
                  placeholder="Enter one entry per line..."
                  spellCheck={false}
                  className="h-full min-h-[300px] w-full resize-none rounded-xl border border-border/70 bg-background/70 p-3 text-sm leading-[22px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            )}

            {/* Add wheel */}
            <div className="shrink-0 border-t border-border/70 bg-muted/10 px-4 py-3">
              <div
                ref={wheelMenuRef}
                className="relative inline-flex"
              >
                <button
                  type="button"
                  onClick={
                    handleNewWheel
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-l-lg border border-blue-500/20 bg-blue-500/10 px-4 text-sm font-semibold text-blue-500 transition-colors hover:bg-blue-500/15"
                >
                  <Plus className="h-4 w-4" />
                  Add wheel
                </button>

                <button
                  type="button"
                  aria-label="More wheel options"
                  aria-expanded={
                    wheelMenuOpen
                  }
                  onClick={
                    toggleWheelMenu
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-r-lg border border-l-0 border-blue-500/20 bg-blue-500/10 text-blue-500 transition-colors hover:bg-blue-500/15"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      wheelMenuOpen
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                {wheelMenuOpen && (
                  <div className="absolute bottom-12 left-0 z-[90] w-60 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-2xl">
                    <button
                      type="button"
                      onClick={
                        handleOpenWheel
                      }
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />

                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          Open wheel
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Results toolbar */}
            <div className="shrink-0 border-b border-border/70 px-4 py-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={
                    onClearResults
                  }
                  disabled={
                    results.length === 0
                  }
                  className="h-9 gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear the list
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={
                    exportResults
                  }
                  disabled={
                    results.length === 0
                  }
                  className="h-9 gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export results
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="min-h-0 flex-1 p-4">
              <div className="h-full min-h-[300px] overflow-y-auto rounded-xl border border-border/70 bg-background/70 p-3">
                {results.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                    No results yet.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {results.map(
                      (
                        result,
                        index,
                      ) => (
                        <div
                          key={`${result}-${index}`}
                          className="border-b border-border/40 px-2 py-2.5 text-sm last:border-0"
                        >
                          {result}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
