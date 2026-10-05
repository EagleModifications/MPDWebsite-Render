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
  Pipette,
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
type ColorTab = "hex" | "rgb" | "wheel"

const COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
]

const COLOR_GALLERY = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",

  "#fecaca",
  "#fed7aa",
  "#fde68a",
  "#fef08a",
  "#d9f99d",
  "#bbf7d0",
  "#a7f3d0",
  "#99f6e4",
  "#a5f3fc",
  "#bae6fd",
  "#bfdbfe",
  "#c7d2fe",
  "#ddd6fe",
  "#e9d5ff",
  "#f5d0fe",
  "#fbcfe8",
  "#fecdd3",

  "#991b1b",
  "#9a3412",
  "#92400e",
  "#854d0e",
  "#3f6212",
  "#166534",
  "#065f46",
  "#115e59",
  "#155e75",
  "#075985",
  "#1e40af",
  "#3730a3",
  "#5b21b6",
  "#6b21a8",
  "#86198f",
  "#9d174d",
  "#9f1239",

  "#000000",
  "#171717",
  "#262626",
  "#404040",
  "#525252",
  "#737373",
  "#a3a3a3",
  "#d4d4d4",
  "#e5e5e5",
  "#f5f5f5",
  "#ffffff",
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
  EyeDropper?: new () => {
    open: () => Promise<{
      sRGBHex: string
    }>
  }
}

type EntryExtras = {
  sound?: string
  popupMessage?: string
  image?: string
}

type RGB = {
  r: number
  g: number
  b: number
}

type HSV = {
  h: number
  s: number
  v: number
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

function normalizeHex(value: string) {
  let hex = value.trim()

  if (!hex.startsWith("#")) {
    hex = `#${hex}`
  }

  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")
      .toLowerCase()}`
  }

  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex.toLowerCase()
  }

  return "#3b82f6"
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex)
  const value = normalized.slice(1)

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function rgbToHex({
  r,
  g,
  b,
}: RGB) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(
        0,
        Math.min(255, Math.round(value)),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

function rgbToHsv({
  r,
  g,
  b,
}: RGB): HSV {
  const red = r / 255
  const green = g / 255
  const blue = b / 255

  const max = Math.max(
    red,
    green,
    blue,
  )

  const min = Math.min(
    red,
    green,
    blue,
  )

  const delta = max - min

  let h = 0

  if (delta !== 0) {
    if (max === red) {
      h =
        60 *
        (((green - blue) / delta) % 6)
    } else if (max === green) {
      h =
        60 *
        ((blue - red) / delta + 2)
    } else {
      h =
        60 *
        ((red - green) / delta + 4)
    }
  }

  if (h < 0) {
    h += 360
  }

  const s =
    max === 0
      ? 0
      : delta / max

  return {
    h,
    s,
    v: max,
  }
}

function hsvToRgb({
  h,
  s,
  v,
}: HSV): RGB {
  const c = v * s
  const x =
    c *
    (1 -
      Math.abs(
        ((h / 60) % 2) - 1,
      ))
  const m = v - c

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  }
}

function hsvToHex(hsv: HSV) {
  return rgbToHex(
    hsvToRgb(hsv),
  )
}

function clampColorValue(value: number) {
  return Math.max(
    0,
    Math.min(255, Math.round(value)),
  )
}

function ColorPicker({
  color,
  onChange,
  onClose,
}: {
  color: string
  onChange: (color: string) => void
  onClose: () => void
}) {
  const [tab, setTab] =
    useState<ColorTab>("hex")

  const [hexInput, setHexInput] =
    useState(normalizeHex(color))

  const [hsv, setHsv] =
    useState<HSV>(() =>
      rgbToHsv(
        hexToRgb(color),
      ),
    )

  const pickerRef =
    useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const normalized =
      normalizeHex(color)

    setHexInput(normalized)
    setHsv(
      rgbToHsv(
        hexToRgb(normalized),
      ),
    )
  }, [color])

  useEffect(() => {
    const handleClick = (
      event: MouseEvent,
    ) => {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (
        !pickerRef.current?.contains(
          target,
        )
      ) {
        onClose()
      }
    }

    document.addEventListener(
      "mousedown",
      handleClick,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClick,
      )
    }
  }, [onClose])

  const rgb = useMemo(
    () => hexToRgb(color),
    [color],
  )

  const setColor = (
    nextColor: string,
  ) => {
    const normalized =
      normalizeHex(nextColor)

    setHexInput(normalized)

    const nextHsv =
      rgbToHsv(
        hexToRgb(normalized),
      )

    setHsv(nextHsv)
    onChange(normalized)
  }

  const updateRgb = (
    channel: keyof RGB,
    value: number,
  ) => {
    const nextRgb = {
      ...rgb,
      [channel]:
        clampColorValue(value),
    }

    setColor(
      rgbToHex(nextRgb),
    )
  }

  const updateHsv = (
    changes: Partial<HSV>,
  ) => {
    const nextHsv = {
      ...hsv,
      ...changes,
    }

    setHsv(nextHsv)
    setColor(
      hsvToHex(nextHsv),
    )
  }

  const handleHexChange = (
    value: string,
  ) => {
    setHexInput(value)

    if (
      /^#?[0-9a-fA-F]{6}$/.test(
        value,
      ) ||
      /^#?[0-9a-fA-F]{3}$/.test(
        value,
      )
    ) {
      setColor(value)
    }
  }

  const useEyeDropper =
    async () => {
      const pickerWindow =
        window as SaveFilePickerWindow

      if (!pickerWindow.EyeDropper) {
        return
      }

      try {
        const eyeDropper =
          new pickerWindow.EyeDropper()

        const result =
          await eyeDropper.open()

        setColor(result.sRGBHex)
      } catch {
        // User cancelled the browser eyedropper.
      }
    }

  const handleSaturationValueClick = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect()

    const saturation = Math.max(
      0,
      Math.min(
        1,
        (event.clientX - rect.left) /
          rect.width,
      ),
    )

    const value = Math.max(
      0,
      Math.min(
        1,
        1 -
          (event.clientY -
            rect.top) /
            rect.height,
      ),
    )

    updateHsv({
      s: saturation,
      v: value,
    })
  }

  const handleHueClick = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect()

    const centerX =
      rect.left + rect.width / 2

    const centerY =
      rect.top + rect.height / 2

    const angle =
      Math.atan2(
        event.clientY - centerY,
        event.clientX - centerX,
      ) *
      (180 / Math.PI)

    const hue =
      (angle + 90 + 360) % 360

    updateHsv({
      h: hue,
    })
  }

  const tabClass = (
    current: ColorTab,
  ) =>
    `flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
      tab === current
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`

  const pickerSupported =
    Boolean(
      (window as SaveFilePickerWindow)
        .EyeDropper,
    )

  return (
    <div
      ref={pickerRef}
      className="absolute left-0 top-12 z-[150] w-[330px] overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl"
      onMouseDown={(event) =>
        event.stopPropagation()
      }
    >
      {/* Tabs */}
      <div className="border-b border-border/70 p-2">
        <div className="flex rounded-lg bg-muted/60 p-1">
          <button
            type="button"
            onClick={() =>
              setTab("hex")
            }
            className={tabClass("hex")}
          >
            HEX
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("rgb")
            }
            className={tabClass("rgb")}
          >
            RGB
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("wheel")
            }
            className={tabClass("wheel")}
          >
            Wheel
          </button>
        </div>
      </div>

      {/* Current color / editor */}
      <div className="p-3">
        {tab === "hex" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="h-10 w-10 shrink-0 rounded-lg border border-border/70 shadow-inner"
                style={{
                  backgroundColor: color,
                }}
              />

              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  #
                </span>

                <input
                  value={hexInput.replace(
                    /^#/,
                    "",
                  )}
                  onChange={(event) =>
                    handleHexChange(
                      `#${event.target.value}`,
                    )
                  }
                  onBlur={() =>
                    setHexInput(
                      normalizeHex(
                        hexInput,
                      ),
                    )
                  }
                  className="h-10 w-full rounded-lg border border-border/70 bg-muted/60 pl-7 pr-3 font-mono text-sm text-foreground outline-none focus:border-blue-500/60"
                  maxLength={6}
                  spellCheck={false}
                />
              </div>

              <button
                type="button"
                aria-label="Pick color from screen"
                title={
                  pickerSupported
                    ? "Pick color from screen"
                    : "Eyedropper is not supported in this browser"
                }
                disabled={
                  !pickerSupported
                }
                onClick={
                  useEyeDropper
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pipette className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {tab === "rgb" && (
          <div className="space-y-3">
            {(
              [
                ["R", "r"],
                ["G", "g"],
                ["B", "b"],
              ] as const
            ).map(
              ([
                label,
                channel,
              ]) => (
                <div
                  key={channel}
                  className="flex items-center gap-3"
                >
                  <span className="w-4 text-xs font-semibold text-foreground">
                    {label}
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={
                      rgb[channel]
                    }
                    onChange={(event) =>
                      updateRgb(
                        channel,
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 accent-blue-500"
                  />

                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={
                      rgb[channel]
                    }
                    onChange={(event) =>
                      updateRgb(
                        channel,
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                    className="h-8 w-14 rounded-md border border-border/70 bg-muted/60 px-2 text-center text-xs text-foreground outline-none focus:border-blue-500/60"
                  />
                </div>
              ),
            )}
          </div>
        )}

        {tab === "wheel" && (
          <div className="flex items-center justify-center py-1">
            <div
              className="relative flex h-[190px] w-[190px] cursor-crosshair items-center justify-center rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
              onClick={
                handleHueClick
              }
            >
              <div className="absolute inset-[25px] rounded-full border-2 border-white/70 bg-card shadow-lg" />

              <div
                className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full"
                style={{
                  background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
                }}
                onClick={
                  handleSaturationValueClick
                }
              >
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                  style={{
                    left: `${hsv.s * 100}%`,
                    top: `${
                      (1 - hsv.v) * 100
                    }%`,
                  }}
                />
              </div>

              <div
                className="pointer-events-none absolute h-7 w-7 rounded-full border-2 border-white shadow-lg"
                style={{
                  backgroundColor:
                    color,
                }}
              />
            </div>
          </div>
        )}

        {/* Gallery */}
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Gallery
            </span>

            <button
              type="button"
              aria-label="Pick color from screen"
              title={
                pickerSupported
                  ? "Pick color from screen"
                  : "Eyedropper is not supported in this browser"
              }
              disabled={
                !pickerSupported
              }
              onClick={
                useEyeDropper
              }
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pipette className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-17 overflow-hidden rounded-lg border border-border/70">
            {COLOR_GALLERY.map(
              (galleryColor) => (
                <button
                  key={galleryColor}
                  type="button"
                  aria-label={`Use ${galleryColor}`}
                  title={galleryColor}
                  onClick={() =>
                    setColor(
                      galleryColor,
                    )
                  }
                  className="aspect-square min-w-0 border-r border-b border-black/10 transition-transform hover:z-10 hover:scale-110"
                  style={{
                    backgroundColor:
                      galleryColor,
                  }}
                />
              ),
            )}
          </div>
        </div>

        {/* RGB sliders always visible */}
        <div className="mt-4 border-t border-border/70 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              RGB
            </span>

            <span className="font-mono text-[11px] text-muted-foreground">
              {rgb.r}, {rgb.g}, {rgb.b}
            </span>
          </div>

          <div className="space-y-2">
            {(
              [
                ["R", "r", "#ef4444"],
                ["G", "g", "#22c55e"],
                ["B", "b", "#3b82f6"],
              ] as const
            ).map(
              ([
                label,
                channel,
                accent,
              ]) => (
                <div
                  key={channel}
                  className="flex items-center gap-2"
                >
                  <span className="w-4 text-[11px] font-semibold text-muted-foreground">
                    {label}
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={
                      rgb[channel]
                    }
                    onChange={(event) =>
                      updateRgb(
                        channel,
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                    className="min-w-0 flex-1"
                    style={{
                      accentColor:
                        accent,
                    }}
                  />

                  <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">
                    {rgb[channel]}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
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

  const [
    colorPickerOpen,
    setColorPickerOpen,
  ] = useState(false)

  const textEditingRef =
    useRef(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  const entryImageInputRef =
    useRef<HTMLInputElement | null>(null)

  const entryImageTargetRef =
    useRef<string | null>(null)

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

  const handleEntryImageFile = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0]

    const targetId =
      entryImageTargetRef.current

    if (!file || !targetId) {
      event.target.value = ""
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

      setEntryExtras(
        targetId,
        {
          image:
            reader.result,
        },
      )

      if (
        settingsDraft?.id ===
        targetId
      ) {
        setSettingsImage(
          reader.result,
        )
      }
    }

    reader.readAsDataURL(file)

    event.target.value = ""
    entryImageTargetRef.current = null
  }

  const openEntryImagePicker = (
    id: string,
  ) => {
    entryImageTargetRef.current = id
    entryImageInputRef.current?.click()
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

    setColorPickerOpen(false)
  }

  const closeSettings = () => {
    setSettingsEntryIndex(null)
    setSettingsDraft(null)
    setSettingsSound("")
    setSettingsPopupMessage("")
    setSettingsImage(undefined)
    setColorPickerOpen(false)
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

    setColorPickerOpen(false)
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

    setColorPickerOpen(false)
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

                                      {/* Direct entry image picker */}
                                      <button
                                        type="button"
                                        aria-label={`Add image to ${item.label}`}
                                        title="Set entry image"
                                        onClick={() =>
                                          openEntryImagePicker(
                                            item.id,
                                          )
                                        }
                                        className={`flex h-9 w-10 shrink-0 items-center justify-center rounded-md text-foreground transition ${
                                          getExtras(
                                            item.id,
                                          ).image
                                            ? "bg-blue-500/10 text-blue-500"
                                            : "hover:bg-muted"
                                        }`}
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

                        <span className="text-sm font-medium">
                          Open wheel
                        </span>
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

      {/* Shared entry image picker */}
      <input
        ref={entryImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={
          handleEntryImageFile
        }
      />

      {/* Advanced entry settings */}
      {settingsEntryIndex !== null &&
        settingsDraft && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
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
              className="w-full max-w-[680px] overflow-hidden rounded-2xl border border-border/70 bg-card text-foreground shadow-2xl"
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
                <div className="flex min-h-[76px] items-center gap-5 border-b border-border/70 px-5">
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
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <div className="min-w-0 flex-1">
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
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
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

                      setColorPickerOpen(
                        false,
                      )
                    }}
                    className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.25)] transition-colors hover:bg-blue-500"
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
                  <div className="relative grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                    <label className="text-sm font-medium text-foreground">
                      Color
                    </label>

                    <div className="flex items-center justify-between gap-3">
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Open color picker"
                          aria-expanded={
                            colorPickerOpen
                          }
                          onClick={() =>
                            setColorPickerOpen(
                              (current) =>
                                !current,
                            )
                          }
                          className="relative flex h-10 w-12 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm transition hover:border-blue-500/50"
                        >
                          <span
                            className="absolute inset-1 rounded-md"
                            style={{
                              backgroundColor:
                                settingsDraft.color ??
                                "#3b82f6",
                            }}
                          />

                          <Palette className="relative z-10 h-4 w-4 text-black/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.55)]" />
                        </button>

                        {colorPickerOpen && (
                          <ColorPicker
                            color={
                              settingsDraft.color ??
                              "#3b82f6"
                            }
                            onChange={(
                              color,
                            ) =>
                              updateSettingsDraft(
                                {
                                  color,
                                },
                              )
                            }
                            onClose={() =>
                              setColorPickerOpen(
                                false,
                              )
                            }
                          />
                        )}
                      </div>

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
