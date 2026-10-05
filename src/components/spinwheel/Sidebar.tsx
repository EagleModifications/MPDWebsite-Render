import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"

import {
  ArrowDownAZ,
  ChevronDown,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  Shuffle,
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
    }))
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
   * Close any dropdown when clicking anywhere
   * outside of that dropdown.
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
          Math.random() * (index + 1),
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
      files.map((file, index) => ({
        id: crypto.randomUUID(),

        label: file.name.replace(
          /\.[^/.]+$/,
          "",
        ),

        color:
          COLORS[
            (items.length + index) %
              COLORS.length
          ],

        weight: 1,
      }))

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

  const exportResults = async () => {
    if (results.length === 0) {
      return
    }

    const content =
      results.join("\r\n")

    const saveWindow =
      window as SaveFilePickerWindow

    if (saveWindow.showSaveFilePicker) {
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
          error.name === "AbortError"
        ) {
          return
        }
      }
    }

    const blob = new Blob(
      [content],
      {
        type: "text/plain;charset=utf-8",
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

    // Open wheel functionality can be
    // connected here when wheel saving/loading
    // is implemented.
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
            className={`flex h-12 items-center gap-1.5 border-b-2 px-4 text-sm font-semibold transition ${
              tab === "entries"
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Entries

            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold leading-none text-muted-foreground">
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("results")
            }
            className={`flex h-12 items-center gap-1.5 border-b-2 px-4 text-sm font-semibold transition ${
              tab === "results"
                ? "border-blue-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Results

            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold leading-none text-muted-foreground">
              {results.length}
            </span>
          </button>
        </div>

        {tab === "entries" ? (
          <>
            {/* Toolbar */}
            <div className="shrink-0 border-b border-border/70 px-4 py-4">
              <div className="flex items-center gap-2">
                {/* Shuffle */}
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
                  className="h-9 gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold hover:bg-muted"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  Shuffle
                </Button>

                {/* Sort */}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={sortEntries}
                  disabled={
                    items.length < 2
                  }
                  className="h-9 gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold hover:bg-muted"
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
                    className="h-9 gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold text-foreground hover:bg-muted"
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

            {/* Advanced */}
            {advanced && (
              <div className="mx-4 mt-4 shrink-0 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                Advanced wheel settings.
              </div>
            )}

            {/* Entries */}
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

            {/* Add wheel */}
            <div className="shrink-0 border-t border-border/70 bg-muted/10 px-4 py-4">
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
                    {/* Open wheel */}
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
                      (result, index) => (
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
