import { useEffect, useMemo, useState } from "react"
import {
  NavLink,
  useLocation,
} from "react-router-dom"

import {
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Home,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import {
  getSession,
  type User,
} from "@/lib/auth"

/* ================================================================
   SESSION STORAGE
================================================================ */

function getStoredBoolean(
  key: string,
  defaultValue: boolean,
): boolean {
  try {
    const stored = sessionStorage.getItem(key)

    if (stored === null) {
      return defaultValue
    }

    return stored === "true"
  } catch {
    return defaultValue
  }
}

function storeBoolean(
  key: string,
  value: boolean,
) {
  try {
    sessionStorage.setItem(
      key,
      String(value),
    )
  } catch {
    // Ignore storage errors.
  }
}

/* ================================================================
   STORAGE KEYS
================================================================ */

const STORAGE_KEYS = {
  activity: "mpd-sidebar-activity-open",
  activityImports:
    "mpd-sidebar-activity-imports-open",
  activityRequirements:
    "mpd-sidebar-activity-requirements-open",

  promotion: "mpd-sidebar-promotion-open",
  promotionImports:
    "mpd-sidebar-promotion-imports-open",
  promotionRequirements:
    "mpd-sidebar-promotion-requirements-open",
}

/* ================================================================
   NAVIGATION
================================================================ */

const navigationButtonClass = `
  !bg-transparent
  !text-sidebar-foreground

  hover:!bg-sidebar-accent
  hover:!text-sidebar-accent-foreground

  focus:!bg-transparent
  focus:!text-sidebar-foreground

  focus-visible:!bg-sidebar-accent
  focus-visible:!text-sidebar-accent-foreground

  data-[active=true]:!bg-sidebar-accent
  data-[active=true]:!text-sidebar-accent-foreground
`

const navigationLinkClass = `
  text-sidebar-foreground
  hover:text-sidebar-accent-foreground
  focus:text-sidebar-foreground
  focus-visible:text-sidebar-accent-foreground
`

const collapsibleButtonClass = `
  !bg-transparent
  !text-sidebar-foreground

  hover:!bg-sidebar-accent
  hover:!text-sidebar-accent-foreground

  focus:!bg-transparent
  focus:!text-sidebar-foreground

  focus-visible:!bg-sidebar-accent
  focus-visible:!text-sidebar-accent-foreground

  data-[active=true]:!bg-transparent
  data-[active=true]:!text-sidebar-foreground

  data-[state=open]:!bg-transparent
  data-[state=open]:!text-sidebar-foreground
`

const profileButtonClass = `
  !bg-transparent
  !text-sidebar-foreground

  hover:!bg-sidebar-accent
  hover:!text-sidebar-accent-foreground

  focus:!bg-transparent
  focus:!text-sidebar-foreground

  focus-visible:!bg-sidebar-accent
  focus-visible:!text-sidebar-accent-foreground

  data-[state=open]:!bg-sidebar-accent
  data-[state=open]:!text-sidebar-accent-foreground
`

/* ================================================================
   SECTION HEADER
================================================================ */

/*
 * The section name and chevron are hidden when the sidebar
 * switches to icon/collapsed mode.
 *
 * This prevents text such as:
 *
 * Activity Management
 * Promotion Management
 *
 * from being squeezed into the 3rem icon sidebar.
 */
const sectionButtonClass = `
  flex
  w-full
  items-center
  gap-2
  rounded-md
  px-2
  py-2
  text-left
  text-xs
  font-semibold
  text-muted-foreground
  !bg-transparent

  hover:!bg-transparent
  hover:!text-muted-foreground

  focus:!bg-transparent
  focus:!text-muted-foreground

  focus-visible:!bg-transparent
  focus-visible:!text-muted-foreground

  active:!bg-transparent

  group-data-[collapsible=icon]/sidebar-wrapper:hidden
`

/* ================================================================
   DISCORD AVATAR HELPERS
================================================================ */

/*
 * Discord animated avatars have hashes beginning with "a_".
 *
 * Example:
 *
 * https://cdn.discordapp.com/avatars/123456/a_abcdef.gif
 *
 * Depending on how the session/backend stores the avatar,
 * user.avatar may contain:
 *
 * 1. The complete CDN URL
 * 2. A CDN URL ending in .webp
 * 3. A CDN URL ending in .png
 * 4. Just the Discord avatar hash
 *
 * This helper converts animated Discord avatars to their
 * actual GIF CDN URL.
 */

function getDiscordAvatarUrl(
  discordId?: string,
  avatar?: string,
): string | undefined {
  const cleanAvatar =
    avatar?.trim()

  if (!cleanAvatar) {
    return undefined
  }

  /*
   * Avatar is already a complete URL.
   */
  if (
    cleanAvatar.startsWith(
      "http://",
    ) ||
    cleanAvatar.startsWith(
      "https://",
    )
  ) {
    const match =
      cleanAvatar.match(
        /\/avatars\/(\d+)\/([^/?#]+)/i,
      )

    if (match) {
      const [, id, hashWithExtension] =
        match

      const hash =
        hashWithExtension.replace(
          /\.(gif|webp|png|jpg|jpeg)$/i,
          "",
        )

      /*
       * Discord animated avatar.
       */
      if (
        hash.startsWith("a_")
      ) {
        return `https://cdn.discordapp.com/avatars/${id}/${hash}.gif?size=256`
      }
    }

    /*
     * Normal avatar URL.
     */
    return cleanAvatar
  }

  /*
   * Avatar is only a Discord hash.
   */
  if (
    discordId &&
    cleanAvatar.startsWith("a_")
  ) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${cleanAvatar}.gif?size=256`
  }

  /*
   * Avatar is a normal Discord hash.
   */
  if (discordId) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${cleanAvatar}.png?size=256`
  }

  return undefined
}

function getDiscordDefaultAvatarUrl(
  discordId?: string,
): string | undefined {
  if (!discordId) {
    return undefined
  }

  try {
    const avatarIndex =
      Number(
        BigInt(discordId) % 6n,
      )

    return `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png?size=256`
  } catch {
    return undefined
  }
}

/* ================================================================
   NAVIGATION DATA
================================================================ */

const ACTIVITY_IMPORTS = [
  [
    "Department",
    "/activity/imports/department",
  ],
  [
    "SWAT",
    "/activity/imports/swat",
  ],
  [
    "MTF-7",
    "/activity/imports/mtf-7",
  ],
  [
    "MCD",
    "/activity/imports/mcd",
  ],
  [
    "TRU",
    "/activity/imports/tru",
  ],
  [
    "TEU",
    "/activity/imports/teu",
  ],
  [
    "SAR",
    "/activity/imports/sar",
  ],
] as const

const ACTIVITY_REQUIREMENTS = [
  [
    "Department",
    "/activity/requirements/department",
  ],
  [
    "SWAT",
    "/activity/requirements/swat",
  ],
  [
    "MTF-7",
    "/activity/requirements/mtf-7",
  ],
  [
    "MCD",
    "/activity/requirements/mcd",
  ],
  [
    "TRU",
    "/activity/requirements/tru",
  ],
  [
    "TEU",
    "/activity/requirements/teu",
  ],
  [
    "SAR",
    "/activity/requirements/sar",
  ],
] as const

const PROMOTION_IMPORTS = [
  [
    "Department",
    "/promotion-imports/department",
  ],
  [
    "SWAT",
    "/promotion-imports/swat",
  ],
  [
    "MTF-7",
    "/promotion-imports/mtf-7",
  ],
  [
    "MCD",
    "/promotion-imports/mcd",
  ],
  [
    "TRU",
    "/promotion-imports/tru",
  ],
  [
    "TEU",
    "/promotion-imports/teu",
  ],
  [
    "SAR",
    "/promotion-imports/sar",
  ],
] as const

const PROMOTION_REQUIREMENTS = [
  [
    "Department",
    "/promotion-requirements/department",
  ],
  [
    "SWAT",
    "/promotion-requirements/swat",
  ],
  [
    "MTF-7",
    "/promotion-requirements/mtf-7",
  ],
  [
    "MCD",
    "/promotion-requirements/mcd",
  ],
  [
    "TRU",
    "/promotion-requirements/tru",
  ],
  [
    "TEU",
    "/promotion-requirements/teu",
  ],
  [
    "SAR",
    "/promotion-requirements/sar",
  ],
] as const

/* ================================================================
   SUB NAVIGATION
================================================================ */

function SubNavigation({
  items,
}: {
  items: readonly (readonly [
    string,
    string,
  ])[]
}) {
  const location = useLocation()

  return (
    <SidebarMenuSub>
      {items.map(
        ([label, path]) => {
          const active =
            location.pathname === path

          return (
            <SidebarMenuSubItem
              key={path}
            >
              <SidebarMenuSubButton
                asChild
                isActive={active}
                className={
                  navigationButtonClass
                }
              >
                <NavLink
                  to={path}
                  end
                  className={
                    navigationLinkClass
                  }
                >
                  <span>
                    {label}
                  </span>
                </NavLink>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )
        },
      )}
    </SidebarMenuSub>
  )
}

/* ================================================================
   COMPONENT
================================================================ */

export default function DashboardSidebar() {
  const location = useLocation()

  const [user, setUser] =
    useState<User | null>(null)

  const [
    refreshingProfile,
    setRefreshingProfile,
  ] = useState(false)

  const [
    profileMenuOpen,
    setProfileMenuOpen,
  ] = useState(false)

  /* ==============================================================
     COLLAPSIBLE STATE
  ============================================================== */

  const [
    activityOpen,
    setActivityOpenState,
  ] = useState(() =>
    getStoredBoolean(
      STORAGE_KEYS.activity,
      true,
    ),
  )

  const [
    activityImportsOpen,
    setActivityImportsOpenState,
  ] = useState(() =>
    getStoredBoolean(
      STORAGE_KEYS.activityImports,
      false,
    ),
  )

  const [
    activityRequirementsOpen,
    setActivityRequirementsOpenState,
  ] = useState(() =>
    getStoredBoolean(
      STORAGE_KEYS.activityRequirements,
      false,
    ),
  )

  const [
    promotionOpen,
    setPromotionOpenState,
  ] = useState(() =>
    getStoredBoolean(
      STORAGE_KEYS.promotion,
      true,
    ),
  )

  const [
    promotionImportsOpen,
    setPromotionImportsOpenState,
  ] = useState(() =>
    getStoredBoolean(
      STORAGE_KEYS.promotionImports,
      false,
    ),
  )

  const [
    promotionRequirementsOpen,
    setPromotionRequirementsOpenState,
  ] = useState(() =>
    getStoredBoolean(
      STORAGE_KEYS.promotionRequirements,
      false,
    ),
  )

  /* ==============================================================
     PERSISTED SETTERS
  ============================================================== */

  const setActivityOpen = (
    value: boolean,
  ) => {
    setActivityOpenState(value)

    storeBoolean(
      STORAGE_KEYS.activity,
      value,
    )
  }

  const setActivityImportsOpen = (
    value: boolean,
  ) => {
    setActivityImportsOpenState(value)

    storeBoolean(
      STORAGE_KEYS.activityImports,
      value,
    )
  }

  const setActivityRequirementsOpen = (
    value: boolean,
  ) => {
    setActivityRequirementsOpenState(value)

    storeBoolean(
      STORAGE_KEYS.activityRequirements,
      value,
    )
  }

  const setPromotionOpen = (
    value: boolean,
  ) => {
    setPromotionOpenState(value)

    storeBoolean(
      STORAGE_KEYS.promotion,
      value,
    )
  }

  const setPromotionImportsOpen = (
    value: boolean,
  ) => {
    setPromotionImportsOpenState(value)

    storeBoolean(
      STORAGE_KEYS.promotionImports,
      value,
    )
  }

  const setPromotionRequirementsOpen = (
    value: boolean,
  ) => {
    setPromotionRequirementsOpenState(value)

    storeBoolean(
      STORAGE_KEYS.promotionRequirements,
      value,
    )
  }

  /* ==============================================================
     SESSION
  ============================================================== */

  useEffect(() => {
    let mounted = true

    getSession()
      .then((session) => {
        if (!mounted) {
          return
        }

        setUser(session ?? null)
      })
      .catch((error) => {
        console.error(
          "[profile] Failed to load session:",
          error,
        )

        if (!mounted) {
          return
        }

        setUser(null)
      })

    return () => {
      mounted = false
    }
  }, [])

  /* ==============================================================
     REFRESH PROFILE
  ============================================================== */

  const handleRefreshProfile =
    async () => {
      if (refreshingProfile) {
        return
      }

      setRefreshingProfile(true)

      try {
        const session =
          await getSession()

        setUser(session ?? null)
      } catch (error) {
        console.error(
          "[profile] Failed to refresh profile:",
          error,
        )
      } finally {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              150,
            ),
        )

        setRefreshingProfile(false)
        setProfileMenuOpen(false)
      }
    }

  /* ==============================================================
     PERMISSIONS
  ============================================================== */

  const hasPermission = (
    permission: string,
  ) => {
    if (!user) {
      return false
    }

    return (
      user.permissions?.includes(
        permission,
      ) ?? false
    )
  }

  const canSeeActivityManagement =
    hasPermission(
      "activitymanagement",
    )

  const canSeePromotionManagement =
    hasPermission(
      "promotionmanagement",
    )

  /* ==============================================================
     ACTIVE ROUTE
  ============================================================== */

  const isRouteActive = (
    path: string,
    end = true,
  ) => {
    if (end) {
      return location.pathname === path
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(
        `${path}/`,
      )
    )
  }

  /* ==============================================================
     PROFILE
  ============================================================== */

  const displayName =
    user?.displayName ||
    user?.username ||
    "User"

  const username =
    user?.username ||
    "Unknown User"

  const initials =
    displayName
      .split(" ")
      .map((part) =>
        part.charAt(0),
      )
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"

  /*
   * Resolve the avatar every time the session changes.
   *
   * Animated Discord avatars are explicitly converted to
   * the .gif CDN URL here.
   */
  const discordAvatarUrl =
    useMemo(
      () =>
        getDiscordAvatarUrl(
          user?.discordId,
          user?.avatar,
        ),
      [
        user?.discordId,
        user?.avatar,
      ],
    )

  const discordDefaultAvatarUrl =
    useMemo(
      () =>
        getDiscordDefaultAvatarUrl(
          user?.discordId,
        ),
      [user?.discordId],
    )

  const [
    avatarSrc,
    setAvatarSrc,
  ] = useState<
    string | undefined
  >(undefined)

  /*
   * Update avatar whenever the
   * logged-in user changes.
   */
  useEffect(() => {
    setAvatarSrc(
      discordAvatarUrl ||
        discordDefaultAvatarUrl,
    )
  }, [
    discordAvatarUrl,
    discordDefaultAvatarUrl,
  ])

  /*
   * If the custom avatar fails, use
   * Discord's default avatar.
   */
  const handleAvatarError = () => {
    if (
      discordDefaultAvatarUrl &&
      avatarSrc !==
        discordDefaultAvatarUrl
    ) {
      setAvatarSrc(
        discordDefaultAvatarUrl,
      )
    }
  }

  /* ==============================================================
     RENDER
  ============================================================== */

  return (
    <Sidebar collapsible="icon">

      {/* ==========================================================
          HEADER
      ========================================================== */}

      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Metro Police Department"
              isActive={isRouteActive(
                "/",
                true,
              )}
              className={
                navigationButtonClass
              }
            >
              <NavLink
                to="/"
                end
                className={
                  navigationLinkClass
                }
              >
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <img
                    src="/logo.png"
                    alt="Metro Police Department"
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    Metro Police Department
                  </span>

                  <span className="truncate text-xs text-muted-foreground">
                    Dashboard
                  </span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ==========================================================
          CONTENT
      ========================================================== */}

      <SidebarContent>

        {/* ========================================================
            HOME
        ======================================================== */}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                      <SidebarMenuButton
                  asChild
                  tooltip="Home"
                  isActive={isRouteActive("/", true)}
                  className={navigationButtonClass}
                >
                  <NavLink
                    to="/"
                    end
                    className={navigationLinkClass}
                  >
                    <Home className="h-4 w-4 shrink-0" />

                    <span>
                      Home
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ========================================================
            ACTIVITY MANAGEMENT
        ======================================================== */}

        {canSeeActivityManagement && (
          <Collapsible
            open={activityOpen}
            onOpenChange={
              setActivityOpen
            }
            className="group/activity"
          >
            <SidebarGroup>

              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={
                    sectionButtonClass
                  }
                >
                  <span>
                    Activity Management
                  </span>

                  <ChevronRight
                    className="
                      ml-auto
                      h-4
                      w-4
                      shrink-0
                      transition-transform
                      duration-200
                      ease-in-out
                      group-data-[state=open]/activity:rotate-90
                    "
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent
                className="
                  overflow-hidden
                  data-[state=closed]:animate-accordion-up
                  data-[state=open]:animate-accordion-down
                "
              >
                <SidebarGroupContent>
                  <SidebarMenu>

                    {/* ACTIVITY ROSTER */}

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip="Activity Roster"
                        isActive={isRouteActive(
                          "/activity/activityroster",
                        )}
                        className={
                          navigationButtonClass
                        }
                      >
                        <NavLink
                          to="/activity/activityroster"
                          end
                          className={
                            navigationLinkClass
                          }
                        >
                          <ClipboardCheck className="h-4 w-4 shrink-0" />

                          <span>
                            Activity Roster
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* ACTIVITY IMPORTS */}

                    <Collapsible
                      open={
                        activityImportsOpen
                      }
                      onOpenChange={
                        setActivityImportsOpen
                      }
                      className="group/activity-imports"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip="Imports"
                            className={
                              collapsibleButtonClass
                            }
                          >
                            <FileSpreadsheet className="h-4 w-4 shrink-0" />

                            <span>
                              Imports
                            </span>

                            <ChevronRight
                              className="
                                ml-auto
                                h-4
                                w-4
                                shrink-0
                                transition-transform
                                duration-200
                                ease-in-out
                                group-data-[state=open]/activity-imports:rotate-90
                              "
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent
                          className="
                            overflow-hidden
                            data-[state=closed]:animate-accordion-up
                            data-[state=open]:animate-accordion-down
                          "
                        >
                          <SubNavigation
                            items={
                              ACTIVITY_IMPORTS
                            }
                          />
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>

                    {/* ACTIVITY REQUIREMENTS */}

                    <Collapsible
                      open={
                        activityRequirementsOpen
                      }
                      onOpenChange={
                        setActivityRequirementsOpen
                      }
                      className="group/activity-requirements"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip="Requirements"
                            className={
                              collapsibleButtonClass
                            }
                          >
                            <ClipboardCheck className="h-4 w-4 shrink-0" />

                            <span>
                              Requirements
                            </span>

                            <ChevronRight
                              className="
                                ml-auto
                                h-4
                                w-4
                                shrink-0
                                transition-transform
                                duration-200
                                ease-in-out
                                group-data-[state=open]/activity-requirements:rotate-90
                              "
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent
                          className="
                            overflow-hidden
                            data-[state=closed]:animate-accordion-up
                            data-[state=open]:animate-accordion-down
                          "
                        >
                          <SubNavigation
                            items={
                              ACTIVITY_REQUIREMENTS
                            }
                          />
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>

                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>

            </SidebarGroup>
          </Collapsible>
        )}

        {/* ========================================================
            PROMOTION MANAGEMENT
        ======================================================== */}

        {canSeePromotionManagement && (
          <Collapsible
            open={promotionOpen}
            onOpenChange={
              setPromotionOpen
            }
            className="group/promotion"
          >
            <SidebarGroup>

              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={
                    sectionButtonClass
                  }
                >
                  <span>
                    Promotion Management
                  </span>

                  <ChevronRight
                    className="
                      ml-auto
                      h-4
                      w-4
                      shrink-0
                      transition-transform
                      duration-200
                      ease-in-out
                      group-data-[state=open]/promotion:rotate-90
                    "
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent
                className="
                  overflow-hidden
                  data-[state=closed]:animate-accordion-up
                  data-[state=open]:animate-accordion-down
                "
              >
                <SidebarGroupContent>
                  <SidebarMenu>

                    {/* PROMOTION ROSTER */}

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip="Promotion Roster"
                        isActive={isRouteActive(
                          "/promotion/promotionroster",
                        )}
                        className={
                          navigationButtonClass
                        }
                      >
                        <NavLink
                          to="/promotion/promotionroster"
                          end
                          className={
                            navigationLinkClass
                          }
                        >
                          <ClipboardCheck className="h-4 w-4 shrink-0" />

                          <span>
                            Promotion Roster
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* PROMOTION IMPORTS */}

                    <Collapsible
                      open={
                        promotionImportsOpen
                      }
                      onOpenChange={
                        setPromotionImportsOpen
                      }
                      className="group/promotion-imports"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip="Imports"
                            className={
                              collapsibleButtonClass
                            }
                          >
                            <FileSpreadsheet className="h-4 w-4 shrink-0" />

                            <span>
                              Imports
                            </span>

                            <ChevronRight
                              className="
                                ml-auto
                                h-4
                                w-4
                                shrink-0
                                transition-transform
                                duration-200
                                ease-in-out
                                group-data-[state=open]/promotion-imports:rotate-90
                              "
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent
                          className="
                            overflow-hidden
                            data-[state=closed]:animate-accordion-up
                            data-[state=open]:animate-accordion-down
                          "
                        >
                          <SubNavigation
                            items={
                              PROMOTION_IMPORTS
                            }
                          />
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>

                    {/* PROMOTION REQUIREMENTS */}

                    <Collapsible
                      open={
                        promotionRequirementsOpen
                      }
                      onOpenChange={
                        setPromotionRequirementsOpen
                      }
                      className="group/promotion-requirements"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip="Requirements"
                            className={
                              collapsibleButtonClass
                            }
                          >
                            <ClipboardCheck className="h-4 w-4 shrink-0" />

                            <span>
                              Requirements
                            </span>

                            <ChevronRight
                              className="
                                ml-auto
                                h-4
                                w-4
                                shrink-0
                                transition-transform
                                duration-200
                                ease-in-out
                                group-data-[state=open]/promotion-requirements:rotate-90
                              "
                            />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        <CollapsibleContent
                          className="
                            overflow-hidden
                            data-[state=closed]:animate-accordion-up
                            data-[state=open]:animate-accordion-down
                          "
                        >
                          <SubNavigation
                            items={
                              PROMOTION_REQUIREMENTS
                            }
                          />
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>

                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>

            </SidebarGroup>
          </Collapsible>
        )}

      </SidebarContent>

      {/* ==========================================================
          PROFILE
      ========================================================== */}

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>

            <DropdownMenu
              open={profileMenuOpen}
              onOpenChange={(open) => {
                if (
                  refreshingProfile &&
                  !open
                ) {
                  return
                }

                setProfileMenuOpen(open)
              }}
            >
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Account"
                  className={
                    profileButtonClass
                  }
                >
                  <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                    <AvatarImage
                      src={avatarSrc}
                      alt={displayName}
                      onError={
                        handleAvatarError
                      }
                    />

                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {displayName}
                    </span>

                    <span className="truncate text-xs text-muted-foreground">
                      {username}
                    </span>
                  </div>

                  <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={8}
                className="
                  w-[--radix-dropdown-menu-trigger-width]
                  min-w-56
                  rounded-lg
                "
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-2">

                    <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                      <AvatarImage
                        src={avatarSrc}
                        alt={displayName}
                        onError={
                          handleAvatarError
                        }
                      />

                      <AvatarFallback className="rounded-lg">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {displayName}
                      </span>

                      <span className="truncate text-xs text-muted-foreground">
                        {username}
                      </span>
                    </div>

                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={
                    refreshingProfile
                  }
                  onSelect={(event) => {
                    event.preventDefault()

                    void handleRefreshProfile()
                  }}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${
                      refreshingProfile
                        ? "animate-spin"
                        : ""
                    }`}
                  />

                  {refreshingProfile
                    ? "Refreshing Profile..."
                    : "Refresh Profile"}
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={
                    refreshingProfile
                  }
                  asChild
                >
                  <a href="/api/auth/logout">
                    <LogOut className="mr-2 h-4 w-4" />

                    Sign Out
                  </a>
                </DropdownMenuItem>

              </DropdownMenuContent>
            </DropdownMenu>

          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  )
}
