import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Pencil,
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
  currentUser?: {
    discordId: string
    rank: string
    isSuperAdmin: boolean
  }
  message?: string
  error?: string
}

type ModalKind =
  | "permission"
  | "rank"
  | "discord"
  | null

type ModalMode =
  | "create"
  | "edit"

type ModalProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

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

  const withSlash = trimmed.startsWith("/")
    ? trimmed
    : `/${trimmed}`

  return withSlash
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "") || "/"
}

function uniqueValues(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) =>
          value.trim(),
        )
        .filter(Boolean),
    ),
  )
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              {title}
            </h2>

            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
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
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
          {icon}
        </div>

        <div>
          <h2 className="font-semibold">
            {title}
          </h2>

          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      {action}
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
    <label className="block space-y-2">
      <span className="text-sm font-medium">
        {label}
      </span>

      {children}
    </label>
  )
}

export default function Permissions() {
  const navigate = useNavigate()

  const [permissions, setPermissions] =
    useState<Permission[]>([])

  const [ranks, setRanks] =
    useState<Rank[]>([])

  const [
    discordPermissions,
    setDiscordPermissions,
  ] = useState<DiscordPermission[]>([])

  const [adminRanks, setAdminRanks] =
    useState<string[]>([])

  const [
    superAdminIds,
    setSuperAdminIds,
  ] = useState<string[]>([])

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  /*
   * ============================================================
   * DROPDOWN STATE
   * ============================================================
   */

  const [
    expandedPermissions,
    setExpandedPermissions,
  ] = useState<Set<string>>(
    new Set(),
  )

  const [
    expandedRanks,
    setExpandedRanks,
  ] = useState<Set<string>>(
    new Set(),
  )

  const [
    expandedDiscord,
    setExpandedDiscord,
  ] = useState<Set<string>>(
    new Set(),
  )

  /*
   * ============================================================
   * MODAL STATE
   * ============================================================
   */

  const [modalKind, setModalKind] =
    useState<ModalKind>(null)

  const [modalMode, setModalMode] =
    useState<ModalMode>("create")

  const [
    editingPermissionKey,
    setEditingPermissionKey,
  ] = useState<string | null>(null)

  const [
    permissionDraft,
    setPermissionDraft,
  ] = useState<Permission>(
    emptyPermission,
  )

  const [
    editingRankName,
    setEditingRankName,
  ] = useState<string | null>(null)

  const [rankDraft, setRankDraft] =
    useState<Rank>(emptyRank)

  const [
    editingDiscordId,
    setEditingDiscordId,
  ] = useState<string | null>(null)

  const [
    discordDraft,
    setDiscordDraft,
  ] =
    useState<DiscordPermission>(
      emptyDiscord,
    )

  /*
   * ============================================================
   * AVAILABLE PERMISSION KEYS
   * ============================================================
   */

  const permissionKeys = useMemo(
    () =>
      uniqueValues(
        permissions.map(
          (permission) =>
            permission.key,
        ),
      ),
    [permissions],
  )

  /*
   * ============================================================
   * LOAD
   * ============================================================
   */

  const load = useCallback(
    async () => {
      setIsLoading(true)

      try {
        const response =
          await fetch(
            "/api/admin/permissions",
            {
              credentials:
                "include",
              cache: "no-store",
            },
          )

        const responseText =
          await response.text()

        let data: PermissionResponse =
          {}

        if (
          responseText.trim()
        ) {
          try {
            data =
              JSON.parse(
                responseText,
              ) as PermissionResponse
          } catch {
            throw new Error(
              `The permissions API returned an invalid response (HTTP ${response.status}).`,
            )
          }
        }

        if (
          response.status ===
          401
        ) {
          navigate(
            "/sign-in",
          )
          return
        }

        if (
          response.status ===
          403
        ) {
          navigate(
            "/no-permission",
          )
          return
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
              data.message ||
              "Failed to load permissions.",
          )
        }

        setPermissions(
          data.permissions ??
            [],
        )

        setRanks(
          data.ranks ?? [],
        )

        setDiscordPermissions(
          data.discordPermissions ??
            [],
        )

        setAdminRanks(
          data.adminRanks ??
            [],
        )

        setSuperAdminIds(
          data.superAdminDiscordIds ??
            [],
        )
      } catch (error) {
        console.error(
          "Permission load failed:",
          error,
        )

        toast.error(
          error instanceof
            Error
            ? error.message
            : "Failed to load permissions.",
        )
      } finally {
        setIsLoading(false)
      }
    },
    [navigate],
  )

  useEffect(() => {
    void load()
  }, [load])

  /*
   * ============================================================
   * API REQUEST
   * ============================================================
   */

  async function request(
    url: string,
    method: string,
    body?: unknown,
  ) {
    const response =
      await fetch(url, {
        method,
        credentials:
          "include",
        cache: "no-store",
        headers: body
          ? {
              "Content-Type":
                "application/json",
            }
          : undefined,
        body: body
          ? JSON.stringify(
              body,
            )
          : undefined,
      })

    const responseText =
      await response.text()

    let data: PermissionResponse =
      {}

    if (
      responseText.trim()
    ) {
      try {
        data =
          JSON.parse(
            responseText,
          ) as PermissionResponse
      } catch {
        throw new Error(
          `The server returned an invalid response for ${method} ${url} (HTTP ${response.status}).`,
        )
      }
    }

    if (
      response.status ===
      401
    ) {
      navigate(
        "/sign-in",
      )

      throw new Error(
        "Your session has expired.",
      )
    }

    if (
      response.status ===
      403
    ) {
      navigate(
        "/no-permission",
      )

      throw new Error(
        "You do not have permission to perform this action.",
      )
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          `Request failed with HTTP ${response.status}.`,
      )
    }

    return data
  }

  /*
   * ============================================================
   * MODAL HELPERS
   * ============================================================
   */

  function closeModal() {
    if (isSaving) {
      return
    }

    setModalKind(null)
    setModalMode("create")

    setEditingPermissionKey(
      null,
    )

    setEditingRankName(null)

    setEditingDiscordId(null)
  }

  function openCreatePermission() {
    setModalKind(
      "permission",
    )

    setModalMode("create")

    setEditingPermissionKey(
      null,
    )

    setPermissionDraft({
      key: "",
      name: "",
      description: "",
      urls: [""],
    })
  }

  function openEditPermission(
    permission: Permission,
  ) {
    setModalKind(
      "permission",
    )

    setModalMode("edit")

    setEditingPermissionKey(
      permission.key,
    )

    setPermissionDraft({
      key: permission.key,
      name: permission.name,
      description:
        permission.description,
      urls:
        permission.urls.length
          ? [
              ...permission.urls,
            ]
          : [""],
    })
  }

  function openCreateRank() {
    setModalKind("rank")
    setModalMode("create")
    setEditingRankName(null)

    setRankDraft({
      ...emptyRank,
      permissions: [],
    })
  }

  function openEditRank(
    rank: Rank,
  ) {
    setModalKind("rank")
    setModalMode("edit")

    setEditingRankName(
      rank.rank,
    )

    setRankDraft({
      rank: rank.rank,
      permissions: [
        ...rank.permissions,
      ],
      isAdminRank:
        rank.isAdminRank,
    })
  }

  function openCreateDiscord() {
    setModalKind("discord")
    setModalMode("create")
    setEditingDiscordId(null)

    setDiscordDraft({
      ...emptyDiscord,
      permissions: [],
    })
  }

  function openEditDiscord(
    discord: DiscordPermission,
  ) {
    if (discord.isSuperAdmin) {
      return
    }

    setModalKind("discord")
    setModalMode("edit")

    setEditingDiscordId(
      discord.discordId,
    )

    setDiscordDraft({
      discordId:
        discord.discordId,
      permissions: [
        ...discord.permissions,
      ],
      isSuperAdmin: false,
    })
  }

  /*
   * ============================================================
   * PERMISSION ROUTES
   * ============================================================
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

  function updateRoute(
    index: number,
    value: string,
  ) {
    setPermissionDraft(
      (current) => ({
        ...current,
        urls:
          current.urls.map(
            (
              route,
              routeIndex,
            ) =>
              routeIndex ===
              index
                ? value
                : route,
          ),
      }),
    )
  }

  function removeRoute(
    index: number,
  ) {
    setPermissionDraft(
      (current) => {
        const urls =
          current.urls.filter(
            (
              _,
              routeIndex,
            ) =>
              routeIndex !==
              index,
          )

        return {
          ...current,
          urls:
            urls.length
              ? urls
              : [""],
        }
      },
    )
  }

  /*
   * ============================================================
   * PERMISSION CRUD
   * ============================================================
   */

  async function submitPermission() {
    const key =
      modalMode ===
        "edit" &&
      editingPermissionKey
        ? editingPermissionKey
        : permissionDraft.key
            .trim()
            .toLowerCase()

    const urls =
      Array.from(
        new Set(
          permissionDraft.urls
            .map(
              normalizePath,
            )
            .filter(Boolean),
        ),
      )

    if (!key) {
      toast.error(
        "Permission key is required.",
      )
      return
    }

    if (!urls.length) {
      toast.error(
        "Add at least one route.",
      )
      return
    }

    setIsSaving(true)

    try {
      await request(
        modalMode ===
          "edit"
          ? `/api/admin/permissions/${encodeURIComponent(
              key,
            )}`
          : "/api/admin/permissions",
        modalMode ===
          "edit"
          ? "PUT"
          : "POST",
        {
          key,
          name:
            permissionDraft.name.trim() ||
            key,
          description:
            permissionDraft.description.trim(),
          urls,
        },
      )

      toast.success(
        modalMode ===
          "edit"
          ? "Permission updated."
          : "Permission created.",
      )

      closeModal()

      await load()
    } catch (error) {
      console.error(
        "Permission save failed:",
        error,
      )

      toast.error(
        error instanceof
          Error
          ? error.message
          : "Failed to save permission.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deletePermission(
    permission: Permission,
  ) {
    if (
      !window.confirm(
        `Delete the "${permission.name}" permission? This will also remove it from ranks and Discord overrides.`,
      )
    ) {
      return
    }

    try {
      await request(
        `/api/admin/permissions/${encodeURIComponent(
          permission.key,
        )}`,
        "DELETE",
      )

      toast.success(
        "Permission deleted.",
      )

      await load()
    } catch (error) {
      toast.error(
        error instanceof
          Error
          ? error.message
          : "Failed to delete permission.",
      )
    }
  }

  /*
   * ============================================================
   * RANK CRUD
   * ============================================================
   */

  async function submitRank() {
    const rank =
      rankDraft.rank.trim()

    if (!rank) {
      toast.error(
        "Rank name is required.",
      )
      return
    }

    setIsSaving(true)

    try {
      await request(
        "/api/admin/ranks",
        "POST",
        {
          ...(modalMode ===
            "edit" &&
          editingRankName
            ? {
                originalRank:
                  editingRankName,
              }
            : {}),
          rank,
          permissions:
            uniqueValues(
              rankDraft.permissions,
            ),
        },
      )

      toast.success(
        modalMode ===
          "edit"
          ? "Rank updated."
          : "Rank created.",
      )

      closeModal()

      await load()
    } catch (error) {
      console.error(
        "Rank save failed:",
        error,
      )

      toast.error(
        error instanceof
          Error
          ? error.message
          : "Failed to save rank.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteRank(
    rank: Rank,
  ) {
    if (rank.isAdminRank) {
      toast.error(
        "Admin ranks are controlled by admin_permissions.json.",
      )
      return
    }

    if (
      !window.confirm(
        `Delete the "${rank.rank}" rank permission configuration?`,
      )
    ) {
      return
    }

    try {
      await request(
        `/api/admin/ranks/${encodeURIComponent(
          rank.rank,
        )}`,
        "DELETE",
      )

      toast.success(
        "Rank deleted.",
      )

      await load()
    } catch (error) {
      toast.error(
        error instanceof
          Error
          ? error.message
          : "Failed to delete rank.",
      )
    }
  }

  /*
   * ============================================================
   * DISCORD CRUD
   * ============================================================
   */

  async function submitDiscord() {
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

    setIsSaving(true)

    try {
      await request(
        "/api/admin/discord-permissions",
        "POST",
        {
          ...(modalMode ===
            "edit" &&
          editingDiscordId
            ? {
                originalDiscordId:
                  editingDiscordId,
              }
            : {}),
          discordId,
          permissions:
            uniqueValues(
              discordDraft.permissions,
            ),
        },
      )

      toast.success(
        modalMode ===
          "edit"
          ? "Discord permissions updated."
          : "Discord permissions added.",
      )

      closeModal()

      await load()
    } catch (error) {
      console.error(
        "Discord permission save failed:",
        error,
      )

      toast.error(
        error instanceof
          Error
          ? error.message
          : "Failed to save Discord permissions.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteDiscord(
    discord: DiscordPermission,
  ) {
    if (discord.isSuperAdmin) {
      toast.error(
        "Super Admin IDs are controlled by admin_permissions.json.",
      )
      return
    }

    if (
      !window.confirm(
        `Remove all web permissions from Discord ID ${discord.discordId}?`,
      )
    ) {
      return
    }

    try {
      await request(
        `/api/admin/discord-permissions/${encodeURIComponent(
          discord.discordId,
        )}`,
        "DELETE",
      )

      toast.success(
        "Discord permissions removed.",
      )

      await load()
    } catch (error) {
      toast.error(
        error instanceof
          Error
          ? error.message
          : "Failed to remove Discord permissions.",
      )
    }
  }

  /*
   * ============================================================
   * TOGGLE HELPERS
   * ============================================================
   */

  function toggleRankPermission(
    permissionKey: string,
  ) {
    setRankDraft(
      (current) => ({
        ...current,
        permissions:
          current.permissions.includes(
            permissionKey,
          )
            ? current.permissions.filter(
                (permission) =>
                  permission !==
                  permissionKey,
              )
            : [
                ...current.permissions,
                permissionKey,
              ],
      }),
    )
  }

  function toggleDiscordPermission(
    permissionKey: string,
  ) {
    setDiscordDraft(
      (current) => ({
        ...current,
        permissions:
          current.permissions.includes(
            permissionKey,
          )
            ? current.permissions.filter(
                (permission) =>
                  permission !==
                  permissionKey,
              )
            : [
                ...current.permissions,
                permissionKey,
              ],
      }),
    )
  }

  /*
   * ============================================================
   * DROPDOWN HELPERS
   * ============================================================
   */

  function toggleSetValue(
    setter: React.Dispatch<
      React.SetStateAction<
        Set<string>
      >
    >,
    value: string,
  ) {
    setter(
      (current) => {
        const next =
          new Set(current)

        if (
          next.has(value)
        ) {
          next.delete(value)
        } else {
          next.add(value)
        }

        return next
      },
    )
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-6 overflow-x-hidden">
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold">
                Permissions
              </h1>

              <p className="text-sm text-muted-foreground">
                Manage web permissions, ranks and individual Discord access.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              void load()
            }
            disabled={isLoading}
          >
            <RotateCcw
              className="mr-2 h-4 w-4"
            />

            Refresh
          </Button>
        </div>

        {/* ======================================================
            WEB PERMISSIONS
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader
            icon={
              <Shield className="h-5 w-5 text-blue-500" />
            }
            title="Web Permissions"
            description="Each permission can contain as many routes as you need."
            action={
              <Button
                onClick={
                  openCreatePermission
                }
              >
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
            ) : permissions.length ===
              0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No web permissions configured.
              </div>
            ) : (
              permissions.map(
                (permission) => {
                  const expanded =
                    expandedPermissions.has(
                      permission.key,
                    )

                  return (
                    <div
                      key={
                        permission.key
                      }
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/30"
                        onClick={() =>
                          toggleSetValue(
                            setExpandedPermissions,
                            permission.key,
                          )
                        }
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              {
                                permission.name
                              }
                            </span>

                            <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                              {
                                permission.key
                              }
                            </span>
                          </div>
                        </div>

                        {expanded ? (
                          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        )}
                      </button>

                      {expanded ? (
                        <div className="border-t border-border bg-muted/10 px-6 py-5">
                          <div className="flex flex-col gap-5">
                            <div>
                              <p className="mb-1 text-sm font-medium">
                                Description
                              </p>

                              <p className="text-sm text-muted-foreground">
                                {permission.description ||
                                  "No description provided."}
                              </p>
                            </div>

                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium">
                                  Routes
                                </p>

                                <span className="text-xs text-muted-foreground">
                                  {
                                    permission
                                      .urls
                                      .length
                                  }{" "}
                                  route
                                  {permission.urls.length ===
                                  1
                                    ? ""
                                    : "s"}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {permission.urls.map(
                                  (
                                    url,
                                  ) => (
                                    <span
                                      key={
                                        url
                                      }
                                      className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs"
                                    >
                                      {
                                        url
                                      }
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() =>
                                  openEditPermission(
                                    permission,
                                  )
                                }
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>

                              <Button
                                variant="outline"
                                onClick={() =>
                                  void deletePermission(
                                    permission,
                                  )
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                },
              )
            )}
          </div>
        </section>

        {/* ======================================================
            RANK PERMISSIONS
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader
            icon={
              <Users className="h-5 w-5 text-blue-500" />
            }
            title="Rank Permissions"
            description="Assign any number of web permissions to a rank."
            action={
              <Button
                onClick={
                  openCreateRank
                }
              >
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
            ) : ranks.length ===
              0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No rank configurations.
              </div>
            ) : (
              ranks.map((rank) => {
                const expanded =
                  expandedRanks.has(
                    rank.rank,
                  )

                return (
                  <div
                    key={rank.rank}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/30"
                      onClick={() =>
                        toggleSetValue(
                          setExpandedRanks,
                          rank.rank,
                        )
                      }
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-semibold">
                          {rank.rank}
                        </span>

                        {rank.isAdminRank ? (
                          <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                            Admin Rank
                          </span>
                        ) : null}
                      </div>

                      {expanded ? (
                        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </button>

                    {expanded ? (
                      <div className="border-t border-border bg-muted/10 px-6 py-5">
                        <div className="space-y-5">
                          {rank.isAdminRank ? (
                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-muted-foreground">
                              This is an admin rank from the JSON configuration. It automatically receives the system{" "}
                              <code className="font-mono text-blue-500">
                                permissionadmin
                              </code>{" "}
                              permission.
                            </div>
                          ) : null}

                          <div>
                            <p className="mb-2 text-sm font-medium">
                              Assigned Web Permissions
                            </p>

                            {rank.permissions.length ===
                            0 ? (
                              <p className="text-sm text-muted-foreground">
                                No Web Permissions assigned.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {rank.permissions.map(
                                  (
                                    permission,
                                  ) => (
                                    <span
                                      key={
                                        permission
                                      }
                                      className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs"
                                    >
                                      {
                                        permission
                                      }
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() =>
                                openEditRank(
                                  rank,
                                )
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>

                            {!rank.isAdminRank ? (
                              <Button
                                variant="outline"
                                onClick={() =>
                                  void deleteRank(
                                    rank,
                                  )
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                Delete
                              </Button>
                            ) : null}
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

        {/* ======================================================
            DISCORD PERMISSIONS
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader
            icon={
              <Shield className="h-5 w-5 text-blue-500" />
            }
            title="Discord Permissions"
            description="Give individual Discord users additional Web Permissions."
            action={
              <Button
                onClick={
                  openCreateDiscord
                }
              >
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
            ) : discordPermissions.length ===
              0 ? (
              <div className="px-6 py-10 text-center">
                <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                <p className="text-sm font-medium">
                  No Discord overrides
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  No individual Discord permissions have been configured.
                </p>
              </div>
            ) : (
              discordPermissions.map(
                (discord) => {
                  const expanded =
                    expandedDiscord.has(
                      discord.discordId,
                    )

                  return (
                    <div
                      key={
                        discord.discordId
                      }
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/30"
                        onClick={() =>
                          toggleSetValue(
                            setExpandedDiscord,
                            discord.discordId,
                          )
                        }
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="font-mono text-sm font-medium">
                            {
                              discord.discordId
                            }
                          </span>

                          {discord.isSuperAdmin ? (
                            <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                              Super Admin
                            </span>
                          ) : null}
                        </div>

                        {expanded ? (
                          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        )}
                      </button>

                      {expanded ? (
                        <div className="border-t border-border bg-muted/10 px-6 py-5">
                          <div className="space-y-5">
                            {discord.isSuperAdmin ? (
                              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-muted-foreground">
                                This Discord ID is controlled by the JSON Super Admin configuration and has full access.
                              </div>
                            ) : null}

                            <div>
                              <p className="mb-2 text-sm font-medium">
                                Assigned Web Permissions
                              </p>

                              {discord.permissions.length ===
                              0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No Web Permissions assigned.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {discord.permissions.map(
                                    (
                                      permission,
                                    ) => (
                                      <span
                                        key={
                                          permission
                                        }
                                        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs"
                                      >
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />

                                        {
                                          permission
                                        }
                                      </span>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>

                            {!discord.isSuperAdmin ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    openEditDiscord(
                                      discord,
                                    )
                                  }
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Button>

                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    void deleteDiscord(
                                      discord,
                                    )
                                  }
                                >
                                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                  Delete
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                },
              )
            )}
          </div>
        </section>

        {/* ======================================================
            JSON CONFIGURATION
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <SectionHeader
            icon={
              <Shield className="h-5 w-5 text-blue-500" />
            }
            title="Admin Configuration"
            description="These values are controlled by the JSON configuration."
            action={null}
          />

          <div className="grid gap-4 p-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-5">
              <p className="text-sm font-medium">
                Admin Ranks
              </p>

              <p className="mt-1 text-2xl font-semibold">
                {adminRanks.length}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {adminRanks.map(
                  (rank) => (
                    <span
                      key={rank}
                      className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs"
                    >
                      {rank}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-5">
              <p className="text-sm font-medium">
                Super Admin Discord IDs
              </p>

              <p className="mt-1 text-2xl font-semibold">
                {superAdminIds.length}
              </p>

              <div className="mt-3 space-y-1">
                {superAdminIds.length ===
                0 ? (
                  <span className="text-sm text-muted-foreground">
                    None configured.
                  </span>
                ) : (
                  superAdminIds.map(
                    (discordId) => (
                      <div
                        key={
                          discordId
                        }
                        className="font-mono text-xs text-muted-foreground"
                      >
                        {
                          discordId
                        }
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================
          PERMISSION MODAL
      ======================================================== */}

      <Modal
        open={
          modalKind ===
          "permission"
        }
        title={
          modalMode ===
          "edit"
            ? "Edit Web Permission"
            : "Add Web Permission"
        }
        description="Add one or as many routes as required."
        onClose={closeModal}
        footer={
          <>
            <Button
              variant="outline"
              onClick={
                closeModal
              }
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              onClick={() =>
                void submitPermission()
              }
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />

              {isSaving
                ? "Saving..."
                : modalMode ===
                    "edit"
                  ? "Save Changes"
                  : "Create Permission"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Permission Key">
            <input
              value={
                permissionDraft.key
              }
              onChange={(event) =>
                setPermissionDraft(
                  (current) => ({
                    ...current,
                    key:
                      event.target
                        .value,
                  }),
                )
              }
              readOnly={
                modalMode ===
                "edit"
              }
              placeholder="documents"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 read-only:cursor-not-allowed read-only:opacity-60"
            />
          </Field>

          <Field label="Display Name">
            <input
              value={
                permissionDraft.name
              }
              onChange={(event) =>
                setPermissionDraft(
                  (current) => ({
                    ...current,
                    name:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="Documents"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </Field>

          <Field label="Description">
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
              rows={4}
              placeholder="Describe what this permission allows."
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </Field>

          <Field label="Routes">
            <div className="space-y-2">
              {permissionDraft.urls.map(
                (
                  url,
                  index,
                ) => (
                  <div
                    key={index}
                    className="flex gap-2"
                  >
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
                      placeholder="/dashboard/example"
                      className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-11 shrink-0 px-0"
                      onClick={() =>
                        removeRoute(
                          index,
                        )
                      }
                      aria-label="Remove route"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ),
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={
                addRoute
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Another Route
            </Button>

            <p className="text-xs text-muted-foreground">
              You can add unlimited routes. Press Enter inside a route field to move to the next line.
            </p>
          </Field>
        </div>
      </Modal>

      {/* ========================================================
          RANK MODAL
      ======================================================== */}

      <Modal
        open={
          modalKind ===
          "rank"
        }
        title={
          modalMode ===
          "edit"
            ? `Edit ${rankDraft.rank}`
            : "Add Rank"
        }
        description="Choose any number of Web Permissions for this rank."
        onClose={closeModal}
        footer={
          <>
            <Button
              variant="outline"
              onClick={
                closeModal
              }
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              onClick={() =>
                void submitRank()
              }
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />

              {isSaving
                ? "Saving..."
                : modalMode ===
                    "edit"
                  ? "Save Changes"
                  : "Create Rank"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Rank">
            <input
              value={
                rankDraft.rank
              }
              onChange={(event) =>
                setRankDraft(
                  (current) => ({
                    ...current,
                    rank:
                      event.target
                        .value,
                  }),
                )
              }
              readOnly={
                modalMode ===
                  "edit" &&
                rankDraft.isAdminRank
              }
              placeholder="Officer"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 read-only:cursor-not-allowed read-only:opacity-60"
            />
          </Field>

          {rankDraft.isAdminRank ? (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-muted-foreground">
              This rank is defined as an Admin Rank in{" "}
              <code className="font-mono text-blue-500">
                config/admin_permissions.json
              </code>
              . The{" "}
              <code className="font-mono text-blue-500">
                permissionadmin
              </code>{" "}
              system permission is automatic.
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                Web Permissions
              </span>

              <span className="text-xs text-muted-foreground">
                {
                  rankDraft
                    .permissions
                    .length
                }{" "}
                selected
              </span>
            </div>

            {permissionKeys.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Create a Web Permission first.
              </div>
            ) : (
              <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-2">
                {permissionKeys.map(
                  (
                    permissionKey,
                  ) => {
                    const checked =
                      rankDraft.permissions.includes(
                        permissionKey,
                      )

                    return (
                      <button
                        key={
                          permissionKey
                        }
                        type="button"
                        onClick={() =>
                          toggleRankPermission(
                            permissionKey,
                          )
                        }
                        className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                          checked
                            ? "border-blue-500/40 bg-blue-500/10"
                            : "border-border bg-background hover:bg-muted/50"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? "border-blue-500 bg-blue-500"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {checked ? (
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          ) : null}
                        </span>

                        <span className="font-mono text-xs">
                          {
                            permissionKey
                          }
                        </span>
                      </button>
                    )
                  },
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ========================================================
          DISCORD MODAL
      ======================================================== */}

      <Modal
        open={
          modalKind ===
          "discord"
        }
        title={
          modalMode ===
          "edit"
            ? "Edit Discord Permissions"
            : "Add Discord ID"
        }
        description="Assign any number of Web Permissions to an individual Discord user."
        onClose={closeModal}
        footer={
          <>
            <Button
              variant="outline"
              onClick={
                closeModal
              }
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              onClick={() =>
                void submitDiscord()
              }
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />

              {isSaving
                ? "Saving..."
                : modalMode ===
                    "edit"
                  ? "Save Changes"
                  : "Add Discord ID"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Discord User ID">
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
              readOnly={
                modalMode ===
                "edit"
              }
              placeholder="123456789012345678"
              inputMode="numeric"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 read-only:cursor-not-allowed read-only:opacity-60"
            />
          </Field>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                Web Permissions
              </span>

              <span className="text-xs text-muted-foreground">
                {
                  discordDraft
                    .permissions
                    .length
                }{" "}
                selected
              </span>
            </div>

            {permissionKeys.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Create a Web Permission first.
              </div>
            ) : (
              <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-2">
                {permissionKeys.map(
                  (
                    permissionKey,
                  ) => {
                    const checked =
                      discordDraft.permissions.includes(
                        permissionKey,
                      )

                    return (
                      <button
                        key={
                          permissionKey
                        }
                        type="button"
                        onClick={() =>
                          toggleDiscordPermission(
                            permissionKey,
                          )
                        }
                        className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                          checked
                            ? "border-blue-500/40 bg-blue-500/10"
                            : "border-border bg-background hover:bg-muted/50"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? "border-blue-500 bg-blue-500"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {checked ? (
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          ) : null}
                        </span>

                        <span className="font-mono text-xs">
                          {
                            permissionKey
                          }
                        </span>
                      </button>
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
