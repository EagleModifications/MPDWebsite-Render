import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
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
  Trash2,
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

type EntryExtras = {
  sound?: string
  popupMessage?: string
  image?: string
}

const extras = new Map<string, EntryExtras>()

function getExtras(id: string): EntryExtras {
  return extras.get(id) ?? {}
}

function setEntryExtras(
  id: string,
  changes: Partial<EntryExtras>,
) {
  extras.set(id, {
    ...getExtras(id),
    ...changes,
  })
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
        existingItems[index]?.weight ??
        1,
      hidden:
        existingItems[index]?.hidden ??
        false,
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

  const textEditingRef =
    useRef(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  const imageMenuRef =
    useRef<HTMLDivElement | null>(null)

  const wheelMenuRef =
    useRef<HTMLDivElement | null>(null)

  const [
    settingsEntryIndex,
    setSettingsEntryIndex,
  ] = useState<number | null>(null)

  const [
    settingsDraft,
    setSettingsDraft,
  ] = useState<SpinWheelItem | null>(null)

  const [
    settingsSound,
    setSettingsSound,
  ] = useState("")

  const [
    settingsPopupMessage,
    setSettingsPopupMessage,
  ] = useState("")

  const [
    settingsImage,
    setSettingsImage,
  ] = useState<string | undefined>(
    undefined,
  )

  useEffect(() => {
    if (textEditingRef.current) {
      return
    }

    setText(
      items
        .map((item) => item.label)
        .join("\n"),
    )
  }, [items])

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

  useEffect(() => {
    if (settingsEntryIndex === null) {
      return
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        closeSettings()
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [settingsEntryIndex])

  const handleTextChange = (
    value: string,
  ) => {
    textEditingRef.current = true

    setText(value)

    onChange(
      createItemsFromText(
        value,
        items,
      ),
    )
  }

  const finishTextEditing = () => {
    textEditingRef.current = false

    setText(
      items
        .map((item) => item.label)
        .join("\n"),
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

    textEditingRef.current = false

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

    textEditingRef.current = false

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

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)

    event.target.value = ""
    setImageMenuOpen(false)
  }

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

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)
  }

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

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)
  }

  const removeEntry = (
    id: string,
  ) => {
    const nextItems =
      items.filter(
        (item) => item.id !== id,
      )

    extras.delete(id)

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)

    if (
      settingsEntryIndex !== null
    ) {
      closeSettings()
    }
  }

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

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)

    if (
      settingsEntryIndex === index
    ) {
      setSettingsEntryIndex(
        targetIndex,
      )
    } else if (
      settingsEntryIndex ===
      targetIndex
    ) {
      setSettingsEntryIndex(index)
    }
  }

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

    if (
      settingsEntryIndex !== null &&
      settingsDraft?.id === id
    ) {
      setSettingsDraft({
        ...current,
        weight: nextWeight,
      })
    }
  }

  const revealHidden = () => {
    const nextItems =
      items.map((item) => ({
        ...item,
        hidden: false,
      }))

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)
  }

  const openSettings = (
    index: number,
  ) => {
    const item = items[index]

    if (!item) {
      return
    }

    const entryExtras =
      getExtras(item.id)

    setSettingsEntryIndex(index)

    setSettingsDraft({
      ...item,
    })

    setSettingsSound(
      entryExtras.sound ??
        "inherit",
    )

    setSettingsPopupMessage(
      entryExtras.popupMessage ??
        "",
    )

    setSettingsImage(
      entryExtras.image,
    )
  }

  const closeSettings = () => {
    setSettingsEntryIndex(null)
    setSettingsDraft(null)
    setSettingsSound("")
    setSettingsPopupMessage("")
    setSettingsImage(undefined)
  }

  const saveSettings = () => {
    if (
      settingsDraft === null
    ) {
      return
    }

    const nextItems =
      items.map((item) =>
        item.id ===
        settingsDraft.id
          ? {
              ...item,
              ...settingsDraft,
            }
          : item,
      )

    setEntryExtras(
      settingsDraft.id,
      {
        sound: settingsSound,
        popupMessage:
          settingsPopupMessage,
        image: settingsImage,
      },
    )

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)

    closeSettings()
  }

  const duplicateSettingsEntry = () => {
    if (
      settingsDraft === null ||
      settingsEntryIndex === null
    ) {
      return
    }

    const duplicatedId =
      crypto.randomUUID()

    const duplicated: SpinWheelItem = {
      ...settingsDraft,
      id: duplicatedId,
      label: `${settingsDraft.label} copy`,
    }

    const nextItems = [
      ...items.slice(
        0,
        settingsEntryIndex + 1,
      ),
      duplicated,
      ...items.slice(
        settingsEntryIndex + 1,
      ),
    ]

    const currentExtras =
      getExtras(settingsDraft.id)

    if (
      Object.keys(currentExtras)
        .length > 0
    ) {
      extras.set(
        duplicatedId,
        {
          ...currentExtras,
        },
      )
    }

    textEditingRef.current = false

    setText(
      nextItems
        .map((item) => item.label)
        .join("\n"),
    )

    onChange(nextItems)

    setSettingsEntryIndex(
      settingsEntryIndex + 1,
    )

    setSettingsDraft({
      ...duplicated,
    })
  }

  const deleteSettingsEntry = () => {
    if (
      settingsDraft === null
    ) {
      return
    }

    removeEntry(
      settingsDraft.id,
    )
  }

  const updateSettingsDraft = (
    changes: Partial<SpinWheelItem>,
  ) => {
    setSettingsDraft(
      (current) =>
        current
          ? {
              ...current,
              ...changes,
            }
          : current,
    )
  }

  const selectSettingsEntry = (
    index: number,
  ) => {
    const item = items[index]

    if (!item) {
      return
    }

    const entryExtras =
      getExtras(item.id)

    setSettingsEntryIndex(index)

    setSettingsDraft({
      ...item,
    })

    setSettingsSound(
      entryExtras.sound ??
        "inherit",
    )

    setSettingsPopupMessage(
      entryExtras.popupMessage ??
        "",
    )

    setSettingsImage(
      entryExtras.image,
    )
  }

  const handleSettingsImage = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    const reader =
      new FileReader()

    reader.onload = () => {
      if (
        typeof reader.result !==
        "string"
      ) {
        return
      }

      setSettingsImage(
        reader.result,
      )
    }

    reader.readAsDataURL(file)

    event.target.value = ""
  }

  const exportResults =
    async () => {
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

          await writable.write(
            content,
          )

          await writable.close()

          return
        } catch (error) {
          if (
            error instanceof
              DOMException &&
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

      document.body.appendChild(
        anchor,
      )

      anchor.click()
      anchor.remove()

      URL.revokeObjectURL(url)
    }

  const handleNewWheel = () => {
    textEditingRef.current = false

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

  const settingsProbability =
    useMemo(() => {
      if (!settingsDraft) {
        return 0
      }

      return getWeightPercentage(
        settingsDraft,
        items,
      )
    }, [
      settingsDraft,
      items,
    ])

  return (
    <>
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
                    onClick={
                      sortEntries
                    }
                    disabled={
                      items.length < 2
                    }
                    className="h-9 gap-1.5 rounded-md border border-border/70 bg-muted/60 px-3 text-xs font-semibold shadow-sm hover:bg-muted"
                  >
                    <ArrowDownAZ className="h-3.5 w-3.5" />
                    Sort
                  </Button>

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

                  <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={advanced}
                      onChange={(event) => {
                        textEditingRef.current =
                          false

                        setAdvanced(
                          event.target
                            .checked,
                        )
                      }}
                      className="h-4 w-4 rounded border-border accent-blue-500"
                    />
                    Advanced
                  </label>
                </div>
              </div>

              {advanced ? (
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
                              Add an entry below to start building your wheel.
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

                                  <div className="min-w-0 flex-1">
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

                                    <div className="mt-2 flex items-center gap-2">
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

                                      <button
                                        type="button"
                                        aria-label={`Add image to ${item.label}`}
                                        onClick={() =>
                                          openSettings(
                                            index,
                                          )
                                        }
                                        className="flex h-9 w-10 shrink-0 items-center justify-center rounded-md text-foreground transition hover:bg-muted"
                                      >
                                        <ImageIcon className="h-4 w-4" />
                                      </button>

                                      <div className="flex h-9 min-w-0 flex-1 items-center rounded-md bg-muted/80">
                                        <Scale className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />

                                        <span className="ml-2 min-w-[22px] text-sm font-medium text-foreground">
                                          {item.weight ?? 1}
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
                                            {percentage}%
                                          </span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        aria-label={`Entry settings for ${item.label}`}
                                        onClick={() =>
                                          openSettings(
                                            index,
                                          )
                                        }
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_2px_6px_rgba(59,130,246,0.30)] transition hover:bg-blue-500"
                                      >
                                        <SlidersHorizontal className="h-4 w-4" />
                                      </button>

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
                                          className="h-4 w-4 cursor-pointer rounded border-border accent-blue-500"
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

                  <div className="shrink-0 border-t border-border/70 bg-card px-4 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={addEntry}
                        className="flex h-11 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.99]"
                      >
                        Add entry
                      </button>

                      <button
                        type="button"
                        onClick={
                          revealHidden
                        }
                        disabled={
                          hiddenCount ===
                          0
                        }
                        className="flex h-11 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Reveal hidden
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="min-h-0 flex-1 p-4">
                  <textarea
                    value={text}
                    onChange={(event) =>
                      handleTextChange(
                        event.target.value,
                      )
                    }
                    onFocus={() => {
                      textEditingRef.current =
                        true
                    }}
                    onBlur={
                      finishTextEditing
                    }
                    placeholder="Enter one entry per line..."
                    spellCheck={false}
                    className="h-full min-h-[300px] w-full resize-none rounded-xl border border-border/70 bg-background/70 p-3 text-sm leading-[22px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              )}

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
                      results.length ===
                      0
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
                      results.length ===
                      0
                    }
                    className="h-9 gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export results
                  </Button>
                </div>
              </div>

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

      {/* Advanced entry settings */}
      {settingsEntryIndex !== null &&
        settingsDraft && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeSettings()
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="advanced-entry-settings-title"
              className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-border/70 bg-card text-foreground shadow-2xl"
            >
              {/* Header */}
              <div className="flex h-[68px] items-center justify-between border-b border-border/70 bg-card px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <SlidersHorizontal className="h-[18px] w-[18px]" />
                  </div>

                  <div>
                    <h2
                      id="advanced-entry-settings-title"
                      className="text-base font-semibold text-foreground"
                    >
                      Entry settings
                    </h2>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Configure this wheel entry
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close"
                  onClick={
                    closeSettings
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-120px)] overflow-y-auto">
                {/* Entry navigation */}
                <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
                  <button
                    type="button"
                    aria-label="Previous entry"
                    disabled={
                      settingsEntryIndex <=
                      0
                    }
                    onClick={() =>
                      selectSettingsEntry(
                        settingsEntryIndex - 1,
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <div className="min-w-[100px]">
                    <p className="text-xs font-medium text-muted-foreground">
                      Entry
                    </p>

                    <p className="text-sm font-semibold text-foreground">
                      {settingsEntryIndex +
                        1}{" "}
                      <span className="font-normal text-muted-foreground">
                        / {items.length}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Next entry"
                    disabled={
                      settingsEntryIndex >=
                      items.length - 1
                    }
                    onClick={() =>
                      selectSettingsEntry(
                        settingsEntryIndex + 1,
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    aria-label="Add entry"
                    onClick={() => {
                      const newItem: SpinWheelItem =
                        {
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

                      textEditingRef.current =
                        false

                      setText(
                        nextItems
                          .map(
                            (item) =>
                              item.label,
                          )
                          .join("\n"),
                      )

                      onChange(
                        nextItems,
                      )

                      setSettingsEntryIndex(
                        nextItems.length -
                          1,
                      )

                      setSettingsDraft({
                        ...newItem,
                      })

                      setSettingsSound(
                        "inherit",
                      )

                      setSettingsPopupMessage(
                        "",
                      )

                      setSettingsImage(
                        undefined,
                      )
                    }}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-500"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-0 px-5 py-4">
                  {/* Visibility + actions */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={
                          !settingsDraft.hidden
                        }
                        onChange={(
                          event,
                        ) =>
                          updateSettingsDraft(
                            {
                              hidden:
                                !event
                                  .target
                                  .checked,
                            },
                          )
                        }
                        className="h-4 w-4 cursor-pointer rounded border-border accent-blue-500"
                      />

                      <span>Visible</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={
                          duplicateSettingsEntry
                        }
                        className="flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <span className="text-sm leading-none">
                          ▣
                        </span>
                        Duplicate
                      </button>

                      <button
                        type="button"
                        onClick={
                          deleteSettingsEntry
                        }
                        className="flex h-9 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Text */}
                  <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                    <label className="text-sm font-medium text-foreground">
                      Text
                    </label>

                    <input
                      value={
                        settingsDraft.label
                      }
                      onChange={(event) =>
                        updateSettingsDraft(
                          {
                            label:
                              event.target
                                .value,
                          },
                        )
                      }
                      className="h-10 w-full rounded-lg border border-border/70 bg-muted/60 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/60 focus:bg-muted"
                    />
                  </div>

                  {/* Color */}
                  <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                    <label className="text-sm font-medium text-foreground">
                      Color
                    </label>

                    <div className="flex items-center justify-between gap-3">
                      <label
                        className="relative flex h-10 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border/70 shadow-sm"
                        style={{
                          backgroundColor:
                            settingsDraft.color ??
                            "#3b82f6",
                        }}
                        title="Change color"
                      >
                        <Palette className="h-4 w-4 text-black/80" />

                        <input
                          type="color"
                          value={
                            settingsDraft.color ??
                            "#3b82f6"
                          }
                          onChange={(event) =>
                            updateSettingsDraft(
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

                      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        Add image

                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={
                            handleSettingsImage
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {/* Sound */}
                  <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                    <label
                      htmlFor="entry-sound"
                      className="text-sm font-medium text-foreground"
                    >
                      Sound
                    </label>

                    <div className="relative">
                      <select
                        id="entry-sound"
                        value={
                          settingsSound
                        }
                        onChange={(event) =>
                          setSettingsSound(
                            event.target
                              .value,
                          )
                        }
                        className="h-10 w-full appearance-none rounded-lg border border-border/70 bg-muted/60 px-3 pr-10 text-sm text-foreground outline-none transition-colors focus:border-blue-500/60 focus:bg-muted"
                      >
                        <option value="inherit">
                          Inherit from wheel
                        </option>
                        <option value="none">
                          No sound
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
                  <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                    <label className="text-sm font-medium text-foreground">
                      Popup message
                    </label>

                    <input
                      value={
                        settingsPopupMessage
                      }
                      onChange={(event) =>
                        setSettingsPopupMessage(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Optional message..."
                      className="h-10 w-full rounded-lg border border-border/70 bg-muted/60 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/60 focus:bg-muted"
                    />
                  </div>

                  {/* Weight */}
                  <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                    <label className="text-sm font-medium text-foreground">
                      Weight
                    </label>

                    <div className="flex items-center gap-3">
                      <div className="flex h-10 flex-1 items-center rounded-lg border border-border/70 bg-muted/60">
                        <Scale className="ml-3 h-4 w-4 text-muted-foreground" />

                        <span className="ml-2 text-sm font-medium text-foreground">
                          {settingsDraft.weight ??
                            1}
                        </span>

                        <div className="ml-auto flex items-center">
                          <button
                            type="button"
                            disabled={
                              (settingsDraft.weight ??
                                1) <= 0
                            }
                            onClick={() =>
                              updateSettingsDraft(
                                {
                                  weight:
                                    Math.max(
                                      0,
                                      Math.round(
                                        ((settingsDraft.weight ??
                                          1) -
                                          1) *
                                          100,
                                      ) /
                                        100,
                                    ),
                                },
                              )
                            }
                            className="flex h-10 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateSettingsDraft(
                                {
                                  weight:
                                    Math.round(
                                      ((settingsDraft.weight ??
                                        1) +
                                        1) *
                                        100,
                                    ) /
                                    100,
                                },
                              )
                            }
                            className="flex h-10 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="min-w-[125px] text-right">
                        <span className="text-xs text-muted-foreground">
                          Probability
                        </span>

                        <p className="text-sm font-semibold text-foreground">
                          {settingsProbability}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Image */}
                  {settingsImage && (
                    <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                      <span className="text-sm font-medium text-foreground">
                        Image
                      </span>

                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-lg border border-border/70 bg-muted">
                          <img
                            src={
                              settingsImage
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSettingsImage(
                              undefined,
                            )
                          }
                          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Remove image
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-4">
                  <button
                    type="button"
                    onClick={
                      closeSettings
                    }
                    className="h-10 rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      saveSettings
                    }
                    className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  )
}
