import {
  useEffect,
  useMemo,
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
  protectedUrls?: string[]
  message?: string
  error?: string
}

type ModalType =
  | "permission"
  | "rank"
  | "discord"
  | null

type ModalMode = "create" | "edit"

const emptyPermission: Permission = {
  key: "",
  name: "",
  description: "",
  urls: [""],
}

function normalizePath(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  const withoutQuery = trimmed
    .split("?")[0]
    .split("#")[0]

  if (withoutQuery === "/") {
    return "/"
  }

  return withoutQuery.replace(/\/+$/, "")
}

function normalizeRoutes(urls: string[]): string[] {
  return Array.from(
    new Set(
      urls
        .map(normalizePath)
        .filter(Boolean),
    ),
  )
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
    (permission) => permission !== key,
  )
}

type ModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  saving?: boolean
}

function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  saving = false,
}: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose()
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
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

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-6">
          {children}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-muted/10 px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  )
}

export default function Permissions() {
  const navigate = useNavigate()

  const [permissions, setPermissions] =
    useState<Permission[]>([])

  const [ranks, setRanks] =
    useState<Rank[]>([])

  const [discordPermissions, setDiscordPermissions] =
    useState<DiscordPermission[]>([])

  const [adminRanks, setAdminRanks] =
    useState<string[]>([])

  const [superAdminIds, setSuperAdminIds] =
    useState<string[]>([])

  const [protectedUrls, setProtectedUrls] =
    useState<string[]>([])

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  const [modalType, setModalType] =
    useState<ModalType>(null)

  const [modalMode, setModalMode] =
    useState<ModalMode>("create")

  const [permissionDraft, setPermissionDraft] =
    useState<Permission>({
      ...emptyPermission,
      urls: [""],
    })

  const [rankDraft, setRankDraft] =
    useState<Rank>({
      rank: "",
      permissions: [],
      isAdminRank: false,
    })

  const [discordDraft, setDiscordDraft] =
    useState<DiscordPermission>({
      discordId: "",
      permissions: [],
      isSuperAdmin: false,
    })

  const permissionKeys = useMemo(
    () =>
      permissions.map(
        (permission) => permission.key,
      ),
    [permissions],
  )

  /*
   * =========================================================
   * LOAD
   * =========================================================
   */

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
        navigate("/no-permission", {
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
        ? (JSON.parse(
            text,
          ) as PermissionResponse)
        : {}

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Failed to load permissions (${response.status}).`,
        )
      }

      setPermissions(
        data.permissions ?? [],
      )

      setRanks(
        data.ranks ?? [],
      )

      setDiscordPermissions(
        data.discordPermissions ?? [],
      )

      setAdminRanks(
        data.adminRanks ?? [],
      )

      setSuperAdminIds(
        data.superAdminDiscordIds ?? [],
      )

      setProtectedUrls(
        Array.from(
          new Set(
            (data.protectedUrls ?? [])
              .map(normalizePath)
              .filter(Boolean),
          ),
        ),
      )
    } catch (error) {
      toast.error(
        "Failed to load permissions",
        {
          description:
            error instanceof Error
              ? error.message
              : "Unexpected error.",
        },
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [navigate])

  /*
   * =========================================================
   * REQUEST
   * =========================================================
   */

  async function request(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<PermissionResponse> {
    const response = await fetch(
      url,
      {
        method,
        credentials: "include",
        cache: "no-store",
        headers: body
          ? {
              "Content-Type":
                "application/json",
            }
          : undefined,
        body: body
          ? JSON.stringify(body)
          : undefined,
      },
    )

    const text = await response.text()

    const data = text
      ? (JSON.parse(
          text,
        ) as PermissionResponse)
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

  /*
   * =========================================================
   * MODALS
   * =========================================================
   */

  function closeModal() {
    if (isSaving) {
      return
    }

    setModalType(null)
    setModalMode("create")

    setPermissionDraft({
      ...emptyPermission,
      urls: [""],
    })

    setRankDraft({
      rank: "",
      permissions: [],
      isAdminRank: false,
    })

    setDiscordDraft({
      discordId: "",
      permissions: [],
      isSuperAdmin: false,
    })
  }

  function openCreatePermission() {
    setModalMode("create")

    setPermissionDraft({
      ...emptyPermission,
      urls: [""],
    })

    setModalType("permission")
  }

  function openEditPermission(
    permission: Permission,
  ) {
    setModalMode("edit")

    setPermissionDraft({
      ...permission,
      urls:
        permission.urls.length > 0
          ? [...permission.urls]
          : [""],
    })

    setModalType("permission")
  }

  function openCreateRank() {
    setModalMode("create")

    setRankDraft({
      rank: "",
      permissions: [],
      isAdminRank: false,
    })

    setModalType("rank")
  }

  function openEditRank(rank: Rank) {
    setModalMode("edit")

    setRankDraft({
      ...rank,
      permissions: [
        ...rank.permissions,
      ],
    })

    setModalType("rank")
  }

  function openCreateDiscord() {
    setModalMode("create")

    setDiscordDraft({
      discordId: "",
      permissions: [],
      isSuperAdmin: false,
    })

    setModalType("discord")
  }

  function openEditDiscord(
    item: DiscordPermission,
  ) {
    if (item.isSuperAdmin) {
      return
    }

    setModalMode("edit")

    setDiscordDraft({
      ...item,
      permissions: [
        ...item.permissions,
      ],
    })

    setModalType("discord")
  }

  /*
   * =========================================================
   * ROUTE MANAGEMENT
   * =========================================================
   */

  function addRoute() {
    setPermissionDraft(
      (current) => ({
        ...current,
        urls: [
          ...current.urls,
          "",
        ],
      }),
    )
  }

  function removeRoute(
    index: number,
  ) {
    setPermissionDraft(
      (current) => {
        const nextUrls =
          current.urls.filter(
            (_, routeIndex) =>
              routeIndex !== index,
          )

        return {
          ...current,
          urls:
            nextUrls.length > 0
              ? nextUrls
              : [""],
        }
      },
    )
  }

  function updateRoute(
    index: number,
    value: string,
  ) {
    setPermissionDraft(
      (current) => ({
        ...current,
        urls: current.urls.map(
          (url, routeIndex) =>
            routeIndex === index
              ? value
              : url,
        ),
      }),
    )
  }

  /*
   * =========================================================
   * PERMISSIONS
   * =========================================================
   */

  async function savePermission() {
    const key =
      permissionDraft.key
        .trim()
        .toLowerCase()

    const name =
      permissionDraft.name.trim()

    const description =
      permissionDraft.description.trim()

    const urls =
      normalizeRoutes(
        permissionDraft.urls,
      )

    if (!key) {
      toast.error(
        "Permission key is required.",
      )

      return
    }

    if (!name) {
      toast.error(
        "Permission name is required.",
      )

      return
    }

    if (urls.length === 0) {
      toast.error(
        "Add at least one route.",
      )

      return
    }

    try {
      setIsSaving(true)

      if (modalMode === "create") {
        await request(
          "/api/admin/permissions",
          "POST",
          {
            key,
            name,
            description,
            urls,
          },
        )

        toast.success(
          "Permission created",
        )
      } else {
        await request(
          `/api/admin/permissions/${encodeURIComponent(
            permissionDraft.key,
          )}`,
          "PUT",
          {
            key:
              permissionDraft.key
                .trim()
                .toLowerCase(),
            name,
            description,
            urls,
          },
        )

        toast.success(
          "Permission saved",
        )
      }

      closeModal()

      await load()
    } catch (error) {
      toast.error(
        modalMode === "create"
          ? "Failed to create permission"
          : "Failed to save permission",
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

  async function deletePermission(
    key: string,
  ) {
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

      toast.success(
        "Permission deleted",
      )

      await load()
    } catch (error) {
      toast.error(
        "Failed to delete permission",
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

  /*
   * =========================================================
   * RANKS
   * =========================================================
   */

  async function saveRank() {
    const rank =
      rankDraft.rank.trim()

    if (!rank) {
      toast.error(
        "Rank name is required.",
      )

      return
    }

    try {
      setIsSaving(true)

      if (modalMode === "create") {
        await request(
          "/api/admin/ranks",
          "POST",
          {
            rank,
            permissions:
              rankDraft.permissions,
          },
        )

        toast.success(
          "Rank created",
        )
      } else {
        await request(
          `/api/admin/ranks/${encodeURIComponent(
            rankDraft.rank,
          )}`,
          "PUT",
          {
            rank:
              rankDraft.rank,
            permissions:
              rankDraft.permissions,
          },
        )

        toast.success(
          "Rank saved",
        )
      }

      closeModal()

      await load()
    } catch (error) {
      toast.error(
        modalMode === "create"
          ? "Failed to create rank"
          : "Failed to save rank",
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

  async function deleteRank(
    rank: Rank,
  ) {
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

      toast.success(
        "Rank deleted",
      )

      await load()
    } catch (error) {
      toast.error(
        "Failed to delete rank",
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

  /*
   * =========================================================
   * DISCORD
   * =========================================================
   */

  async function saveDiscord() {
    if (discordDraft.isSuperAdmin) {
      return
    }

    const discordId =
      discordDraft.discordId.trim()

    if (
      !/^\d{17,20}$/.test(
        discordId,
      )
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

      toast.success(
        modalMode === "create"
          ? "Discord permissions created"
          : "Discord permissions saved",
      )

      closeModal()

      await load()
    } catch (error) {
      toast.error(
        "Failed to save Discord permissions",
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

      toast.success(
        "Discord permissions removed",
      )

      await load()
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

  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                Permissions
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage web permissions, rank access, and Discord overrides.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={
              openCreatePermission
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Permission
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
            <div className="flex items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Loading permissions...
            </p>
          </div>
        ) : (
          <>
            {/* =================================================
                WEB PERMISSIONS
            ================================================== */}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] flex-col justify-between gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Web Permissions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Manage permissions and their associated routes.
                    </p>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {permissions.length}{" "}
                  {permissions.length ===
                  1
                    ? "permission"
                    : "permissions"}
                </span>
              </div>

              {permissions.length ===
              0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium">
                    No web permissions configured
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first permission to get started.
                  </p>

                  <Button
                    type="button"
                    onClick={
                      openCreatePermission
                    }
                    className="mt-4"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Permission
                  </Button>
                </div>
              ) : (
                <div>
                  {permissions.map(
                    (
                      permission,
                      index,
                    ) => (
                      <div
                        key={
                          permission.key
                        }
                        className={`px-6 py-5 ${
                          index !==
                          permissions.length -
                            1
                            ? "border-b border-border"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold">
                                {permission.name ||
                                  permission.key}
                              </h3>

                              <span className="rounded-md border border-border bg-muted/20 px-2 py-1 font-mono text-[11px] text-muted-foreground">
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

                            <div className="mt-3 flex flex-wrap gap-2">
                              {permission.urls.map(
                                (url) => (
                                  <span
                                    key={
                                      url
                                    }
                                    className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs text-muted-foreground"
                                  >
                                    {url}
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
                                openEditPermission(
                                  permission,
                                )
                              }
                              disabled={
                                isSaving
                              }
                              className="h-10"
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
                              disabled={
                                isSaving
                              }
                              className="h-10"
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

            {/* =================================================
                RANK PERMISSIONS
            ================================================== */}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] flex-col justify-between gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Rank Permissions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Assign Web Permissions to roster ranks.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    openCreateRank
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rank
                </Button>
              </div>

              {ranks.length ===
              0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium">
                    No ranks configured
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a rank to assign permissions.
                  </p>
                </div>
              ) : (
                <div>
                  {ranks.map(
                    (
                      rank,
                      index,
                    ) => (
                      <div
                        key={
                          rank.rank
                        }
                        className={`px-6 py-5 ${
                          index !==
                          ranks.length -
                            1
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

                            <div className="mt-2 flex flex-wrap gap-2">
                              {rank.permissions.length ===
                              0 ? (
                                <span className="text-sm text-muted-foreground">
                                  No Web Permissions assigned
                                </span>
                              ) : (
                                rank.permissions.map(
                                  (
                                    permission,
                                  ) => (
                                    <span
                                      key={
                                        permission
                                      }
                                      className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs"
                                    >
                                      {
                                        permission
                                      }
                                    </span>
                                  ),
                                )
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                openEditRank(
                                  rank,
                                )
                              }
                              disabled={
                                isSaving
                              }
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit
                            </Button>

                            {!rank.isAdminRank && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  void deleteRank(
                                    rank,
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>

            {/* =================================================
                DISCORD PERMISSIONS
            ================================================== */}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] flex-col justify-between gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Discord Permissions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Give individual Discord users additional Web Permissions.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    openCreateDiscord
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Discord ID
                </Button>
              </div>

              {discordPermissions.length ===
              0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium">
                    No Discord overrides configured
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a Discord ID to assign individual permissions.
                  </p>
                </div>
              ) : (
                <div>
                  {discordPermissions.map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={
                          item.discordId
                        }
                        className={`px-6 py-5 ${
                          index !==
                          discordPermissions.length -
                            1
                            ? "border-b border-border"
                            : ""
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-mono text-base font-semibold">
                                {
                                  item.discordId
                                }
                              </h3>

                              {item.isSuperAdmin && (
                                <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-500">
                                  Super Admin
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.isSuperAdmin ? (
                                <span className="text-sm text-muted-foreground">
                                  Full access controlled by JSON configuration
                                </span>
                              ) : item.permissions.length ===
                                0 ? (
                                <span className="text-sm text-muted-foreground">
                                  No Web Permissions assigned
                                </span>
                              ) : (
                                item.permissions.map(
                                  (
                                    permission,
                                  ) => (
                                    <span
                                      key={
                                        permission
                                      }
                                      className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs"
                                    >
                                      {
                                        permission
                                      }
                                    </span>
                                  ),
                                )
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
                                disabled={
                                  isSaving
                                }
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
                                disabled={
                                  isSaving
                                }
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

            {/* =================================================
                JSON CONFIGURATION
            ================================================== */}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] items-center gap-3 border-b border-border px-6 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>

                <div>
                  <h2 className="text-base font-semibold">
                    JSON Configuration
                  </h2>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Admin ranks, Super Admin IDs, and protected routes remain controlled by admin_permissions.json.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Admin Ranks
                  </p>

                  <p className="mt-3 text-sm leading-6">
                    {adminRanks.length
                      ? adminRanks.join(
                          ", ",
                        )
                      : "None configured"}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Super Admin Discord IDs
                  </p>

                  <p className="mt-3 text-sm leading-6">
                    {superAdminIds.length}
                  </p>
                </div>
              </div>
            </section>

            {/* REFRESH */}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void load()
                }
                disabled={
                  isLoading ||
                  isSaving
                }
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </>
        )}
      </div>

      {/* =======================================================
          PERMISSION MODAL
      ======================================================== */}

      <Modal
        open={
          modalType ===
          "permission"
        }
        title={
          modalMode === "create"
            ? "Add Web Permission"
            : "Edit Web Permission"
        }
        description="Create a permission and add as many routes as required."
        onClose={closeModal}
        saving={isSaving}
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
                void savePermission()
              }
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />

              {isSaving
                ? "Saving..."
                : modalMode ===
                    "create"
                  ? "Create Permission"
                  : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* KEY */}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Permission Key
            </label>

            <input
              value={
                permissionDraft.key
              }
              onChange={(event) =>
                setPermissionDraft(
                  (current) => ({
                    ...current,
                    key: event.target
                      .value,
                  }),
                )
              }
              disabled={
                modalMode === "edit"
              }
              placeholder="promotionroster"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-muted/20"
            />

            <p className="mt-1.5 text-xs text-muted-foreground">
              This must be unique.
            </p>
          </div>

          {/* NAME */}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Name
            </label>

            <input
              value={
                permissionDraft.name
              }
              onChange={(event) =>
                setPermissionDraft(
                  (current) => ({
                    ...current,
                    name: event.target
                      .value,
                  }),
                )
              }
              placeholder="Promotion Roster"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-blue-500"
            />
          </div>

          {/* DESCRIPTION */}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>

            <textarea
              value={
                permissionDraft.description
              }
              onChange={(event) =>
                setPermissionDraft(
                  (current) => ({
                    ...current,
                    description:
                      event.target
                        .value,
                  }),
                )
              }
              rows={3}
              placeholder="Allows access to the promotion roster."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
            />
          </div>

          {/* ROUTES */}

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <label className="block text-sm font-medium">
                  Routes
                </label>

                <p className="mt-1 text-xs text-muted-foreground">
                  Add as many frontend routes as you need.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addRoute}
                disabled={isSaving}
                className="h-9 shrink-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Route
              </Button>
            </div>

            <div className="space-y-2">
              {permissionDraft.urls.map(
                (
                  url,
                  index,
                ) => (
                  <div
                    key={`route-${index}`}
                    className="flex gap-2"
                  >
                    <div className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/20 text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </div>

                    <input
                      value={url}
                      onChange={(
                        event,
                      ) =>
                        updateRoute(
                          index,
                          event.target
                            .value,
                        )
                      }
                      placeholder="/dashboard/promotion/promotionroster"
                      className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition focus:border-blue-500"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        removeRoute(
                          index,
                        )
                      }
                      disabled={
                        isSaving
                      }
                      className="h-11 w-11 shrink-0 p-0"
                      aria-label={`Remove route ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              )}
            </div>

            <div className="mt-3 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                {permissionDraft.urls.length}{" "}
                {permissionDraft.urls.length ===
                1
                  ? "route"
                  : "routes"}{" "}
                configured. There is no route limit.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* =======================================================
          RANK MODAL
      ======================================================== */}

      <Modal
        open={
          modalType === "rank"
        }
        title={
          modalMode === "create"
            ? "Add Rank"
            : "Edit Rank"
        }
        description="Assign any number of Web Permissions to this rank."
        onClose={closeModal}
        saving={isSaving}
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
                void saveRank()
              }
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />

              {isSaving
                ? "Saving..."
                : modalMode ===
                    "create"
                  ? "Create Rank"
                  : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Rank
            </label>

            <input
              value={
                rankDraft.rank
              }
              onChange={(event) =>
                setRankDraft(
                  (current) => ({
                    ...current,
                    rank: event.target
                      .value,
                  }),
                )
              }
              disabled={
                modalMode ===
                  "edit" ||
                rankDraft.isAdminRank
              }
              placeholder="Sergeant"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-muted/20"
            />

            {rankDraft.isAdminRank && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                This rank is controlled by admin_permissions.json.
              </p>
            )}
          </div>

          <div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Web Permissions
              </label>

              <p className="mt-1 text-xs text-muted-foreground">
                Select as many permissions as required.
              </p>
            </div>

            {permissions.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No Web Permissions exist yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {permissions.map(
                  (permission) => {
                    const checked =
                      rankDraft.permissions.includes(
                        permission.key,
                      )

                    return (
                      <label
                        key={
                          permission.key
                        }
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                          checked
                            ? "border-blue-500/40 bg-blue-500/10"
                            : "border-border bg-background hover:bg-muted/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            checked
                          }
                          onChange={(
                            event,
                          ) =>
                            setRankDraft(
                              (
                                current,
                              ) => ({
                                ...current,
                                permissions:
                                  togglePermission(
                                    current.permissions,
                                    permission.key,
                                    event
                                      .target
                                      .checked,
                                  ),
                              }),
                            )
                          }
                          className="mt-0.5 h-4 w-4 accent-blue-500"
                        />

                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {permission.name ||
                              permission.key}
                          </span>

                          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                            {
                              permission.key
                            }
                          </span>
                        </span>
                      </label>
                    )
                  },
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* =======================================================
          DISCORD MODAL
      ======================================================== */}

      <Modal
        open={
          modalType ===
          "discord"
        }
        title={
          modalMode === "create"
            ? "Add Discord Permissions"
            : "Edit Discord Permissions"
        }
        description="Assign any number of Web Permissions to an individual Discord user."
        onClose={closeModal}
        saving={isSaving}
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
                void saveDiscord()
              }
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />

              {isSaving
                ? "Saving..."
                : modalMode ===
                    "create"
                  ? "Add Discord ID"
                  : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Discord User ID
            </label>

            <input
              value={
                discordDraft.discordId
              }
              onChange={(event) =>
                setDiscordDraft(
                  (current) => ({
                    ...current,
                    discordId:
                      event.target
                        .value,
                  }),
                )
              }
              disabled={
                modalMode ===
                "edit"
              }
              placeholder="123456789012345678"
              inputMode="numeric"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-muted/20"
            />

            <p className="mt-1.5 text-xs text-muted-foreground">
              Enter the user's Discord ID.
            </p>
          </div>

          <div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Web Permissions
              </label>

              <p className="mt-1 text-xs text-muted-foreground">
                Select as many permissions as required.
              </p>
            </div>

            {permissions.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No Web Permissions exist yet.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {permissions.map(
                  (permission) => {
                    const checked =
                      discordDraft.permissions.includes(
                        permission.key,
                      )

                    return (
                      <label
                        key={
                          permission.key
                        }
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                          checked
                            ? "border-blue-500/40 bg-blue-500/10"
                            : "border-border bg-background hover:bg-muted/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            checked
                          }
                          onChange={(
                            event,
                          ) =>
                            setDiscordDraft(
                              (
                                current,
                              ) => ({
                                ...current,
                                permissions:
                                  togglePermission(
                                    current.permissions,
                                    permission.key,
                                    event
                                      .target
                                      .checked,
                                  ),
                              }),
                            )
                          }
                          className="mt-0.5 h-4 w-4 accent-blue-500"
                        />

                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {permission.name ||
                              permission.key}
                          </span>

                          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                            {
                              permission.key
                            }
                          </span>
                        </span>
                      </label>
                    )
                  },
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
