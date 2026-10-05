import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Minus,
  Palette,
  Pencil,
  Play,
  Square,
  Plus,
  Scale,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  Pipette,
} from "lucide-react"

import { Button } from "@/components/ui/button"

import type { SpinWheelItem } from "./Wheel"

type WheelSummary = {
  id: string
  name: string
  items: SpinWheelItem[]
}

type SidebarProps = {
  open: boolean
  items: SpinWheelItem[]
  results: string[]
  wheels: WheelSummary[]
  activeWheelId: string
  onSelectWheel: (wheelId: string) => void
  onChange: (items: SpinWheelItem[]) => void
  onClearResults: () => void
  onRenameWheel: (wheelId: string, name: string) => void
  onRemoveWheel: (wheelId: string) => void
  onAddWheel: () => void
  onSpinAllWheels: () => void
  onOpenWheel: () => void
  animateWinningEntryByWheel: Record<string, boolean>
  onAnimateWinningEntryChange: (wheelId: string, enabled: boolean) => void
  afterSoundByWheel: Record<string, string>
  afterVolumeByWheel: Record<string, number>
  onAfterSoundChange: (wheelId: string, sound: string) => void
  onAfterVolumeChange: (wheelId: string, volume: number) => void
}

type Tab = "entries" | "results"

type ColorPickerTab = "hex" | "rgb" | "wheel"

type EntryExtras = {
  sound?: string
  popupMessage?: string
  image?: string
}

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

type EyeDropperResult = {
  sRGBHex: string
}

type EyeDropperInstance = {
  open: () => Promise<EyeDropperResult>
}

type EyeDropperWindow = Window & {
  EyeDropper?: new () => EyeDropperInstance
}

const COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
]

const WHEEL_THEMES = [
  ["Default", ["#3b82f6", "#64748b", "#0ea5e9", "#334155", "#60a5fa", "#94a3b8"]],
  ["Classic", ["#2563eb", "#ef4444", "#facc15", "#22c55e", "#8b5cf6", "#f97316"]],
  ["Rainbow", ["#7c3aed", "#2563eb", "#06b6d4", "#22c55e", "#facc15", "#ef4444"]],
  ["Unicorn", ["#c026d3", "#ec4899", "#f9a8d4", "#fde68a", "#c4b5fd", "#e2e8f0"]],
  ["Circus", ["#06b6d4", "#facc15", "#fb7185", "#f97316", "#ec4899", "#22c55e"]],
  ["Fruit Salad", ["#f97316", "#fb923c", "#facc15", "#84cc16", "#4ade80", "#22c55e"]],
  ["Building Blocks", ["#06b6d4", "#38bdf8", "#fde68a", "#fb7185", "#f97316", "#ef4444"]],
  ["Splash", ["#38bdf8", "#67e8f9", "#a5f3fc", "#2563eb", "#c084fc", "#94a3b8"]],
  ["Retro Pop", ["#fb7185", "#fef3c7", "#67e8f9", "#22d3ee", "#bef264", "#84cc16"]],
  ["Playground", ["#3b82f6", "#facc15", "#fb923c", "#f43f5e", "#c084fc", "#22c55e"]],
  ["Picnic", ["#f59e0b", "#facc15", "#a3e635", "#4ade80", "#22c55e", "#84cc16"]],
  ["Sugar Rush", ["#ec4899", "#f472b6", "#fde047", "#facc15", "#fb7185", "#86efac"]],
  ["Popsicle", ["#60a5fa", "#34d399", "#fde047", "#f97316", "#fb7185", "#c084fc"]],
  ["Cotton Candy", ["#bae6fd", "#ddd6fe", "#bbf7d0", "#fbcfe8", "#f9a8d4", "#e0f2fe"]],
  ["Marshmallow", ["#86efac", "#c4b5fd", "#f9a8d4", "#fde2e4", "#bfdbfe", "#d9f99d"]],
  ["Lilac Dreams", ["#d8b4fe", "#c4b5fd", "#a78bfa", "#f5d0fe", "#fbcfe8", "#ede9fe"]],
  ["Blush & Peach", ["#d8b4fe", "#fed7aa", "#fdba74", "#fb923c", "#fb7185", "#f43f5e"]],
  ["Seaside", ["#a7f3d0", "#fed7aa", "#bae6fd", "#67e8f9", "#22d3ee", "#38bdf8"]],
  ["Soft Sage", ["#d1fae5", "#dcfce7", "#bbf7d0", "#a7f3d0", "#d9f99d", "#f0fdf4"]],
  ["Office Hours", ["#fca5a5", "#fde68a", "#cbd5e1", "#94a3b8", "#6366f1", "#475569"]],
  ["Information Blues", ["#94a3b8", "#cbd5e1", "#e2e8f0", "#64748b", "#3b82f6", "#1d4ed8"]],
  ["Ice & Slate", ["#0284c7", "#38bdf8", "#7dd3fc", "#cbd5e1", "#e5e7eb", "#f3f4f6"]],
  ["Moon", ["#27272a", "#52525b", "#a1a1aa", "#d4d4d8", "#e4e4e7", "#f4f4f5"]],
  ["Modern Muted", ["#a7c4bc", "#d1d5db", "#e7e5e4", "#f5f5f4", "#fecdd3", "#94a3b8"]],
  ["Deep Dive", ["#020617", "#0f172a", "#0e7490", "#0369a1", "#155e75", "#164e63"]],
  ["Jungle", ["#166534", "#15803d", "#4d7c0f", "#84cc16", "#a3a3a3", "#c08457"]],
  ["Autumn Foliage", ["#c2410c", "#ea580c", "#f59e0b", "#d97706", "#84cc16", "#a16207"]],
  ["Woodland", ["#9a6654", "#7c5c4b", "#78534a", "#d6a77a", "#c49a6c", "#e2c19a"]],
  ["Savanna", ["#fef3c7", "#fde68a", "#b45309", "#d97706", "#92400e", "#78716c"]],
  ["Canyon", ["#a8a29e", "#d97757", "#fb923c", "#ea580c", "#7c2d12", "#57534e"]],
  ["Succulent Garden", ["#9ca3af", "#86a58a", "#d9f99d", "#fed7aa", "#fef3c7", "#a7f3d0"]],
  ["Pond Life", ["#4d7c0f", "#65a30d", "#facc15", "#fb7185", "#f9a8d4", "#86efac"]],
  ["Koi Fish", ["#f97316", "#f8fafc", "#facc15", "#ef4444", "#fb923c", "#334155"]],
  ["Rainforest", ["#06b6d4", "#14b8a6", "#0f766e", "#e2e8f0", "#67e8f9", "#22c55e"]],
  ["Oasis", ["#fde68a", "#fbbf24", "#365f55", "#4d7c6f", "#86a98b", "#94a3b8"]],
  ["Deep Sea", ["#4338ca", "#67e8f9", "#cffafe", "#e0f2fe", "#5eead4", "#0f766e"]],
  ["Moss & Fern", ["#3f6212", "#4d7c0f", "#65a30d", "#84cc16", "#a3e635", "#bef264"]],
  ["Midnight", ["#082f49", "#1e3a5f", "#64748b", "#9f1239", "#fb7185", "#fed7aa"]],
  ["Neon Nights", ["#f0abfc", "#d946ef", "#8b5cf6", "#7c3aed", "#4338ca", "#1d4ed8"]],
  ["Deep Forest", ["#475569", "#6366f1", "#cbd5e1", "#3f6212", "#166534", "#365314"]],
  ["Galactic", ["#a5b4fc", "#7c3aed", "#4c1d95", "#312e81", "#581c87", "#475569"]],
  ["Urban Ops", ["#737373", "#171717", "#0f172a", "#7dd3fc", "#e5e7eb", "#f5f5f5"]],
  ["Abyss", ["#38bdf8", "#0891b2", "#164e63", "#0f3d56", "#c084fc", "#e9d5ff"]],
  ["Fire & Ice", ["#60a5fa", "#3b82f6", "#fed7aa", "#fb923c", "#f97316", "#ea580c"]],
  ["Sunshine", ["#f8fafc", "#fde68a", "#facc15", "#f59e0b", "#ea580c", "#dc2626"]],
  ["Heatwave", ["#dc2626", "#f97316", "#fb923c", "#fde68a", "#facc15", "#bef264"]],
  ["Solstice", ["#991b1b", "#dc2626", "#f97316", "#fde68a", "#facc15", "#fb923c"]],
  ["Golden Hour", ["#d97706", "#f59e0b", "#facc15", "#eab308", "#fde047", "#fef08a"]],
  ["Sorbet", ["#4f46e5", "#6366f1", "#ec4899", "#fda4af", "#fdba74", "#fde68a"]],
  ["Valentine's Day", ["#ef4444", "#ec4899", "#f9a8d4", "#fecdd3", "#fff1f2", "#be123c"]],
  ["Saint Patrick's Day", ["#16a34a", "#f8fafc", "#f59e0b", "#facc15", "#166534", "#4ade80"]],
  ["Easter", ["#f9a8d4", "#fef3c7", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fbcfe8"]],
  ["Halloween", ["#f97316", "#111827", "#a21caf", "#84cc16", "#facc15", "#7c2d12"]],
  ["Christmas", ["#15803d", "#dc2626", "#facc15", "#f8fafc", "#166534", "#b91c1c"]],
  ["New Year", ["#111827", "#facc15", "#f8fafc", "#64748b", "#1e3a8a", "#e5e7eb"]],
  ["Classic Rainbow", ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6"]],
  ["Asexual", ["#111827", "#a3a3a3", "#f8fafc", "#7c2d8a", "#52525b", "#d4d4d8"]],
  ["Bisexual", ["#ec4899", "#a855f7", "#2563eb", "#c026d3", "#7c3aed", "#1d4ed8"]],
  ["Demisexual", ["#111827", "#f8fafc", "#7e22ce", "#a3a3a3", "#e5e7eb", "#4c1d95"]],
  ["Gay", ["#059669", "#86efac", "#f8fafc", "#60a5fa", "#4c1d95", "#22c55e"]],
  ["Lesbian", ["#f97316", "#fb923c", "#f8fafc", "#f472b6", "#db2777", "#be185d"]],
  ["Pansexual", ["#ec4899", "#facc15", "#0ea5e9", "#db2777", "#fde047", "#0284c7"]],
  ["Agender", ["#111827", "#d4d4d8", "#f8fafc", "#bef264", "#52525b", "#a3a3a3"]],
  ["Genderfluid", ["#f472b6", "#f8fafc", "#c026d3", "#111827", "#4338ca", "#a78bfa"]],
  ["Genderqueer", ["#a78bfa", "#f8fafc", "#65a30d", "#7e22ce", "#bef264", "#e9d5ff"]],
  ["Intersex", ["#a21caf", "#facc15", "#7e22ce", "#fde047", "#581c87", "#fef08a"]],
  ["Non-binary", ["#facc15", "#f8fafc", "#a855f7", "#111827", "#fde047", "#c084fc"]],
  ["Transgender", ["#5eead4", "#f9a8d4", "#f8fafc", "#fbcfe8", "#67e8f9", "#38bdf8"]],
] as const

const COLOR_GALLERY = [
  "#ffffff",
  "#f8fafc",
  "#e2e8f0",
  "#94a3b8",
  "#64748b",
  "#334155",
  "#0f172a",
  "#000000",

  "#fecaca",
  "#fca5a5",
  "#ef4444",
  "#dc2626",
  "#991b1b",
  "#7f1d1d",

  "#fed7aa",
  "#fb923c",
  "#f97316",
  "#ea580c",
  "#c2410c",

  "#fef08a",
  "#fde047",
  "#eab308",
  "#ca8a04",
  "#a16207",

  "#bbf7d0",
  "#86efac",
  "#22c55e",
  "#16a34a",
  "#15803d",

  "#a5f3fc",
  "#67e8f9",
  "#06b6d4",
  "#0891b2",
  "#0e7490",

  "#bfdbfe",
  "#93c5fd",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",

  "#ddd6fe",
  "#c4b5fd",
  "#8b5cf6",
  "#7c3aed",
  "#6d28d9",

  "#f5d0fe",
  "#f0abfc",
  "#d946ef",
  "#c026d3",
  "#a21caf",
]

const SOUND_OPTIONS = [
  "Inherit from wheel",
  "Ticking sound",
  "No sound",
  "Random sound",
  "Subdued applause",
  "Joke punchline",
  "Announcement bell",
  "Twinkling star",
  "Correct answer ding",
  "Synth bell",
  "Notification bell",
  "Loud applause",
  "Fanfare",
  "Bell ringing",
  "Cymbals",
  "Thunder",
  "Cash register",
  "Evil laugh",
  "Microwave ding",
  "Old phone ringing",
  "Alarm clock",
  "Fireworks",
  "Game win ding",
  "Wrong answer",
  "Punch",
  "Cat meow",
  "Wolf howl",
  "Horse",
  "Lion roar",
  "Sad trombone",
  "Cinematic drum impact",
  "Water splash",
  "Gong",
  "Doorbell",
  "Church bell",
  "Referee whistle",
  "Boing",
  "Angel choir",
  "Harp strum",
  "Breaker switch",
  "Camera shutter & flash",
  "Lost game",
  "Horror scream",
  "Speak result aloud (Voice 1)",
  "Speak result aloud (Voice 2)",
]

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
    return (
      "#" +
      hex
        .slice(1)
        .split("")
        .map((character) => character + character)
        .join("")
        .toLowerCase()
    )
  }

  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex.toLowerCase()
  }

  return "#3b82f6"
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)

  return {
    r: Number.parseInt(
      normalized.slice(1, 3),
      16,
    ),
    g: Number.parseInt(
      normalized.slice(3, 5),
      16,
    ),
    b: Number.parseInt(
      normalized.slice(5, 7),
      16,
    ),
  }
}

function rgbToHex(
  r: number,
  g: number,
  b: number,
) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(
        0,
        Math.min(
          255,
          Math.round(value),
        ),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

function rgbToHsv(
  r: number,
  g: number,
  b: number,
) {
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

  const difference = max - min

  let hue = 0

  if (difference !== 0) {
    if (max === red) {
      hue =
        ((green - blue) /
          difference) %
        6
    } else if (max === green) {
      hue =
        (blue - red) /
          difference +
        2
    } else {
      hue =
        (red - green) /
          difference +
        4
    }

    hue *= 60

    if (hue < 0) {
      hue += 360
    }
  }

  const saturation =
    max === 0
      ? 0
      : difference / max

  return {
    h: hue,
    s: saturation,
    v: max,
  }
}

function hsvToHex(
  h: number,
  s: number,
  v: number,
) {
  const c = v * s

  const x =
    c *
    (1 -
      Math.abs(
        ((h / 60) % 2) - 1,
      ))

  const m = v - c

  let red = 0
  let green = 0
  let blue = 0

  if (h < 60) {
    red = c
    green = x
  } else if (h < 120) {
    red = x
    green = c
  } else if (h < 180) {
    green = c
    blue = x
  } else if (h < 240) {
    green = x
    blue = c
  } else if (h < 300) {
    red = x
    blue = c
  } else {
    red = c
    blue = x
  }

  return rgbToHex(
    (red + m) * 255,
    (green + m) * 255,
    (blue + m) * 255,
  )
}

function ColorPickerPopover({
  value,
  onChange,
  onClose,
}: {
  value: string
  onChange: (value: string) => void
  onClose: () => void
}) {
  const pickerRef =
    useRef<HTMLDivElement | null>(null)

  const currentColor =
    normalizeHex(value)

  const currentRgb =
    hexToRgb(currentColor)

  const currentHsv =
    rgbToHsv(
      currentRgb.r,
      currentRgb.g,
      currentRgb.b,
    )

  const [
    activeTab,
    setActiveTab,
  ] = useState<ColorPickerTab>("hex")

  const [
    hexValue,
    setHexValue,
  ] = useState(currentColor)

  const [
    hue,
    setHue,
  ] = useState(currentHsv.h)

  useEffect(() => {
    const normalized =
      normalizeHex(value)

    setHexValue(normalized)

    const rgb = hexToRgb(normalized)

    setHue(
      rgbToHsv(
        rgb.r,
        rgb.g,
        rgb.b,
      ).h,
    )
  }, [value])

  useEffect(() => {
    const handlePointerDown = (
      event: MouseEvent,
    ) => {
      const target = event.target

      if (
        target instanceof Node &&
        !pickerRef.current?.contains(
          target,
        )
      ) {
        onClose()
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      )
    }
  }, [onClose])

  const applyHex = (next: string) => {
    const normalized =
      normalizeHex(next)

    setHexValue(normalized)
    onChange(normalized)

    const rgb = hexToRgb(normalized)

    setHue(
      rgbToHsv(
        rgb.r,
        rgb.g,
        rgb.b,
      ).h,
    )
  }

  const updateRgb = (
    channel: "r" | "g" | "b",
    amount: number,
  ) => {
    const rgb = hexToRgb(currentColor)

    rgb[channel] = Math.max(
      0,
      Math.min(
        255,
        Math.round(amount),
      ),
    )

    applyHex(
      rgbToHex(
        rgb.r,
        rgb.g,
        rgb.b,
      ),
    )
  }

  const handleHuePointer = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect()

    const x =
      event.clientX -
      (rect.left + rect.width / 2)

    const y =
      event.clientY -
      (rect.top + rect.height / 2)

    let nextHue =
      (Math.atan2(y, x) * 180) /
        Math.PI +
      90

    if (nextHue < 0) {
      nextHue += 360
    }

    setHue(nextHue)

    const nextColor = hsvToHex(
      nextHue,
      currentHsv.s,
      currentHsv.v,
    )

    applyHex(nextColor)
  }

  const handleSvPointer = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect()

    const saturation = Math.max(
      0,
      Math.min(
        1,
        (event.clientX -
          rect.left) /
          rect.width,
      ),
    )

    const brightness =
      1 -
      Math.max(
        0,
        Math.min(
          1,
          (event.clientY -
            rect.top) /
            rect.height,
        ),
      )

    applyHex(
      hsvToHex(
        hue,
        saturation,
        brightness,
      ),
    )
  }

  const useEyeDropper = async () => {
    const eyeDropperWindow =
      window as EyeDropperWindow

    if (
      !eyeDropperWindow.EyeDropper
    ) {
      return
    }

    try {
      const eyeDropper =
        new eyeDropperWindow.EyeDropper()

      const result =
        await eyeDropper.open()

      applyHex(result.sRGBHex)
    } catch {
      // User cancelled the eyedropper.
    }
  }

  const slider = (
    label: string,
    channel: "r" | "g" | "b",
    value: number,
  ) => (
    <div
      key={channel}
      className="grid grid-cols-[24px_1fr_52px] items-center gap-2"
    >
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>

      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={(event) =>
          updateRgb(
            channel,
            Number(event.target.value),
          )
        }
        className="h-1.5 w-full cursor-pointer accent-blue-500"
      />

      <input
        type="number"
        min={0}
        max={255}
        value={value}
        onChange={(event) =>
          updateRgb(
            channel,
            Number(event.target.value),
          )
        }
        className="h-7 w-[52px] rounded-md border border-border/70 bg-background px-2 text-center text-xs text-foreground outline-none focus:border-blue-500/60"
      />
    </div>
  )

  return (
    <div
      ref={pickerRef}
      className="absolute left-0 top-[calc(100%+8px)] z-[300] w-[340px] overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl"
      onMouseDown={(event) =>
        event.stopPropagation()
      }
    >
      <div className="flex items-center border-b border-border/70 bg-muted/30">
        {(
          [
            ["hex", "HEX"],
            ["rgb", "RGB"],
            ["wheel", "Wheel"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              setActiveTab(id)
            }
            className={`flex h-10 flex-1 items-center justify-center border-b-2 text-xs font-semibold transition-colors ${
              activeTab === id
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          aria-label="Pick color from screen"
          title="Pick color from screen"
          onClick={
            useEyeDropper
          }
          className="mr-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pipette className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <div
          className="h-9 rounded-lg border border-border/70 shadow-inner"
          style={{
            backgroundColor:
              currentColor,
          }}
        />

        {activeTab === "hex" && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                #
              </span>

              <input
                value={hexValue.replace(
                  "#",
                  "",
                )}
                onChange={(event) => {
                  const raw =
                    event.target.value.replace(
                      /[^0-9a-fA-F]/g,
                      "",
                    )

                  setHexValue(
                    `#${raw}`,
                  )

                  if (
                    raw.length === 6
                  ) {
                    applyHex(
                      `#${raw}`,
                    )
                  }
                }}
                onBlur={() =>
                  applyHex(
                    hexValue,
                  )
                }
                className="h-9 flex-1 rounded-lg border border-border/70 bg-muted/60 px-3 text-sm text-foreground outline-none focus:border-blue-500/60"
              />
            </div>

            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_GALLERY.map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    onClick={() =>
                      applyHex(color)
                    }
                    className={`h-7 rounded-md border transition-transform hover:scale-105 ${
                      currentColor ===
                      color
                        ? "border-foreground ring-2 ring-blue-500/40"
                        : "border-black/10 dark:border-white/10"
                    }`}
                    style={{
                      backgroundColor:
                        color,
                    }}
                  />
                ),
              )}
            </div>
          </>
        )}

        {activeTab === "rgb" && (
          <>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_GALLERY.map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    onClick={() =>
                      applyHex(color)
                    }
                    className={`h-7 rounded-md border transition-transform hover:scale-105 ${
                      currentColor ===
                      color
                        ? "border-foreground ring-2 ring-blue-500/40"
                        : "border-black/10 dark:border-white/10"
                    }`}
                    style={{
                      backgroundColor:
                        color,
                    }}
                  />
                ),
              )}
            </div>

            <div className="space-y-2.5 border-t border-border/60 pt-3">
              {slider(
                "R",
                "r",
                currentRgb.r,
              )}

              {slider(
                "G",
                "g",
                currentRgb.g,
              )}

              {slider(
                "B",
                "b",
                currentRgb.b,
              )}
            </div>
          </>
        )}

        {activeTab === "wheel" && (
          <div className="grid grid-cols-[150px_1fr] gap-3">
            <div
              className="relative h-[150px] w-[150px] cursor-crosshair rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
              onPointerDown={
                handleHuePointer
              }
            >
              <div className="absolute inset-[17px] rounded-full bg-card" />

              <div
                className="absolute inset-[23px] rounded-full"
                style={{
                  backgroundColor:
                    `hsl(${hue} 100% 50%)`,
                }}
              />

              <div className="absolute inset-[35px] rounded-full bg-card/95" />

              <div
                className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
                style={{
                  backgroundColor:
                    currentColor,
                }}
              />
            </div>

            <div className="space-y-3">
              <div
                className="relative h-[110px] cursor-crosshair overflow-hidden rounded-lg border border-border/70"
                style={{
                  backgroundColor:
                    `hsl(${hue} 100% 50%)`,
                  backgroundImage:
                    "linear-gradient(to right, #fff, transparent), linear-gradient(to top, #000, transparent)",
                }}
                onPointerDown={
                  handleSvPointer
                }
              >
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                  style={{
                    left: `${currentHsv.s * 100}%`,
                    top: `${(1 - currentHsv.v) * 100}%`,
                  }}
                />
              </div>

              <div className="space-y-2.5">
                {slider(
                  "R",
                  "r",
                  currentRgb.r,
                )}

                {slider(
                  "G",
                  "g",
                  currentRgb.g,
                )}

                {slider(
                  "B",
                  "b",
                  currentRgb.b,
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SoundDropdown({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] =
    useState(false)

  const ref =
    useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handleClick = (
      event: MouseEvent,
    ) => {
      const target = event.target

      if (
        target instanceof Node &&
        !ref.current?.contains(target)
      ) {
        setOpen(false)
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
  }, [open])

  return (
    <div
      ref={ref}
      className="relative w-full"
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() =>
          setOpen((current) => !current)
        }
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border/70 bg-muted/60 px-3 text-left text-sm text-foreground outline-none transition-colors hover:bg-muted focus:border-blue-500/60"
      >
        <span className="truncate">
          {value}
        </span>

        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[320] w-full overflow-hidden rounded-xl border border-border/70 bg-card p-1.5 shadow-2xl">
          {/* Only this area scrolls. The settings popup itself does not. */}
          <div className="max-h-[240px] overflow-y-auto pr-1">
            {SOUND_OPTIONS.map(
              (sound) => {
                const active =
                  sound === value

                return (
                  <button
                    key={sound}
                    type="button"
                    role="option"
                    aria-selected={
                      active
                    }
                    onClick={() => {
                      onChange(sound)
                      setOpen(false)
                    }}
                    className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? "bg-blue-500/10 text-blue-500"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="truncate">
                      {sound}
                    </span>

                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-blue-500" />
                    )}
                  </button>
                )
              },
            )}
          </div>
        </div>
      )}
    </div>
  )
}


function WheelCustomizeDialog({
  open,
  wheelNumber,
  onClose,
  animateWinner,
  onAnimateWinnerChange,
  onColorsChange,
  afterSound,
  afterVolume,
  onAfterSoundChange,
  onAfterVolumeChange,
}: {
  open: boolean
  wheelNumber: number
  onClose: () => void
  animateWinner: boolean
  onAnimateWinnerChange: (enabled: boolean) => void
  onColorsChange: (colors: string[]) => void
  afterSound: string
  afterVolume: number
  onAfterSoundChange: (sound: string) => void
  onAfterVolumeChange: (volume: number) => void
}) {
  const [tab, setTab] = useState<"during" | "after" | "appearance">("during")
  const [duringSound, setDuringSound] = useState("Ticking sound")
  const [duringVolume, setDuringVolume] = useState(50)
  const [displayDuplicates, setDisplayDuplicates] = useState(true)
  const [spinSlowly, setSpinSlowly] = useState(false)
  const [showTitle, setShowTitle] = useState(true)
  const [spinTime, setSpinTime] = useState(10)
  const [maxVisible, setMaxVisible] = useState(1000)

  const [launchConfetti, setLaunchConfetti] = useState(true)
  const [autoRemove, setAutoRemove] = useState(false)
  const [displayPopup, setDisplayPopup] = useState(true)
  const [popupMessage, setPopupMessage] = useState("We have a winner!")
  const [displayRemoveButton, setDisplayRemoveButton] = useState(true)
  const [clickRemoveSound, setClickRemoveSound] = useState(false)

  const [oneColorPerSection, setOneColorPerSection] = useState(true)
  const [useBackgroundImage, setUseBackgroundImage] = useState(true)
  const [availableColors, setAvailableColors] = useState<string[]>(COLORS)
  const [selectedColors, setSelectedColors] = useState<string[]>(COLORS)
  const [themeOpen, setThemeOpen] = useState(false)
  const [centerImage, setCenterImage] = useState<string | undefined>()
  const [imageSize, setImageSize] = useState("S")
  const [gradient, setGradient] = useState(true)
  const [contours, setContours] = useState(false)
  const [wheelShadow, setWheelShadow] = useState(true)
  const [pointerChangesColor, setPointerChangesColor] = useState(true)
  const [alwaysShowText, setAlwaysShowText] = useState("Always show text on the wheel")

  const centerImageInputRef = useRef<HTMLInputElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const toggleColor = (color: string) => {
    setSelectedColors((current) => {
      const next = current.includes(color)
        ? current.filter((entry) => entry !== color)
        : [...current, color]
      const safe = next.length > 0 ? next : [color]
      onColorsChange(safe)
      return safe
    })
  }

  const handleCenterImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setCenterImage(reader.result)
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  const check = (checked: boolean, onChange: (value: boolean) => void, label: string, extra?: ReactNode) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 cursor-pointer rounded border-border accent-blue-500"
      />
      <span>{label}</span>
      {extra}
    </label>
  )

  const slider = (
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
    labels: string[],
  ) => (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-blue-500"
      />
      <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground">
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  )

  const previewAfterSound = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
    }
    if (afterSound === "No sound" || afterSound === "Inherit from wheel" || afterSound.startsWith("Speak result")) return
    const files: Record<string, string> = {
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
    const file = files[afterSound]
    if (!file) return
    const audio = new Audio(`/sounds/after-spin/${file}`)
    audio.volume = afterVolume / 100
    audio.onerror = () => {
      const fallback = new Audio(`/sounds/after-spin/${file}`)
      fallback.volume = afterVolume / 100
      previewAudioRef.current = fallback
      void fallback.play().catch(() => undefined)
    }
    previewAudioRef.current = audio
    void audio.play().catch(() => undefined)
  }

  const stopPreviewSound = () => {
    if (!previewAudioRef.current) return
    previewAudioRef.current.pause()
    previewAudioRef.current.currentTime = 0
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-background/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wheel-customize-title"
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[820px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card text-foreground shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-border/70 bg-card/95">
          <div className="flex h-full items-end">
            {[
              ["during", "During spin"],
              ["after", "After spin"],
              ["appearance", "Appearance"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as "during" | "after" | "appearance")}
                className={`flex h-14 items-center border-b-2 px-5 text-sm font-semibold transition-colors ${
                  tab === id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background/40 p-4 sm:p-6">
          {tab === "during" && (
            <div className="space-y-0">
              <div className="rounded-lg bg-yellow-300/90 px-4 py-3 text-sm leading-5 text-black">
                You are in multi-wheel mode. The sound for this wheel (Wheel {wheelNumber}) will play when you press “Spin all wheels”.
              </div>

              <div className="grid grid-cols-[116px_1fr] items-center gap-x-4 gap-y-5 py-5">
                <label className="text-sm font-semibold">Sound</label>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <SoundDropdown value={duringSound} onChange={setDuringSound} />
                  </div>
                  <button type="button" aria-label="Preview sound" className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition hover:bg-muted">
                    <Play className="h-5 w-5 fill-current" />
                  </button>
                  <button type="button" aria-label="Stop sound" className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition hover:bg-muted">
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                </div>

                <label className="text-sm font-semibold">Volume</label>
                <div>
                  {slider(duringVolume, 0, 100, 1, setDuringVolume, ["0%", "25%", "50%", "75%", "100%"])}
                </div>
              </div>

              <div className="border-t border-border/70 py-5">
                <div className="flex flex-wrap gap-x-7 gap-y-4">
                  {check(displayDuplicates, setDisplayDuplicates, "Display duplicates")}
                  {check(spinSlowly, setSpinSlowly, "Spin slowly")}
                  {check(showTitle, setShowTitle, "Show title")}
                </div>
              </div>

              <div className="border-t border-border/70 py-5">
                <div className="mb-3 text-sm font-semibold">Spin time (seconds)</div>
                {slider(spinTime, 1, 60, 1, setSpinTime, ["1", "10", "20", "30", "40", "50", "60"])}
              </div>

              <div className="border-t border-border/70 pt-5">
                <div className="mb-1 text-sm font-semibold">Max number of names visible on the wheel</div>
                <p className="mb-4 text-xs font-medium text-muted-foreground">All names in the text-box have the same chance of winning, regardless of this value.</p>
                {slider(maxVisible, 4, 1000, 1, setMaxVisible, ["4", "100", "200", "300", "400", "500", "600", "700", "800", "900", "1000"])}
              </div>
            </div>
          )}

          {tab === "after" && (
            <div className="space-y-0">
              <div className="rounded-lg bg-yellow-300/90 px-4 py-3 text-sm leading-5 text-black">
                You are in multi-wheel mode. The “After spin” settings for this wheel (Wheel {wheelNumber}) will be used when you press “Spin all wheels”.
              </div>

              <div className="grid grid-cols-[116px_1fr] items-center gap-x-4 gap-y-5 py-5">
                <label className="text-sm font-semibold">Sound</label>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <SoundDropdown value={afterSound} onChange={onAfterSoundChange} />
                  </div>
                  <button type="button" aria-label="Preview sound" onClick={previewAfterSound} className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition hover:bg-muted">
                    <Play className="h-5 w-5 fill-current" />
                  </button>
                  <button type="button" aria-label="Stop sound" onClick={stopPreviewSound} className="flex h-10 w-10 items-center justify-center rounded-md text-foreground transition hover:bg-muted">
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                </div>

                <label className="text-sm font-semibold">Volume</label>
                <div>
                  {slider(afterVolume, 0, 100, 1, (value) => onAfterVolumeChange(value), ["0%", "25%", "50%", "75%", "100%"])}
                </div>
              </div>

              <div className="border-t border-border/70 py-5">
                <div className="flex flex-wrap gap-x-7 gap-y-4">
                  {check(animateWinner, onAnimateWinnerChange, "Animate winning entry")}
                  {check(launchConfetti, setLaunchConfetti, "Launch confetti")}
                  {check(autoRemove, setAutoRemove, "Auto-remove winner after 5 seconds")}
                </div>
              </div>

              <div className="border-t border-border/70 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  {check(displayPopup, setDisplayPopup, "Display popup with message:")}
                  <input
                    value={popupMessage}
                    onChange={(event) => setPopupMessage(event.target.value)}
                    disabled={!displayPopup}
                    className="h-10 min-w-[240px] flex-1 rounded-md border border-border/70 bg-muted/70 px-3 text-sm font-medium outline-none transition-colors focus:border-blue-500/60 disabled:opacity-50"
                  />
                </div>
                <div className="mt-4 space-y-4 pl-1">
                  {check(displayRemoveButton, setDisplayRemoveButton, 'Display the "Remove" button')}
                  {check(clickRemoveSound, setClickRemoveSound, "Play a click sound when the winner is removed")}
                </div>
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-0">
              <div className="grid grid-cols-2 gap-6 border-b border-border/70 pb-5">
                <button
                  type="button"
                  onClick={() => setOneColorPerSection((value) => !value)}
                  className="group flex flex-col items-center gap-3 rounded-lg p-2 transition hover:bg-muted/40"
                >
                  <div className="flex h-14 w-14 overflow-hidden rounded-full border-2 border-border/70 shadow-sm">
                    {selectedColors.slice(0, 4).map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}
                  </div>
                  <span className="text-sm font-semibold">One color per section</span>
                  <span className={`h-1.5 w-14 rounded-full transition ${oneColorPerSection ? "bg-blue-500" : "bg-muted"}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setUseBackgroundImage((value) => !value)}
                  className="group flex flex-col items-center gap-3 rounded-lg p-2 transition hover:bg-muted/40"
                >
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-border/70 bg-muted shadow-sm">
                    {centerImage ? <img src={centerImage} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <span className="text-sm font-semibold">Wheel background image</span>
                  <span className={`h-1.5 w-14 rounded-full transition ${useBackgroundImage ? "bg-blue-500" : "bg-muted"}`} />
                </button>
              </div>

              <div className="relative border-b border-border/70 py-5">
                <button
                  type="button"
                  onClick={() => setThemeOpen((value) => !value)}
                  className="flex h-9 min-w-[200px] items-center justify-center gap-3 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                >
                  Apply a theme
                  <ChevronDown className={`h-4 w-4 transition-transform ${themeOpen ? "rotate-180" : ""}`} />
                </button>

                {themeOpen && (
                  <div className="absolute left-0 top-[calc(100%+4px)] z-[50] w-[285px] overflow-hidden rounded-md border border-white/10 bg-[#1c1c1c] shadow-2xl">
                    <div className="max-h-[520px] overflow-y-auto">
                      {WHEEL_THEMES.map(([name, colors]) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            const next = [...colors]
                            setAvailableColors(next)
                            setSelectedColors(next)
                            onColorsChange(next)
                            setThemeOpen(false)
                          }}
                          className="flex min-h-11 w-full items-center justify-between gap-4 px-5 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          <span>{name}</span>
                          <span className="flex shrink-0 gap-1">
                            {colors.map((color) => (
                              <span key={color} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-b border-border/70 py-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  Customize colors
                </div>

                <div className="flex flex-wrap gap-4">
                  {availableColors.map((color) => {
                    const checked = selectedColors.includes(color)
                    return (
                      <label key={color} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleColor(color)}
                          className="h-5 w-5 cursor-pointer rounded border-border accent-blue-500"
                        />
                        <span
                          className="flex h-9 w-12 items-center justify-center rounded-md border border-border/70 shadow-sm"
                          style={{ backgroundColor: color }}
                        >
                          <Palette className="h-4 w-4 text-black/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.45)]" />
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border/70 py-5">
                <div className="flex items-center gap-3 text-sm font-semibold">Image at the center of the wheel
                  <button type="button" onClick={() => centerImageInputRef.current?.click()} className="flex h-10 w-24 items-center justify-center gap-2 rounded-md bg-blue-600 text-white transition hover:bg-blue-500">
                    <ImageIcon className="h-4 w-4" />
                  </button>
                  <input ref={centerImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCenterImage} />
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Image size
                  <select value={imageSize} onChange={(event) => setImageSize(event.target.value)} className="h-10 rounded-md border border-border/70 bg-muted/70 px-3 text-sm outline-none focus:border-blue-500/60">
                    <option>S</option><option>M</option><option>L</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4 bg-muted/20 p-4">
                {check(contours, setContours, "Contours")}
                {check(gradient, setGradient, "Display a color gradient on the page")}
                {check(wheelShadow, setWheelShadow, "Wheel shadow")}
                <button type="button" onClick={() => setAlwaysShowText((value) => value === "Always show text on the wheel" ? "Only show text while spinning" : "Always show text on the wheel")} className="flex h-10 items-center justify-between rounded-md bg-muted/70 px-3 text-left text-sm font-semibold">{alwaysShowText}<ChevronDown className="h-4 w-4 text-muted-foreground" /></button>
                {check(pointerChangesColor, setPointerChangesColor, "Pointer changes color")}
              </div>
            </div>
          )}
        </div>

        <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-border/70 bg-card px-5">
          <button type="button" onClick={onClose} className="h-10 rounded-md px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">Cancel</button>
          <button type="button" onClick={onClose} className="h-10 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500">OK</button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({
  open,
  items,
  results,
  wheels,
  activeWheelId,
  onSelectWheel,
  onChange,
  onClearResults,
  onRenameWheel,
  onRemoveWheel,
  onAddWheel,
  onSpinAllWheels,
  onOpenWheel,
  animateWinningEntryByWheel,
  onAnimateWinningEntryChange,
  afterSoundByWheel,
  afterVolumeByWheel,
  onAfterSoundChange,
  onAfterVolumeChange,
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

  const [removeWheelConfirmOpen, setRemoveWheelConfirmOpen] =
    useState(false)

  const [customizeWheelOpen, setCustomizeWheelOpen] =
    useState(false)

  const textEditingRef =
    useRef(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  const entryImageInputRef =
    useRef<HTMLInputElement | null>(null)

  const pendingImageEntryId =
    useRef<string | null>(null)

  const imageMenuRef =
    useRef<HTMLDivElement | null>(null)

  const wheelMenuRef =
    useRef<HTMLDivElement | null>(null)

  const [
    colorPickerEntryId,
    setColorPickerEntryId,
  ] = useState<string | null>(null)

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
  ] = useState("Inherit from wheel")

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

  const [
    settingsColorOpen,
    setSettingsColorOpen,
  ] = useState(false)

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

  const handleEntryImageFiles = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0]

    const entryId =
      pendingImageEntryId.current

    if (!file || !entryId) {
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

      setEntryExtras(entryId, {
        image: reader.result,
      })

      if (
        settingsDraft?.id ===
        entryId
      ) {
        setSettingsImage(
          reader.result,
        )
      }
    }

    reader.readAsDataURL(file)

    pendingImageEntryId.current = null
    event.target.value = ""
  }

  const openEntryImagePicker = (
    id: string,
  ) => {
    pendingImageEntryId.current = id
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
        "Inherit from wheel",
    )

    setSettingsPopupMessage(
      entryExtras.popupMessage ??
        "",
    )

    setSettingsImage(
      entryExtras.image,
    )

    setSettingsColorOpen(false)
  }

  const closeSettings = () => {
    setSettingsEntryIndex(null)
    setSettingsDraft(null)
    setSettingsSound(
      "Inherit from wheel",
    )
    setSettingsPopupMessage("")
    setSettingsImage(undefined)
    setSettingsColorOpen(false)
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
        "Inherit from wheel",
    )

    setSettingsPopupMessage(
      entryExtras.popupMessage ??
        "",
    )

    setSettingsImage(
      entryExtras.image,
    )

    setSettingsColorOpen(false)
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

  const handleRenameActiveWheel = () => {
    const wheel = wheels.find((entry) => entry.id === activeWheelId)
    if (!wheel) return

    const nextName = window.prompt("Rename wheel", wheel.name)
    if (nextName !== null) {
      onRenameWheel(wheel.id, nextName)
    }
    setWheelMenuOpen(false)
  }

  const handleRemoveActiveWheel = () => {
    if (wheels.length <= 1) {
      setWheelMenuOpen(false)
      return
    }

    setWheelMenuOpen(false)
    setRemoveWheelConfirmOpen(true)
  }

  const confirmRemoveActiveWheel = () => {
    onRemoveWheel(activeWheelId)
    setRemoveWheelConfirmOpen(false)
  }

  const handleCustomizeActiveWheel = () => {
    setWheelMenuOpen(false)
    setCustomizeWheelOpen(true)
  }

  const toggleWheelMenu = (event: ReactMouseEvent) => {
    event.stopPropagation()
    setWheelMenuOpen((current) => !current)
    setImageMenuOpen(false)
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

  const hiddenCount =
    items.filter(
      (item) => item.hidden,
    ).length

  const activeWheelNumber = Math.max(
    1,
    wheels.findIndex((wheel) => wheel.id === activeWheelId) + 1,
  )

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
        className={`absolute inset-y-0 right-0 z-[150] flex h-full w-[468px] max-w-[calc(100vw-8px)] flex-col border-l border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
          open
            ? "translate-x-0"
            : "translate-x-full"
        }`}
      >
        <div className="flex min-h-0 h-full flex-col">
          <div className="flex h-12 shrink-0 items-end overflow-x-auto border-b border-border/70 bg-card/80 px-1">
            {wheels.map((wheel) => (
              <button
                key={wheel.id}
                type="button"
                onClick={() => {
                  onSelectWheel(wheel.id)
                  setTab("entries")
                }}
                className={`flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                  tab === "entries" &&
                  activeWheelId === wheel.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {wheel.name}

                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-[11px] font-bold leading-none text-muted-foreground">
                  {wheel.items.length}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setTab("results")}
              className={`flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                tab === "results"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Results

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

                            const itemExtras =
                              getExtras(
                                item.id,
                              )

                            return (
                              <div
                                key={item.id}
                                className={`relative py-2.5 transition-opacity ${
                                  hidden
                                    ? "opacity-35"
                                    : ""
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div className="flex w-7 shrink-0 flex-col items-center gap-1">
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
                                      className="flex h-6 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30"
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
                                      className="flex h-6 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-30"
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
                                      <div className="relative shrink-0">
                                        <button
                                          type="button"
                                          aria-label={`Change color for ${item.label}`}
                                          onClick={() =>
                                            setColorPickerEntryId(
                                              (
                                                current,
                                              ) =>
                                                current ===
                                                item.id
                                                  ? null
                                                  : item.id,
                                            )
                                          }
                                          className="flex h-9 w-11 items-center justify-center overflow-hidden rounded-md border border-border/70 shadow-sm transition hover:brightness-105"
                                          style={{
                                            backgroundColor:
                                              item.color ??
                                              COLORS[
                                                index %
                                                  COLORS.length
                                              ],
                                          }}
                                        >
                                          <Palette className="h-4 w-4 text-black/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.45)]" />
                                        </button>

                                        {colorPickerEntryId ===
                                          item.id && (
                                          <ColorPickerPopover
                                            value={
                                              item.color ??
                                              "#3b82f6"
                                            }
                                            onChange={(
                                              color,
                                            ) =>
                                              updateEntry(
                                                item.id,
                                                {
                                                  color,
                                                },
                                              )
                                            }
                                            onClose={() =>
                                              setColorPickerEntryId(
                                                null,
                                              )
                                            }
                                          />
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        aria-label={`Add image to ${item.label}`}
                                        onClick={() =>
                                          openEntryImagePicker(
                                            item.id,
                                          )
                                        }
                                        className={`relative flex h-9 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/80 text-foreground transition hover:bg-muted ${
                                          itemExtras.image
                                            ? "text-blue-500"
                                            : ""
                                        }`}
                                      >
                                        <ImageIcon className="h-4 w-4" />

                                        {itemExtras.image && (
                                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                        )}
                                      </button>

                                      <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-border/50 bg-muted/80">
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
                                            className="flex h-9 w-8 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
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
                                            className="flex h-9 w-8 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-40"
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

          <div className="mt-auto shrink-0 border-t border-border/70 bg-muted/10 px-4 py-3">
            <div className="relative">
              {wheels.length > 1 && (
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSpinAllWheels}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                  >
                    <span className="text-sm leading-none">⟳</span>
                    Spin all wheels
                  </button>

                  <div ref={wheelMenuRef} className="relative">
                    <div className="flex h-9">
                      <button
                        type="button"
                        onClick={() => {
                          onAddWheel()
                          setWheelMenuOpen(false)
                        }}
                        className="flex items-center gap-1.5 rounded-l-md border-r border-white/15 bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                      >
                        <Plus className="h-4 w-4" />
                        Add wheel
                      </button>
                      <button
                        type="button"
                        aria-label="More wheel options"
                        aria-expanded={wheelMenuOpen}
                        onClick={toggleWheelMenu}
                        className="flex w-9 items-center justify-center rounded-r-md bg-blue-600 text-white shadow-sm transition hover:bg-blue-500"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${wheelMenuOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {wheelMenuOpen && (
                      <div className="absolute bottom-[calc(100%+6px)] left-0 z-[320] w-[145px] overflow-hidden rounded-md border border-border/70 bg-card p-1 shadow-2xl">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectWheel(activeWheelId)
                            setTab("entries")
                            setWheelMenuOpen(false)
                            onOpenWheel()
                          }}
                          className="flex h-9 w-full items-center gap-3 rounded px-2.5 text-left text-xs font-semibold text-foreground transition hover:bg-muted"
                        >
                          <span className="text-base leading-none">📁</span>
                          Open wheel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {wheels.length === 1 && (
                <div ref={wheelMenuRef} className="relative inline-flex">
                  <div className="flex h-9">
                    <button
                      type="button"
                      onClick={() => {
                        onAddWheel()
                        setWheelMenuOpen(false)
                      }}
                      className="flex items-center gap-1.5 rounded-l-md border-r border-white/15 bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                    >
                      <Plus className="h-4 w-4" />
                      Add wheel
                    </button>
                    <button
                      type="button"
                      aria-label="More wheel options"
                      aria-expanded={wheelMenuOpen}
                      onClick={toggleWheelMenu}
                      className="flex w-9 items-center justify-center rounded-r-md bg-blue-600 text-white shadow-sm transition hover:bg-blue-500"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${wheelMenuOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {wheelMenuOpen && (
                    <div className="absolute bottom-[calc(100%+6px)] left-0 z-[320] w-[145px] overflow-hidden rounded-md border border-border/70 bg-card p-1 shadow-2xl">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWheel(activeWheelId)
                          setTab("entries")
                          setWheelMenuOpen(false)
                          onOpenWheel()
                        }}
                        className="flex h-9 w-full items-center gap-3 rounded px-2.5 text-left text-xs font-semibold text-foreground transition hover:bg-muted"
                      >
                        <span className="text-base leading-none">📁</span>
                        Open wheel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {wheels.length > 1 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCustomizeActiveWheel}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                  >
                    <Palette className="h-4 w-4 shrink-0" />
                    Customize wheel {activeWheelNumber}
                  </button>

                  <button
                    type="button"
                    onClick={handleRenameActiveWheel}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                  >
                    <Pencil className="h-4 w-4 shrink-0" />
                    Rename wheel {activeWheelNumber}
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveActiveWheel}
                    className="flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-red-500"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    Remove wheel {activeWheelNumber}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {removeWheelConfirmOpen && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRemoveWheelConfirmOpen(false)
          }}
        >
          <div className="w-full max-w-[420px] rounded-xl border border-border/70 bg-card p-5 text-foreground shadow-2xl">
            <h2 className="text-base font-semibold">Remove wheel?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Are you sure you want to remove Wheel {activeWheelNumber}? This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setRemoveWheelConfirmOpen(false)} className="h-10 rounded-md px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground">Cancel</button>
              <button type="button" onClick={confirmRemoveActiveWheel} className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500">Remove</button>
            </div>
          </div>
        </div>
      )}

      <WheelCustomizeDialog
        open={customizeWheelOpen}
        wheelNumber={activeWheelNumber}
        onClose={() => setCustomizeWheelOpen(false)}
        animateWinner={animateWinningEntryByWheel[activeWheelId] ?? false}
        onAnimateWinnerChange={(enabled) =>
          onAnimateWinningEntryChange(activeWheelId, enabled)
        }
        afterSound={afterSoundByWheel[activeWheelId] ?? "Subdued applause"}
        afterVolume={afterVolumeByWheel[activeWheelId] ?? 50}
        onAfterSoundChange={(sound) => onAfterSoundChange(activeWheelId, sound)}
        onAfterVolumeChange={(volume) => onAfterVolumeChange(activeWheelId, volume)}
        onColorsChange={(colors) => {
          const next = items.map((item, index) => ({
            ...item,
            color: colors[index % colors.length],
          }))
          onChange(next)
        }}
      />

      <input
        ref={entryImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={
          handleEntryImageFiles
        }
      />

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
              className="w-full max-w-[680px] overflow-visible rounded-2xl border border-border/70 bg-card text-foreground shadow-2xl"
            >
              <div className="flex h-[68px] items-center justify-between border-b border-border/70 bg-card px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <SlidersHorizontal className="h-[18px] w-[18px]" />
                  </div>

                  <div>
                    <h2
                      id="advanced-entry-settings-title"
                      className="text-base font-semibold"
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

              {/* Entry navigation is deliberately independent from the + button.
                  The arrows/text stay together on the left, while + stays pinned right. */}
              <div className="border-b border-border/70 px-5 py-4">
                <div className="relative flex h-10 items-center">
                  <div className="flex items-center gap-3">
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>

                    <div className="min-w-[64px] text-center">
                      <p className="text-xs font-medium text-muted-foreground">
                        Entry
                      </p>

                      <p className="mt-0.5 text-sm font-semibold leading-4">
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

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
                            (
                              item,
                            ) =>
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
                        "Inherit from wheel",
                      )

                      setSettingsPopupMessage(
                        "",
                      )

                      setSettingsImage(
                        undefined,
                      )
                    }}
                    className="absolute right-0 top-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-500"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* No scroll container here.
                  The only scrollable list in the settings popup is the sound dropdown. */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
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

                    Visible
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={
                        duplicateSettingsEntry
                      }
                      className="flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 text-xs font-semibold transition-colors hover:bg-muted"
                    >
                      <span className="text-sm">
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

                <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                  <label className="text-sm font-medium">
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
                    className="h-10 w-full rounded-lg border border-border/70 bg-muted/60 px-3 text-sm outline-none transition-colors focus:border-blue-500/60 focus:bg-muted"
                  />
                </div>

                <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                  <label className="text-sm font-medium">
                    Color
                  </label>

                  <div className="relative flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Change color"
                      onClick={() =>
                        setSettingsColorOpen(
                          (current) =>
                            !current,
                        )
                      }
                      className="flex h-10 w-12 items-center justify-center overflow-hidden rounded-lg border border-border/70 shadow-sm transition hover:brightness-105"
                      style={{
                        backgroundColor:
                          settingsDraft.color ??
                          "#3b82f6",
                      }}
                    >
                      <Palette className="h-4 w-4 text-black/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.45)]" />
                    </button>

                    {settingsColorOpen && (
                      <ColorPickerPopover
                        value={
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
                          setSettingsColorOpen(
                            false,
                          )
                        }
                      />
                    )}

                    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-muted/60 px-3 text-xs font-semibold transition-colors hover:bg-muted">
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

                <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                  <label className="text-sm font-medium">
                    Sound
                  </label>

                  <SoundDropdown
                    value={
                      settingsSound
                    }
                    onChange={
                      setSettingsSound
                    }
                  />
                </div>

                <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                  <label className="text-sm font-medium">
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
                    className="h-10 w-full rounded-lg border border-border/70 bg-muted/60 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500/60 focus:bg-muted"
                  />
                </div>

                <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                  <label className="text-sm font-medium">
                    Weight
                  </label>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 flex-1 items-center rounded-lg border border-border/70 bg-muted/60">
                      <Scale className="ml-3 h-4 w-4 text-muted-foreground" />

                      <span className="ml-2 text-sm font-medium">
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

                    <div className="min-w-[100px] text-right">
                      <span className="text-xs text-muted-foreground">
                        Probability
                      </span>

                      <p className="text-sm font-semibold">
                        {settingsProbability}%
                      </p>
                    </div>
                  </div>
                </div>

                {settingsImage && (
                  <div className="grid grid-cols-[130px_1fr] items-center gap-4 border-b border-border/50 py-4">
                    <span className="text-sm font-medium">
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
        )}
    </>
  )
}
