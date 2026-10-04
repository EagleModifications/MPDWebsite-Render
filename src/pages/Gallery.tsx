import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react"
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
  fallbackUrl?: string
}

type GalleryCategory = "Community" | "Fleet"
type GalleryTag = "Dept" | "SWAT" | "MTF-7" | "MCD" | "TRU" | "SAR"

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
}

type GalleryCategoryFilter = "All" | GalleryCategory

const GALLERY_TAGS: readonly GalleryTag[] = [
  "Dept",
  "SWAT",
  "MTF-7",
  "MCD",
  "TRU",
  "SAR",
]

const GALLERY_TAG_CLASSES: Record<GalleryTag, string> = {
  Dept: "!border-blue-500/50 !bg-blue-500/15 !text-blue-700 dark:!border-blue-400/50 dark:!bg-blue-500/25 dark:!text-blue-300",
  SWAT: "!border-slate-500/60 !bg-slate-900/10 !text-slate-900 dark:!border-slate-400/50 dark:!bg-slate-800 dark:!text-white",
  "MTF-7": "!border-blue-600/45 !bg-blue-700/10 !text-blue-800 dark:!border-blue-500/50 dark:!bg-blue-900/60 dark:!text-blue-200",
  MCD: "!border-blue-950/60 !bg-blue-950/15 !text-blue-950 dark:!border-blue-800/70 dark:!bg-blue-950/90 dark:!text-blue-100",
  TRU: "!border-yellow-500/50 !bg-yellow-500/15 !text-yellow-700 dark:!border-yellow-400/50 dark:!bg-yellow-500/20 dark:!text-yellow-300",
  SAR: "!border-red-500/50 !bg-red-500/15 !text-red-700 dark:!border-red-400/50 dark:!bg-red-500/20 dark:!text-red-300",
}
type GalleryMediaFilter = "All" | "Images" | "Videos"

const GALLERY_CATEGORY_FILTERS: GalleryCategoryFilter[] = [
  "All",
  "Community",
  "Fleet",
]

const GALLERY_MEDIA_FILTERS: GalleryMediaFilter[] = [
  "All",
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
                  selected ? "bg-blue-500/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
}: {
  id: string
  value: readonly GalleryTag[]
  options: readonly GalleryTag[]
  onChange: (value: GalleryTag[]) => void
  ariaLabel: string
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

  const selectedLabel =
    value.length === 0
      ? "Select tags"
      : value.length === 1
        ? value[0]
        : `${value.length} tags selected`

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
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
          />
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
                    ? "bg-muted/70 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={[
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      option === "Dept"
                        ? "bg-blue-500"
                        : option === "SWAT"
                          ? "bg-slate-500"
                          : option === "MTF-7"
                            ? "bg-sky-700"
                            : option === "MCD"
                              ? "bg-blue-950 dark:bg-blue-800"
                              : option === "TRU"
                                ? "bg-yellow-500"
                                : "bg-red-500",
                    ].join(" ")}
                  />
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

function getAspectClass(ratio?: number) {
  if (!ratio || !Number.isFinite(ratio)) {
    return "aspect-[4/3]"
  }

  if (ratio >= 1.85) return "aspect-[16/8]"
  if (ratio >= 1.35) return "aspect-[4/3]"
  if (ratio >= 1.05) return "aspect-square"
  if (ratio >= 0.8) return "aspect-[4/5]"

  return "aspect-[3/4]"
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

  const [categoryFilter, setCategoryFilter] =
    useState<GalleryCategoryFilter>("All")

  const [mediaFilter, setMediaFilter] =
    useState<GalleryMediaFilter>("All")

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

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const overlayOpen =
      showModal ||
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
  }, [showModal, viewer, infoItem, deleteTarget])

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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        categoryFilter === "All" ||
        (item.category ?? "Community") === categoryFilter

      const matchesMedia =
        mediaFilter === "All" ||
        item.media.some((media) =>
          mediaFilter === "Images"
            ? isImageMedia(media)
            : isVideoMedia(media),
        )

      return matchesCategory && matchesMedia
    })
  }, [categoryFilter, items, mediaFilter])

  const visibleMediaCount = useMemo(() => {
    return filteredItems.reduce(
      (count, item) => {
        if (mediaFilter === "Images") {
          return (
            count +
            item.media.filter(
              isImageMedia,
            ).length
          )
        }

        if (mediaFilter === "Videos") {
          return (
            count +
            item.media.filter(
              isVideoMedia,
            ).length
          )
        }

        return count + item.media.length
      },
      0,
    )
  }, [filteredItems, mediaFilter])

  function getVisibleMedia(
    item: GalleryItem,
  ) {
    if (mediaFilter === "Images") {
      return item.media.filter(
        isImageMedia,
      )
    }

    if (mediaFilter === "Videos") {
      return item.media.filter(
        isVideoMedia,
      )
    }

    return item.media
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
    setCategory("Community")
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
    const files = pendingMedia
      .filter(
        (media) =>
          media.source === "upload" &&
          media.file,
      )
      .map((media) => media.file as File)

    if (!files.length) {
      return []
    }

    const formData = new FormData()

    for (const file of files) {
      formData.append("files", file, file.name)
    }

    setSavingStage("upload")
    setUploadProgress(0)

    const result = await new Promise<{
      status: number
      raw: string
    }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.open("POST", "/api/gallery/upload")
      xhr.withCredentials = true
      xhr.timeout = 15 * 60 * 1000

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        setUploadProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        )
      }

      xhr.onload = () => {
        setUploadProgress(100)
        resolve({
          status: xhr.status,
          raw: xhr.responseText || "",
        })
      }

      xhr.onerror = () => {
        reject(new Error("Gallery upload failed. Check the server logs and try again."))
      }

      xhr.ontimeout = () => {
        reject(new Error("Gallery upload timed out after 15 minutes."))
      }

      xhr.onabort = () => {
        reject(new Error("Gallery upload was cancelled."))
      }

      xhr.send(formData)
    })

    let data: {
      success?: boolean
      items?: GalleryMedia[]
      error?: string
    } = {}

    try {
      data = result.raw ? JSON.parse(result.raw) : {}
    } catch {
      data = {}
    }

    if (result.status < 200 || result.status >= 300) {
      if (result.status === 404) {
        throw new Error(
          "Gallery upload API is not deployed. Make sure the updated app.ts is deployed and the server has been restarted.",
        )
      }

      if (result.status === 401) {
        throw new Error("Your session has expired. Sign in again.")
      }

      if (result.status === 403) {
        throw new Error("You do not have permission to upload gallery media.")
      }

      throw new Error(
        data.error || `Gallery upload failed (${result.status}).`,
      )
    }

    if (!Array.isArray(data.items)) {
      throw new Error("Gallery upload returned an invalid response.")
    }

    return data.items
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

        // YouTube/Vimeo URLs are imported server-side into GridFS before
        // the gallery document is saved. After this point they are treated
        // exactly like a normal uploaded video file.
        if (
          item.source === "url" &&
          item.type === "video" &&
          (Boolean(getYouTubeVideoId(item.url)) ||
            Boolean(getVimeoVideoId(item.url)))
        ) {
          setSavingStage("import")
          setUploadProgress(0)

          const importResponse = await fetch(
            "/api/gallery/import-url",
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: item.url,
              }),
            },
          )

          const importData = await importResponse
            .json()
            .catch(() => ({}))

          if (!importResponse.ok || !importData.item) {
            throw new Error(
              importData.error ||
                "Failed to import the video URL.",
            )
          }

          media.push(importData.item as GalleryMedia)
          setUploadProgress(100)
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
              <Button
                type="button"
                className="shrink-0"
                onClick={openAdd}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Media
              </Button>
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

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Type:
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {GALLERY_MEDIA_FILTERS.map((item) => (
                      <button
                        key={`media-${item}`}
                        type="button"
                        onClick={() => setMediaFilter(item)}
                        className={[
                          "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                          mediaFilter === item
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300"
                            : "border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="hidden text-xs text-muted-foreground/50 sm:block">
                  •
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Category:
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {GALLERY_CATEGORY_FILTERS.map((item) => (
                      <button
                        key={`category-${item}`}
                        type="button"
                        onClick={() => setCategoryFilter(item)}
                        className={[
                          "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                          categoryFilter === item
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300"
                            : "border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
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
                                    className={[
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                      item.category === "Fleet"
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                        : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                                    ].join(" ")}
                                  >
                                    {item.category ?? "Community"}
                                  </span>

                                  {(item.tags ?? []).length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {(item.tags ?? []).map((tag) => (
                                        <span
                                          key={`${item.id}-tag-${tag}`}
                                          className={[
                                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                                            GALLERY_TAG_CLASSES[tag],
                                          ].join(" ")}
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <h3 className="truncate text-sm font-semibold">
                                  {item.title}
                                </h3>

                                {item.description && (
                                  <div className="mt-1">
                                    <p className="line-clamp-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                                      {item.description}
                                    </p>

                                    {(item.description.length > 120 ||
                                      item.description.split(/\r?\n/).length > 2) && (
                                      <span className="mt-1 inline-block text-[11px] font-medium text-blue-500">
                                        Show more...
                                      </span>
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
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                    <span>
                      Images
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <span>
                      Videos
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span>
                      Fleet
                    </span>
                  </span>
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

                <Button
                  type="button"
                  onClick={openAdd}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Media
                </Button>
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
                    options={["Community", "Fleet"]}
                    ariaLabel="Gallery category"
                    onChange={(value) =>
                      setCategory(value as GalleryCategory)
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Tags <span className="text-xs font-normal text-muted-foreground">(Optional · Select multiple)</span>
                  </label>

                  <CustomMultiSelect
                    id="gallery-tags"
                    value={tags}
                    options={GALLERY_TAGS}
                    ariaLabel="Gallery tags"
                    onChange={setTags}
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

                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1.5 text-[10px] text-white">
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
                      <GalleryImage
                        src={currentMedia.url}
                        fallbackSrc={currentMedia.fallbackUrl}
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
                  Open Original
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
  const extraCount = Math.max(0, media.length - 3)

  if (visible.length === 0) return null

  if (visible.length === 1) {
    return (
      <div className="grid gap-1">
        <GalleryMediaCard
          media={visible[0]}
          title={title}
          onClick={() => onClick(visible[0])}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-1">
      <div className="min-w-0">
        <GalleryMediaCard
          media={visible[0]}
          title={title}
          onClick={() => onClick(visible[0])}
        />
      </div>
      <div className="min-w-0">
        <GalleryMediaCard
          media={visible[1]}
          title={title}
          onClick={() => onClick(visible[1])}
        />
      </div>
      <div className="col-span-2 min-w-0">
        {visible.length >= 3 && (
          <div className={visible.length >= 4 ? "grid grid-cols-2 gap-1" : ""}>
            <GalleryMediaCard
              media={visible[2]}
              title={title}
              onClick={() => onClick(visible[2])}
            />
            {visible.length >= 4 && (
              <div className="group relative min-w-0">
                <GalleryMediaCard
                  media={visible[3]}
                  title={title}
                  onClick={() => onClick(visible[3])}
                />
                <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black/45 backdrop-blur-[5px] transition-colors group-hover:bg-black/35" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65 shadow-sm backdrop-blur-sm">
                    <Images className="h-3.5 w-3.5" />
                  </span>

                  <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold leading-4 shadow-sm backdrop-blur-sm">
                    +{extraCount} {extraCount === 1 ? "image/video" : "images/videos"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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

function GalleryImage({
  src,
  fallbackSrc,
  alt,
  className,
  onLoad,
}: {
  src: string
  fallbackSrc?: string
  alt: string
  className?: string
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
}) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setCurrentSrc(src)
    setFailed(false)
  }, [src])

  function handleError() {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      return
    }

    setFailed(true)
  }

  if (failed || !currentSrc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="mx-auto h-6 w-6 opacity-50" />
          <span className="mt-1 block text-[10px]">Image unavailable</span>
        </div>
      </div>
    )
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={handleError}
    />
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
  const [ratio, setRatio] =
    useState<number | undefined>()

  return (
    <button
      type="button"
      className={[
        "group relative block w-full overflow-hidden bg-muted/40 text-left",
        getAspectClass(ratio),
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
        <GalleryImage
          src={media.url}
          fallbackSrc={media.fallbackUrl}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          onLoad={(event) => {
            const image = event.currentTarget
            if (image.naturalHeight > 0) {
              setRatio(image.naturalWidth / image.naturalHeight)
            }
          }}
        />
      ) : getMediaThumbnail(media) ? (
        <div className="relative h-full w-full">
          <img
            src={getMediaThumbnail(media)}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            onLoad={(event) => {
              const image = event.currentTarget
              if (image.naturalHeight > 0) {
                setRatio(image.naturalWidth / image.naturalHeight)
              }
            }}
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
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget
            if (video.videoHeight > 0) {
              setRatio(video.videoWidth / video.videoHeight)
            }
          }}
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
