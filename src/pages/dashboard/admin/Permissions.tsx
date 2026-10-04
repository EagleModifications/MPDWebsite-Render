import {
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  Edit3,
  Plus,
  RotateCcw,
  Save,
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

type ModalType =
  | "permission"
  | "rank"
  | "discord"
  | null

type ModalMode = "create" | "edit"

type ModalState = {
  type: ModalType
  mode: ModalMode
}

const emptyPermission: Permission = {
  key: "",
  name: "",
  description: "",
  urls: [],
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

function normalizeList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function normalizePath(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  const withoutQuery = trimmed.split("?")[0].split("#")[0]

  if (withoutQuery === "/") {
    return "/"
  }

  return withoutQuery.replace(/\/+$/, "")
}

function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ml-4 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          {children}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/10 px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
      </label>

      {children}
    </div>
  )
}

const inputClassName =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"

const textareaClassName =
  "min-h-[110px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"

export default function Permissions() {
  const [permissions, setPermissions] = useState<
    Permission[]
  >([])

  const [ranks, setRanks] = useState<Rank[]>([])

  const [discordPermissions, setDiscordPermissions] =
    useState<DiscordPermission[]>([])

  const [adminRanks, setAdminRanks] = useState<string[]>(
    [],
  )

  const [superAdminIds, setSuperAdminIds] = useState<
    string[]
  >([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [modal, setModal] = useState<ModalState>({
    type: null,
    mode: "create",
  })

  const [permissionDraft, setPermissionDraft] =
    useState<Permission>(emptyPermission)

  const [rankDraft, setRankDraft] =
    useState<Rank>(emptyRank)

  const [discordDraft, setDiscordDraft] =
    useState<DiscordPermission>(emptyDiscord)

  const navigate = useNavigate()

  function closeModal() {
    if (isSaving) {
      return
    }

    setModal({
      type: null,
      mode: "create",
    })
  }

  function openCreatePermission() {
    setPermissionDraft({
      ...emptyPermission,
      urls: [],
    })

    setModal({
      type: "permission",
      mode: "create",
    })
  }

  function openEditPermission(permission: Permission) {
    setPermissionDraft({
      ...permission,
      urls: [...permission.urls],
    })

    setModal({
      type: "permission",
      mode: "edit",
    })
  }

  function openCreateRank() {
    setRankDraft({
      ...emptyRank,
      permissions: [],
    })

    setModal({
      type: "rank",
      mode: "create",
    })
  }

  function openEditRank(rank: Rank) {
    setRankDraft({
      ...rank,
      permissions: [...rank.permissions],
    })

    setModal({
      type: "rank",
      mode: "edit",
    })
  }

  function openCreateDiscord() {
    setDiscordDraft({
      ...emptyDiscord,
      permissions: [],
    })

    setModal({
      type: "discord",
      mode: "create",
    })
  }

  function openEditDiscord(item: DiscordPermission) {
    if (item.isSuperAdmin) {
      return
    }

    setDiscordDraft({
      ...item,
      permissions: [...item.permissions],
    })

    setModal({
      type: "discord",
      mode: "edit",
    })
  }

  async function load() {
    try {
      setIsLoading(true)

      const pageCheck = await fetch(
        `/api/auth/check?url=${encodeURIComponent(
          window.location.pathname,
        )}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      )

      if (pageCheck.status === 401) {
        navigate("/sign-in", {
          replace: true,
        })
        return
      }

      if (pageCheck.status === 403) {
        navigate("/dashboard", {
          replace: true,
        })
        return
      }

      if (!pageCheck.ok) {
        throw new Error(
          `Failed to verify page access (${pageCheck.status}).`,
        )
      }

      const response = await fetch(
        "/api/admin/permissions",
        {
          credentials: "include",
          cache: "no-store",
        },
      )

      const text = await response.text()

      const data = text
        ? (JSON.parse(text) as PermissionResponse)
        : {}

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Failed to load permissions (${response.status}).`,
        )
      }

      setPermissions(data.permissions ?? [])
      setRanks(data.ranks ?? [])
      setDiscordPermissions(
        data.discordPermissions ?? [],
      )
      setAdminRanks(data.adminRanks ?? [])
      setSuperAdminIds(
        data.superAdminDiscordIds ?? [],
      )
    } catch (error) {
      toast.error("Failed to load permissions", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [navigate])

  async function request(
    url: string,
    method: string,
    body?: unknown,
  ) {
    const response = await fetch(url, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: body
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
      body: body
        ? JSON.stringify(body)
        : undefined,
    })

    const text = await response.text()

    const data = text
      ? (JSON.parse(text) as PermissionResponse)
      : {}

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          `Request failed (${response.status}).`,
      )
    }

    return data
  }

  async function submitPermission() {
    const key = permissionDraft.key
      .trim()
      .toLowerCase()

    const urls = Array.from(
      new Set(
        permissionDraft.urls
          .map(normalizePath)
          .filter(Boolean),
      ),
    )

    if (!key) {
      toast.error("Permission key is required.")
      return
    }

    if (!urls.length) {
      toast.error(
        "Add at least one URL to this permission.",
      )
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        ...permissionDraft,
        key,
        urls,
      }

      if (modal.mode === "edit") {
        await request(
          `/api/admin/permissions/${encodeURIComponent(
            permissionDraft.key,
          )}`,
          "PUT",
          payload,
        )

        toast.success("Permission updated")
      } else {
        await request(
          "/api/admin/permissions",
          "POST",
          payload,
        )

        toast.success("Permission created")
      }

      closeModal()
      await load()
    } catch (error) {
      toast.error(
        modal.mode === "edit"
          ? "Failed to update permission"
          : "Failed to create permission",
        {
          description:
            error instanceof Error
              ? error.message
              : "Unexpected error.",
        },
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deletePermission(key: string) {
    if (
      !window.confirm(
        `Delete permission "${key}"?`,
      )
    ) {
      return
    }

    try {
      setIsSaving(true)

      await request(
        `/api/admin/permissions/${encodeURIComponent(
          key,
        )}`,
        "DELETE",
      )

      await load()

      toast.success("Permission deleted")
    } catch (error) {
      toast.error("Failed to delete permission", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function submitRank() {
    const rank = rankDraft.rank.trim()

    if (!rank) {
      toast.error("Rank name is required.")
      return
    }

    try {
      setIsSaving(true)

      if (modal.mode === "edit") {
        await request(
          `/api/admin/ranks/${encodeURIComponent(
            rankDraft.rank,
          )}`,
          "PUT",
          {
            rank: rankDraft.rank,
            permissions: rankDraft.permissions,
          },
        )

        toast.success("Rank updated")
      } else {
        await request(
          "/api/admin/ranks",
          "POST",
          {
            rank,
            permissions: rankDraft.permissions,
          },
        )

        toast.success("Rank created")
      }

      closeModal()
      await load()
    } catch (error) {
      toast.error(
        modal.mode === "edit"
          ? "Failed to update rank"
          : "Failed to create rank",
        {
          description:
            error instanceof Error
              ? error.message
              : "Unexpected error.",
        },
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteRank(rank: Rank) {
    if (rank.isAdminRank) {
      return
    }

    if (
      !window.confirm(
        `Delete rank "${rank.rank}"?`,
      )
    ) {
      return
    }

    try {
      setIsSaving(true)

      await request(
        `/api/admin/ranks/${encodeURIComponent(
          rank.rank,
        )}`,
        "DELETE",
      )

      await load()

      toast.success("Rank deleted")
    } catch (error) {
      toast.error("Failed to delete rank", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function submitDiscord() {
    const discordId =
      discordDraft.discordId.trim()

    if (
      !/^\d{17,20}$/.test(discordId)
    ) {
      toast.error(
        "Enter a valid Discord user ID.",
      )
      return
    }

    try {
      setIsSaving(true)

      await request(
        "/api/admin/discord-permissions",
        "POST",
        {
          discordId,
          permissions:
            discordDraft.permissions,
          isSuperAdmin: false,
        },
      )

      closeModal()
      await load()

      toast.success(
        modal.mode === "edit"
          ? "Discord permissions updated"
          : "Discord ID added",
      )
    } catch (error) {
      toast.error(
        modal.mode === "edit"
          ? "Failed to update Discord permissions"
          : "Failed to add Discord ID",
        {
          description:
            error instanceof Error
              ? error.message
              : "Unexpected error.",
        },
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteDiscord(
    discordId: string,
  ) {
    if (
      !window.confirm(
        `Remove Discord permissions for ${discordId}?`,
      )
    ) {
      return
    }

    try {
      setIsSaving(true)

      await request(
        `/api/admin/discord-permissions/${encodeURIComponent(
          discordId,
        )}`,
        "DELETE",
      )

      await load()

      toast.success(
        "Discord permissions removed",
      )
    } catch (error) {
      toast.error(
        "Failed to remove Discord permissions",
        {
          description:
            error instanceof Error
              ? error.message
              : "Unexpected error.",
        },
      )
    } finally {
      setIsSaving(false)
    }
  }

  function togglePermission(
    current: string[],
    key: string,
    checked: boolean,
  ): string[] {
    if (checked) {
      return Array.from(
        new Set([...current, key]),
      )
    }

    return current.filter(
      (item) => item !== key,
    )
  }

  const modalPermissionKeys =
    permissions.map(
      (permission) => permission.key,
    )

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                Permissions
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage web permissions, ranks and individual
                Discord access.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={isLoading || isSaving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Loading permissions...
            </p>
          </div>
        ) : (
          <>
            {/* WEB PERMISSIONS */}
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] items-center justify-between border-b border-border px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Web Permissions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Each permission can contain as many routes
                      as you need.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={openCreatePermission}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Permission
                </Button>
              </div>

              {permissions.length === 0 ? (
                <div className="p-6">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Shield className="mx-auto h-8 w-8 text-muted-foreground" />

                    <p className="mt-3 text-sm font-medium">
                      No permissions created
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Create your first permission to get started.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {permissions.map(
                    (permission, index) => (
                      <div
                        key={permission.key}
                        className={`px-6 py-5 ${
                          index !==
                          permissions.length - 1
                            ? "border-b border-border"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold">
                                {permission.name ||
                                  permission.key}
                              </h3>

                              <span className="rounded-md border border-border bg-muted/20 px-2 py-1 font-mono text-[11px]">
                                {permission.key}
                              </span>
                            </div>

                            {permission.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {
                                  permission.description
                                }
                              </p>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                              {permission.urls.map(
                                (url) => (
                                  <span
                                    key={url}
                                    className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs"
                                  >
                                    {url}
                                  </span>
                                ),
                              )}
                            </div>

                            <p className="mt-3 text-xs text-muted-foreground">
                              {permission.urls.length}{" "}
                              {permission.urls
                                .length === 1
                                ? "route"
                                : "routes"}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                openEditPermission(
                                  permission,
                                )
                              }
                              disabled={isSaving}
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                void deletePermission(
                                  permission.key,
                                )
                              }
                              disabled={isSaving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>

            {/* RANK PERMISSIONS */}
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] items-center justify-between border-b border-border px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Rank Permissions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Assign any number of Web Permissions to a
                      rank.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={openCreateRank}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rank
                </Button>
              </div>

              {ranks.length === 0 ? (
                <div className="p-6">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground" />

                    <p className="mt-3 text-sm font-medium">
                      No MongoDB ranks created
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {ranks.map((rank, index) => (
                    <div
                      key={rank.rank}
                      className={`px-6 py-5 ${
                        index !== ranks.length - 1
                          ? "border-b border-border"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold">
                              {rank.rank}
                            </h3>

                            {rank.isAdminRank && (
                              <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-500">
                                JSON Admin Rank
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {rank.isAdminRank && (
                              <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-500">
                                permissionadmin
                              </span>
                            )}

                            {rank.permissions.length === 0 &&
                              !rank.isAdminRank && (
                                <span className="text-sm text-muted-foreground">
                                  No Web Permissions assigned
                                </span>
                              )}

                            {rank.permissions.map(
                              (permission) => (
                                <span
                                  key={permission}
                                  className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs"
                                >
                                  {permission}
                                </span>
                              ),
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              openEditRank(rank)
                            }
                            disabled={isSaving}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit
                          </Button>

                          {!rank.isAdminRank && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                void deleteRank(rank)
                              }
                              disabled={isSaving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* DISCORD PERMISSIONS */}
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] items-center justify-between border-b border-border px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Discord Permissions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Give individual Discord users additional Web
                      Permissions.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={openCreateDiscord}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Discord ID
                </Button>
              </div>

              {discordPermissions.length === 0 ? (
                <div className="p-6">
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Shield className="mx-auto h-8 w-8 text-muted-foreground" />

                    <p className="mt-3 text-sm font-medium">
                      No Discord overrides
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {discordPermissions.map(
                    (item, index) => (
                      <div
                        key={item.discordId}
                        className={`px-6 py-5 ${
                          index !==
                          discordPermissions.length - 1
                            ? "border-b border-border"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-mono text-sm font-semibold">
                                {item.discordId}
                              </h3>

                              {item.isSuperAdmin && (
                                <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-500">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.isSuperAdmin ? (
                                <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold text-blue-500">
                                  *
                                </span>
                              ) : item.permissions.length ? (
                                item.permissions.map(
                                  (permission) => (
                                    <span
                                      key={permission}
                                      className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs"
                                    >
                                      {permission}
                                    </span>
                                  ),
                                )
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  No permissions assigned
                                </span>
                              )}
                            </div>
                          </div>

                          {!item.isSuperAdmin && (
                            <div className="flex shrink-0 gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  openEditDiscord(
                                    item,
                                  )
                                }
                                disabled={isSaving}
                              >
                                <Edit3 className="mr-2 h-4 w-4" />
                                Edit
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  void deleteDiscord(
                                    item.discordId,
                                  )
                                }
                                disabled={isSaving}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>

            {/* JSON CONFIG */}
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] items-center gap-3 border-b border-border px-6 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>

                <div>
                  <h2 className="text-base font-semibold">
                    System Configuration
                  </h2>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Admin ranks and Super Admin accounts are
                    controlled by the JSON configuration.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-6 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Admin Ranks
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {adminRanks.length ? (
                      adminRanks.map((rank) => (
                        <span
                          key={rank}
                          className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-500"
                        >
                          {rank}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        None configured
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Super Admin Discord IDs
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {superAdminIds.length ? (
                      superAdminIds.map((id) => (
                        <span
                          key={id}
                          className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 font-mono text-xs text-blue-500"
                        >
                          {id}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        None configured
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-border bg-muted/10 px-6 py-4">
                <p className="text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Admin ranks:
                  </span>{" "}
                  automatically receive{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    permissionadmin
                  </code>
                  . They do not automatically receive every Web
                  Permission.
                </p>

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Super Admins:
                  </span>{" "}
                  receive the{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    *
                  </code>{" "}
                  permission and bypass individual Web Permission
                  assignments.
                </p>
              </div>
            </section>
          </>
        )}

        {/* PERMISSION MODAL */}
        <Modal
          open={modal.type === "permission"}
          title={
            modal.mode === "edit"
              ? "Edit Web Permission"
              : "Add Web Permission"
          }
          description="Add one or as many routes as required. Enter one route per line."
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
                onClick={() =>
                  void submitPermission()
                }
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving
                  ? "Saving..."
                  : modal.mode === "edit"
                    ? "Save Changes"
                    : "Create Permission"}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <Field label="Permission Key">
              <input
                value={permissionDraft.key}
                onChange={(event) =>
                  setPermissionDraft(
                    (current) => ({
                      ...current,
                      key: event.target.value,
                    }),
                  )
                }
                disabled={modal.mode === "edit"}
                placeholder="promotionroster"
                className={`${inputClassName} ${
                  modal.mode === "edit"
                    ? "cursor-not-allowed bg-muted/30"
                    : ""
                }`}
              />
            </Field>

            <Field label="Display Name">
              <input
                value={permissionDraft.name}
                onChange={(event) =>
                  setPermissionDraft(
                    (current) => ({
                      ...current,
                      name: event.target.value,
                    }),
                  )
                }
                placeholder="Promotion Roster"
                className={inputClassName}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={permissionDraft.description}
                onChange={(event) =>
                  setPermissionDraft(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }),
                  )
                }
                placeholder="Allows access to the promotion roster."
                className={textareaClassName}
              />
            </Field>

            <Field label="Routes">
              <textarea
                value={permissionDraft.urls.join(
                  "\n",
                )}
                onChange={(event) =>
                  setPermissionDraft(
                    (current) => ({
                      ...current,
                      urls: normalizeList(
                        event.target.value,
                      ).map(normalizePath),
                    }),
                  )
                }
                placeholder={`/dashboard/promotion/promotionroster
/dashboard/promotion/history
/dashboard/promotion/manage`}
                className="min-h-[180px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />

              <p className="text-xs text-muted-foreground">
                You can add unlimited routes. Put each route on
                its own line.
              </p>
            </Field>
          </div>
        </Modal>

        {/* RANK MODAL */}
        <Modal
          open={modal.type === "rank"}
          title={
            modal.mode === "edit"
              ? "Edit Rank Permissions"
              : "Add Rank"
          }
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
                  : modal.mode === "edit"
                    ? "Save Changes"
                    : "Create Rank"}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <Field label="Rank Name">
              <input
                value={rankDraft.rank}
                onChange={(event) =>
                  setRankDraft((current) => ({
                    ...current,
                    rank: event.target.value,
                  }))
                }
                disabled={modal.mode === "edit"}
                placeholder="Sergeant"
                className={`${inputClassName} ${
                  modal.mode === "edit"
                    ? "cursor-not-allowed bg-muted/30"
                    : ""
                }`}
              />
            </Field>

            {rankDraft.isAdminRank && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-sm font-semibold text-blue-500">
                  JSON Admin Rank
                </p>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This rank automatically receives
                  permissionadmin. You can still assign specific
                  Web Permissions below.
                </p>
              </div>
            )}

            <Field label="Web Permissions">
              <div className="grid gap-2 sm:grid-cols-2">
                {modalPermissionKeys.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground sm:col-span-2">
                    No Web Permissions exist yet.
                  </div>
                ) : (
                  modalPermissionKeys.map(
                    (key) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-sm transition-colors hover:bg-muted/30"
                      >
                        <input
                          type="checkbox"
                          checked={rankDraft.permissions.includes(
                            key,
                          )}
                          onChange={(event) =>
                            setRankDraft(
                              (current) => ({
                                ...current,
                                permissions:
                                  togglePermission(
                                    current.permissions,
                                    key,
                                    event.target
                                      .checked,
                                  ),
                              }),
                            )
                          }
                          className="h-4 w-4"
                        />

                        <span className="font-mono text-xs">
                          {key}
                        </span>
                      </label>
                    ),
                  )
                )}
              </div>
            </Field>
          </div>
        </Modal>

        {/* DISCORD MODAL */}
        <Modal
          open={modal.type === "discord"}
          title={
            modal.mode === "edit"
              ? "Edit Discord Permissions"
              : "Add Discord Permissions"
          }
          description="Give a Discord account additional Web Permissions."
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
                onClick={() =>
                  void submitDiscord()
                }
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving
                  ? "Saving..."
                  : modal.mode === "edit"
                    ? "Save Changes"
                    : "Add Discord ID"}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <Field label="Discord User ID">
              <input
                value={discordDraft.discordId}
                onChange={(event) =>
                  setDiscordDraft(
                    (current) => ({
                      ...current,
                      discordId:
                        event.target.value,
                    }),
                  )
                }
                disabled={modal.mode === "edit"}
                placeholder="123456789012345678"
                inputMode="numeric"
                className={`${inputClassName} ${
                  modal.mode === "edit"
                    ? "cursor-not-allowed bg-muted/30"
                    : ""
                }`}
              />
            </Field>

            <Field label="Web Permissions">
              <div className="grid gap-2 sm:grid-cols-2">
                {modalPermissionKeys.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground sm:col-span-2">
                    No Web Permissions exist yet.
                  </div>
                ) : (
                  modalPermissionKeys.map(
                    (key) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-sm transition-colors hover:bg-muted/30"
                      >
                        <input
                          type="checkbox"
                          checked={discordDraft.permissions.includes(
                            key,
                          )}
                          onChange={(event) =>
                            setDiscordDraft(
                              (current) => ({
                                ...current,
                                permissions:
                                  togglePermission(
                                    current.permissions,
                                    key,
                                    event.target
                                      .checked,
                                  ),
                              }),
                            )
                          }
                          className="h-4 w-4"
                        />

                        <span className="font-mono text-xs">
                          {key}
                        </span>
                      </label>
                    ),
                  )
                )}
              </div>
            </Field>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
