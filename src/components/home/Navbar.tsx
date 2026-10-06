import { useEffect, useRef, useState } from "react"
import { NavLink, Link } from "react-router-dom"
import {
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/theme-toggle"

import {
  getSession,
  hasPermission,
  type User,
} from "@/lib/auth"

type NavItem = {
  name: string
  href: string
  public?: boolean
  permission?: string | string[]
}

const navItems: NavItem[] = [
  {
    name: "Home",
    href: "/",
    public: true,
  },
  {
    name: "Events",
    href: "/events",
    public: true,
    permission: "events",
  },
  {
    name: "Gallery",
    href: "/gallery",
    public: true,
    permission: "gallery",
  },
  {
    name: "Spin Wheel",
    href: "/spin-wheel",
    public: true,
  },
  {
    name: "Download",
    href: "/download",
    public: true,
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    permission: [
      "dashboard",
      "activitymanagement",
      "promotionmanagement",
    ],
  },
]

const rosterItems: NavItem[] = [
  {
    name: "Metro Roster",
    href: "/documents/rosters/metro-rosters",
    permission: "documents",
  },
  {
    name: "SWAT Roster",
    href: "/documents/rosters/swat-rosters",
    permission: "documents",
  },
  {
    name: "MCD Roster",
    href: "/documents/rosters/mcd-rosters",
    permission: "documents",
  },
  {
    name: "TRU Roster",
    href: "/documents/rosters/tru-rosters",
    permission: "documents",
  },
  {
    name: "FTD Roster",
    href: "/documents/rosters/ftd-rosters",
    permission: "documents",
  },
]

const sopItems: NavItem[] = [
  {
    name: "Metro SOPs",
    href: "/documents/sops/metro-sops",
    permission: "documents",
  },
  {
    name: "SWAT SOPs",
    href: "/documents/sops/swat-sops",
    permission: "documents",
  },
  {
    name: "MCD SOPs",
    href: "/documents/sops/mcd-sops",
    permission: "documents",
  },
  {
    name: "TRU SOPs",
    href: "/documents/sops/tru-sops",
    permission: "documents",
  },
  {
    name: "FTD SOPs",
    href: "/documents/sops/ftd-sops",
    permission: "ftddocuments",
  },
  {
    name: "Global SOPs",
    href: "/documents/sops/global-sops",
    permission: "documents",
  },
]

const supervisorItem: NavItem = {
  name: "Supervisor",
  href: "/documents/supervisor/supervisor-docs",
  permission: "supervisordocuments",
}

const commandItem: NavItem = {
  name: "Command",
  href: "/documents/command/command-docs",
  permission: "commanddocuments",
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [rostersOpen, setRostersOpen] = useState(false)
  const [sopsOpen, setSopsOpen] = useState(false)

  const documentsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getSession().then(setUser)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    if (!documentsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (
        documentsRef.current &&
        !documentsRef.current.contains(target)
      ) {
        setDocumentsOpen(false)
        setRostersOpen(false)
        setSopsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      )
    }
  }, [documentsOpen])

  const canViewItem = (item: NavItem) => {
    if (item.public) {
      return true
    }

    if (!user) {
      return false
    }

    if (!item.permission) {
      return true
    }

    if (Array.isArray(item.permission)) {
      return item.permission.some((permission) =>
        hasPermission(user, permission),
      )
    }

    return hasPermission(user, item.permission)
  }

  const visibleItems = navItems.filter(canViewItem)
  const visibleRosters = rosterItems.filter(canViewItem)
  const visibleSops = sopItems.filter(canViewItem)

  const canViewSupervisor = canViewItem(supervisorItem)
  const canViewCommand = canViewItem(commandItem)

  const hasDocuments =
    visibleRosters.length > 0 ||
    visibleSops.length > 0 ||
    canViewSupervisor ||
    canViewCommand

  const currentPath = window.location.pathname

  const documentsActive =
    visibleRosters.some(
      (item) => currentPath === item.href,
    ) ||
    visibleSops.some(
      (item) => currentPath === item.href,
    ) ||
    currentPath.startsWith("/documents/supervisor") ||
    currentPath.startsWith("/documents/command")

  const rostersActive = visibleRosters.some(
    (item) => currentPath === item.href,
  )

  const sopsActive = visibleSops.some(
    (item) => currentPath === item.href,
  )

  const supervisorActive =
    currentPath.startsWith("/documents/supervisor")

  const commandActive =
    currentPath.startsWith("/documents/command")

  const closeMobileMenu = () => {
    setMobileOpen(false)
    setDocumentsOpen(false)
    setRostersOpen(false)
    setSopsOpen(false)
  }

  const toggleDocuments = () => {
    setDocumentsOpen((open) => !open)
    setRostersOpen(false)
    setSopsOpen(false)
  }

  const toggleRosters = () => {
    setRostersOpen((open) => !open)
    setSopsOpen(false)
  }

  const toggleSops = () => {
    setSopsOpen((open) => !open)
    setRostersOpen(false)
  }

  return (
    <header className="absolute left-0 top-0 z-50 w-full">
      <div className="mx-auto grid h-20 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-6 lg:px-8">

        {/* Logo */}
        <div className="flex items-center justify-start">
          <Link
            to="/"
            className="flex items-center gap-3"
            onClick={closeMobileMenu}
          >
            <img
              src="/logo.png"
              alt="Metro Police Department"
              className="h-11 w-auto"
            />

            <span className="text-lg font-semibold tracking-tight text-foreground">
              Metro Police Department
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center justify-center gap-1 md:flex">
          {visibleItems
            .filter((item) => item.name !== "Dashboard")
            .map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")
                }
              >
                {item.name}
              </NavLink>
            ))}

          {/* Documents */}
          {hasDocuments && (
            <div
              ref={documentsRef}
              className="relative"
            >
              <button
                type="button"
                onClick={toggleDocuments}
                className={[
                  "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  documentsActive || documentsOpen
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Documents

                <ChevronDown
                  className={[
                    "h-4 w-4 transition-transform duration-200",
                    documentsOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              {documentsOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">

                  {/* Rosters */}
                  {visibleRosters.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={toggleRosters}
                        className={[
                          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          rostersActive || rostersOpen
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        ].join(" ")}
                      >
                        <span>Rosters</span>

                        <ChevronDown
                          className={[
                            "h-4 w-4 transition-transform duration-200",
                            rostersOpen ? "rotate-180" : "",
                          ].join(" ")}
                        />
                      </button>

                      {rostersOpen && (
                        <div className="mt-1 space-y-1 border-l border-border/60 pl-2">
                          {visibleRosters.map((item) => (
                            <NavLink
                              key={item.href}
                              to={item.href}
                              onClick={closeMobileMenu}
                              className={({ isActive }) =>
                                [
                                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                                  isActive
                                    ? "bg-foreground/10 font-medium text-foreground"
                                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                                ].join(" ")
                              }
                            >
                              {item.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SOPs */}
                  {visibleSops.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={toggleSops}
                        className={[
                          "mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          sopsActive || sopsOpen
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        ].join(" ")}
                      >
                        <span>SOPs</span>

                        <ChevronDown
                          className={[
                            "h-4 w-4 transition-transform duration-200",
                            sopsOpen ? "rotate-180" : "",
                          ].join(" ")}
                        />
                      </button>

                      {sopsOpen && (
                        <div className="mt-1 space-y-1 border-l border-border/60 pl-2">
                          {visibleSops.map((item) => (
                            <NavLink
                              key={item.href}
                              to={item.href}
                              onClick={closeMobileMenu}
                              className={({ isActive }) =>
                                [
                                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                                  isActive
                                    ? "bg-foreground/10 font-medium text-foreground"
                                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                                ].join(" ")
                              }
                            >
                              {item.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Supervisor */}
                  {canViewSupervisor && (
                    <NavLink
                      to={supervisorItem.href}
                      onClick={closeMobileMenu}
                      className={[
                        "mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        supervisorActive
                          ? "bg-foreground/10 text-foreground"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                      ].join(" ")}
                    >
                      Supervisor
                    </NavLink>
                  )}

                  {/* Command */}
                  {canViewCommand && (
                    <NavLink
                      to={commandItem.href}
                      onClick={closeMobileMenu}
                      className={[
                        "mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        commandActive
                          ? "bg-foreground/10 text-foreground"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                      ].join(" ")}
                    >
                      Command
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dashboard */}
          {visibleItems
            .filter((item) => item.name === "Dashboard")
            .map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")
                }
              >
                {item.name}
              </NavLink>
            ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center justify-end gap-2 md:flex">
          <ThemeToggle />

          {user ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-foreground/70 bg-transparent px-3 text-xs font-medium text-foreground shadow-none hover:bg-foreground/5 hover:text-foreground"
            >
              <a href="/api/auth/logout">
                <LogOut className="mr-1.5 h-4 w-4" />
                Sign Out
              </a>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="h-8 rounded-lg bg-foreground px-3 text-xs font-medium text-background shadow-none hover:bg-foreground/90"
            >
              <Link to="/sign-in">
                <LogIn className="mr-1.5 h-4 w-4" />
                Sign In
              </Link>
            </Button>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center justify-end gap-2 md:hidden">
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={
              mobileOpen
                ? "Close menu"
                : "Open menu"
            }
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div className="border-t border-border/50 bg-background/95 px-6 py-4 shadow-xl backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-[1600px] flex-col gap-1">

            {/* Main Mobile Navigation */}
            {visibleItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")
                }
              >
                {item.name}
              </NavLink>
            ))}

            {/* Mobile Documents */}
            {hasDocuments && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={toggleDocuments}
                  className={[
                    "flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    documentsActive || documentsOpen
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span>Documents</span>

                  <ChevronDown
                    className={[
                      "h-4 w-4 transition-transform duration-200",
                      documentsOpen ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>

                {documentsOpen && (
                  <div className="mt-1 space-y-1 pl-3">

                    {/* Mobile Rosters */}
                    {visibleRosters.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={toggleRosters}
                          className={[
                            "flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                            rostersActive || rostersOpen
                              ? "bg-foreground/10 text-foreground"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                          ].join(" ")}
                        >
                          <span>Rosters</span>

                          <ChevronDown
                            className={[
                              "h-4 w-4 transition-transform duration-200",
                              rostersOpen ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        </button>

                        {rostersOpen && (
                          <div className="mt-1 space-y-1 border-l border-border/60 pl-3">
                            {visibleRosters.map((item) => (
                              <NavLink
                                key={item.href}
                                to={item.href}
                                onClick={closeMobileMenu}
                                className={({ isActive }) =>
                                  [
                                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                                    isActive
                                      ? "bg-foreground/10 font-medium text-foreground"
                                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                                  ].join(" ")
                                }
                              >
                                {item.name}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile SOPs */}
                    {visibleSops.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={toggleSops}
                          className={[
                            "flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                            sopsActive || sopsOpen
                              ? "bg-foreground/10 text-foreground"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                          ].join(" ")}
                        >
                          <span>SOPs</span>

                          <ChevronDown
                            className={[
                              "h-4 w-4 transition-transform duration-200",
                              sopsOpen ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        </button>

                        {sopsOpen && (
                          <div className="mt-1 space-y-1 border-l border-border/60 pl-3">
                            {visibleSops.map((item) => (
                              <NavLink
                                key={item.href}
                                to={item.href}
                                onClick={closeMobileMenu}
                                className={({ isActive }) =>
                                  [
                                    "block rounded-lg px-3 py-2 text-sm transition-colors",
                                    isActive
                                      ? "bg-foreground/10 font-medium text-foreground"
                                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                                  ].join(" ")
                                }
                              >
                                {item.name}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mobile Supervisor */}
                    {canViewSupervisor && (
                      <NavLink
                        to={supervisorItem.href}
                        onClick={closeMobileMenu}
                        className={[
                          "block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                          supervisorActive
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        ].join(" ")}
                      >
                        Supervisor
                      </NavLink>
                    )}

                    {/* Mobile Command */}
                    {canViewCommand && (
                      <NavLink
                        to={commandItem.href}
                        onClick={closeMobileMenu}
                        className={[
                          "block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                          commandActive
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        ].join(" ")}
                      >
                        Command
                      </NavLink>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mobile Authentication */}
            <div className="mt-2 flex items-center border-t border-border/50 pt-3">
              {user ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-foreground/70 bg-transparent px-3 text-xs font-medium text-foreground shadow-none hover:bg-foreground/5 hover:text-foreground"
                >
                  <a href="/api/auth/logout">
                    <LogOut className="mr-1.5 h-4 w-4" />
                    Sign Out
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="h-8 rounded-lg bg-foreground px-3 text-xs font-medium text-background shadow-none hover:bg-foreground/90"
                >
                  <Link
                    to="/sign-in"
                    onClick={closeMobileMenu}
                  >
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
