import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileImage,
  Image as ImageIcon,
  Images,
  Plus,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  Settings2,
  Gauge,
  PictureInPicture2,
  Pipette,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getSession, type User } from "@/lib/auth"

type YouTubeQuality = "highres" | "hd2160" | "hd1440" | "hd1080" | "hd720" | "large" | "medium" | "small" | "tiny" | "auto"

type YouTubePlayerInstance = {
  playVideo: () => void
  pauseVideo: () => void
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  setVolume: (value: number) => void
  getVolume: () => number
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  setPlaybackRate: (rate: number) => void
  getPlaybackRate: () => number
  getAvailableQualityLevels: () => string[]
  setPlaybackQuality: (quality: string) => void
  destroy: () => void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string
          playerVars?: Record<string, string | number>
          events?: {
            onReady?: (event: { target: YouTubePlayerInstance }) => void
            onStateChange?: (event: { target: YouTubePlayerInstance; data: number }) => void
            onPlaybackQualityChange?: (event: { target: YouTubePlayerInstance; data: string }) => void
          }
        },
      ) => YouTubePlayerInstance
      PlayerState: {
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

type GalleryMediaType = "image" | "video"

type GalleryMedia = {
  id: string
  type: GalleryMediaType
  url: string
  thumbnailUrl: string
  source: "upload" | "url"
  storageId?: string
}

type GalleryCategory = string
type GalleryTag = string

type GalleryItem = {
  id: string
  title: string
  description: string
  category?: GalleryCategory
  tags?: GalleryTag[]
  media: GalleryMedia[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

type PendingMedia = GalleryMedia & {
  previewUrl?: string
  file?: File
  progress?: number
  processing?: boolean
  error?: string
}

const DEFAULT_GALLERY_TAGS: readonly GalleryTag[] = [
  "Dept",
  "SWAT",
  "MTF-7",
  "MCD",
  "TRU",
  "SAR",
]

const DEFAULT_GALLERY_CATEGORY_COLORS: Record<string, string> = {
  Community: "#3b82f6",
  Fleet: "#ffffff",
}

const DEFAULT_GALLERY_TAG_COLORS: Record<string, string> = {
  Dept: "#3b82f6",
  SWAT: "#ffffff",
  "MTF-7": "#3b82f6",
  MCD: "#ffffff",
  TRU: "#3b82f6",
  SAR: "#ffffff",
}
type GalleryMediaFilter = "Images" | "Videos"

const DEFAULT_GALLERY_CATEGORIES: readonly GalleryCategory[] = [
  "Community",
  "Fleet",
]

const DEFAULT_GALLERY_MEDIA_FILTERS: readonly GalleryMediaFilter[] = [
  "Images",
  "Videos",
]

type DropdownContextValue = {
  openDropdown: string | null
  setOpenDropdown: (value: string | null) => void
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

function DropdownProvider({ children }: { children: ReactNode }) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      {children}
    </DropdownContext.Provider>
  )
}

function CustomSelect({
  id,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  id: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const dropdown = useContext(DropdownContext)

  if (!dropdown) {
    throw new Error("CustomSelect must be used inside DropdownProvider.")
  }

  const { openDropdown, setOpenDropdown } = dropdown
  const open = openDropdown === id

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest(`[data-custom-select="${id}"]`)) {
        setOpenDropdown(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenDropdown(null)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [id, open, setOpenDropdown])

  return (
    <div className="relative" data-custom-select={id}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpenDropdown(open ? null : id)}
        className={[
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-all",
          "hover:border-blue-500/30 hover:bg-muted/40",
          "focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20",
          open ? "border-blue-500/50 ring-2 ring-blue-500/20" : "",
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2">
          {id === "gallery-category" && value !== "All" && (
            <span
              aria-hidden="true"
              className={
                value === "Community"
                  ? "h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                  : "h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
              }
            />
          )}
          <span>{value}</span>
        </span>
        <ChevronDown className={["h-4 w-4 text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          {options.map((option) => {
            const selected = option === value

            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option)
                  setOpenDropdown(null)
                }}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  selected ? "bg-blue-500/10 text-blue-600 dark:text-blue-300" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {id === "gallery-category" && option !== "All" && (
                    <span
                      aria-hidden="true"
                      className={
                        option === "Community"
                          ? "h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                          : "h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                      }
                    />
                  )}
                  <span>{option}</span>
                </span>
                {selected && <Check className="h-4 w-4 text-blue-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CustomMultiSelect({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  optionColors,
  optionKind,
}: {
  id: string
  value: readonly string[]
  options: readonly string[]
  onChange: (value: string[]) => void
  ariaLabel: string
  optionColors?: Record<string, string>
  optionKind?: "type" | "category" | "tag"
}) {
  const dropdown = useContext(DropdownContext)

  if (!dropdown) {
    throw new Error("CustomMultiSelect must be used inside DropdownProvider.")
  }

  const { openDropdown, setOpenDropdown } = dropdown
  const open = openDropdown === id

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest(`[data-custom-select="${id}"]`)) {
        setOpenDropdown(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenDropdown(null)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [id, open, setOpenDropdown])

  const filterLabel =
    id === "gallery-filter-type"
      ? "Type"
      : id === "gallery-filter-category"
        ? "Category"
        : id === "gallery-filter-tags"
          ? "Tags"
          : "Select tags"

  const selectedLabel =
    value.length === 0
      ? filterLabel
      : value.length === 1
        ? value[0]
        : `${value.length} selected`

  return (
    <div className="relative" data-custom-select={id}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpenDropdown(open ? null : id)}
        className={[
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-all",
          "hover:border-blue-500/30 hover:bg-muted/40",
          "focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20",
          open ? "border-blue-500/50 ring-2 ring-blue-500/20" : "",
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <span className={value.length === 0 ? "text-muted-foreground" : ""}>
            {selectedLabel}
          </span>
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          {options.map((option) => {
            const selected = value.includes(option)

            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(
                    selected
                      ? value.filter((tag) => tag !== option)
                      : [...value, option],
                  )
                }}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  selected
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {optionKind === "category" || optionKind === "tag" ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: optionColors?.[option] ?? "#3b82f6" }}
                    />
                  ) : optionKind === "type" ? (
                    option === "Images" ? <ImageIcon className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />
                  ) : null}
                  <span>{option}</span>
                </span>
                {selected && <Check className="h-4 w-4 text-blue-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getGalleryMediaUrl(media: GalleryMedia) {
  return media.url
}

function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")

    if (host === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v")
      }

      const parts = url.pathname.split("/").filter(Boolean)

      if (["shorts", "embed", "live"].includes(parts[0] ?? "")) {
        return parts[1] || null
      }
    }
  } catch {
    return null
  }

  return null
}

function getYouTubeThumbnail(value: string) {
  const id = getYouTubeVideoId(value)
  return id
    ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
    : ""
}

function getYouTubeEmbedUrl(value: string) {
  const id = getYouTubeVideoId(value)
  return id
    ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&autoplay=1&mute=1&playsinline=1`
    : ""
}

function getVimeoVideoId(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")

    if (host !== "vimeo.com" && host !== "player.vimeo.com") {
      return null
    }

    const parts = url.pathname.split("/").filter(Boolean)
    const id = parts.find((part) => /^\d+$/.test(part))
    return id || null
  } catch {
    return null
  }
}

function getVimeoEmbedUrl(value: string) {
  const id = getVimeoVideoId(value)
  return id
    ? `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1&muted=1&playsinline=1`
    : ""
}

function getVideoEmbedUrl(value: string) {
  return getYouTubeEmbedUrl(value) || getVimeoEmbedUrl(value)
}

function getDirectMediaType(value: string): GalleryMediaType | null {
  try {
    const url = new URL(value)
    const path = url.pathname.toLowerCase()
    const extension = path.includes(".")
      ? path.slice(path.lastIndexOf("."))
      : ""

    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg", ".tif", ".tiff"].includes(extension)) {
      return "image"
    }

    if ([".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".ogv", ".mpeg", ".mpg"].includes(extension)) {
      return "video"
    }
  } catch {
    return null
  }

  return null
}

function getFileMediaType(file: File): GalleryMediaType | null {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"

  const extension = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : ""

  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg", ".tif", ".tiff"].includes(extension)) {
    return "image"
  }

  if ([".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".ogv", ".mpeg", ".mpg"].includes(extension)) {
    return "video"
  }

  return null
}

function isEmbeddableVideo(media: GalleryMedia) {
  return Boolean(getVideoEmbedUrl(media.url))
}

function getMediaThumbnail(media: GalleryMedia) {
  if (media.thumbnailUrl) return media.thumbnailUrl
  return getYouTubeThumbnail(media.url)
}

function getMediaLabel(type: GalleryMediaType) {
  return type === "image" ? "Image" : "Video"
}

function isImageMedia(media: GalleryMedia) {
  return media.type === "image"
}

function isVideoMedia(media: GalleryMedia) {
  return media.type === "video"
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Estimates the number of lines needed when text is wrapped at roughly
 * 35 characters per line. It is used only to decide whether "Show more..."
 * should be displayed.
 */
function getWrappedLineCount(
  value: string,
  maxCharsPerLine = 35,
) {
  return value.split(/\r?\n/).reduce((total, rawLine) => {
    const line = rawLine.trim()

    if (!line) {
      return total + 1
    }

    let currentLength = 0
    let lines = 1

    for (const word of line.split(/\s+/)) {
      if (!word) continue

      if (word.length > maxCharsPerLine) {
        if (currentLength > 0) {
          lines += Math.ceil(word.length / maxCharsPerLine)
          currentLength = word.length % maxCharsPerLine
          if (currentLength === 0) currentLength = maxCharsPerLine
        } else {
          lines += Math.floor((word.length - 1) / maxCharsPerLine)
          currentLength = word.length % maxCharsPerLine
          if (currentLength === 0) currentLength = maxCharsPerLine
        }
        continue
      }

      const requiredLength =
        currentLength === 0
          ? word.length
          : currentLength + 1 + word.length

      if (requiredLength <= maxCharsPerLine) {
        currentLength = requiredLength
      } else {
        lines += 1
        currentLength = word.length
      }
    }

    return total + lines
  }, 0)
}


function normalizeHexColor(value: string) {
  const trimmed = value.trim()
  const short = /^#?([0-9a-fA-F]{3})$/.exec(trimmed)
  if (short) return `#${short[1].split("").map((char) => char + char).join("")}`.toLowerCase()
  const full = /^#?([0-9a-fA-F]{6})$/.exec(trimmed)
  return full ? `#${full[1]}`.toLowerCase() : null
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex) ?? "#3b82f6"
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === red) h = 60 * (((green - blue) / delta) % 6)
    else if (max === green) h = 60 * ((blue - red) / delta + 2)
    else h = 60 * ((red - green) / delta + 4)
  }
  if (h < 0) h += 360
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToRgb(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360 / 360
  const saturation = Math.max(0, Math.min(100, s)) / 100
  const lightness = Math.max(0, Math.min(100, l)) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs((hue * 6) % 2 - 1))
  const m = lightness - chroma / 2
  let r = 0, g = 0, b = 0
  if (hue < 1 / 6) [r, g, b] = [chroma, x, 0]
  else if (hue < 2 / 6) [r, g, b] = [x, chroma, 0]
  else if (hue < 3 / 6) [r, g, b] = [0, chroma, x]
  else if (hue < 4 / 6) [r, g, b] = [0, x, chroma]
  else if (hue < 5 / 6) [r, g, b] = [x, 0, chroma]
  else [r, g, b] = [chroma, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

function parseRgb(value: string) {
  const match = value.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i)
  return match ? rgbToHex(Number(match[1]), Number(match[2]), Number(match[3])) : null
}

function parseHsl(value: string) {
  const match = value.match(/hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/i)
  if (!match) return null
  const rgb = hslToRgb(Number(match[1]), Number(match[2]), Number(match[3]))
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

function GalleryMultiSelect({
  id,
  value,
  options,
  optionColors,
  placeholder,
  allowEmpty = false,
  onChange,
}: {
  id: string
  value: string[]
  options: readonly string[]
  optionColors?: Record<string, string>
  placeholder: string
  allowEmpty?: boolean
  onChange: (value: string[]) => void
}) {
  const dropdown = useContext(DropdownContext)

  if (!dropdown) {
    throw new Error("GalleryMultiSelect must be used inside DropdownProvider.")
  }

  const { openDropdown, setOpenDropdown } = dropdown
  const open = openDropdown === id

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest(`[data-gallery-multi-select="${id}"]`)) {
        setOpenDropdown(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDropdown(null)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [id, open, setOpenDropdown])

  const selectedLabel = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `${value.length} categories selected`

  function toggle(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((entry) => entry !== option))
    } else {
      onChange([...value, option])
    }
  }

  return (
    <div className="relative min-w-0" data-gallery-multi-select={id}>
      <button
        type="button"
        aria-label={placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpenDropdown(open ? null : id)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-all hover:border-blue-500/30 hover:bg-muted/40"
      >
        <span className="min-w-0 truncate text-left">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[10070] w-full min-w-[220px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/10">
          <div className="max-h-64 overflow-y-auto p-1.5" role="listbox" aria-multiselectable="true">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">No categories available.</div>
            ) : (
              options.map((option) => {
                const selected = value.includes(option)
                const color = optionColors?.[option] ?? "#3b82f6"
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggle(option)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-background">
                      {selected && <Check className="h-3.5 w-3.5 text-blue-500" />}
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="min-w-0 flex-1 truncate">{option}</span>
                  </button>
                )
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/70 px-2.5 py-2">
            <span className="text-[11px] text-muted-foreground">
              {value.length === 0 ? "No categories selected" : `${value.length} selected`}
            </span>
            {allowEmpty && value.length > 0 && (
              <button
                type="button"
                className="text-[11px] font-medium text-blue-500 hover:text-blue-400"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GalleryColorPicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<"HEX" | "RGB" | "HSL">("HEX")
  const [draft, setDraft] = useState(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const normalized = normalizeHexColor(value) ?? "#3b82f6"
  const rgb = hexToRgb(normalized)
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  function commit(next: string) {
    const hex = normalizeHexColor(next) ?? parseRgb(next) ?? parseHsl(next)
    if (!hex) return
    setDraft(hex)
    onChange(hex)
  }

  async function pickFromScreen() {
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropperCtor) {
      toast.error("Eyedropper is not supported by this browser.")
      return
    }
    try {
      const result = await new EyeDropperCtor().open()
      commit(result.sRGBHex)
    } catch {
      // The user cancelled the eyedropper.
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 shadow-sm transition-colors hover:border-blue-500/50 hover:bg-muted/40"
      >
        <span className="h-5 w-5 rounded-md border border-white/20 shadow-inner" style={{ backgroundColor: normalized }} />
        <span className="font-mono text-[11px] uppercase text-muted-foreground">{normalized}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[320] w-[290px] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl ring-1 ring-black/10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Color</p>
              <p className="text-[11px] text-muted-foreground">Choose a color for this gallery label.</p>
            </div>
            <button type="button" onClick={() => void pickFromScreen()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:border-blue-500/50 hover:bg-muted/40" title="Pick a color from your screen">
              <Pipette className="h-3.5 w-3.5 text-blue-500" />
              Eyedropper
            </button>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-border bg-background/70 p-1">
            {(["HEX", "RGB", "HSL"] as const).map((item) => (
              <button key={item} type="button" onClick={() => { setFormat(item); if (item === "HEX") setDraft(normalized); if (item === "RGB") setDraft(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`); if (item === "HSL") setDraft(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`) }} className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${format === item ? "bg-blue-500/15 text-blue-400" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-10 w-10 shrink-0 rounded-lg border border-white/15 shadow-inner" style={{ backgroundColor: normalized }} />
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { commit(draft); setOpen(false) } }} onBlur={() => commit(draft)} placeholder={format === "HEX" ? "#3b82f6" : format === "RGB" ? "rgb(59, 130, 246)" : "hsl(217, 91%, 60%)"} className="font-mono text-xs" />
            <input type="color" value={normalized} aria-label={`${ariaLabel} native color picker`} onChange={(event) => commit(event.target.value)} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1" />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2">
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-4 w-4 rounded border border-white/20 shadow-inner" style={{ backgroundColor: normalized }} />
              Current
            </span>
            <span className="font-mono text-[11px] text-foreground">{normalized}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function GalleryFilterDropdown({
  label,
  options,
  value,
  onChange,
  ariaLabel,
  optionColors,
  optionKind,
}: {
  label: string
  options: readonly string[]
  value: string[]
  onChange: (value: string[]) => void
  ariaLabel: string
  optionColors?: Record<string, string>
  optionKind?: "type" | "category" | "tag"
}) {
  const allSelected = options.length > 0 && value.length === options.length

  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          className="h-10 w-[132px] shrink-0 justify-between gap-2 px-3 text-sm font-medium"
        >
          <span>{label}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="z-[120] w-[220px] rounded-xl border border-border/80 bg-popover p-1.5 shadow-xl">
        <DropdownMenuItem
          onSelect={(event) => event.preventDefault()}
          onClick={() => onChange(allSelected ? [] : [...options])}
          className="gap-2 rounded-lg px-3 py-2.5"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {allSelected && <Check className="h-4 w-4 text-blue-500" />}
          </span>
          <span className="font-medium">All {label === "Type" ? "Types" : `${label}s`}</span>
        </DropdownMenuItem>
        <div className="my-1 h-px bg-border" />
        {options.map((option) => {
          const checked = value.includes(option)
          return (
            <DropdownMenuItem
              key={option}
              onSelect={(event) => event.preventDefault()}
              onClick={() => toggle(option)}
              className={[
                "gap-2 rounded-lg px-3 py-2.5",
                checked ? "bg-blue-500/10 text-blue-400 focus:bg-blue-500/10 focus:text-blue-400" : "",
              ].join(" ")}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {checked && <Check className="h-4 w-4 text-blue-500" />}
              </span>
              {optionKind === "type" ? (
                option === "Images" ? <ImageIcon className="h-4 w-4 shrink-0" /> : <Video className="h-4 w-4 shrink-0" />
              ) : (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: optionColors?.[option] ?? "#3b82f6" }}
                />
              )}
              <span className="truncate">{option}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function makePendingFromMedia(
  media: GalleryMedia,
): PendingMedia {
  return {
    ...media,
    previewUrl: media.url,
  }
}

export default function Gallery() {
  const [user, setUser] =
    useState<User | null>(null)

  const [items, setItems] =
    useState<GalleryItem[]>([])

  const [loading, setLoading] =
    useState(true)

  const [canManageGallery, setCanManageGallery] =
    useState(false)

  const [categoryFilters, setCategoryFilters] =
    useState<string[]>([])

  const [mediaFilters, setMediaFilters] =
    useState<string[]>([])

  const [tagFilters, setTagFilters] =
    useState<string[]>([])

  const [galleryCategories, setGalleryCategories] =
    useState<string[]>([...DEFAULT_GALLERY_CATEGORIES])

  const [galleryTags, setGalleryTags] =
    useState<string[]>([...DEFAULT_GALLERY_TAGS])

  const [galleryTagCategories, setGalleryTagCategories] =
    useState<Record<string, string[]>>({
      Community: [...DEFAULT_GALLERY_TAGS],
      Fleet: [...DEFAULT_GALLERY_TAGS],
    })

  const [galleryCategoryColors, setGalleryCategoryColors] =
    useState<Record<string, string>>(DEFAULT_GALLERY_CATEGORY_COLORS)

  const [galleryTagColors, setGalleryTagColors] =
    useState<Record<string, string>>(DEFAULT_GALLERY_TAG_COLORS)

  const [showTaxonomyModal, setShowTaxonomyModal] =
    useState(false)

  const [newGalleryCategory, setNewGalleryCategory] =
    useState("")

  const [newGalleryTag, setNewGalleryTag] =
    useState("")

  const [newGalleryTagCategories, setNewGalleryTagCategories] =
    useState<string[]>(["Community"])

  const [newGalleryCategoryColor, setNewGalleryCategoryColor] =
    useState("#3b82f6")

  const [newGalleryTagColor, setNewGalleryTagColor] =
    useState("#3b82f6")

  const [showModal, setShowModal] =
    useState(false)

  const [editingItem, setEditingItem] =
    useState<GalleryItem | null>(null)

  const [viewer, setViewer] =
    useState<{
      item: GalleryItem
      index: number
    } | null>(null)

  const [infoItem, setInfoItem] =
    useState<GalleryItem | null>(null)

  const [title, setTitle] =
    useState("")

  const [description, setDescription] =
    useState("")

  const [category, setCategory] =
    useState<GalleryCategory>("Community")

  const [tags, setTags] =
    useState<GalleryTag[]>([])

  const [pendingMedia, setPendingMedia] =
    useState<PendingMedia[]>([])

  const [urlInput, setUrlInput] =
    useState("")

  const [urlType, setUrlType] =
    useState<GalleryMediaType>("image")

  const [thumbnailInput, setThumbnailInput] =
    useState("")

  const [isDragging, setIsDragging] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [uploadProgress, setUploadProgress] =
    useState<number | null>(null)

  const [savingStage, setSavingStage] =
    useState<"upload" | "import" | "save" | null>(null)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] =
    useState<GalleryItem | null>(null)

  const [taxonomyEdit, setTaxonomyEdit] =
    useState<{ type: "category" | "tag"; value: string } | null>(null)
  const [taxonomyEditName, setTaxonomyEditName] = useState("")
  const [taxonomyEditColor, setTaxonomyEditColor] = useState("#3b82f6")
  const [taxonomyEditCategories, setTaxonomyEditCategories] = useState<string[]>([])
  const [taxonomyBusy, setTaxonomyBusy] = useState(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const overlayOpen =
      showModal ||
      showTaxonomyModal ||
      Boolean(viewer) ||
      Boolean(infoItem) ||
      Boolean(deleteTarget)

    if (!overlayOpen) return

    const body = document.body
    const html = document.documentElement
    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverflow = html.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth

    body.style.overflow = "hidden"
    html.style.overflow = "hidden"

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      body.style.overflow = previousBodyOverflow
      html.style.overflow = previousHtmlOverflow
      body.style.paddingRight = previousBodyPaddingRight
    }
  }, [showModal, showTaxonomyModal, viewer, infoItem, deleteTarget, taxonomyEdit])

  useEffect(() => {
    if (!showTaxonomyModal && !taxonomyEdit) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (taxonomyEdit) {
        setTaxonomyEdit(null)
        setShowTaxonomyModal(true)
        return
      }
      setShowTaxonomyModal(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showTaxonomyModal, taxonomyEdit])

  const dragDepthRef =
    useRef(0)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [
          session,
          galleryResponse,
          permissionResponse,
          optionsResponse,
        ] = await Promise.all([
          getSession(),
          fetch("/api/gallery", {
            credentials: "include",
          }),
          fetch(
            "/api/auth/check?permission=gallery",
            {
              credentials: "include",
            },
          ),
          fetch("/api/gallery/options", {
            credentials: "include",
          }),
        ])

        if (!active) {
          return
        }

        setUser(session)

        if (!galleryResponse.ok) {
          throw new Error(
            "Failed to load gallery.",
          )
        }

        const data =
          await galleryResponse.json()

        setItems(
          Array.isArray(data.items)
            ? data.items
            : [],
        )

        setCanManageGallery(
          permissionResponse.ok,
        )

        if (optionsResponse.ok) {
          const optionsData = await optionsResponse.json()
          if (Array.isArray(optionsData.categories)) {
            setGalleryCategories(optionsData.categories.map(String).filter(Boolean))
          }
          if (Array.isArray(optionsData.tags)) {
            setGalleryTags(optionsData.tags.map(String).filter(Boolean))
          }
          if (optionsData.tagCategories && typeof optionsData.tagCategories === "object") {
            setGalleryTagCategories(optionsData.tagCategories)
          }
          if (optionsData.categoryColors && typeof optionsData.categoryColors === "object") {
            setGalleryCategoryColors(optionsData.categoryColors)
          }
          if (optionsData.tagColors && typeof optionsData.tagColors === "object") {
            setGalleryTagColors(optionsData.tagColors)
          }
        }
      } catch (error) {
        console.error(error)

        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load gallery.",
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const availableFilterTags = useMemo(() => {
    if (categoryFilters.length === 0) return galleryTags
    return Array.from(new Set(categoryFilters.flatMap((name) => galleryTagCategories[name] ?? [])))
  }, [categoryFilters, galleryTagCategories, galleryTags])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        categoryFilters.length === 0 ||
        categoryFilters.includes(item.category ?? "Community")

      const matchesMedia =
        mediaFilters.length === 0 ||
        item.media.some((media) =>
          mediaFilters.some((filter) =>
            filter === "Images"
              ? isImageMedia(media)
              : isVideoMedia(media),
          ),
        )

      const matchesTags =
        tagFilters.length === 0 ||
        tagFilters.some((tag) =>
          (item.tags ?? []).includes(tag),
        )

      return matchesCategory && matchesMedia && matchesTags
    })
  }, [categoryFilters, items, mediaFilters, tagFilters])

  const visibleMediaCount = useMemo(() => {
    return filteredItems.reduce((count, item) => {
      if (mediaFilters.length === 0) {
        return count + item.media.length
      }

      return (
        count +
        item.media.filter((media) =>
          mediaFilters.some((filter) =>
            filter === "Images"
              ? isImageMedia(media)
              : isVideoMedia(media),
          ),
        ).length
      )
    }, 0)
  }, [filteredItems, mediaFilters])

  function getVisibleMedia(item: GalleryItem) {
    if (mediaFilters.length === 0) {
      return item.media
    }

    return item.media.filter((media) =>
      mediaFilters.some((filter) =>
        filter === "Images"
          ? isImageMedia(media)
          : isVideoMedia(media),
      ),
    )
  }

  async function addGalleryOption(type: "category" | "tag", color?: string) {
    const rawValue = type === "category" ? newGalleryCategory : newGalleryTag
    const value = rawValue.trim()

    if (!value) {
      toast.error(`Enter a ${type} name.`)
      return
    }

    try {
      const response = await fetch("/api/gallery/options", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          value,
          color: color || undefined,
          categories: type === "tag" ? newGalleryTagCategories : undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Failed to create ${type}.`)

      if (type === "category") {
        setGalleryCategories(Array.isArray(data.categories) ? data.categories : (current => [...current, value]))
        setNewGalleryCategory("")
        setNewGalleryCategoryColor("#3b82f6")
      } else {
        setGalleryTags(Array.isArray(data.tags) ? data.tags : (current => [...current, value]))
        setNewGalleryTag("")
        setNewGalleryTagColor("#3b82f6")
      }
      if (data.categoryColors && typeof data.categoryColors === "object") setGalleryCategoryColors(data.categoryColors)
      if (data.tagColors && typeof data.tagColors === "object") setGalleryTagColors(data.tagColors)
      if (data.tagCategories && typeof data.tagCategories === "object") setGalleryTagCategories(data.tagCategories)

      toast.success(`${type === "category" ? "Category" : "Tag"} created.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to create ${type}.`)
    }
  }

  function beginTaxonomyEdit(type: "category" | "tag", value: string) {
    // Close the management modal before opening the edit modal so the edit
    // dialog can never render behind its parent/backdrop.
    setShowTaxonomyModal(false)
    setTaxonomyEdit({ type, value })
    setTaxonomyEditName(value)
    setTaxonomyEditColor(
      type === "category"
        ? galleryCategoryColors[value] ?? "#3b82f6"
        : galleryTagColors[value] ?? "#3b82f6",
    )
    if (type === "tag") {
      const assigned = galleryCategories.filter((categoryName) =>
        (galleryTagCategories[categoryName] ?? []).includes(value),
      )
      setTaxonomyEditCategories(assigned)
    } else {
      setTaxonomyEditCategories([])
    }
  }

  async function saveTaxonomyEdit() {
    if (!taxonomyEdit) return
    const newValue = taxonomyEditName.trim()
    if (!newValue) {
      toast.error("Enter a name.")
      return
    }

    setTaxonomyBusy(true)
    try {
      const response = await fetch("/api/gallery/options", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: taxonomyEdit.type,
          value: taxonomyEdit.value,
          newValue,
          color: taxonomyEditColor,
          categories: taxonomyEdit.type === "tag" ? taxonomyEditCategories : undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to update gallery option.")

      if (Array.isArray(data.categories)) setGalleryCategories(data.categories)
      if (Array.isArray(data.tags)) setGalleryTags(data.tags)
      if (data.categoryColors && typeof data.categoryColors === "object") setGalleryCategoryColors(data.categoryColors)
      if (data.tagColors && typeof data.tagColors === "object") setGalleryTagColors(data.tagColors)
      if (data.tagCategories && typeof data.tagCategories === "object") setGalleryTagCategories(data.tagCategories)

      if (taxonomyEdit.type === "category" && categoryFilters.includes(taxonomyEdit.value)) {
        setCategoryFilters((current) => current.map((item) => item === taxonomyEdit.value ? newValue : item))
      }
      if (taxonomyEdit.type === "tag" && tagFilters.includes(taxonomyEdit.value)) {
        setTagFilters((current) => current.map((item) => item === taxonomyEdit.value ? newValue : item))
      }

      const editedType = taxonomyEdit.type
      setTaxonomyEdit(null)
      setShowTaxonomyModal(true)
      toast.success(`${editedType === "category" ? "Category" : "Tag"} updated.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update gallery option.")
    } finally {
      setTaxonomyBusy(false)
    }
  }

  async function deleteTaxonomyOption(type: "category" | "tag", value: string) {
    if (!window.confirm(`Delete ${type === "category" ? "category" : "tag"} \"${value}\"?`)) return

    setTaxonomyBusy(true)
    try {
      const response = await fetch("/api/gallery/options", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to delete gallery option.")

      if (Array.isArray(data.categories)) setGalleryCategories(data.categories)
      if (Array.isArray(data.tags)) setGalleryTags(data.tags)
      if (data.categoryColors && typeof data.categoryColors === "object") setGalleryCategoryColors(data.categoryColors)
      if (data.tagColors && typeof data.tagColors === "object") setGalleryTagColors(data.tagColors)
      if (data.tagCategories && typeof data.tagCategories === "object") setGalleryTagCategories(data.tagCategories)
      setCategoryFilters((current) => current.filter((item) => item !== value))
      setTagFilters((current) => current.filter((item) => item !== value))
      toast.success(`${type === "category" ? "Category" : "Tag"} deleted.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete gallery option.")
    } finally {
      setTaxonomyBusy(false)
    }
  }

  function resetForm() {
    for (const media of pendingMedia) {
      if (
        media.file &&
        media.previewUrl?.startsWith(
          "blob:",
        )
      ) {
        URL.revokeObjectURL(
          media.previewUrl,
        )
      }
    }

    setTitle("")
    setDescription("")
    setCategory(galleryCategories[0] ?? "Community")
    setTags([])
    setPendingMedia([])
    setUrlInput("")
    setUrlType("image")
    setThumbnailInput("")
    setEditingItem(null)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setShowModal(false)
    resetForm()
  }

  function openAdd() {
    resetForm()
    setShowModal(true)
  }

  function openEdit(
    item: GalleryItem,
  ) {
    setEditingItem(item)
    setTitle(item.title)
    setDescription(item.description)
    setCategory(item.category ?? "Community")
    setTags(item.tags ?? [])
    setPendingMedia(
      item.media.map(
        makePendingFromMedia,
      ),
    )
    setUrlInput("")
    setThumbnailInput("")
    setShowModal(true)
  }

  function removePendingMedia(
    id: string,
  ) {
    setPendingMedia((current) => {
      const media = current.find(
        (item) => item.id === id,
      )

      if (
        media?.file &&
        media.previewUrl?.startsWith(
          "blob:",
        )
      ) {
        URL.revokeObjectURL(
          media.previewUrl,
        )
      }

      return current.filter(
        (item) => item.id !== id,
      )
    })
  }

  function addExternalUrl() {
    const url = urlInput.trim()

    if (!url) {
      toast.error("Enter a media URL.")
      return
    }

    try {
      const parsed = new URL(url)

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol")
      }
    } catch {
      toast.error("Enter a valid HTTP or HTTPS URL.")
      return
    }

    const detectedEmbed = getVideoEmbedUrl(url)
    const detectedDirectType = getDirectMediaType(url)
    const type: GalleryMediaType =
      detectedEmbed
        ? "video"
        : detectedDirectType || urlType

    const thumbnailUrl =
      type === "video"
        ? thumbnailInput.trim() || getYouTubeThumbnail(url)
        : ""

    setPendingMedia((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        url,
        thumbnailUrl,
        source: "url",
      },
    ])

    setUrlInput("")
    setUrlType("image")
    setThumbnailInput("")
  }

  function handleFiles(
    files: FileList | null,
  ) {
    if (!files?.length) return

    const next: PendingMedia[] = []

    for (const file of Array.from(files)) {
      const type = getFileMediaType(file)

      if (!type) continue

      next.push({
        id: crypto.randomUUID(),
        type,
        url: "",
        thumbnailUrl: "",
        source: "upload",
        previewUrl: URL.createObjectURL(file),
        file,
      })
    }

    if (!next.length) {
      toast.error("Select image or video files.")
      return
    }

    setPendingMedia((current) => [...current, ...next])
  }

  function handleDragEnter(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()
    event.stopPropagation()

    if (
      !event.dataTransfer.types.includes(
        "Files",
      )
    ) {
      return
    }

    dragDepthRef.current += 1
    setIsDragging(true)
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()
    event.stopPropagation()

    if (
      event.dataTransfer.types.includes(
        "Files",
      )
    ) {
      event.dataTransfer.dropEffect =
        "copy"

      setIsDragging(true)
    }
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()
    event.stopPropagation()

    if (
      !event.dataTransfer.types.includes(
        "Files",
      )
    ) {
      return
    }

    dragDepthRef.current = Math.max(
      0,
      dragDepthRef.current - 1,
    )

    if (
      dragDepthRef.current === 0
    ) {
      setIsDragging(false)
    }
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()
    event.stopPropagation()

    dragDepthRef.current = 0
    setIsDragging(false)

    if (
      event.dataTransfer.files
        ?.length
    ) {
      handleFiles(
        event.dataTransfer.files,
      )
    }
  }

  async function uploadPendingFiles() {
    const uploadItems = pendingMedia.filter((media) => media.source === "upload" && media.file)
    if (!uploadItems.length) return []

    const uploaded: GalleryMedia[] = []

    setSavingStage("upload")

    for (let index = 0; index < uploadItems.length; index += 1) {
      const item = uploadItems[index]
      const file = item.file as File

      setPendingMedia((current) => current.map((media) => media.id === item.id ? { ...media, processing: true, progress: 0, error: undefined } : media))

      const formData = new FormData()
      formData.append("files", file, file.name)
      formData.append("title", title.trim() || "gallery")

      const result = await new Promise<{ status: number; raw: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", "/api/gallery/upload")
        xhr.withCredentials = true
        xhr.timeout = 15 * 60 * 1000
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          const progress = Math.min(100, Math.round((event.loaded / event.total) * 100))
          setUploadProgress(progress)
          setPendingMedia((current) => current.map((media) => media.id === item.id ? { ...media, progress } : media))
        }
        xhr.onload = () => resolve({ status: xhr.status, raw: xhr.responseText || "" })
        xhr.onerror = () => reject(new Error("Gallery upload failed. Check the server logs and try again."))
        xhr.ontimeout = () => reject(new Error("Gallery upload timed out after 15 minutes."))
        xhr.onabort = () => reject(new Error("Gallery upload was cancelled."))
        xhr.send(formData)
      })

      let data: { success?: boolean; items?: GalleryMedia[]; error?: string } = {}
      try { data = result.raw ? JSON.parse(result.raw) : {} } catch { data = {} }

      if (result.status < 200 || result.status >= 300) {
        const message = result.status === 404
          ? "Gallery upload API is not deployed. Make sure the updated app.ts is deployed and the server has been restarted."
          : result.status === 401
            ? "Your session has expired. Sign in again."
            : result.status === 403
              ? "You do not have permission to upload gallery media."
              : data.error || `Gallery upload failed (${result.status}).`
        setPendingMedia((current) => current.map((media) => media.id === item.id ? { ...media, processing: false, error: message } : media))
        throw new Error(message)
      }

      if (!Array.isArray(data.items) || !data.items[0]) {
        const message = "Gallery upload returned an invalid response."
        setPendingMedia((current) => current.map((media) => media.id === item.id ? { ...media, processing: false, error: message } : media))
        throw new Error(message)
      }

      uploaded.push(data.items[0])
      setPendingMedia((current) => current.map((media) => media.id === item.id ? { ...media, processing: false, progress: 100 } : media))
      setUploadProgress(index === uploadItems.length - 1 ? 100 : 0)
    }

    return uploaded
  }

  // Description is intentionally optional; only title and media are required.
  async function saveGallery() {
    const cleanTitle =
      title.trim()

    if (!cleanTitle) {
      toast.error(
        "Enter a gallery title.",
      )
      return
    }

    if (!pendingMedia.length) {
      toast.error(
        "Add at least one image or video.",
      )
      return
    }

    setSaving(true)
    setSavingStage("save")
    setUploadProgress(null)

    try {
      const uploaded =
        await uploadPendingFiles()

      let uploadIndex = 0

      const media: GalleryMedia[] =
        []

      for (const item of pendingMedia) {
        if (item.file) {
          const uploadedMedia =
            uploaded[uploadIndex]

          if (!uploadedMedia) {
            throw new Error(
              "One or more new media files failed to upload.",
            )
          }

          media.push(
            uploadedMedia,
          )
          uploadIndex += 1
          continue
        }

        if (item.source === "url") {
          setSavingStage("import")
          setPendingMedia((current) => current.map((mediaItem) => mediaItem.id === item.id ? { ...mediaItem, processing: true, progress: 0, error: undefined } : mediaItem))

          let simulatedProgress = 4
          const progressTimer = window.setInterval(() => {
            simulatedProgress = Math.min(92, simulatedProgress + Math.floor(Math.random() * 9) + 4)
            setPendingMedia((current) => current.map((mediaItem) => mediaItem.id === item.id ? { ...mediaItem, progress: simulatedProgress } : mediaItem))
          }, 450)

          try {
            const importResponse = await fetch("/api/gallery/import-url", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: item.url,
                type: item.type,
                title: cleanTitle,
                index: media.length,
              }),
            })
            const importData = await importResponse.json().catch(() => ({}))
            if (!importResponse.ok || !importData.item) {
              throw new Error(importData.error || "Failed to import the media URL.")
            }
            media.push(importData.item as GalleryMedia)
            setPendingMedia((current) => current.map((mediaItem) => mediaItem.id === item.id ? { ...mediaItem, processing: false, progress: 100 } : mediaItem))
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to import the media URL."
            setPendingMedia((current) => current.map((mediaItem) => mediaItem.id === item.id ? { ...mediaItem, processing: false, error: message } : mediaItem))
            throw error
          } finally {
            window.clearInterval(progressTimer)
          }

          continue
        }

        media.push({
          id: item.id,
          type: item.type,
          url: item.url,
          thumbnailUrl:
            item.thumbnailUrl ||
            "",
          source: item.source,
          storageId:
            item.storageId,
        })
      }

      setSavingStage("save")
      setUploadProgress(null)

      const response =
        await fetch(
          editingItem
            ? `/api/gallery/${editingItem.id}`
            : "/api/gallery",
          {
            method: editingItem
              ? "PUT"
              : "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title: cleanTitle,
              description,
              category,
              tags,
              media,
            }),
          },
        )

      const data =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save gallery.",
        )
      }

      if (!data.item) {
        throw new Error(
          "The server did not return the saved gallery item.",
        )
      }

      if (editingItem) {
        setItems((current) =>
          current.map((item) =>
            item.id ===
            editingItem.id
              ? data.item
              : item,
          ),
        )

        toast.success(
          "Gallery updated.",
        )
      } else {
        setItems((current) => [
          data.item,
          ...current,
        ])

        toast.success(
          "Gallery item created.",
        )
      }

      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error(error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save gallery.",
      )
    } finally {
      setSaving(false)
      setSavingStage(null)
      setUploadProgress(null)
    }
  }

  function requestDeleteGallery(
    item: GalleryItem,
  ) {
    if (deletingId) {
      return
    }

    setDeleteTarget(item)
  }

  function closeDeleteDialog() {
    if (deletingId) {
      return
    }

    setDeleteTarget(null)
  }

  async function deleteGallery(
    item: GalleryItem,
  ) {
    setDeletingId(item.id)

    try {
      const response =
        await fetch(
          `/api/gallery/${item.id}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        )

      const data =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete gallery item.",
        )
      }

      setItems((current) =>
        current.filter(
          (entry) =>
            entry.id !== item.id,
        ),
      )

      setViewer(null)
      setDeleteTarget(null)

      toast.success(
        "Gallery item deleted.",
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete gallery item.",
      )
    } finally {
      setDeletingId(null)
    }
  }

  function openInfo(item: GalleryItem) {
    setInfoItem(item)
  }

  function closeInfo() {
    setInfoItem(null)
  }

  function openViewer(
    item: GalleryItem,
    media: GalleryMedia,
  ) {
    const mediaList =
      getVisibleMedia(item)

    const index =
      mediaList.findIndex(
        (entry) =>
          entry.id === media.id,
      )

    setViewer({
      item: {
        ...item,
        media: mediaList,
      },
      index: Math.max(0, index),
    })
  }

  function closeViewer() {
    setViewer(null)
  }

  function showPrevious() {
    setViewer((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        index:
          current.index <= 0
            ? current.item.media
                .length - 1
            : current.index - 1,
      }
    })
  }

  function showNext() {
    setViewer((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        index:
          current.index >=
          current.item.media.length - 1
            ? 0
            : current.index + 1,
      }
    })
  }

  useEffect(() => {
    if (!viewer) {
      return
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        if (infoItem) {
          closeInfo()
          return
        }

        closeViewer()
      }

      if (event.key === "ArrowLeft") {
        showPrevious()
      }

      if (event.key === "ArrowRight") {
        showNext()
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [infoItem, viewer])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-7">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
                <Images className="h-4 w-4" />
                COMMUNITY
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Gallery
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                View photos and videos from the
                Metro Police Department community.
              </p>
            </div>

            {canManageGallery && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="default" className="shrink-0 bg-white text-black hover:bg-white/90" onClick={() => setShowTaxonomyModal(true)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Add Tags & Categories
                </Button>
                <Button type="button" className="shrink-0" onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Media
                </Button>
              </div>
            )}
          </div>

          <section className="h-auto min-h-0 overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Gallery
                </h2>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  {visibleMediaCount}{" "}
                  {visibleMediaCount === 1
                    ? "media item"
                    : "media items"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <GalleryFilterDropdown
                  label="Type"
                  options={DEFAULT_GALLERY_MEDIA_FILTERS}
                  value={mediaFilters}
                  ariaLabel="Filter by media type"
                  onChange={setMediaFilters}
                  optionKind="type"
                />

                <GalleryFilterDropdown
                  label="Category"
                  options={galleryCategories}
                  value={categoryFilters}
                  ariaLabel="Filter by category"
                  onChange={setCategoryFilters}
                  optionKind="category"
                  optionColors={galleryCategoryColors}
                />

                <GalleryFilterDropdown
                  label="Tags"
                  options={availableFilterTags}
                  value={tagFilters}
                  ariaLabel="Filter by tags"
                  onChange={setTagFilters}
                  optionKind="tag"
                  optionColors={galleryTagColors}
                />

                {(categoryFilters.length > 0 || mediaFilters.length > 0 || tagFilters.length > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-3 text-xs text-muted-foreground hover:text-blue-400"
                    onClick={() => {
                      setCategoryFilters([])
                      setMediaFilters([])
                      setTagFilters([])
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="px-4 py-14 text-center">
                <Images className="mx-auto h-9 w-9 animate-pulse text-muted-foreground" />

                <p className="mt-3 text-sm font-medium">
                  Loading gallery...
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Please wait while the gallery
                  is loaded.
                </p>
              </div>
            ) : filteredItems.length ===
              0 ? (
              <div className="px-4 py-14 text-center">
                <ImageIcon className="mx-auto h-9 w-9 text-muted-foreground" />

                <p className="mt-3 text-sm font-medium">
                  No media available
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  There are no gallery items
                  matching this filter.
                </p>

                {canManageGallery && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={openAdd}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Media
                  </Button>
                )}
              </div>
            ) : (
              <div className="h-auto p-3 sm:p-4">
                  <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
                  {filteredItems.map(
                    (item) => {
                      const mediaList =
                        getVisibleMedia(
                          item,
                        )

                      return (
                        <article
                          key={item.id}
                          className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-border/70 bg-background/60 shadow-sm transition-all hover:border-blue-500/40 hover:shadow-md"
                        >
                          <GalleryMediaCollage
                            media={mediaList}
                            title={item.title}
                            onClick={(media) =>
                              openViewer(item, media)
                            }
                          />

                          <div className="border-t border-border/70 p-3">
                            <div className="relative">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => openInfo(item)}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault()
                                    openInfo(item)
                                  }
                                }}
                                className="group/info w-full cursor-pointer rounded-lg px-1 py-1 pr-16 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                aria-label={`View information for ${item.title}`}
                              >
                                <div className="mb-1.5 flex flex-col items-start gap-1.5">
                                  <span
                                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{
                                      borderColor: `${galleryCategoryColors[item.category ?? "Community"] ?? "#3b82f6"}55`,
                                      backgroundColor: `${galleryCategoryColors[item.category ?? "Community"] ?? "#3b82f6"}1a`,
                                      color: galleryCategoryColors[item.category ?? "Community"] ?? "#3b82f6",
                                    }}
                                  >
                                    {item.category ?? "Community"}
                                  </span>

                                  {(item.tags ?? []).length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {(item.tags ?? []).map((tag) => (
                                        <span
                                          key={`${item.id}-tag-${tag}`}
                                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                                          style={{
                                            borderColor: `${galleryTagColors[tag] ?? "#3b82f6"}55`,
                                            backgroundColor: `${galleryTagColors[tag] ?? "#3b82f6"}1a`,
                                            color: galleryTagColors[tag] ?? "#3b82f6",
                                          }}
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <h3 className="line-clamp-2 w-[35ch] max-w-full whitespace-pre-line text-sm font-semibold">
                                  {item.title}
                                </h3>

                                {item.description && (
                                  <div className="mt-1 w-[35ch] max-w-full">
                                    <p className="line-clamp-3 w-[35ch] max-w-full whitespace-pre-line text-xs leading-5 text-muted-foreground">
                                      {item.description}
                                    </p>

                                    {getWrappedLineCount(item.description, 35) > 3 && (
                                      <button
                                        type="button"
                                        className="mt-0.5 block text-[11px] font-medium text-blue-500 transition-colors hover:text-blue-400"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          openInfo(item)
                                        }}
                                      >
                                        Show more...
                                      </button>
                                    )}
                                  </div>
                                )}

                                <p className="mt-2 truncate whitespace-nowrap text-[10px] text-muted-foreground">
                                  {mediaList.length}{" "}
                                  {mediaList.length === 1
                                    ? "item"
                                    : "items"}
                                  {item.createdAt
                                    ? ` · ${formatDate(item.createdAt)}`
                                    : ""}
                                </p>
                              </div>

                              {canManageGallery && (
                                <div
                                  className="absolute right-0 top-0 z-10 flex shrink-0 items-center gap-1"
                                  onClick={(event) =>
                                    event.stopPropagation()
                                  }
                                  onKeyDown={(event) =>
                                    event.stopPropagation()
                                  }
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      openEdit(item)
                                    }
                                    aria-label={`Edit ${item.title}`}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    disabled={
                                      deletingId === item.id
                                    }
                                    onClick={() =>
                                      requestDeleteGallery(item)
                                    }
                                    aria-label={`Delete ${item.title}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    },
                  )}
                  </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <span className="shrink-0">
                  Select an image or video to view
                  it full size.
                </span>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {galleryCategories.map((entry) => (
                    <span key={`legend-${entry}`} className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: galleryCategoryColors[entry] ?? "#3b82f6" }}
                      />
                      <span>{entry}</span>
                    </span>
                  ))}
                </div>
              </div>

              <span className="shrink-0 font-medium text-foreground/70">
                {filteredItems.length}{" "}
                {filteredItems.length === 1
                  ? "gallery entry"
                  : "gallery entries"}
              </span>
            </div>
          </section>

          {canManageGallery && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-500">
                    <Upload className="h-3.5 w-3.5" />
                    MANAGEMENT
                  </div>

                  <h2 className="text-lg font-semibold">
                    Gallery Management
                  </h2>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Add, edit, and remove community
                    media.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={() => setShowTaxonomyModal(true)}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Add Tags & Categories
                  </Button>
                  <Button type="button" onClick={openAdd}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Media
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <ManagementStat
                  icon={
                    <Images className="h-4 w-4" />
                  }
                  label="Entries"
                  value={String(
                    items.length,
                  )}
                />

                <ManagementStat
                  icon={
                    <ImageIcon className="h-4 w-4" />
                  }
                  label="Images"
                  value={String(
                    items.reduce(
                      (
                        count,
                        item,
                      ) =>
                        count +
                        item.media.filter(
                          isImageMedia,
                        ).length,
                      0,
                    ),
                  )}
                />

                <ManagementStat
                  icon={
                    <Video className="h-4 w-4" />
                  }
                  label="Videos"
                  value={String(
                    items.reduce(
                      (
                        count,
                        item,
                      ) =>
                        count +
                        item.media.filter(
                          isVideoMedia,
                        ).length,
                      0,
                    ),
                  )}
                />
              </div>
            </section>
          )}
        </div>

        <Footer />
      </main>

      {infoItem && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center overscroll-contain bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              closeInfo()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-info-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
              <div className="min-w-0 pr-3">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                  Gallery
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2
                    id="gallery-info-title"
                    className="min-w-0 text-lg font-semibold"
                  >
                    {infoItem.title}
                  </h2>

                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      infoItem.category === "Fleet"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                    ].join(" ")}
                  >
                    {infoItem.category ?? "Community"}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={closeInfo}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
              <div className="px-5 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Description
                  </p>

                  {infoItem.description ? (
                    <div className="mt-2 rounded-xl border border-border/70 bg-background/50 p-4">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                        {infoItem.description}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No description provided.
                    </p>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ManagementStat
                    icon={
                      <Images className="h-4 w-4" />
                    }
                    label="Media"
                    value={`${infoItem.media.length} ${
                      infoItem.media.length === 1
                        ? "item"
                        : "items"
                    }`}
                  />

                  <ManagementStat
                    icon={
                      <ImageIcon className="h-4 w-4" />
                    }
                    label="Images"
                    value={String(
                      infoItem.media.filter(
                        isImageMedia,
                      ).length,
                    )}
                  />

                  <ManagementStat
                    icon={
                      <Video className="h-4 w-4" />
                    }
                    label="Videos"
                    value={String(
                      infoItem.media.filter(
                        isVideoMedia,
                      ).length,
                    )}
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  {infoItem.createdAt && (
                    <span>
                      Added{" "}
                      {formatDate(
                        infoItem.createdAt,
                      )}
                    </span>
                  )}

                  {infoItem.updatedAt &&
                    infoItem.updatedAt !==
                      infoItem.createdAt && (
                      <span>
                        Updated{" "}
                        {formatDate(
                          infoItem.updatedAt,
                        )}
                      </span>
                    )}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Media
                    </p>

                    <span className="text-xs text-muted-foreground">
                      Click an item to view it
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {infoItem.media.map(
                      (media) => (
                        <div
                          key={media.id}
                          className="overflow-hidden rounded-xl border border-border/70 bg-background/50"
                        >
                          <GalleryMediaCard
                            media={media}
                            title={
                              infoItem.title
                            }
                            onClick={() => {
                              closeInfo()
                              openViewer(
                                infoItem,
                                media,
                              )
                            }}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-3">
              {canManageGallery && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    closeInfo()
                    openEdit(infoItem)
                  }}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}

              <Button
                type="button"
                onClick={closeInfo}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overscroll-contain bg-black/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              closeDeleteDialog()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-gallery-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2
                    id="delete-gallery-title"
                    className="text-base font-semibold"
                  >
                    Delete gallery entry?
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Are you sure you want to
                    delete{" "}
                    <span className="font-medium text-foreground">
                      {deleteTarget.title}
                    </span>
                    ? This will permanently
                    remove the gallery entry and
                    any uploaded media stored with
                    it.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={
                  closeDeleteDialog
                }
                disabled={
                  deletingId ===
                  deleteTarget.id
                }
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                disabled={
                  deletingId ===
                  deleteTarget.id
                }
                onClick={() =>
                  void deleteGallery(
                    deleteTarget,
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />

                {deletingId ===
                deleteTarget.id
                  ? "Deleting..."
                  : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTaxonomyModal && canManageGallery && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setShowTaxonomyModal(false)
            }}
          >
            <DropdownProvider>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="gallery-taxonomy-title"
              className="relative z-[9999] flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
            <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-500">
                  <Settings2 className="h-3.5 w-3.5" />
                  GALLERY SETTINGS
                </div>
                <h2 id="gallery-taxonomy-title" className="text-lg font-semibold">Add Tags & Categories</h2>
                <p className="mt-1 text-xs text-muted-foreground">Create categories and sub-tags and choose the color shown throughout the gallery.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTaxonomyModal(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="space-y-5">
                <div className="rounded-xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Categories</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Main gallery categories such as Community and Fleet.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input value={newGalleryCategory} onChange={(event) => setNewGalleryCategory(event.target.value)} placeholder="Create category" onKeyDown={(event) => { if (event.key === "Enter") void addGalleryOption("category", newGalleryCategoryColor) }} />
                    <GalleryColorPicker value={newGalleryCategoryColor} onChange={setNewGalleryCategoryColor} ariaLabel="New category color" />
                    <Button type="button" onClick={() => void addGalleryOption("category", newGalleryCategoryColor)}><Plus className="mr-2 h-4 w-4" />Create</Button>
                  </div>
                  <div className="mt-3 divide-y divide-border/60 rounded-lg border border-border/60">
                    {galleryCategories.map((entry) => (
                      <div key={entry} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            borderColor: `${galleryCategoryColors[entry] ?? "#3b82f6"}55`,
                            backgroundColor: `${galleryCategoryColors[entry] ?? "#3b82f6"}1a`,
                            color: galleryCategoryColors[entry] ?? "#3b82f6",
                          }}
                        >
                          {entry}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5" onClick={() => beginTaxonomyEdit("category", entry)} disabled={taxonomyBusy}>
                            <Edit3 className="mr-1.5 h-3.5 w-3.5" />Edit
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-red-400 hover:text-red-300" onClick={() => void deleteTaxonomyOption("category", entry)} disabled={taxonomyBusy}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/40 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">Sub Tags</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Create tags inside a main category. Each tag keeps its own color.</p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px_auto_auto]">
                    <Input value={newGalleryTag} onChange={(event) => setNewGalleryTag(event.target.value)} placeholder="Create sub tag" onKeyDown={(event) => { if (event.key === "Enter") void addGalleryOption("tag", newGalleryTagColor) }} />
                    <GalleryMultiSelect
                      id="gallery-new-tag-categories"
                      value={newGalleryTagCategories}
                      options={galleryCategories}
                      optionColors={galleryCategoryColors}
                      placeholder="Assign categories"
                      onChange={setNewGalleryTagCategories}
                    />
                    <GalleryColorPicker value={newGalleryTagColor} onChange={setNewGalleryTagColor} ariaLabel="New sub tag color" />
                    <Button type="button" onClick={() => void addGalleryOption("tag", newGalleryTagColor)} disabled={newGalleryTagCategories.length === 0}><Plus className="mr-2 h-4 w-4" />Create</Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {galleryCategories.map((categoryName) => {
                      const categoryTags = Array.isArray(galleryTagCategories[categoryName])
                        ? galleryTagCategories[categoryName]
                        : []
                      return (
                        <div key={categoryName} className="rounded-lg border border-border/60 bg-background/30 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: `${galleryCategoryColors[categoryName] ?? "#3b82f6"}55`, backgroundColor: `${galleryCategoryColors[categoryName] ?? "#3b82f6"}1a`, color: galleryCategoryColors[categoryName] ?? "#3b82f6" }}>{categoryName}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {categoryTags.length ? categoryTags.map((entry) => (
                              <div key={`${categoryName}-${entry}`} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide" style={{ borderColor: `${galleryTagColors[entry] ?? "#3b82f6"}55`, backgroundColor: `${galleryTagColors[entry] ?? "#3b82f6"}1a`, color: galleryTagColors[entry] ?? "#3b82f6" }}>
                                <span>{entry}</span>
                                <div className="ml-1 flex items-center gap-1">
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => beginTaxonomyEdit("tag", entry)} disabled={taxonomyBusy} aria-label={`Edit ${entry}`}>
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => void deleteTaxonomyOption("tag", entry)} disabled={taxonomyBusy} aria-label={`Delete ${entry}`}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )) : <span className="text-xs text-muted-foreground">No tags yet.</span>}
                          </div>
                        </div>
                      )
                    })}
                    {(() => {
                      const assignedTags = new Set(Object.values(galleryTagCategories).flat())
                      const unassignedTags = galleryTags.filter((entry) => !assignedTags.has(entry))
                      if (unassignedTags.length === 0) return null
                      return (
                        <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unassigned</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {unassignedTags.map((entry) => (
                              <div key={`unassigned-${entry}`} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide" style={{ borderColor: `${galleryTagColors[entry] ?? "#3b82f6"}55`, backgroundColor: `${galleryTagColors[entry] ?? "#3b82f6"}1a`, color: galleryTagColors[entry] ?? "#3b82f6" }}>
                                <span>{entry}</span>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => beginTaxonomyEdit("tag", entry)} disabled={taxonomyBusy} aria-label={`Edit ${entry}`}>
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => void deleteTaxonomyOption("tag", entry)} disabled={taxonomyBusy} aria-label={`Delete ${entry}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
            </div>
            </DropdownProvider>
          </div>,
          document.body,
        )}

      {taxonomyEdit && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.currentTarget === event.target) { setTaxonomyEdit(null); setShowTaxonomyModal(true) } }}
        >
          <DropdownProvider>
          <div className="relative z-[10051] w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="taxonomy-edit-title">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="taxonomy-edit-title" className="text-lg font-semibold">Edit {taxonomyEdit.type === "category" ? "Category" : "Sub Tag"}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Change the name, color, or category assignment.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setTaxonomyEdit(null); setShowTaxonomyModal(true) }} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
                <Input value={taxonomyEditName} onChange={(event) => setTaxonomyEditName(event.target.value)} />
              </div>
              {taxonomyEdit.type === "tag" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Category</label>
                  <GalleryMultiSelect
                    id="taxonomy-edit-categories"
                    value={taxonomyEditCategories}
                    options={galleryCategories}
                    optionColors={galleryCategoryColors}
                    placeholder="Assign categories"
                    allowEmpty
                    onChange={setTaxonomyEditCategories}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">Select one or multiple categories. Clear every selection to reset the sub-tag to unassigned.</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Color</label>
                <GalleryColorPicker value={taxonomyEditColor} onChange={setTaxonomyEditColor} ariaLabel="Edit gallery label color" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setTaxonomyEdit(null); setShowTaxonomyModal(true) }} disabled={taxonomyBusy}>Cancel</Button>
                <Button type="button" onClick={() => void saveTaxonomyEdit()} disabled={taxonomyBusy || !taxonomyEditName.trim()}>
                  {taxonomyBusy ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
          </DropdownProvider>
        </div>,
        document.body,
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overscroll-contain bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              closeModal()
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingItem
                    ? "Edit Gallery Entry"
                    : "Add Media"}
                </h2>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <DropdownProvider>
                <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Title <span className="text-destructive">*</span>
                  </label>

                  <Input
                    value={title}
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                    placeholder="Gallery title"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Category <span className="text-destructive">*</span>
                  </label>

                  <CustomSelect
                    id="gallery-category"
                    value={category}
                    options={galleryCategories}
                    ariaLabel="Gallery category"
                    onChange={(value) => {
                      const nextCategory = value as GalleryCategory
                      setCategory(nextCategory)
                      setTags((current) => current.filter((tag) => (galleryTagCategories[nextCategory] ?? galleryTags).includes(tag)))
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Tags <span className="text-xs font-normal text-muted-foreground">(Optional · Select multiple)</span>
                  </label>

                  <CustomMultiSelect
                    id="gallery-tags"
                    value={tags}
                    options={galleryTagCategories[category] ?? []}
                    ariaLabel="Gallery tags"
                    onChange={setTags}
                    optionKind="tag"
                    optionColors={galleryTagColors}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    Description <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                  </label>

                  <Textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                    placeholder="Describe this gallery entry..."
                    rows={3}
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold">
                      Upload Media <span className="text-destructive">*</span>
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Add one or more images or videos from your computer.
                    </p>
                  </div>
                </div>

                <div
                  className={[
                    "sm:col-span-2 rounded-xl border border-dashed p-5 transition-colors",
                    isDragging
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border bg-background/40",
                  ].join(" ")}
                  onDragEnter={
                    handleDragEnter
                  }
                  onDragOver={
                    handleDragOver
                  }
                  onDragLeave={
                    handleDragLeave
                  }
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <h3 className="mt-3 text-sm font-semibold">
                      {isDragging
                        ? "Drop files here"
                        : "Drag and drop files"}
                    </h3>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Drop images or videos here,
                      or choose files from your
                      computer.
                    </p>

                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose Files
                    </Button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event) => {
                        handleFiles(
                          event.target.files,
                        )

                        event.currentTarget.value =
                          ""
                      }}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-border bg-background/40 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">
                      Add Media URL <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                    </h3>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      URLs can be mixed with uploaded
                      files.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Type <span className="text-destructive">*</span>
                      </label>
                      <CustomSelect
                        id="gallery-url-type"
                        value={urlType === "image" ? "Image" : "Video"}
                        options={["Image", "Video"]}
                        ariaLabel="Media type"
                        onChange={(value) =>
                          setUrlType(value === "Image" ? "image" : "video")
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        URL <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                      </label>

                    <Input
                      value={urlInput}
                      onChange={(event) =>
                        setUrlInput(
                          event.target.value,
                        )
                      }
                      placeholder="https://example.com/image.jpg (Optional)"
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault()
                          addExternalUrl()
                        }
                      }}
                    />

                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={
                          addExternalUrl
                        }
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Add URL
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2">
                    <Input
                      value={
                        thumbnailInput
                      }
                      onChange={(event) =>
                        setThumbnailInput(
                          event.target.value,
                        )
                      }
                      placeholder="Video thumbnail URL (Optional)"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Media <span className="text-destructive">*</span> (
                      {
                        pendingMedia.length
                      }
                      )
                    </label>

                    {pendingMedia.length >
                      0 && (
                      <span className="text-xs text-muted-foreground">
                        Files and URLs can be
                        mixed.
                      </span>
                    )}
                  </div>

                  {pendingMedia.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                      <FileImage className="mx-auto h-8 w-8 text-muted-foreground" />

                      <p className="mt-2 text-sm font-medium">
                        No media added
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Add files or URLs above.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {pendingMedia.map(
                        (media) => (
                          <div
                            key={media.id}
                            className="group relative overflow-hidden rounded-lg border border-border bg-muted"
                          >
                            <div className="aspect-square">
                              {media.type === "image" ? (
                                <img
                                  src={media.previewUrl || media.url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : getMediaThumbnail(media) ? (
                                <div className="relative h-full w-full">
                                  <img
                                    src={getMediaThumbnail(media)}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ) : isEmbeddableVideo(media) ? (
                                <iframe
                                  src={getVideoEmbedUrl(media.url)}
                                  title="Video preview"
                                  className="pointer-events-none h-full w-full border-0 object-cover"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                />
                              ) : (
                                <video
                                  src={media.previewUrl || media.url}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                  preload="auto"
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </div>

                            {(media.processing || media.progress !== undefined) && (
                              <div className="absolute inset-x-0 bottom-0 z-10 bg-black/75 px-2.5 py-2 backdrop-blur-sm">
                                <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-white">
                                  <span>{media.processing ? "Processing" : "Ready"}</span>
                                  <span>{media.progress ?? 0}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                                  <div className="h-full rounded-full bg-blue-500 transition-all duration-200" style={{ width: `${Math.max(0, Math.min(100, media.progress ?? 0))}%` }} />
                                </div>
                              </div>
                            )}

                            <div className={`absolute inset-x-0 ${media.processing || media.progress !== undefined ? "bottom-[42px]" : "bottom-0"} flex items-center justify-between bg-black/60 px-2 py-1.5 text-[10px] text-white`}>
                              <span className="flex items-center gap-1">
                                {media.type ===
                                "image" ? (
                                  <ImageIcon className="h-3 w-3" />
                                ) : (
                                  <Video className="h-3 w-3" />
                                )}

                                {getMediaLabel(
                                  media.type,
                                )}
                              </span>

                              <span>
                                {media.source ===
                                "upload"
                                  ? "File"
                                  : "URL"}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                removePendingMedia(
                                  media.id,
                                )
                              }
                              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                              aria-label="Remove media"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
                </div>
              </DropdownProvider>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border/70 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void saveGallery()
                }
                disabled={saving}
              >
                {saving
                  ? savingStage === "upload" && uploadProgress !== null && uploadProgress < 100
                    ? `Uploading ${uploadProgress}%...`
                    : savingStage === "import"
                      ? "Importing video..."
                      : "Saving..."
                  : editingItem
                    ? "Save Changes"
                    : "Create Gallery"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewer &&
        viewer.item.media[
          viewer.index
        ] && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center overscroll-contain bg-black/85 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(event) => {
              if (
                event.currentTarget ===
                event.target
              ) {
                closeViewer()
              }
            }}
          >
            <div className="relative flex h-full w-full max-w-6xl flex-col">
              <div className="flex items-center justify-between pb-3 text-white">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {viewer.item.title}
                  </p>

                  <p className="text-xs text-white/60">
                    {viewer.index + 1} /{" "}
                    {viewer.item.media.length}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
                  onClick={
                    closeViewer
                  }
                  aria-label="Close viewer"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center">
                {viewer.item.media
                  .length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-1 z-10 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:left-3"
                      onClick={
                        showPrevious
                      }
                      aria-label="Previous media"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 z-10 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white sm:right-3"
                      onClick={
                        showNext
                      }
                      aria-label="Next media"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </>
                )}

                {(() => {
                  const currentMedia = viewer.item.media[viewer.index]
                  const embedUrl = getVideoEmbedUrl(currentMedia.url)
                  const thumbnail = getMediaThumbnail(currentMedia)

                  if (currentMedia.type === "image") {
                    return (
                      <img
                        src={currentMedia.url}
                        alt={viewer.item.title}
                        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                      />
                    )
                  }

                  if (getYouTubeVideoId(currentMedia.url)) {
                    return (
                      <CustomYouTubePlayer
                        videoId={getYouTubeVideoId(currentMedia.url) || ""}
                        title={viewer.item.title}
                        sourceUrl={currentMedia.url}
                      />
                    )
                  }

                  if (embedUrl) {
                    return (
                      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl bg-black shadow-2xl">
                        <iframe
                          src={embedUrl.replace("muted=1", "muted=0")}
                          title={viewer.item.title}
                          className="h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    )
                  }

                  return (
                    <CustomVideoPlayer
                      src={getGalleryMediaUrl(currentMedia)}
                      poster={thumbnail || undefined}
                      title={viewer.item.title}
                    />
                  )
                })()}
              </div>

              <div className="flex items-center justify-center gap-2 pt-3">
                <a
                  href={getGalleryMediaUrl(
                    viewer.item.media[
                      viewer.index
                    ],
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Open {getMediaLabel(viewer.item.media[viewer.index].type)}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

      {!user && !loading ? null : null}
    </div>
  )
}

function formatVideoTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00"

  const totalSeconds = Math.floor(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function qualityLabel(value: string) {
  const labels: Record<string, string> = {
    highres: "2160p+",
    hd2160: "2160p",
    hd1440: "1440p",
    hd1080: "1080p",
    hd720: "720p",
    large: "480p",
    medium: "360p",
    small: "240p",
    tiny: "144p",
    auto: "Auto",
  }
  return labels[value] || value
}

function useDocumentCursorFix(enabled: boolean) {
  useEffect(() => {
    const root = document.documentElement
    const styleId = "gallery-video-fullscreen-cursor"
    const existingStyle = document.getElementById(styleId)

    if (!enabled) {
      root.classList.remove("gallery-video-fullscreen")
      existingStyle?.remove()
      return
    }

    root.classList.add("gallery-video-fullscreen")
    const previousHtmlCursor = root.style.cursor
    const previousBodyCursor = document.body.style.cursor
    root.style.cursor = "default"
    document.body.style.cursor = "default"

    if (!existingStyle) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `
        html.gallery-video-fullscreen,
        html.gallery-video-fullscreen *,
        :fullscreen,
        :fullscreen * {
          cursor: default !important;
        }
      `
      document.head.appendChild(style)
    }

    return () => {
      root.classList.remove("gallery-video-fullscreen")
      root.style.cursor = previousHtmlCursor
      document.body.style.cursor = previousBodyCursor
      document.getElementById(styleId)?.remove()
    }
  }, [enabled])
}

function CustomVideoPlayer({
  src,
  poster,
  title,
}: {
  src: string
  poster?: string
  title: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [buffered, setBuffered] = useState(0)

  useDocumentCursorFix(fullscreen)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted
    video.playbackRate = speed
  }, [volume, muted, speed])

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // Viewer opens from a user click, so do not force mute here.
    video.muted = false
    setMuted(false)
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [src])

  useEffect(() => () => videoRef.current?.pause(), [])

  async function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      try { await video.play() } catch {}
    } else {
      video.pause()
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
    if (video.duration > 0 && video.buffered.length > 0) {
      const end = video.buffered.end(video.buffered.length - 1)
      setBuffered(Math.min(100, (end / video.duration) * 100))
    }
  }

  function seek(value: number) {
    const video = videoRef.current
    if (!video || !Number.isFinite(value)) return
    video.currentTime = value
    setCurrentTime(value)
  }

  function changeVolume(value: number) {
    const next = Math.max(0, Math.min(1, value))
    setVolume(next)
    setMuted(next === 0)
  }

  async function toggleFullscreen() {
    const container = containerRef.current
    if (!container) return
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen()
      else await container.requestFullscreen()
    } catch {}
  }

  async function togglePictureInPicture() {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else if (document.pictureInPictureEnabled && "requestPictureInPicture" in video) await video.requestPictureInPicture()
    } catch {}
  }

  function downloadVideo() {
    const anchor = document.createElement("a")
    anchor.href = src
    anchor.download = ""
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  return (
    <div
      ref={containerRef}
      className="group relative flex h-full max-h-full w-full max-w-5xl cursor-default flex-col overflow-hidden rounded-xl bg-black shadow-2xl"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={toggleFullscreen}
    >
      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          preload="auto"
          className="h-full w-full cursor-default object-contain"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget
            setDuration(video.duration || 0)
            setVolume(video.volume || 1)
            video.muted = false
            setMuted(false)
            void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
          }}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onClick={togglePlay}
        />
        <button
          type="button"
          className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={togglePlay}
          aria-label={playing ? "Pause video" : "Play video"}
        >
          {playing ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
        </button>
      </div>

      <div className="relative z-10 border-t border-white/10 bg-black/95 px-3 pb-3 pt-2 text-white" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relative mb-2 h-1.5 w-full rounded-full bg-white/15">
          <div className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-blue-500" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
          <div className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-white/20" style={{ width: `${buffered}%` }} />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seek(Number(event.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent accent-blue-500"
            aria-label="Video progress"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
          </button>

          <div className="hidden items-center gap-1 sm:flex">
            <button type="button" onClick={() => changeVolume(muted ? volume || 1 : 0)} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label={muted ? "Unmute" : "Mute"}>
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="relative h-1.5 w-20 rounded-full bg-white/15">
              <div className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-blue-500" style={{ width: `${muted ? 0 : volume * 100}%` }} />
              <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent accent-blue-500" aria-label="Volume" />
            </div>
          </div>

          <span className="ml-1 min-w-[82px] text-[11px] tabular-nums text-white/65">{formatVideoTime(currentTime)} / {formatVideoTime(duration)}</span>

          <div className="ml-auto flex items-center gap-1">
            <div ref={settingsRef} className="relative" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" onClick={(event) => { event.stopPropagation(); setSettingsOpen((value) => !value) }} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label="Video settings" aria-expanded={settingsOpen}>
                <Settings2 className="h-4 w-4" />
              </button>
              {settingsOpen && (
                <div className="absolute bottom-11 right-0 z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-black/95 p-2 shadow-2xl backdrop-blur-md" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">Playback speed</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[0.5, 1, 1.25, 1.5, 1.75, 2].map((value) => (
                      <button key={value} type="button" onClick={() => { setSpeed(value); setSettingsOpen(false) }} className={`rounded-md px-2 py-1.5 text-[11px] ${speed === value ? "bg-blue-500/20 text-blue-400" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{value}x</button>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <div className="flex items-center justify-between px-2 py-1.5 text-xs text-white/70"><span className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5" />Quality</span><span className="text-[11px] text-white/45">Original</span></div>
                    <p className="px-2 pb-1 text-[10px] leading-4 text-white/40">This video is stored as one source file, so there are no alternate quality streams.</p>
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={togglePictureInPicture} className="hidden h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10 sm:flex" aria-label="Picture in picture" title="Picture in picture"><PictureInPicture2 className="h-4 w-4" /></button>
            <button type="button" onClick={downloadVideo} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label="Download video" title="Download"><Download className="h-4 w-4" /></button>
            <button type="button" onClick={toggleFullscreen} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}><Maximize2 className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-1 truncate px-1 text-[10px] text-white/40">{title}</div>
      </div>
    </div>
  )
}

function CustomYouTubePlayer({
  videoId,
  title,
  sourceUrl,
}: {
  videoId: string
  title: string
  sourceUrl: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [quality, setQuality] = useState<YouTubeQuality>("auto")
  const [qualities, setQualities] = useState<string[]>([])

  useDocumentCursorFix(fullscreen)

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadApi = () => new Promise<void>((resolve) => {
      if (window.YT?.Player) { resolve(); return }
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve() }
      if (!document.getElementById("youtube-iframe-api")) {
        const script = document.createElement("script")
        script.id = "youtube-iframe-api"
        script.src = "https://www.youtube.com/iframe_api"
        document.head.appendChild(script)
      }
    })

    void loadApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return
      const player = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target
            // Start muted so browser autoplay is allowed, then immediately attempt to restore audio.
            event.target.setVolume(100)
            event.target.mute()
            setMuted(true)
            setVolume(1)
            setDuration(event.target.getDuration() || 0)
            setQualities(event.target.getAvailableQualityLevels?.() || [])
            event.target.setPlaybackRate(1)
            event.target.playVideo()
            window.setTimeout(() => {
              try {
                event.target.unMute()
                setMuted(false)
              } catch {}
            }, 50)
          },
          onStateChange: (event) => {
            const state = event.data
            const yt = window.YT?.PlayerState
            setPlaying(state === yt?.PLAYING)
          },
          onPlaybackQualityChange: (event) => setQuality((event.data as YouTubeQuality) || "auto"),
        },
      })
      playerRef.current = player
    })

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (!player) return
      setCurrentTime(player.getCurrentTime?.() || 0)
      setDuration(player.getDuration?.() || 0)
      const available = player.getAvailableQualityLevels?.() || []
      if (available.length) setQualities(available)
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  async function toggleFullscreen() {
    const container = containerRef.current
    if (!container) return
    try {
      if (document.fullscreenElement === container) await document.exitFullscreen()
      else await container.requestFullscreen()
    } catch {}
  }

  function togglePlay() {
    const player = playerRef.current
    if (!player) return
    if (playing) player.pauseVideo()
    else player.playVideo()
  }

  function seek(value: number) {
    playerRef.current?.seekTo(value, true)
    setCurrentTime(value)
  }

  function changeVolume(value: number) {
    const next = Math.max(0, Math.min(1, value))
    setVolume(next)
    setMuted(next === 0)
    const player = playerRef.current
    if (!player) return
    player.setVolume(next * 100)
    if (next === 0) player.mute()
    else player.unMute()
  }

  function setPlaybackSpeed(value: number) {
    setSpeed(value)
    playerRef.current?.setPlaybackRate(value)
    setSettingsOpen(false)
  }

  function setPlaybackQuality(value: string) {
    const next = (value || "auto") as YouTubeQuality
    setQuality(next)
    playerRef.current?.setPlaybackQuality(next === "auto" ? "default" : next)
    setSettingsOpen(false)
  }

  function openOriginal() {
    window.open(sourceUrl, "_blank", "noopener,noreferrer")
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const qualityOptions = qualities.length ? ["auto", ...qualities.filter((item) => item !== "auto")] : ["auto"]

  return (
    <div ref={containerRef} className="group relative flex aspect-video h-full max-h-full w-full max-w-5xl cursor-default flex-col overflow-hidden rounded-xl bg-black shadow-2xl" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onDoubleClick={toggleFullscreen}>
      <div ref={hostRef} className="min-h-0 flex-1 bg-black [&>iframe]:h-full [&>iframe]:w-full" />
      <div className="relative z-10 border-t border-white/10 bg-black/95 px-3 pb-3 pt-2 text-white" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relative mb-2 h-1.5 w-full rounded-full bg-white/15">
          <div className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
          <input type="range" min={0} max={duration || 0} step={0.01} value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent accent-blue-500" aria-label="Video progress" />
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}</button>
          <button type="button" onClick={() => changeVolume(muted ? volume || 1 : 0)} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label={muted ? "Unmute" : "Mute"}>{muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          <div className="relative h-1.5 w-20 rounded-full bg-white/15"><div className="pointer-events-none absolute left-0 top-0 h-full rounded-full bg-blue-500" style={{ width: `${muted ? 0 : volume * 100}%` }} /><input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent accent-blue-500" aria-label="Volume" /></div>
          <span className="ml-1 min-w-[82px] text-[11px] tabular-nums text-white/65">{formatVideoTime(currentTime)} / {formatVideoTime(duration)}</span>
          <div className="ml-auto flex items-center gap-1">
            <div ref={settingsRef} className="relative" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" onClick={(event) => { event.stopPropagation(); setSettingsOpen((value) => !value) }} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label="Video settings" aria-expanded={settingsOpen}><Settings2 className="h-4 w-4" /></button>
              {settingsOpen && <div className="absolute bottom-11 right-0 z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-black/95 p-2 shadow-2xl backdrop-blur-md" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">Playback speed</div>
                <div className="grid grid-cols-3 gap-1">{[0.5, 1, 1.25, 1.5, 1.75, 2].map((value) => <button key={value} type="button" onClick={() => setPlaybackSpeed(value)} className={`rounded-md px-2 py-1.5 text-[11px] ${speed === value ? "bg-blue-500/20 text-blue-400" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{value}x</button>)}</div>
                <div className="mt-2 border-t border-white/10 pt-2"><div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">Quality</div><div className="grid grid-cols-3 gap-1">{qualityOptions.map((value) => <button key={value} type="button" onClick={() => setPlaybackQuality(value)} className={`rounded-md px-2 py-1.5 text-[11px] ${quality === value ? "bg-blue-500/20 text-blue-400" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{qualityLabel(value)}</button>)}</div></div>
              </div>}
            </div>
            <button type="button" onClick={openOriginal} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label="Open original video" title="Open original video"><Download className="h-4 w-4" /></button>
            <button type="button" onClick={toggleFullscreen} className="flex h-9 w-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}><Maximize2 className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-1 truncate px-1 text-[10px] text-white/40">{title}</div>
      </div>
    </div>
  )
}

function GalleryMediaCollage({
  media,
  title,
  onClick,
}: {
  media: GalleryMedia[]
  title: string
  onClick: (media: GalleryMedia) => void
}) {
  const visible = media.slice(0, 4)
  const hiddenCount = Math.max(0, media.length - 3)

  if (visible.length === 0) return null

  return (
    <div className="relative h-[280px] w-full overflow-hidden bg-black sm:h-[320px]">
      {visible.length === 1 && (
        <GalleryMediaCard media={visible[0]} title={title} onClick={() => onClick(visible[0])} />
      )}

      {visible.length === 2 && (
        <div className="grid h-full min-h-0 grid-cols-2 gap-1 bg-black">
          {visible.map((item) => (
            <GalleryMediaCard key={item.id} media={item} title={title} onClick={() => onClick(item)} />
          ))}
        </div>
      )}

      {visible.length === 3 && (
        <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-1 bg-black">
          <div className="min-h-0 min-w-0"><GalleryMediaCard media={visible[0]} title={title} onClick={() => onClick(visible[0])} /></div>
          <div className="min-h-0 min-w-0"><GalleryMediaCard media={visible[1]} title={title} onClick={() => onClick(visible[1])} /></div>
          <div className="col-span-2 min-h-0 min-w-0"><GalleryMediaCard media={visible[2]} title={title} onClick={() => onClick(visible[2])} /></div>
        </div>
      )}

      {visible.length === 4 && (
        <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-1 bg-black">
          {visible.map((item, index) => (
            <div key={item.id} className="group relative min-h-0 min-w-0">
              <GalleryMediaCard media={item} title={title} onClick={() => onClick(item)} />
              {index === 3 && media.length >= 5 && (
                <>
                  <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black/45 backdrop-blur-[5px] transition-colors group-hover:bg-black/35" />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65 shadow-sm backdrop-blur-sm">
                      <Images className="h-3.5 w-3.5" />
                    </span>
                    <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold leading-4 shadow-sm backdrop-blur-sm">
                      +{hiddenCount} {(() => {
                        const hidden = media.slice(3)
                        const imageCount = hidden.filter((entry) => entry.type === "image").length
                        const videoCount = hidden.filter((entry) => entry.type === "video").length
                        const parts: string[] = []
                        if (imageCount) parts.push(`${imageCount} image${imageCount === 1 ? "" : "s"}`)
                        if (videoCount) parts.push(`${videoCount} video${videoCount === 1 ? "" : "s"}`)
                        return parts.join(" / ") || "media"
                      })()}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function YouTubeGalleryPreview({
  videoId,
  title,
}: {
  videoId: string
  title: string
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&enablejsapi=1`}
        title={title}
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        allow="autoplay; encrypted-media; picture-in-picture"
      />
      <div className="pointer-events-none absolute inset-0" />
    </div>
  )
}

function GalleryMediaCard({
  media,
  title,
  onClick,
}: {
  media: GalleryMedia
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={[
        "group relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-left",
        "min-h-0",
      ].join(" ")}
      onClick={onClick}
      aria-label={`View ${title}`}
    >
      {getYouTubeVideoId(media.url) ? (
        <YouTubeGalleryPreview
          videoId={getYouTubeVideoId(media.url) || ""}
          title={title}
        />
      ) : media.type === "image" ? (
        <img
          src={media.url}
          alt={title}
          className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
        />
      ) : getMediaThumbnail(media) ? (
        <div className="relative h-full w-full">
          <img
            src={getMediaThumbnail(media)}
            alt={title}
            className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
          />
        </div>
      ) : isEmbeddableVideo(media) ? (
        <iframe
          src={getVideoEmbedUrl(media.url)}
          title={title}
          tabIndex={-1}
          className="pointer-events-none h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      ) : (
        <video
          src={media.url}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
        />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-70 transition-opacity group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-2.5 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[10px] font-medium backdrop-blur-sm">
          {media.type === "image" ? (
            <ImageIcon className="h-3 w-3" />
          ) : (
            <Video className="h-3 w-3" />
          )}

          {getMediaLabel(
            media.type,
          )}
        </span>

        <span className="rounded-md bg-black/45 px-2 py-1 text-[10px] font-medium backdrop-blur-sm">
          View
        </span>
      </div>
    </button>
  )
}

function ManagementStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>

      <p className="mt-2 text-xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  )
}
