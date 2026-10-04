import { useEffect, useMemo, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"

type PermissionDefinition = {
  key: string
  name?: string
  description?: string
  urls: string[]
}

type RankPermission = {
  rank: string
  permissions: string[]
  isAdminRank?: boolean
}

type DiscordPermission = {
  discordId: string
  permissions: string[]
  isSuperAdmin?: boolean
}

type PermissionsResponse = {
  success?: boolean
  permissions?: PermissionDefinition[]
  ranks?: RankPermission[]
  discordPermissions?: DiscordPermission[]
  adminRanks?: string[]
  currentUser?: {
    discordId?: string
    rank?: string
    permissions?: string[]
  }
  message?: string
  error?: string
}

type SavedState = {
  permissions: PermissionDefinition[]
  ranks: RankPermission[]
  discordPermissions: DiscordPermission[]
}

function cloneState(state: SavedState): SavedState {
  return {
    permissions: state.permissions.map((permission) => ({
      ...permission,
      urls: [...permission.urls],
    })),
    ranks: state.ranks.map((rank) => ({
      ...rank,
      permissions: [...rank.permissions],
    })),
    discordPermissions: state.discordPermissions.map((entry) => ({
      ...entry,
      permissions: [...entry.permissions],
    })),
  }
}

function areStatesEqual(
  first: SavedState,
  second: SavedState,
) {
  return JSON.stringify(first) === JSON.stringify(second)
}

function normalizePermissions(
  permissions: PermissionDefinition[] = [],
): PermissionDefinition[] {
  return [...permissions]
    .filter(
      (permission) =>
        permission &&
        typeof permission.key === "string" &&
        permission.key.trim() !== "",
    )
    .map((permission) => ({
      key: permission.key.trim(),
      name:
        typeof permission.name === "string"
          ? permission.name
          : "",
      description:
        typeof permission.description === "string"
          ? permission.description
          : "",
      urls: Array.isArray(permission.urls)
        ? permission.urls.filter(
            (url): url is string =>
              typeof url === "string" &&
              url.trim() !== "",
          )
        : [],
    }))
    .sort((a, b) =>
      a.key.localeCompare(b.key),
    )
}

function normalizeRanks(
  ranks: RankPermission[] = [],
  adminRanks: string[] = [],
): RankPermission[] {
  const adminRankSet = new Set(
    adminRanks.map((rank) =>
      rank.trim().toLowerCase(),
    ),
  )

  return [...ranks]
    .filter(
      (rank) =>
        rank &&
        typeof rank.rank === "string" &&
        rank.rank.trim() !== "",
    )
    .map((rank) => ({
      rank: rank.rank.trim(),
      permissions: Array.isArray(
        rank.permissions,
      )
        ? rank.permissions.filter(
            (permission): permission is string =>
              typeof permission === "string" &&
              permission.trim() !== "",
          )
        : [],
      isAdminRank:
        adminRankSet.has(
          rank.rank.trim().toLowerCase(),
        ),
    }))
    .sort((a, b) =>
      a.rank.localeCompare(b.rank),
    )
}

function normalizeDiscordPermissions(
  entries: DiscordPermission[] = [],
  superAdminDiscordIds: string[] = [],
): DiscordPermission[] {
  const superAdminSet = new Set(
    superAdminDiscordIds.map((id) =>
      id.trim(),
    ),
  )

  return [...entries]
    .filter(
      (entry) =>
        entry &&
        typeof entry.discordId === "string" &&
        entry.discordId.trim() !== "",
    )
    .map((entry) => ({
      discordId:
        entry.discordId.trim(),
      permissions: Array.isArray(
        entry.permissions,
      )
        ? entry.permissions.filter(
            (permission): permission is string =>
              typeof permission === "string" &&
              permission.trim() !== "",
          )
        : [],
      isSuperAdmin:
        superAdminSet.has(
          entry.discordId.trim(),
        ),
    }))
    .sort((a, b) =>
      a.discordId.localeCompare(
        b.discordId,
      ),
    )
}

function PermissionPicker({
  permissions,
  selected,
  onToggle,
  disabled,
}: {
  permissions: PermissionDefinition[]
  selected: string[]
  onToggle: (permission: string) => void
  disabled: boolean
}) {
  if (permissions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-sm text-muted-foreground">
          No permissions have been created yet.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {permissions.map((permission) => {
        const checked =
          selected.includes(permission.key)

        return (
          <button
            key={permission.key}
            type="button"
            onClick={() =>
              onToggle(permission.key)
            }
            disabled={disabled}
            className={`
              flex min-h-[62px]
              items-center gap-3
              rounded-lg border
              px-3 py-2.5
              text-left
              transition-colors
              ${
                checked
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-border bg-background hover:bg-muted/30"
              }
              disabled:cursor-not-allowed
              disabled:opacity-60
            `}
          >
            <div
              className={`
                flex h-5 w-5 shrink-0
                items-center justify-center
                rounded-md border
                ${
                  checked
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-border"
                }
              `}
            >
              {checked ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {permission.key}
              </p>

              {permission.name ? (
                <p className="truncate text-xs text-muted-foreground">
                  {permission.name}
                </p>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function NumberStepper({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <div
      className="
        flex h-11
        overflow-hidden
        rounded-lg
        border border-border
        bg-background
      "
    >
      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={disabled}
        className="
          min-w-0 flex-1
          border-0 bg-transparent
          px-3 text-sm
          outline-none
          focus:bg-muted/30
          disabled:cursor-not-allowed
          disabled:opacity-60
        "
      />

      <div
        className="
          flex w-9 shrink-0
          flex-col border-l border-border
        "
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange(
              String(Math.max(0, value + 1)),
            )
          }
          className="
            flex h-1/2
            items-center justify-center
            border-b border-border
            text-muted-foreground
            transition-colors
            hover:bg-blue-500/10
            hover:text-blue-500
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange(
              String(Math.max(0, value - 1)),
            )
          }
          className="
            flex h-1/2
            items-center justify-center
            text-muted-foreground
            transition-colors
            hover:bg-blue-500/10
            hover:text-blue-500
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function Permissions() {
  const [permissions, setPermissions] =
    useState<PermissionDefinition[]>([])

  const [ranks, setRanks] =
    useState<RankPermission[]>([])

  const [
    discordPermissions,
    setDiscordPermissions,
  ] = useState<DiscordPermission[]>([])

  const [adminRanks, setAdminRanks] =
    useState<string[]>([])

  const [
    superAdminDiscordIds,
    setSuperAdminDiscordIds,
  ] = useState<string[]>([])

  const [savedState, setSavedState] =
    useState<SavedState>({
      permissions: [],
      ranks: [],
      discordPermissions: [],
    })

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  const [expandedRanks, setExpandedRanks] =
    useState<Record<string, boolean>>({})

  const [
    expandedDiscord,
    setExpandedDiscord,
  ] = useState<Record<string, boolean>>({})

  const [
    newPermissionKey,
    setNewPermissionKey,
  ] = useState("")

  const [
    newPermissionName,
    setNewPermissionName,
  ] = useState("")

  const [
    newPermissionDescription,
    setNewPermissionDescription,
  ] = useState("")

  const [
    newPermissionUrls,
    setNewPermissionUrls,
  ] = useState("")

  const [
    newRankName,
    setNewRankName,
  ] = useState("")

  const [
    newDiscordId,
    setNewDiscordId,
  ] = useState("")

  const [
    newDiscordPermissions,
    setNewDiscordPermissions,
  ] = useState<string[]>([])

  const loadPermissions =
    async () => {
      const response = await fetch(
        "/api/admin/permissions",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      )

      const responseText =
        await response.text()

      let data: PermissionsResponse =
        {}

      if (responseText.trim()) {
        try {
          data =
            JSON.parse(
              responseText,
            ) as PermissionsResponse
        } catch {
          throw new Error(
            "The permissions API returned an invalid response.",
          )
        }
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Failed to load permissions (${response.status}).`,
        )
      }

      const normalizedPermissions =
        normalizePermissions(
          data.permissions ?? [],
        )

      const normalizedRanks =
        normalizeRanks(
          data.ranks ?? [],
          data.adminRanks ?? [],
        )

      const normalizedDiscord =
        normalizeDiscordPermissions(
          data.discordPermissions ?? [],
          data.adminRanks
            ? []
            : [],
        )

      setPermissions(
        normalizedPermissions,
      )

      setRanks(
        normalizedRanks,
      )

      setDiscordPermissions(
        normalizedDiscord,
      )

      setAdminRanks(
        Array.isArray(data.adminRanks)
          ? data.adminRanks
          : [],
      )

      setSavedState({
        permissions:
          normalizedPermissions,
        ranks: normalizedRanks,
        discordPermissions:
          normalizedDiscord,
      })
    }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setIsLoading(true)

        const response = await fetch(
          "/api/admin/permissions",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        )

        const responseText =
          await response.text()

        let data: PermissionsResponse =
          {}

        if (responseText.trim()) {
          try {
            data =
              JSON.parse(
                responseText,
              ) as PermissionsResponse
          } catch {
            throw new Error(
              "The permissions API returned an invalid response.",
            )
          }
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              `Failed to load permissions (${response.status}).`,
          )
        }

        const normalizedAdminRanks =
          Array.isArray(data.adminRanks)
            ? data.adminRanks
            : []

        const normalizedPermissions =
          normalizePermissions(
            data.permissions ?? [],
          )

        const normalizedRanks =
          normalizeRanks(
            data.ranks ?? [],
            normalizedAdminRanks,
          )

        const normalizedSuperAdminIds =
          Array.isArray(
            data.discordPermissions,
          )
            ? data.discordPermissions
                .filter(
                  (entry) =>
                    entry.isSuperAdmin ===
                    true,
                )
                .map(
                  (entry) =>
                    entry.discordId,
                )
            : []

        const normalizedDiscord =
          normalizeDiscordPermissions(
            data.discordPermissions ??
              [],
            normalizedSuperAdminIds,
          )

        if (cancelled) {
          return
        }

        setPermissions(
          normalizedPermissions,
        )

        setRanks(
          normalizedRanks,
        )

        setDiscordPermissions(
          normalizedDiscord,
        )

        setAdminRanks(
          normalizedAdminRanks,
        )

        setSuperAdminDiscordIds(
          normalizedSuperAdminIds,
        )

        setSavedState({
          permissions:
            normalizedPermissions,
          ranks: normalizedRanks,
          discordPermissions:
            normalizedDiscord,
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        toast.error(
          "Failed to load permissions",
          {
            description:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred while loading permissions.",
          },
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const currentState =
    useMemo<SavedState>(
      () => ({
        permissions,
        ranks,
        discordPermissions,
      }),
      [
        permissions,
        ranks,
        discordPermissions,
      ],
    )

  const hasChanges =
    !areStatesEqual(
      currentState,
      savedState,
    )

  function toggleRankPermission(
    rankName: string,
    permission: string,
  ) {
    setRanks((current) =>
      current.map((rank) => {
        if (rank.rank !== rankName) {
          return rank
        }

        const exists =
          rank.permissions.includes(
            permission,
          )

        return {
          ...rank,
          permissions: exists
            ? rank.permissions.filter(
                (item) =>
                  item !== permission,
              )
            : [
                ...rank.permissions,
                permission,
              ],
        }
      }),
    )
  }

  function toggleDiscordPermission(
    discordId: string,
    permission: string,
  ) {
    setDiscordPermissions(
      (current) =>
        current.map((entry) => {
          if (
            entry.discordId !==
            discordId
          ) {
            return entry
          }

          const exists =
            entry.permissions.includes(
              permission,
            )

          return {
            ...entry,
            permissions: exists
              ? entry.permissions.filter(
                  (item) =>
                    item !== permission,
                )
              : [
                  ...entry.permissions,
                  permission,
                ],
          }
        }),
    )
  }

  function toggleNewDiscordPermission(
    permission: string,
  ) {
    setNewDiscordPermissions(
      (current) =>
        current.includes(permission)
          ? current.filter(
              (item) =>
                item !== permission,
            )
          : [
              ...current,
              permission,
            ],
    )
  }

  async function createPermission() {
    const key =
      newPermissionKey.trim()

    if (!key) {
      toast.error(
        "Permission key is required",
      )
      return
    }

    if (
      permissions.some(
        (permission) =>
          permission.key.toLowerCase() ===
          key.toLowerCase(),
      )
    ) {
      toast.error(
        "That permission already exists",
      )
      return
    }

    try {
      const response =
        await fetch(
          "/api/admin/permissions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              key,
              name:
                newPermissionName.trim(),
              description:
                newPermissionDescription.trim(),
              urls: newPermissionUrls
                .split("\n")
                .map((url) =>
                  url.trim(),
                )
                .filter(Boolean),
            }),
          },
        )

      const data =
        (await response.json()) as {
          success?: boolean
          permission?: PermissionDefinition
          message?: string
          error?: string
        }

      if (
        !response.ok ||
        !data.success ||
        !data.permission
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to create permission.",
        )
      }

      setPermissions(
        (current) =>
          normalizePermissions([
            ...current,
            data.permission!,
          ]),
      )

      setNewPermissionKey("")
      setNewPermissionName("")
      setNewPermissionDescription("")
      setNewPermissionUrls("")

      toast.success(
        "Permission created",
        {
          description: `"${key}" has been added.`,
        },
      )
    } catch (error) {
      toast.error(
        "Failed to create permission",
        {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        },
      )
    }
  }

  async function deletePermission(
    permission: PermissionDefinition,
  ) {
    if (
      permission.key ===
      "permissionadmin"
    ) {
      return
    }

    if (
      !window.confirm(
        `Delete the "${permission.key}" permission?`,
      )
    ) {
      return
    }

    try {
      const response =
        await fetch(
          `/api/admin/permissions/${encodeURIComponent(
            permission.key,
          )}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        )

      const data =
        (await response.json()) as {
          success?: boolean
          message?: string
          error?: string
        }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to delete permission.",
        )
      }

      setPermissions(
        (current) =>
          current.filter(
            (item) =>
              item.key !==
              permission.key,
          ),
      )

      setRanks((current) =>
        current.map((rank) => ({
          ...rank,
          permissions:
            rank.permissions.filter(
              (item) =>
                item !== permission.key,
            ),
        })),
      )

      setDiscordPermissions(
        (current) =>
          current.map((entry) => ({
            ...entry,
            permissions:
              entry.permissions.filter(
                (item) =>
                  item !==
                  permission.key,
              ),
          })),
      )

      toast.success(
        "Permission deleted",
        {
          description: `"${permission.key}" has been removed.`,
        },
      )
    } catch (error) {
      toast.error(
        "Failed to delete permission",
        {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        },
      )
    }
  }

  async function createRank() {
    const rank =
      newRankName.trim()

    if (!rank) {
      toast.error(
        "Rank name is required",
      )
      return
    }

    if (
      ranks.some(
        (item) =>
          item.rank.toLowerCase() ===
          rank.toLowerCase(),
      )
    ) {
      toast.error(
        "That rank already exists",
      )
      return
    }

    try {
      const response =
        await fetch(
          "/api/admin/ranks",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              rank,
              permissions: [],
            }),
          },
        )

      const data =
        (await response.json()) as {
          success?: boolean
          rank?: RankPermission
          message?: string
          error?: string
        }

      if (
        !response.ok ||
        !data.success ||
        !data.rank
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to create rank.",
        )
      }

      setRanks((current) =>
        normalizeRanks([
          ...current,
          data.rank!,
        ], adminRanks),
      )

      setNewRankName("")

      toast.success(
        "Rank created",
        {
          description: `"${rank}" has been added.`,
        },
      )
    } catch (error) {
      toast.error(
        "Failed to create rank",
        {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        },
      )
    }
  }

  async function deleteRank(
    rank: RankPermission,
  ) {
    if (rank.isAdminRank) {
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
      const response =
        await fetch(
          `/api/admin/ranks/${encodeURIComponent(
            rank.rank,
          )}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        )

      const data =
        (await response.json()) as {
          success?: boolean
          message?: string
          error?: string
        }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to delete rank.",
        )
      }

      setRanks((current) =>
        current.filter(
          (item) =>
            item.rank !== rank.rank,
        ),
      )

      toast.success(
        "Rank deleted",
        {
          description: `"${rank.rank}" has been removed.`,
        },
      )
    } catch (error) {
      toast.error(
        "Failed to delete rank",
        {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        },
      )
    }
  }

  async function createDiscordOverride() {
    const discordId =
      newDiscordId.trim()

    if (!discordId) {
      toast.error(
        "Discord ID is required",
      )
      return
    }

    if (
      superAdminDiscordIds.includes(
        discordId,
      )
    ) {
      toast.error(
        "That Discord ID is a Super Admin",
        {
          description:
            "Super Admin IDs are controlled only by admin_permissions.json.",
        },
      )
      return
    }

    if (
      discordPermissions.some(
        (entry) =>
          entry.discordId ===
          discordId,
      )
    ) {
      toast.error(
        "That Discord ID already exists",
      )
      return
    }

    try {
      const response =
        await fetch(
          "/api/admin/discord-permissions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              discordId,
              permissions:
                newDiscordPermissions,
            }),
          },
        )

      const data =
        (await response.json()) as {
          success?: boolean
          discordPermission?: DiscordPermission
          message?: string
          error?: string
        }

      if (
        !response.ok ||
        !data.success ||
        !data.discordPermission
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to create Discord permission override.",
        )
      }

      setDiscordPermissions(
        (current) =>
          normalizeDiscordPermissions([
            ...current,
            data.discordPermission!,
          ], superAdminDiscordIds),
      )

      setNewDiscordId("")
      setNewDiscordPermissions([])

      toast.success(
        "Discord permissions created",
        {
          description:
            `Permissions for ${discordId} have been added.`,
        },
      )
    } catch (error) {
      toast.error(
        "Failed to create Discord permissions",
        {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        },
      )
    }
  }

  async function deleteDiscordOverride(
    entry: DiscordPermission,
  ) {
    if (entry.isSuperAdmin) {
      return
    }

    if (
      !window.confirm(
        `Delete the Discord permission override for ${entry.discordId}?`,
      )
    ) {
      return
    }

    try {
      const response =
        await fetch(
          `/api/admin/discord-permissions/${encodeURIComponent(
            entry.discordId,
          )}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        )

      const data =
        (await response.json()) as {
          success?: boolean
          message?: string
          error?: string
        }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to delete Discord permissions.",
        )
      }

      setDiscordPermissions(
        (current) =>
          current.filter(
            (item) =>
              item.discordId !==
              entry.discordId,
          ),
      )

      toast.success(
        "Discord permissions deleted",
      )
    } catch (error) {
      toast.error(
        "Failed to delete Discord permissions",
        {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        },
      )
    }
  }

  async function saveChanges() {
    if (
      isSaving ||
      !hasChanges
    ) {
      return
    }

    setIsSaving(true)

    const loadingToast =
      toast.loading(
        "Saving permissions...",
        {
          description:
            "Updating MongoDB permission assignments.",
        },
      )

    try {
      for (const permission of permissions) {
        const response =
          await fetch(
            `/api/admin/permissions/${encodeURIComponent(
              permission.key,
            )}`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                name:
                  permission.name ??
                  "",
                description:
                  permission.description ??
                  "",
                urls:
                  permission.urls,
              }),
            },
          )

        const data =
          (await response.json()) as {
            success?: boolean
            message?: string
            error?: string
          }

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              data.error ||
              `Failed to save permission "${permission.key}".`,
          )
        }
      }

      for (const rank of ranks) {
        const response =
          await fetch(
            `/api/admin/ranks/${encodeURIComponent(
              rank.rank,
            )}`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                permissions:
                  rank.permissions,
              }),
            },
          )

        const data =
          (await response.json()) as {
            success?: boolean
            message?: string
            error?: string
          }

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              data.error ||
              `Failed to save rank "${rank.rank}".`,
          )
        }
      }

      for (const entry of discordPermissions) {
        if (entry.isSuperAdmin) {
          continue
        }

        const response =
          await fetch(
            `/api/admin/discord-permissions/${encodeURIComponent(
              entry.discordId,
            )}`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                permissions:
                  entry.permissions,
              }),
            },
          )

        const data =
          (await response.json()) as {
            success?: boolean
            message?: string
            error?: string
          }

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              data.error ||
              `Failed to save Discord permissions for ${entry.discordId}.`,
          )
        }
      }

      const normalizedPermissions =
        normalizePermissions(
          permissions,
        )

      const normalizedRanks =
        normalizeRanks(
          ranks,
          adminRanks,
        )

      const normalizedDiscord =
        normalizeDiscordPermissions(
          discordPermissions,
          superAdminDiscordIds,
        )

      setPermissions(
        normalizedPermissions,
      )

      setRanks(
        normalizedRanks,
      )

      setDiscordPermissions(
        normalizedDiscord,
      )

      setSavedState({
        permissions:
          normalizedPermissions,
        ranks: normalizedRanks,
        discordPermissions:
          normalizedDiscord,
      })

      toast.success(
        "Permissions saved successfully",
        {
          id: loadingToast,
          description:
            "MongoDB permission settings have been updated.",
        },
      )
    } catch (error) {
      toast.error(
        "Failed to save permissions",
        {
          id: loadingToast,
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while saving permissions.",
        },
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleReset() {
    if (
      !hasChanges ||
      isSaving
    ) {
      return
    }

    const restored =
      cloneState(savedState)

    setPermissions(
      restored.permissions,
    )

    setRanks(restored.ranks)

    setDiscordPermissions(
      restored.discordPermissions,
    )

    toast.info(
      "Changes reset",
      {
        description:
          "Your unsaved permission changes have been discarded.",
      },
    )
  }

  function updatePermission(
    key: string,
    field:
      | "name"
      | "description"
      | "urls",
    value: string,
  ) {
    setPermissions((current) =>
      current.map((permission) => {
        if (
          permission.key !== key
        ) {
          return permission
        }

        return {
          ...permission,
          [field]:
            field === "urls"
              ? value
                  .split("\n")
                  .map((item) =>
                    item.trim(),
                  )
                  .filter(Boolean)
              : value,
        }
      }),
    )
  }

  return (
    <DashboardLayout>
      <div
        className="
          min-w-0
          max-w-full
          space-y-6
          overflow-x-hidden
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <div>
          <div className="flex items-center gap-3">
            <div
              className="
                flex h-11 w-11 shrink-0
                items-center justify-center
                rounded-xl border
                border-blue-500/20
                bg-blue-500/10
              "
            >
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                Permissions
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Configure permissions, rank access, and Discord-specific permissions for the Metro Police Department.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div
            className="
              rounded-xl border border-border
              bg-card p-10 text-center
              shadow-sm
            "
          >
            <p className="text-sm text-muted-foreground">
              Loading permissions...
            </p>
          </div>
        ) : (
          <>
            <section
              className="
                overflow-hidden
                rounded-xl border border-border
                bg-card shadow-sm
              "
            >
              <div
                className="
                  flex min-h-[66px]
                  items-center justify-between
                  border-b border-border
                  px-6 py-3
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex h-10 w-10 shrink-0
                      items-center justify-center
                      rounded-lg
                      border border-blue-500/20
                      bg-blue-500/10
                    "
                  >
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Permission Definitions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Create and configure the permissions used throughout the dashboard.
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

              <div className="border-b border-border bg-muted/10 px-6 py-5">
                <div className="grid gap-3 lg:grid-cols-4">
                  <input
                    value={newPermissionKey}
                    onChange={(event) =>
                      setNewPermissionKey(
                        event.target.value,
                      )
                    }
                    placeholder="Permission key"
                    className="
                      h-11 rounded-lg
                      border border-border
                      bg-background
                      px-3 text-sm
                      outline-none
                      focus:border-blue-500/50
                    "
                  />

                  <input
                    value={newPermissionName}
                    onChange={(event) =>
                      setNewPermissionName(
                        event.target.value,
                      )
                    }
                    placeholder="Display name"
                    className="
                      h-11 rounded-lg
                      border border-border
                      bg-background
                      px-3 text-sm
                      outline-none
                      focus:border-blue-500/50
                    "
                  />

                  <input
                    value={
                      newPermissionDescription
                    }
                    onChange={(event) =>
                      setNewPermissionDescription(
                        event.target.value,
                      )
                    }
                    placeholder="Description"
                    className="
                      h-11 rounded-lg
                      border border-border
                      bg-background
                      px-3 text-sm
                      outline-none
                      focus:border-blue-500/50
                    "
                  />

                  <Button
                    type="button"
                    onClick={() =>
                      void createPermission()
                    }
                    disabled={isSaving}
                    className="h-11"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Permission
                  </Button>
                </div>

                <textarea
                  value={newPermissionUrls}
                  onChange={(event) =>
                    setNewPermissionUrls(
                      event.target.value,
                    )
                  }
                  placeholder="Protected URLs, one per line. Example: /activity/*"
                  rows={2}
                  className="
                    mt-3 w-full
                    resize-none rounded-lg
                    border border-border
                    bg-background
                    px-3 py-2.5
                    text-sm
                    outline-none
                    focus:border-blue-500/50
                  "
                />
              </div>

              <div>
                {permissions.map(
                  (permission, index) => (
                    <div
                      key={permission.key}
                      className={`
                        px-6 py-5
                        ${
                          index !==
                          permissions.length - 1
                            ? "border-b border-border"
                            : ""
                        }
                      `}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div
                              className="
                                flex h-10 w-10 shrink-0
                                items-center justify-center
                                rounded-lg
                                border border-blue-500/20
                                bg-blue-500/10
                              "
                            >
                              <Shield className="h-5 w-5 text-blue-500" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-base font-semibold">
                                {permission.key}
                              </p>

                              <p className="mt-1 text-sm text-muted-foreground">
                                Permission key used by the dashboard.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            <input
                              value={
                                permission.name ??
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updatePermission(
                                  permission.key,
                                  "name",
                                  event.target
                                    .value,
                                )
                              }
                              placeholder="Display name"
                              disabled={isSaving}
                              className="
                                h-10 rounded-lg
                                border border-border
                                bg-background
                                px-3 text-sm
                                outline-none
                                focus:border-blue-500/50
                                disabled:opacity-60
                              "
                            />

                            <input
                              value={
                                permission.description ??
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updatePermission(
                                  permission.key,
                                  "description",
                                  event.target
                                    .value,
                                )
                              }
                              placeholder="Description"
                              disabled={isSaving}
                              className="
                                h-10 rounded-lg
                                border border-border
                                bg-background
                                px-3 text-sm
                                outline-none
                                focus:border-blue-500/50
                                disabled:opacity-60
                              "
                            />
                          </div>

                          <textarea
                            value={permission.urls.join(
                              "\n",
                            )}
                            onChange={(
                              event,
                            ) =>
                              updatePermission(
                                permission.key,
                                "urls",
                                event.target
                                  .value,
                              )
                            }
                            disabled={isSaving}
                            rows={2}
                            placeholder="Protected URLs, one per line"
                            className="
                              mt-3 w-full
                              resize-none rounded-lg
                              border border-border
                              bg-background
                              px-3 py-2.5
                              text-sm
                              outline-none
                              focus:border-blue-500/50
                              disabled:opacity-60
                            "
                          />
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            void deletePermission(
                              permission,
                            )
                          }
                          disabled={isSaving}
                          className="
                            h-10 shrink-0
                            text-destructive
                            hover:text-destructive
                          "
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ),
                )}

                {permissions.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      No permissions have been created yet.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className="
                overflow-hidden
                rounded-xl border border-border
                bg-card shadow-sm
              "
            >
              <div
                className="
                  flex min-h-[66px]
                  items-center justify-between
                  border-b border-border
                  px-6 py-3
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex h-10 w-10 shrink-0
                      items-center justify-center
                      rounded-lg
                      border border-blue-500/20
                      bg-blue-500/10
                    "
                  >
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Rank Permissions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Assign MongoDB permissions to each rank.
                    </p>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {ranks.length}{" "}
                  {ranks.length === 1
                    ? "rank"
                    : "ranks"}
                </span>
              </div>

              <div className="border-b border-border bg-muted/10 px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={newRankName}
                    onChange={(event) =>
                      setNewRankName(
                        event.target.value,
                      )
                    }
                    placeholder="Rank name"
                    className="
                      h-11 min-w-0 flex-1
                      rounded-lg
                      border border-border
                      bg-background
                      px-3 text-sm
                      outline-none
                      focus:border-blue-500/50
                    "
                  />

                  <Button
                    type="button"
                    onClick={() =>
                      void createRank()
                    }
                    disabled={isSaving}
                    className="h-11 sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rank
                  </Button>
                </div>
              </div>

              <div>
                {ranks.map(
                  (rank, index) => {
                    const expanded =
                      expandedRanks[
                        rank.rank
                      ] ?? false

                    return (
                      <div
                        key={rank.rank}
                        className={`
                          ${
                            index !==
                            ranks.length - 1
                              ? "border-b border-border"
                              : ""
                          }
                        `}
                      >
                        <div className="flex items-center gap-4 px-6 py-5">
                          <div
                            className="
                              flex h-10 w-10
                              shrink-0
                              items-center justify-center
                              rounded-lg
                              border border-blue-500/20
                              bg-blue-500/10
                            "
                          >
                            <Shield className="h-5 w-5 text-blue-500" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold">
                                {rank.rank}
                              </p>

                              {rank.isAdminRank ? (
                                <span
                                  className="
                                    rounded-full
                                    border
                                    border-blue-500/20
                                    bg-blue-500/10
                                    px-2 py-0.5
                                    text-[11px]
                                    font-semibold
                                    text-blue-500
                                  "
                                >
                                  ADMIN RANK
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                              {rank.isAdminRank
                                ? "Admin status is controlled by admin_permissions.json. Permissions below remain managed in MongoDB."
                                : `${rank.permissions.length} assigned permission${rank.permissions.length === 1 ? "" : "s"}.`}
                            </p>
                          </div>

                          {!rank.isAdminRank ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                void deleteRank(
                                  rank,
                                )
                              }
                              disabled={isSaving}
                              className="
                                hidden h-10
                                text-destructive
                                hover:text-destructive
                                sm:flex
                              "
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRanks(
                                (current) => ({
                                  ...current,
                                  [rank.rank]:
                                    !expanded,
                                }),
                              )
                            }
                            className="
                              flex h-10 w-10
                              shrink-0
                              items-center justify-center
                              rounded-lg
                              border border-border
                              text-muted-foreground
                              transition-colors
                              hover:bg-muted/40
                              hover:text-foreground
                            "
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {expanded ? (
                          <div className="border-t border-border bg-muted/10 px-6 py-5">
                            <PermissionPicker
                              permissions={
                                permissions
                              }
                              selected={
                                rank.permissions
                              }
                              onToggle={(
                                permission,
                              ) =>
                                toggleRankPermission(
                                  rank.rank,
                                  permission,
                                )
                              }
                              disabled={
                                isSaving
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    )
                  },
                )}

                {ranks.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      No rank permission configurations have been created yet.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className="
                overflow-hidden
                rounded-xl border border-border
                bg-card shadow-sm
              "
            >
              <div
                className="
                  flex min-h-[66px]
                  items-center justify-between
                  border-b border-border
                  px-6 py-3
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex h-10 w-10 shrink-0
                      items-center justify-center
                      rounded-lg
                      border border-blue-500/20
                      bg-blue-500/10
                    "
                  >
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      Discord Permission Overrides
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Give individual Discord accounts additional MongoDB permissions.
                    </p>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {discordPermissions.length}{" "}
                  {discordPermissions.length === 1
                    ? "account"
                    : "accounts"}
                </span>
              </div>

              <div className="border-b border-border bg-muted/10 px-6 py-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={newDiscordId}
                    onChange={(event) =>
                      setNewDiscordId(
                        event.target.value,
                      )
                    }
                    placeholder="Discord User ID"
                    className="
                      h-11 min-w-0 flex-1
                      rounded-lg
                      border border-border
                      bg-background
                      px-3 text-sm
                      outline-none
                      focus:border-blue-500/50
                    "
                  />

                  <Button
                    type="button"
                    onClick={() =>
                      void createDiscordOverride()
                    }
                    disabled={isSaving}
                    className="h-11"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Discord ID
                  </Button>
                </div>

                <div className="mt-3">
                  <PermissionPicker
                    permissions={
                      permissions
                    }
                    selected={
                      newDiscordPermissions
                    }
                    onToggle={
                      toggleNewDiscordPermission
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div>
                {discordPermissions.map(
                  (
                    entry,
                    index,
                  ) => {
                    const expanded =
                      expandedDiscord[
                        entry.discordId
                      ] ?? false

                    return (
                      <div
                        key={
                          entry.discordId
                        }
                        className={`
                          ${
                            index !==
                            discordPermissions.length -
                              1
                              ? "border-b border-border"
                              : ""
                          }
                        `}
                      >
                        <div className="flex items-center gap-4 px-6 py-5">
                          <div
                            className="
                              flex h-10 w-10
                              shrink-0
                              items-center justify-center
                              rounded-lg
                              border border-blue-500/20
                              bg-blue-500/10
                            "
                          >
                            <Users className="h-5 w-5 text-blue-500" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold">
                                {entry.discordId}
                              </p>

                              {entry.isSuperAdmin ? (
                                <span
                                  className="
                                    rounded-full
                                    border
                                    border-blue-500/20
                                    bg-blue-500/10
                                    px-2 py-0.5
                                    text-[11px]
                                    font-semibold
                                    text-blue-500
                                  "
                                >
                                  SUPER ADMIN
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                              {entry.isSuperAdmin
                                ? "Full permission bypass. Controlled only by admin_permissions.json."
                                : `${entry.permissions.length} assigned permission${entry.permissions.length === 1 ? "" : "s"}.`}
                            </p>
                          </div>

                          {!entry.isSuperAdmin ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                void deleteDiscordOverride(
                                  entry,
                                )
                              }
                              disabled={isSaving}
                              className="
                                hidden h-10
                                text-destructive
                                hover:text-destructive
                                sm:flex
                              "
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDiscord(
                                (current) => ({
                                  ...current,
                                  [entry.discordId]:
                                    !expanded,
                                }),
                              )
                            }
                            className="
                              flex h-10 w-10
                              shrink-0
                              items-center justify-center
                              rounded-lg
                              border border-border
                              text-muted-foreground
                              transition-colors
                              hover:bg-muted/40
                              hover:text-foreground
                            "
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {expanded ? (
                          <div className="border-t border-border bg-muted/10 px-6 py-5">
                            {entry.isSuperAdmin ? (
                              <div
                                className="
                                  rounded-lg
                                  border
                                  border-blue-500/20
                                  bg-blue-500/10
                                  p-4
                                "
                              >
                                <p className="text-sm font-semibold">
                                  Super Admin
                                </p>

                                <p className="mt-1 text-sm text-muted-foreground">
                                  This Discord ID receives{" "}
                                  <code className="rounded bg-background px-1.5 py-0.5 text-xs">
                                    *
                                  </code>{" "}
                                  and has full access. It is controlled only through{" "}
                                  <code className="rounded bg-background px-1.5 py-0.5 text-xs">
                                    config/admin_permissions.json
                                  </code>
                                  .
                                </p>
                              </div>
                            ) : (
                              <PermissionPicker
                                permissions={
                                  permissions
                                }
                                selected={
                                  entry.permissions
                                }
                                onToggle={(
                                  permission,
                                ) =>
                                  toggleDiscordPermission(
                                    entry.discordId,
                                    permission,
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  },
                )}

                {discordPermissions.length ===
                0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      No Discord permission overrides have been created yet.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className="
                overflow-hidden
                rounded-xl border border-border
                bg-card shadow-sm
              "
            >
              <div
                className="
                  flex min-h-[66px]
                  items-center
                  border-b border-border
                  px-6 py-3
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex h-10 w-10 shrink-0
                      items-center justify-center
                      rounded-lg
                      border border-blue-500/20
                      bg-blue-500/10
                    "
                  >
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      JSON Controlled Administration
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      These settings are intentionally not editable from this page.
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-border">
                <div className="px-6 py-5">
                  <p className="text-sm font-semibold">
                    Admin Ranks
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Admin ranks are controlled by{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      config/admin_permissions.json
                    </code>
                    . They automatically receive the virtual{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      permissionadmin
                    </code>{" "}
                    permission.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {adminRanks.map(
                      (rank) => (
                        <span
                          key={rank}
                          className="
                            rounded-full
                            border
                            border-blue-500/20
                            bg-blue-500/10
                            px-3 py-1
                            text-xs font-semibold
                            text-blue-500
                          "
                        >
                          {rank}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                <div className="px-6 py-5">
                  <p className="text-sm font-semibold">
                    Super Admin Discord IDs
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Super Admin IDs are controlled only by{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      config/admin_permissions.json
                    </code>
                    . They automatically receive{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      *
                    </code>{" "}
                    and bypass normal permission checks.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {superAdminDiscordIds.map(
                      (discordId) => (
                        <span
                          key={discordId}
                          className="
                            rounded-full
                            border
                            border-blue-500/20
                            bg-blue-500/10
                            px-3 py-1
                            text-xs font-semibold
                            text-blue-500
                          "
                        >
                          {discordId}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div
              className="
                flex min-h-11
                items-center
                justify-end
                gap-4
              "
            >
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={
                    !hasChanges ||
                    isSaving
                  }
                  className="h-10 rounded-md px-4"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    void saveChanges()
                  }
                  disabled={
                    !hasChanges ||
                    isSaving
                  }
                  className="h-10 rounded-md px-4"
                >
                  <Save className="mr-2 h-4 w-4" />

                  {isSaving
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
