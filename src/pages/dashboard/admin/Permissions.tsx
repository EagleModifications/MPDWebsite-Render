import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Users,
  XCircle,
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

type ProtectedUrlStatus = {
  url: string
  protected: boolean
  permission?: Permission
  permissionKey?: string
}

const emptyPermission: Permission = {
  key: "",
  name: "",
  description: "",
  urls: [],
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

function isSamePath(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right)
}

export default function Permissions() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [ranks, setRanks] = useState<Rank[]>([])
  const [discordPermissions, setDiscordPermissions] = useState<
    DiscordPermission[]
  >([])
  const [adminRanks, setAdminRanks] = useState<string[]>([])
  const [superAdminIds, setSuperAdminIds] = useState<string[]>([])
  const [protectedUrls, setProtectedUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const navigate = useNavigate()

  const [newPermission, setNewPermission] =
    useState<Permission>(emptyPermission)
  const [newRank, setNewRank] = useState("")
  const [newDiscordId, setNewDiscordId] = useState("")

  const permissionKeys = useMemo(
    () => permissions.map((permission) => permission.key),
    [permissions],
  )

  /*
   * IMPORTANT:
   *
   * protectedUrls is the master list of pages that are protected.
   *
   * A URL being present in a permission definition does NOT make the
   * page protected.
   *
   * The flow is:
   *
   * protectedUrls
   *      ↓
   * page requires permission
   *      ↓
   * find permission containing that URL
   *      ↓
   * user must have that permission
   *
   * If the URL is NOT in protectedUrls, the page is public.
   */
  const protectedUrlStatuses = useMemo<ProtectedUrlStatus[]>(() => {
    return protectedUrls.map((url) => {
      const permission = permissions.find((item) =>
        item.urls.some((permissionUrl) => isSamePath(permissionUrl, url)),
      )

      return {
        url,
        protected: true,
        permission,
        permissionKey: permission?.key,
      }
    })
  }, [permissions, protectedUrls])

  async function load() {
    try {
      setIsLoading(true)

      /*
       * This endpoint only checks the current PAGE.
       * It does not protect or intercept API routes.
       */
      const pageCheck = await fetch(
        `/api/auth/check?url=${encodeURIComponent(window.location.pathname)}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      )

      if (pageCheck.status === 401) {
        navigate("/sign-in", { replace: true })
        return
      }

      if (pageCheck.status === 403) {
        navigate("/dashboard", { replace: true })
        return
      }

      if (!pageCheck.ok) {
        throw new Error(
          `Failed to verify page access (${pageCheck.status}).`,
        )
      }

      const response = await fetch("/api/admin/permissions", {
        credentials: "include",
        cache: "no-store",
      })

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
      setDiscordPermissions(data.discordPermissions ?? [])
      setAdminRanks(data.adminRanks ?? [])
      setSuperAdminIds(data.superAdminDiscordIds ?? [])
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
      body: body ? JSON.stringify(body) : undefined,
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

  async function createPermission() {
    const key = newPermission.key.trim().toLowerCase()

    const urls = newPermission.urls
      .map(normalizePath)
      .filter(Boolean)

    if (!key || !urls.length) {
      toast.error(
        "Permission key and at least one URL are required.",
      )
      return
    }

    try {
      setIsSaving(true)

      await request("/api/admin/permissions", "POST", {
        ...newPermission,
        key,
        urls,
      })

      setNewPermission(emptyPermission)

      await load()

      toast.success("Permission created")
    } catch (error) {
      toast.error("Failed to create permission", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function savePermission(permission: Permission) {
    const urls = permission.urls
      .map(normalizePath)
      .filter(Boolean)

    try {
      setIsSaving(true)

      await request(
        `/api/admin/permissions/${encodeURIComponent(
          permission.key,
        )}`,
        "PUT",
        {
          ...permission,
          urls,
        },
      )

      await load()

      toast.success(
        `${permission.name || permission.key} saved`,
      )
    } catch (error) {
      toast.error("Failed to save permission", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function deletePermission(key: string) {
    if (!window.confirm(`Delete permission "${key}"?`)) {
      return
    }

    try {
      setIsSaving(true)

      await request(
        `/api/admin/permissions/${encodeURIComponent(key)}`,
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

  async function saveRank(rank: Rank) {
    try {
      setIsSaving(true)

      await request(
        `/api/admin/ranks/${encodeURIComponent(rank.rank)}`,
        "PUT",
        {
          rank: rank.rank,
          permissions: rank.permissions,
        },
      )

      await load()

      toast.success(`${rank.rank} saved`)
    } catch (error) {
      toast.error("Failed to save rank", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function createRank() {
    const rank = newRank.trim()

    if (!rank) {
      return
    }

    try {
      setIsSaving(true)

      await request("/api/admin/ranks", "POST", {
        rank,
        permissions: [],
      })

      setNewRank("")

      await load()

      toast.success("Rank created")
    } catch (error) {
      toast.error("Failed to create rank", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteRank(rank: Rank) {
    if (rank.isAdminRank) {
      return
    }

    if (!window.confirm(`Delete rank "${rank.rank}"?`)) {
      return
    }

    try {
      setIsSaving(true)

      await request(
        `/api/admin/ranks/${encodeURIComponent(rank.rank)}`,
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

  async function saveDiscord(item: DiscordPermission) {
    if (item.isSuperAdmin) {
      return
    }

    try {
      setIsSaving(true)

      await request(
        "/api/admin/discord-permissions",
        "POST",
        item,
      )

      await load()

      toast.success("Discord permissions saved")
    } catch (error) {
      toast.error("Failed to save Discord permissions", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function createDiscord() {
    const discordId = newDiscordId.trim()

    if (!/^\d{17,20}$/.test(discordId)) {
      toast.error("Enter a valid Discord user ID.")
      return
    }

    await saveDiscord({
      discordId,
      permissions: [],
      isSuperAdmin: false,
    })

    setNewDiscordId("")
  }

  async function deleteDiscord(discordId: string) {
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

      toast.success("Discord permissions removed")
    } catch (error) {
      toast.error("Failed to remove Discord permissions", {
        description:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  function togglePermission(
    current: string[],
    key: string,
    checked: boolean,
  ): string[] {
    return checked
      ? Array.from(new Set([...current, key]))
      : current.filter((item) => item !== key)
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* PAGE HEADER */}
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                Permissions
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Manage web permissions and decide which dashboard
                pages require them.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Loading permissions...
            </p>
          </div>
        ) : (
          <>
            {/* =================================================
                PROTECTED PAGE STATUS
            ================================================== */}
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] items-center justify-between border-b border-border px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Protected Pages
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Only URLs listed in admin_permissions.json are
                      protected.
                    </p>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {protectedUrls.length}{" "}
                  {protectedUrls.length === 1
                    ? "protected page"
                    : "protected pages"}
                </span>
              </div>

              {protectedUrls.length === 0 ? (
                <div className="p-6">
                  <div className="rounded-lg border border-dashed border-border bg-muted/10 p-6 text-center">
                    <p className="text-sm font-medium">
                      No protected pages configured
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Add a URL to protectedUrls in
                      admin_permissions.json to require a web
                      permission.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {protectedUrlStatuses.map((item, index) => (
                    <div
                      key={item.url}
                      className={`px-6 py-5 ${
                        index !==
                        protectedUrlStatuses.length - 1
                          ? "border-b border-border"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="break-all font-mono text-sm font-semibold">
                            {item.url}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.permission
                              ? `${
                                  item.permission.name ||
                                  item.permission.key
                                } (${item.permission.key})`
                              : "No web permission currently matches this URL."}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {item.permission ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/20 bg-green-500/10 px-2.5 py-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Protected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                              <XCircle className="h-3.5 w-3.5" />
                              No Permission
                            </span>
                          )}

                          {item.permissionKey && (
                            <span className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs">
                              {item.permissionKey}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-border bg-muted/10 px-6 py-4">
                <p className="text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    How protection works:
                  </span>{" "}
                  a page is public unless its URL is listed in{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    protectedUrls
                  </code>
                  . A protected page then requires the Web Permission
                  whose URL matches that route. Adding a URL to a
                  permission alone does not protect the page.
                </p>
              </div>
            </section>

            {/* =================================================
                PERMISSION DEFINITIONS
            ================================================== */}
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
                      Create permissions and associate them with
                      protected dashboard URLs.
                    </p>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {permissions.length}{" "}
                  {permissions.length === 1
                    ? "permission"
                    : "permissions"}
                </span>
              </div>

              <div className="border-b border-border bg-muted/10 p-6">
                <div className="grid gap-3 lg:grid-cols-[180px_180px_1fr_180px_auto]">
                  <input
                    value={newPermission.key}
                    onChange={(event) =>
                      setNewPermission((current) => ({
                        ...current,
                        key: event.target.value,
                      }))
                    }
                    placeholder="permission-key"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
                  />

                  <input
                    value={newPermission.name}
                    onChange={(event) =>
                      setNewPermission((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Display name"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
                  />

                  <input
                    value={newPermission.description}
                    onChange={(event) =>
                      setNewPermission((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Description"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
                  />

                  <textarea
                    value={newPermission.urls.join("\n")}
                    onChange={(event) =>
                      setNewPermission((current) => ({
                        ...current,
                        urls: normalizeList(
                          event.target.value,
                        ).map(normalizePath),
                      }))
                    }
                    placeholder="/dashboard/example"
                    className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />

                  <Button
                    type="button"
                    onClick={() => void createPermission()}
                    disabled={isSaving}
                    className="h-11"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              {permissions.map((permission, index) => (
                <div
                  key={permission.key}
                  className={`px-6 py-5 ${
                    index !== permissions.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <div className="grid gap-4 lg:grid-cols-[180px_180px_1fr_180px_auto] lg:items-start">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        Key
                      </p>

                      <input
                        value={permission.key}
                        readOnly
                        className="h-11 w-full rounded-lg border border-border bg-muted/20 px-3 text-sm font-semibold text-foreground"
                      />
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        Name
                      </p>

                      <input
                        value={permission.name}
                        onChange={(event) =>
                          setPermissions((current) =>
                            current.map((item) =>
                              item.key === permission.key
                                ? {
                                    ...item,
                                    name: event.target.value,
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        URLs
                      </p>

                      <textarea
                        value={permission.urls.join("\n")}
                        onChange={(event) =>
                          setPermissions((current) =>
                            current.map((item) =>
                              item.key === permission.key
                                ? {
                                    ...item,
                                    urls: normalizeList(
                                      event.target.value,
                                    ).map(normalizePath),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        Description
                      </p>

                      <textarea
                        value={permission.description}
                        onChange={(event) =>
                          setPermissions((current) =>
                            current.map((item) =>
                              item.key === permission.key
                                ? {
                                    ...item,
                                    description:
                                      event.target.value,
                                  }
                                : item,
                            ),
                          )
                        }
                        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex gap-2 lg:pt-6">
                      <Button
                        type="button"
                        onClick={() =>
                          void savePermission(permission)
                        }
                        disabled={isSaving}
                        className="h-11"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
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
                        className="h-11"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {permission.urls.map((url) => {
                      const protectedPage =
                        protectedUrls.some((protectedUrl) =>
                          isSamePath(protectedUrl, url),
                        )

                      return (
                        <span
                          key={url}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
                            protectedPage
                              ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                              : "border-border bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          {protectedPage ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}

                          {protectedPage
                            ? "Protected"
                            : "Public"}

                          <span className="font-mono">
                            {url}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>

            {/* =================================================
                RANK PERMISSIONS
            ================================================== */}
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
                      Assign Web Permissions to roster ranks.
                    </p>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {ranks.length} ranks
                </span>
              </div>

              <div className="flex gap-3 border-b border-border bg-muted/10 p-6">
                <input
                  value={newRank}
                  onChange={(event) =>
                    setNewRank(event.target.value)
                  }
                  placeholder="New rank name"
                  className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
                />

                <Button
                  type="button"
                  onClick={() => void createRank()}
                  disabled={isSaving}
                  className="h-11"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rank
                </Button>
              </div>

              {ranks.map((rank, index) => (
                <div
                  key={rank.rank}
                  className={`px-6 py-5 ${
                    index !== ranks.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">
                          {rank.rank}
                        </p>

                        {rank.isAdminRank && (
                          <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-500">
                            JSON Admin Rank
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {rank.isAdminRank
                          ? "Admin access is granted by admin_permissions.json. This does not grant every Web Permission."
                          : "Select the Web Permissions this rank receives."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-3xl lg:justify-end">
                      {permissionKeys.map((key) => (
                        <label
                          key={key}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={rank.permissions.includes(
                              key,
                            )}
                            onChange={(event) =>
                              setRanks((current) =>
                                current.map((item) =>
                                  item.rank === rank.rank
                                    ? {
                                        ...item,
                                        permissions:
                                          togglePermission(
                                            item.permissions,
                                            key,
                                            event.target
                                              .checked,
                                          ),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />

                          {key}
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => void saveRank(rank)}
                        disabled={isSaving}
                        className="h-11"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>

                      {!rank.isAdminRank && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            void deleteRank(rank)
                          }
                          disabled={isSaving}
                          className="h-11"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* =================================================
                DISCORD PERMISSIONS
            ================================================== */}
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

                <span className="text-sm text-muted-foreground">
                  {discordPermissions.length} users
                </span>
              </div>

              <div className="flex gap-3 border-b border-border bg-muted/10 p-6">
                <input
                  value={newDiscordId}
                  onChange={(event) =>
                    setNewDiscordId(event.target.value)
                  }
                  placeholder="Discord user ID"
                  className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
                />

                <Button
                  type="button"
                  onClick={() => void createDiscord()}
                  disabled={isSaving}
                  className="h-11"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Discord ID
                </Button>
              </div>

              {discordPermissions.map((item, index) => (
                <div
                  key={item.discordId}
                  className={`px-6 py-5 ${
                    index !== discordPermissions.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-base font-semibold">
                        {item.discordId}
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.isSuperAdmin
                          ? "SUPER ADMIN — JSON CONTROLLED"
                          : "MongoDB Web Permission override"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-3xl lg:justify-end">
                      {permissionKeys.map((key) => (
                        <label
                          key={key}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            disabled={item.isSuperAdmin}
                            checked={item.permissions.includes(
                              key,
                            )}
                            onChange={(event) =>
                              setDiscordPermissions(
                                (current) =>
                                  current.map((entry) =>
                                    entry.discordId ===
                                    item.discordId
                                      ? {
                                          ...entry,
                                          permissions:
                                            togglePermission(
                                              entry.permissions,
                                              key,
                                              event.target
                                                .checked,
                                            ),
                                        }
                                      : entry,
                                  ),
                              )
                            }
                          />

                          {key}
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      {!item.isSuperAdmin && (
                        <>
                          <Button
                            type="button"
                            onClick={() =>
                              void saveDiscord(item)
                            }
                            disabled={isSaving}
                            className="h-11"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
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
                            className="h-11"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* =================================================
                JSON CONFIGURATION
            ================================================== */}
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex min-h-[66px] items-center gap-3 border-b border-border px-6 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>

                <div>
                  <h2 className="text-base font-semibold">
                    JSON Configuration
                  </h2>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    These values are controlled by
                    admin_permissions.json.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-6 lg:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Admin Ranks
                  </p>

                  <p className="mt-3 text-sm leading-6">
                    {adminRanks.length
                      ? adminRanks.join(", ")
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

                <div className="rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Protected URLs
                  </p>

                  <p className="mt-3 text-sm leading-6">
                    {protectedUrls.length}
                  </p>
                </div>
              </div>

              <div className="border-t border-border bg-muted/10 px-6 py-4">
                <p className="text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Important:
                  </span>{" "}
                  Admin ranks only grant{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    permissionadmin
                  </code>{" "}
                  for managing this system. They do not automatically
                  receive every Web Permission. Super Admin Discord
                  IDs receive the full bypass.
                </p>
              </div>
            </section>

            {/* REFRESH */}
            <div className="flex min-h-11 items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void load()}
                disabled={isLoading || isSaving}
                className="h-10 rounded-md px-4"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
