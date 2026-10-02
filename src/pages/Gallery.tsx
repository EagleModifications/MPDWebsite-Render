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

type GalleryMediaType = "image" | "video"

type GalleryMedia = {
  id: string
  type: GalleryMediaType
  url: string
  thumbnailUrl: string
  source: "upload" | "url"
  storageId?: string
}

type GalleryCategory = "Community" | "Fleet"

type GalleryItem = {
  id: string
  title: string
  description: string
  category?: GalleryCategory
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
        <span>{value}</span>
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
                <span>{option}</span>
                {selected && <Check className="h-4 w-4 text-blue-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
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

  const [title, setTitle] =
    useState("")

  const [description, setDescription] =
    useState("")

  const [category, setCategory] =
    useState<GalleryCategory>("Community")

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

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] =
    useState<GalleryItem | null>(null)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

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
      toast.error(
        "Enter a media URL.",
      )
      return
    }

    try {
      const parsed = new URL(url)

      if (
        !["http:", "https:"].includes(
          parsed.protocol,
        )
      ) {
        throw new Error(
          "Invalid protocol",
        )
      }
    } catch {
      toast.error(
        "Enter a valid HTTP or HTTPS URL.",
      )
      return
    }

    const type: GalleryMediaType =
      urlType

    setPendingMedia((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        url,
        thumbnailUrl:
          type === "video"
            ? thumbnailInput.trim()
            : "",
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
    if (!files?.length) {
      return
    }

    const next: PendingMedia[] = []

    for (const file of Array.from(
      files,
    )) {
      if (
        !file.type.startsWith(
          "image/",
        ) &&
        !file.type.startsWith(
          "video/",
        )
      ) {
        continue
      }

      const type: GalleryMediaType =
        file.type.startsWith("video/")
          ? "video"
          : "image"

      next.push({
        id: crypto.randomUUID(),
        type,
        url: "",
        thumbnailUrl: "",
        source: "upload",
        previewUrl:
          URL.createObjectURL(file),
        file,
      })
    }

    if (!next.length) {
      toast.error(
        "Select image or video files.",
      )
      return
    }

    setPendingMedia(
      (current) => [
        ...current,
        ...next,
      ],
    )
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
          media.source ===
            "upload" &&
          media.file,
      )
      .map(
        (media) =>
          media.file as File,
      )

    if (!files.length) {
      return []
    }

    const formData = new FormData()

    for (const file of files) {
      formData.append(
        "files",
        file,
        file.name,
      )
    }

    const response =
      await fetch(
        "/api/gallery/upload",
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      )

    const raw =
      await response.text()

    let data: {
      success?: boolean
      items?: GalleryMedia[]
      error?: string
    } = {}

    try {
      data = raw
        ? JSON.parse(raw)
        : {}
    } catch {
      data = {}
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "Gallery upload API is not deployed. Redeploy the updated app.ts backend before uploading files.",
        )
      }

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Sign in again.",
        )
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to upload gallery media.",
        )
      }

      throw new Error(
        data.error ||
          `Gallery upload failed (${response.status}).`,
      )
    }

    if (
      !Array.isArray(data.items)
    ) {
      throw new Error(
        "Gallery upload returned an invalid response.",
      )
    }

    return data.items
  }

  async function saveGallery() {
    const cleanTitle =
      title.trim()

    if (!cleanTitle) {
      toast.error(
        "Enter a gallery title.",
      )
      return
    }

    if (!description.trim()) {
      toast.error(
        "Enter a gallery description.",
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
              description:
                description.trim(),
              category,
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
  }, [viewer])

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
                Community Gallery
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

              <div className="flex flex-wrap items-center gap-1.5">
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
                          <div className="grid gap-1">
                            {mediaList.map(
                              (media) => (
                                <GalleryMediaCard
                                  key={
                                    media.id
                                  }
                                  media={
                                    media
                                  }
                                  title={
                                    item.title
                                  }
                                  onClick={() =>
                                    openViewer(
                                      item,
                                      media,
                                    )
                                  }
                                />
                              ),
                            )}
                          </div>

                          <div className="border-t border-border/70 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="mb-1.5 flex items-center gap-2">
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
                                </div>

                                <h3 className="truncate text-sm font-semibold">
                                  {
                                    item.title
                                  }
                                </h3>

                                {item.description && (
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                    {
                                      item.description
                                    }
                                  </p>
                                )}

                                <p className="mt-2 text-[10px] text-muted-foreground">
                                  {
                                    mediaList.length
                                  }{" "}
                                  {mediaList.length ===
                                  1
                                    ? "item"
                                    : "items"}
                                  {item.createdAt
                                    ? ` · ${formatDate(item.createdAt)}`
                                    : ""}
                                </p>
                              </div>

                              {canManageGallery && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      openEdit(
                                        item,
                                      )
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
                                      deletingId ===
                                      item.id
                                    }
                                    onClick={() =>
                                      requestDeleteGallery(
                                        item,
                                      )
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

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
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
                <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                  {category}
                </p>

                <h2 className="mt-1 text-lg font-semibold">
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
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    Title
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

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    Description
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

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Category
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

                <div
                  className={[
                    "rounded-xl border border-dashed p-5 transition-colors",
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

                <div className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">
                      Add media URL
                    </h3>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      URLs can be mixed with uploaded
                      files.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                    <CustomSelect
                      id="gallery-url-type"
                      value={urlType === "image" ? "Image" : "Video"}
                      options={["Image", "Video"]}
                      ariaLabel="Media type"
                      onChange={(value) =>
                        setUrlType(value === "Image" ? "image" : "video")
                      }
                    />

                    <Input
                      value={urlInput}
                      onChange={(event) =>
                        setUrlInput(
                          event.target.value,
                        )
                      }
                      placeholder="https://example.com/image.jpg"
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

                    <Button
                      type="button"
                      variant="outline"
                      onClick={
                        addExternalUrl
                      }
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Add URL
                    </Button>
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
                      placeholder="Optional video thumbnail URL"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Media (
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
                              {media.type ===
                              "image" ? (
                                <img
                                  src={
                                    media.previewUrl ||
                                    media.url
                                  }
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : media.thumbnailUrl ? (
                                <img
                                  src={
                                    media.thumbnailUrl
                                  }
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <video
                                  src={
                                    media.previewUrl ||
                                    media.url
                                  }
                                  muted
                                  preload="metadata"
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
                  ? "Saving..."
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
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6"
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

                {viewer.item.media[
                  viewer.index
                ].type === "image" ? (
                  <img
                    src={
                      viewer.item.media[
                        viewer.index
                      ].url
                    }
                    alt={
                      viewer.item.title
                    }
                    className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                  />
                ) : viewer.item
                    .media[
                    viewer.index
                  ]
                    .thumbnailUrl ? (
                  <video
                    src={
                      viewer.item.media[
                        viewer.index
                      ].url
                    }
                    controls
                    poster={
                      viewer.item.media[
                        viewer.index
                      ]
                        .thumbnailUrl
                    }
                    className="max-h-full max-w-full rounded-xl shadow-2xl"
                  />
                ) : (
                  <video
                    src={
                      viewer.item.media[
                        viewer.index
                      ].url
                    }
                    controls
                    className="max-h-full max-w-full rounded-xl shadow-2xl"
                  />
                )}
              </div>

              <div className="flex items-center justify-center gap-2 pt-3">
                <a
                  href={
                    viewer.item.media[
                      viewer.index
                    ].url
                  }
                  target="_blank"
                  rel="noreferrer"
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
      {media.type === "image" ? (
        <img
          src={media.url}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          onLoad={(event) => {
            const image =
              event.currentTarget

            if (
              image.naturalHeight >
              0
            ) {
              setRatio(
                image.naturalWidth /
                  image.naturalHeight,
              )
            }
          }}
        />
      ) : media.thumbnailUrl ? (
        <img
          src={media.thumbnailUrl}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          onLoad={(event) => {
            const image =
              event.currentTarget

            if (
              image.naturalHeight >
              0
            ) {
              setRatio(
                image.naturalWidth /
                  image.naturalHeight,
              )
            }
          }}
        />
      ) : (
        <video
          src={media.url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          onLoadedMetadata={(
            event,
          ) => {
            const video =
              event.currentTarget

            if (
              video.videoHeight >
              0
            ) {
              setRatio(
                video.videoWidth /
                  video.videoHeight,
              )
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
