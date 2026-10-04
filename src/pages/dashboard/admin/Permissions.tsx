import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"

type Permission = {
  key: string
  name: string
  description: string
  urls: string[]
}

type Rank = {
  rank: string
  permissions: string[]
  isAdminRank: boolean
}

type DiscordPermission = {
  discordId: string
  permissions: string[]
  isSuperAdmin: boolean
}

type PermissionResponse = {
  success?: boolean
  permissions?: Permission[]
  ranks?: Rank[]
  discordPermissions?: DiscordPermission[]
  adminRanks?: string[]
  superAdminDiscordIds?: string[]
  message?: string
  error?: string
}

type ModalKind = "permission" | "rank" | "discord" | null

type ModalMode = "create" | "edit"

const emptyPermission: Permission = {
  key: "",
  name: "",
  description: "",
  urls: [""],
}

const emptyRank: Rank = {
  rank: "",
  permissions: [],
  isAdminRank: false,
}

const emptyDiscord: DiscordPermission = {
  discordId: "",
  permissions: [],
  isSuperAdmin: false,
}

function normalizePath(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function getApiErrorMessage(
  status: number,
  statusText: string,
  raw: string,
): string {
  const trimmed = raw.trim()

  if (!trimmed) {
    return `Request failed (${status} ${statusText}).`
  }

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.includes("<html")) {
    return `The server returned HTML instead of JSON (${status} ${statusText}). Check that the API route is running.`
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: unknown
      message?: unknown
    }

    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error
    }

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message
    }
  } catch {
    // Fall through to the generic message.
  }

  return `Request failed (${status} ${statusText}).`
}

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  })

  const raw = await response.text()

  if (!response.ok) {
    throw new ApiError(
      getApiErrorMessage(response.status, response.statusText, raw),
      response.status,
    )
  }

  if (!raw.trim()) {
    return {} as T
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new ApiError(
      "The server returned an invalid JSON response.",
      response.status,
    )
  }
}

type ModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>

            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  description,
  button,
}: {
  icon: ReactNode
  title: string
  description: string
  button: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-500">
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {button}
    </div>
  )
}

export default function Permissions() {
  const navigate = useNavigate()

  const [permissions, setPermissions] = useState<Permission[]>([])
  const [ranks, setRanks] = useState<Rank[]>([])
  const [discordPermissions, setDiscordPermissions] = useState<
    DiscordPermission[]
  >([])

  const [adminRanks, setAdminRanks] = useState<string[]>([])
  const [superAdminIds, setSuperAdminIds] = useState<string[]>([])
  const [discordNames, setDiscordNames] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "permission" | "rank" | "discord"; label: string; id: string } | null
  >(null)
  const [contextMenu, setContextMenu] = useState<{ discordId: string; x: number; y: number } | null>(null)
  const [permissionSearch, setPermissionSearch] = useState("")

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [modalMode, setModalMode] = useState<ModalMode>("create")

  const [permissionDraft, setPermissionDraft] =
    useState<Permission>(emptyPermission)
  const [editingPermissionKey, setEditingPermissionKey] = useState<
    string | null
  >(null)

  const [rankDraft, setRankDraft] = useState<Rank>(emptyRank)
  const [editingRankName, setEditingRankName] = useState<string | null>(null)

  const [discordDraft, setDiscordDraft] =
    useState<DiscordPermission>(emptyDiscord)

  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(
    new Set(),
  )

  const [expandedRanks, setExpandedRanks] = useState<Set<string>>(new Set())

  const [expandedDiscord, setExpandedDiscord] = useState<Set<string>>(
    new Set(),
  )

  const permissionKeys = useMemo(
    () =>
      Array.from(
        new Set(
          permissions
            .map((permission) => permission.key.trim())
            .filter(Boolean),
        ),
      ),
    [permissions],
  )

  const filteredPermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase()

    if (!query) {
      return permissions
    }

    return permissions.filter((permission) =>
      [permission.name, permission.key, permission.description].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [permissions, permissionSearch])

  const filteredPermissionKeys = useMemo(
    () => filteredPermissions.map((permission) => permission.key),
    [filteredPermissions],
  )

  function permissionDisplayName(permissionKey: string) {
    return (
      permissions.find((permission) => permission.key === permissionKey)?.name ||
      permissionKey
    )
  }

  const load = useCallback(async () => {
    setIsLoading(true)

    try {
      const data = await requestJson<PermissionResponse>(
        "/api/admin/permissions",
      )

      setPermissions(data.permissions ?? [])
      setRanks(data.ranks ?? [])
      setDiscordPermissions(data.discordPermissions ?? [])
      setAdminRanks(data.adminRanks ?? [])
      setSuperAdminIds(data.superAdminDiscordIds ?? [])
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          navigate("/sign-in")
          return
        }

        if (error.status === 403) {
          navigate("/no-permission")
          return
        }

        toast.error(error.message)
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load permission settings.",
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false

    async function loadDiscordNames() {
      const divisions = ["department", "swat", "mtf7", "mcd", "tru", "teu", "sar"]
      const map: Record<string, string> = {}

      await Promise.all(
        divisions.map(async (division) => {
          try {
            const response = await fetch(`/api/promotion/roster/${division}`, {
              credentials: "include",
              cache: "no-store",
              headers: { Accept: "application/json" },
            })
            if (!response.ok) return
            const data = await response.json() as { members?: Array<{ discordId?: unknown; name?: unknown }> }
            for (const member of data.members ?? []) {
              const id = String(member.discordId ?? "").trim()
              const name = String(member.name ?? "").trim()
              if (id && name && !map[id]) map[id] = name
            }
          } catch {
            // A roster failing should not prevent the permissions page from loading.
          }
        }),
      )

      if (!cancelled) setDiscordNames(map)
    }

    void loadDiscordNames()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener("click", close)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [])

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied.`)
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}.`)
    }
  }

  function discordDisplayName(discordId: string) {
    return discordNames[discordId] || "Unknown User"
  }

  function closeModal() {
    setModalKind(null)
    setModalMode("create")
    setPermissionSearch("")

    setPermissionDraft({
      ...emptyPermission,
      urls: [""],
    })

    setEditingPermissionKey(null)

    setRankDraft({
      ...emptyRank,
      permissions: [],
    })

    setEditingRankName(null)

    setDiscordDraft({
      ...emptyDiscord,
      permissions: [],
    })
  }

  function openCreatePermission() {
    setModalKind("permission")
    setModalMode("create")
    setEditingPermissionKey(null)

    setPermissionDraft({
      key: "",
      name: "",
      description: "",
      urls: [""],
    })
  }

  function openEditPermission(permission: Permission) {
    setModalKind("permission")
    setModalMode("edit")
    setEditingPermissionKey(permission.key)

    setPermissionDraft({
      key: permission.key,
      name: permission.name,
      description: permission.description,
      urls: permission.urls.length ? [...permission.urls] : [""],
    })
  }

  function duplicatePermission(permission: Permission) {
    const existingKeys = new Set(
      permissions.map((item) => item.key.trim().toLowerCase()),
    )

    const baseKey = `${permission.key.trim().toLowerCase()}-copy`
    let duplicateKey = baseKey
    let number = 2

    while (existingKeys.has(duplicateKey)) {
      duplicateKey = `${baseKey}-${number}`
      number += 1
    }

    setModalKind("permission")
    setModalMode("create")
    setEditingPermissionKey(null)

    setPermissionDraft({
      key: duplicateKey,
      name: `${permission.name || permission.key} Copy`,
      description: permission.description,
      urls: permission.urls.length ? [...permission.urls] : [""],
    })

    toast.success(`Prepared a copy as ${duplicateKey}.`)
  }

  function openCreateRank() {
    setPermissionSearch("")
    setModalKind("rank")
    setModalMode("create")
    setEditingRankName(null)

    setRankDraft({
      rank: "",
      permissions: [],
      isAdminRank: false,
    })
  }

  function openEditRank(rank: Rank) {
    setPermissionSearch("")
    setModalKind("rank")
    setModalMode("edit")
    setEditingRankName(rank.rank)

    setRankDraft({
      rank: rank.rank,
      permissions: [...rank.permissions],
      isAdminRank: rank.isAdminRank,
    })
  }

  function duplicateRank(rank: Rank) {
    setPermissionSearch("")
    const existingRanks = new Set(
      ranks.map((item) => item.rank.trim().toLowerCase()),
    )

    const baseRank = `${rank.rank.trim()} Copy`
    let duplicateRankName = baseRank
    let number = 2

    while (existingRanks.has(duplicateRankName.toLowerCase())) {
      duplicateRankName = `${baseRank} ${number}`
      number += 1
    }

    setModalKind("rank")
    setModalMode("create")
    setEditingRankName(null)
    setRankDraft({
      rank: duplicateRankName,
      permissions: [...rank.permissions],
      isAdminRank: false,
    })

    toast.success(`Prepared a copy as ${duplicateRankName}.`)
  }

  function openCreateDiscord() {
    setPermissionSearch("")
    setModalKind("discord")
    setModalMode("create")

    setDiscordDraft({
      discordId: "",
      permissions: [],
      isSuperAdmin: false,
    })
  }

  function openEditDiscord(entry: DiscordPermission) {
    if (entry.isSuperAdmin) {
      toast.error(
        "Super Admin Discord IDs are controlled by config/admin_permissions.json.",
      )
      return
    }

    setPermissionSearch("")
    setModalKind("discord")
    setModalMode("edit")

    setDiscordDraft({
      discordId: entry.discordId,
      permissions: [...entry.permissions],
      isSuperAdmin: false,
    })
  }

  function duplicateDiscord(entry: DiscordPermission) {
    if (entry.isSuperAdmin) {
      toast.error(
        "Super Admin Discord IDs cannot be duplicated here because they are controlled by config/admin_permissions.json.",
      )
      return
    }

    setPermissionSearch("")
    setModalKind("discord")
    setModalMode("create")
    setDiscordDraft({
      discordId: "",
      permissions: [...entry.permissions],
      isSuperAdmin: false,
    })

    toast.success("Prepared a copy. Enter the new Discord user ID.")
  }

  function togglePermissionExpanded(key: string) {
    setExpandedPermissions((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  function toggleRankExpanded(rank: string) {
    setExpandedRanks((current) => {
      const next = new Set(current)

      if (next.has(rank)) {
        next.delete(rank)
      } else {
        next.add(rank)
      }

      return next
    })
  }

  function toggleDiscordExpanded(discordId: string) {
    setExpandedDiscord((current) => {
      const next = new Set(current)

      if (next.has(discordId)) {
        next.delete(discordId)
      } else {
        next.add(discordId)
      }

      return next
    })
  }

  function addRoute() {
    setPermissionDraft((current) => ({
      ...current,
      urls: [...current.urls, ""],
    }))
  }

  function updateRoute(index: number, value: string) {
    setPermissionDraft((current) => ({
      ...current,
      urls: current.urls.map((url, routeIndex) =>
        routeIndex === index ? value : url,
      ),
    }))
  }

  function removeRoute(index: number) {
    setPermissionDraft((current) => {
      const urls = current.urls.filter(
        (_, routeIndex) => routeIndex !== index,
      )

      return {
        ...current,
        urls: urls.length ? urls : [""],
      }
    })
  }

  function handleRouteKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (event.key !== "Enter") {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    setPermissionDraft((current) => {
      const urls = [...current.urls]

      urls.splice(index + 1, 0, "")

      return {
        ...current,
        urls,
      }
    })

    requestAnimationFrame(() => {
      const nextInput =
        document.querySelector<HTMLInputElement>(
          `[data-route-index="${index + 1}"]`,
        )

      nextInput?.focus()
    })
  }

  function toggleDraftPermission(
    permissionKey: string,
    target: "rank" | "discord",
  ) {
    if (target === "rank") {
      setRankDraft((current) => {
        const exists = current.permissions.includes(permissionKey)

        return {
          ...current,
          permissions: exists
            ? current.permissions.filter(
                (permission) => permission !== permissionKey,
              )
            : [...current.permissions, permissionKey],
        }
      })

      return
    }

    setDiscordDraft((current) => {
      const exists = current.permissions.includes(permissionKey)

      return {
        ...current,
        permissions: exists
          ? current.permissions.filter(
              (permission) => permission !== permissionKey,
            )
          : [...current.permissions, permissionKey],
      }
    })
  }

  async function submitPermission() {
    const key =
      modalMode === "edit" && editingPermissionKey
        ? editingPermissionKey.trim().toLowerCase()
        : permissionDraft.key.trim().toLowerCase()

    const urls = uniqueStrings(
      permissionDraft.urls
        .map(normalizePath)
        .filter(Boolean),
    )

    if (!key) {
      toast.error("Permission key is required.")
      return
    }

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) {
      toast.error(
        "Permission keys may only contain lowercase letters, numbers, hyphens, and underscores.",
      )
      return
    }

    if (key === "permissionadmin") {
      toast.error(
        "permissionadmin is controlled by config/admin_permissions.json and cannot be created or edited here.",
      )
      return
    }

    if (!urls.length) {
      toast.error("Add at least one route.")
      return
    }

    setIsSaving(true)

    try {
      const payload = {
        key,
        name: permissionDraft.name.trim() || key,
        description: permissionDraft.description.trim(),
        urls,
      }

      if (modalMode === "edit" && editingPermissionKey) {
        await requestJson(
          `/api/admin/permissions/${encodeURIComponent(
            editingPermissionKey,
          )}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        )

        toast.success("Permission updated.")
      } else {
        await requestJson("/api/admin/permissions", {
          method: "POST",
          body: JSON.stringify(payload),
        })

        toast.success("Permission created.")
      }

      setIsSaving(false)
      closeModal()
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save permission.",
      )

      setIsSaving(false)
    }
  }

  async function deletePermission(permission: Permission) {
    setDeleteTarget({ type: "permission", label: permission.name || permission.key, id: permission.key })
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    const target = deleteTarget
    setDeleteTarget(null)

    try {
      if (target.type === "permission") {
        await requestJson(`/api/admin/permissions/${encodeURIComponent(target.id)}`, { method: "DELETE" })
        toast.success("Permission deleted.")
      } else if (target.type === "rank") {
        await requestJson(`/api/admin/ranks/${encodeURIComponent(target.id)}`, { method: "DELETE" })
        toast.success("Rank deleted.")
      } else {
        await requestJson(`/api/admin/discord-permissions/${encodeURIComponent(target.id)}`, { method: "DELETE" })
        toast.success("Discord permissions removed.")
      }
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete permission.",
      )
    }
  }

  async function submitRank() {
    const rank = rankDraft.rank.trim()

    if (!rank) {
      toast.error("Rank name is required.")
      return
    }

    const permissions = uniqueStrings(rankDraft.permissions)

    setIsSaving(true)

    try {
      const payload = {
        rank,
        permissions,
      }

      if (modalMode === "edit" && editingRankName) {
        await requestJson(
          `/api/admin/ranks/${encodeURIComponent(editingRankName)}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        )

        toast.success("Rank updated.")
      } else {
        await requestJson("/api/admin/ranks", {
          method: "POST",
          body: JSON.stringify(payload),
        })

        toast.success("Rank created.")
      }

      setIsSaving(false)
      closeModal()
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save rank.",
      )

      setIsSaving(false)
    }
  }

  async function deleteRank(rank: Rank) {
    if (rank.isAdminRank) {
      toast.error("Admin ranks are controlled by config/admin_permissions.json.")
      return
    }
    setDeleteTarget({ type: "rank", label: rank.rank, id: rank.rank })
  }

  async function submitDiscord() {
    const discordId = discordDraft.discordId.trim()

    if (!/^\d{17,20}$/.test(discordId)) {
      toast.error("Enter a valid Discord user ID.")
      return
    }

    setIsSaving(true)

    try {
      await requestJson("/api/admin/discord-permissions", {
        method: "POST",
        body: JSON.stringify({
          discordId,
          permissions: uniqueStrings(discordDraft.permissions),
          isSuperAdmin: false,
        }),
      })

      toast.success(
        modalMode === "edit"
          ? "Discord permissions updated."
          : "Discord permissions added.",
      )

      setIsSaving(false)
      closeModal()
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save Discord permissions.",
      )

      setIsSaving(false)
    }
  }

  async function deleteDiscord(entry: DiscordPermission) {
    if (entry.isSuperAdmin) {
      toast.error("Super Admin Discord IDs are controlled by config/admin_permissions.json.")
      return
    }
    setDeleteTarget({
      type: "discord",
      label: `${discordDisplayName(entry.discordId)} (${entry.discordId})`,
      id: entry.discordId,
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-500">
              <Shield className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Permissions
              </h1>

              <p className="text-sm text-muted-foreground">
                Manage web permissions, ranks and individual Discord access.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={isLoading}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* WEB PERMISSIONS */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader
            icon={<Shield className="h-5 w-5" />}
            title="Web Permissions"
            description="Each permission can contain as many routes as you need."
            button={
              <Button type="button" onClick={openCreatePermission}>
                <Plus className="mr-2 h-4 w-4" />
                Add Permission
              </Button>
            }
          />

          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Loading permissions...
              </div>
            ) : permissions.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No web permissions have been created.
              </div>
            ) : (
              permissions.map((permission) => {
                const expanded = expandedPermissions.has(permission.key)

                return (
                  <div key={permission.key}>
                    <div className="flex items-center gap-3 px-6 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          togglePermissionExpanded(permission.key)
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                        />

                        <span className="truncate font-semibold">
                          {permission.name || permission.key}
                        </span>

                        <span className="hidden rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground sm:inline">
                          {permission.key}
                        </span>
                      </button>

                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => openEditPermission(permission)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => duplicatePermission(permission)}
                        aria-label={`Duplicate ${permission.name || permission.key}`}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 px-3"
                        onClick={() => void deletePermission(permission)}
                        aria-label={`Delete ${permission.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {expanded ? (
                      <div className="border-t border-border bg-muted/20 px-6 py-5">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium">
                              Description
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                              {permission.description || "No description."}
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                Routes
                              </p>

                              <span className="text-xs text-muted-foreground">
                                {permission.urls.length}{" "}
                                {permission.urls.length === 1
                                  ? "route"
                                  : "routes"}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {permission.urls.map((url, index) => (
                                <span
                                  key={`${url}-${index}`}
                                  className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground"
                                >
                                  {url}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* RANK PERMISSIONS */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader
            icon={<Users className="h-5 w-5" />}
            title="Rank Permissions"
            description="Assign any number of Web Permissions to a rank."
            button={
              <Button type="button" onClick={openCreateRank}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rank
              </Button>
            }
          />

          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Loading ranks...
              </div>
            ) : ranks.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No rank permissions have been created.
              </div>
            ) : (
              ranks.map((rank) => {
                const expanded = expandedRanks.has(rank.rank)

                return (
                  <div key={rank.rank}>
                    <div className="flex items-center gap-3 px-6 py-4">
                      <button
                        type="button"
                        onClick={() => toggleRankExpanded(rank.rank)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                        />

                        <span className="truncate font-semibold">
                          {rank.rank}
                        </span>

                        {rank.isAdminRank ? (
                          <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                            Admin Rank
                          </span>
                        ) : null}
                      </button>

                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => openEditRank(rank)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => duplicateRank(rank)}
                        aria-label={`Duplicate ${rank.rank}`}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 px-3"
                        disabled={rank.isAdminRank}
                        onClick={() => void deleteRank(rank)}
                        aria-label={`Delete ${rank.rank}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {expanded ? (
                      <div className="border-t border-border bg-muted/20 px-6 py-5">
                        {rank.isAdminRank ? (
                          <p className="mb-4 text-xs text-muted-foreground">
                            This rank is controlled by{" "}
                            <code className="rounded bg-muted px-1.5 py-0.5">
                              config/admin_permissions.json
                            </code>
                            . It automatically receives the admin permission.
                          </p>
                        ) : null}

                        {rank.permissions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No Web Permissions assigned.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {rank.permissions.map((permission) => (
                              <span
                                key={permission}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                                {permissionDisplayName(permission)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* DISCORD PERMISSIONS */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader
            icon={<Shield className="h-5 w-5" />}
            title="Discord Permissions"
            description="Give individual Discord users additional Web Permissions."
            button={
              <Button type="button" onClick={openCreateDiscord}>
                <Plus className="mr-2 h-4 w-4" />
                Add Discord ID
              </Button>
            }
          />

          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Loading Discord permissions...
              </div>
            ) : discordPermissions.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No Discord overrides.
              </div>
            ) : (
              discordPermissions.map((entry) => {
                const expanded = expandedDiscord.has(entry.discordId)

                return (
                  <div key={entry.discordId}>
                    <div className="flex items-center gap-3 px-6 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          toggleDiscordExpanded(entry.discordId)
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                        />

                        <span
                          className="truncate text-sm font-semibold text-blue-400"
                          title={`${discordDisplayName(entry.discordId)} (${entry.discordId})`}
                          onClick={(event) => {
                            event.stopPropagation()
                            const rect = event.currentTarget.getBoundingClientRect()
                            setContextMenu({
                              discordId: entry.discordId,
                              x: rect.left,
                              y: rect.bottom + 6,
                            })
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setContextMenu({
                              discordId: entry.discordId,
                              x: event.clientX,
                              y: event.clientY,
                            })
                          }}
                        >
                          {discordDisplayName(entry.discordId)} ({entry.discordId})
                        </span>

                        {entry.isSuperAdmin ? (
                          <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                            Super Admin
                          </span>
                        ) : null}
                      </button>

                      {!entry.isSuperAdmin ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => openEditDiscord(entry)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => duplicateDiscord(entry)}
                            aria-label={`Duplicate ${entry.discordId}`}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 px-3"
                            onClick={() => void deleteDiscord(entry)}
                            aria-label={`Delete ${entry.discordId}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>

                    {expanded ? (
                      <div className="border-t border-border bg-muted/20 px-6 py-5">
                        {entry.isSuperAdmin ? (
                          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-300">
                            This Discord ID has full access through the Super
                            Admin configuration.
                          </div>
                        ) : entry.permissions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No Web Permissions assigned.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {entry.permissions.map((permission) => (
                              <span
                                key={permission}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                                {permissionDisplayName(permission)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* SYSTEM CONFIGURATION */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-6 py-5">
            <h2 className="font-semibold">System Configuration</h2>

            <p className="text-sm text-muted-foreground">
              These values are read-only and controlled by the system
              configuration.
            </p>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium">Admin Ranks</p>

              {adminRanks.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {adminRanks.map((rank) => (
                    <span
                      key={rank}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs"
                    >
                      {rank}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No admin ranks configured.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium">
                Super Admin Discord IDs
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                {superAdminIds.length}{" "}
                {superAdminIds.length === 1 ? "ID" : "IDs"} configured.
              </p>
            </div>
          </div>
        </section>
      </div>

      {contextMenu ? (
        <div
          className="fixed z-[100] min-w-52 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-2xl"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 70) }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
            onClick={() => {
              void copyText(contextMenu.discordId, "Discord ID")
              setContextMenu(null)
            }}
          >
            <Copy className="h-4 w-4" />
            Copy ID
          </button>
        </div>
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        title="Confirm Delete"
        description="This action cannot be undone."
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete
            <span className="mx-1 font-semibold text-foreground">
              {deleteTarget?.label}
            </span>?
          </p>
        </div>
      </Modal>

      {/* PERMISSION MODAL */}
      <Modal
        open={modalKind === "permission"}
        title={
          modalMode === "edit"
            ? "Edit Web Permission"
            : "Add Web Permission"
        }
        description="Add one or as many routes as required."
        onClose={closeModal}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => void submitPermission()}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving
                ? "Saving..."
                : modalMode === "edit"
                  ? "Save Changes"
                  : "Create Permission"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Permission Key
            </label>

            <input
              value={permissionDraft.key}
              onChange={(event) =>
                setPermissionDraft((current) => ({
                  ...current,
                  key: event.target.value.toLowerCase(),
                }))
              }
              disabled={modalMode === "edit"}
              placeholder="documents"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Display Name
            </label>

            <input
              value={permissionDraft.name}
              onChange={(event) =>
                setPermissionDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Documents"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>

            <textarea
              value={permissionDraft.description}
              onChange={(event) =>
                setPermissionDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={4}
              placeholder="Describe what this permission allows."
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium">
                Routes
              </label>

              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={addRoute}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Route
              </Button>
            </div>

            <div className="space-y-2">
              {permissionDraft.urls.map((url, index) => (
                <div
                  key={`route-${index}`}
                  className="flex items-center gap-2"
                >
                  <input
                    data-route-index={index}
                    value={url}
                    onChange={(event) =>
                      updateRoute(index, event.target.value)
                    }
                    onKeyDown={(event) =>
                      handleRouteKeyDown(event, index)
                    }
                    placeholder="/dashboard/example"
                    autoComplete="off"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition focus:border-blue-500"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-11 shrink-0 px-0"
                    onClick={() => removeRoute(index)}
                    aria-label={`Remove route ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Press Enter to add another route. You can add unlimited routes.
            </p>
          </div>
        </div>
      </Modal>

      {/* RANK MODAL */}
      <Modal
        open={modalKind === "rank"}
        title={modalMode === "edit" ? "Edit Rank" : "Add Rank"}
        description="Choose which Web Permissions this rank receives."
        onClose={closeModal}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => void submitRank()}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving
                ? "Saving..."
                : modalMode === "edit"
                  ? "Save Changes"
                  : "Create Rank"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Rank Name
            </label>

            <input
              value={rankDraft.rank}
              onChange={(event) =>
                setRankDraft((current) => ({
                  ...current,
                  rank: event.target.value,
                }))
              }
              disabled={modalMode === "edit" && rankDraft.isAdminRank}
              placeholder="Officer"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {rankDraft.isAdminRank ? (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-muted-foreground">
              This is an Admin Rank. Admin access is automatically granted
              through the system configuration.
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium">
                Web Permissions
              </label>

              <span className="text-xs text-muted-foreground">
                {rankDraft.permissions.length} selected
              </span>
            </div>

            {permissionKeys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Create a Web Permission first.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                    placeholder="Search permissions..."
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-blue-500"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                {filteredPermissionKeys.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No permissions match your search.
                  </div>
                ) : filteredPermissionKeys.map((permissionKey) => {
                  const checked =
                    rankDraft.permissions.includes(permissionKey)

                  return (
                    <label
                      key={permissionKey}
                      className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleDraftPermission(
                            permissionKey,
                            "rank",
                          )
                        }
                        className="h-4 w-4 accent-blue-500"
                      />

                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {permissionDisplayName(permissionKey)}
                      </span>
                    </label>
                  )
                })}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* DISCORD MODAL */}
      <Modal
        open={modalKind === "discord"}
        title={
          modalMode === "edit"
            ? "Edit Discord Permissions"
            : "Add Discord Permissions"
        }
        description="Give one Discord user additional Web Permissions."
        onClose={closeModal}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => void submitDiscord()}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving
                ? "Saving..."
                : modalMode === "edit"
                  ? "Save Changes"
                  : "Add Discord ID"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Discord User ID
            </label>

            <input
              value={discordDraft.discordId}
              onChange={(event) =>
                setDiscordDraft((current) => ({
                  ...current,
                  discordId: event.target.value.replace(/\D/g, ""),
                }))
              }
              disabled={modalMode === "edit"}
              inputMode="numeric"
              placeholder="123456789012345678"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <p className="mt-2 text-xs text-muted-foreground">
              Enter the Discord user's numeric ID.
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium">
                Web Permissions
              </label>

              <span className="text-xs text-muted-foreground">
                {discordDraft.permissions.length} selected
              </span>
            </div>

            {permissionKeys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Create a Web Permission first.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                    placeholder="Search permissions..."
                    className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-blue-500"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                {filteredPermissionKeys.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No permissions match your search.
                  </div>
                ) : filteredPermissionKeys.map((permissionKey) => {
                  const checked =
                    discordDraft.permissions.includes(permissionKey)

                  return (
                    <label
                      key={permissionKey}
                      className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleDraftPermission(
                            permissionKey,
                            "discord",
                          )
                        }
                        className="h-4 w-4 accent-blue-500"
                      />

                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {permissionDisplayName(permissionKey)}
                      </span>
                    </label>
                  )
                })}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
