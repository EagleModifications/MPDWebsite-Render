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
    name: "Dashboard",
    href: "/dashboard",
    permission: ["activitymanagement", "promotionmanagement"],
  },
]

const documentsItems: NavItem[] = [
  {
    name: "Main Roster",
    href: "/documents/mainroster",
    permission: "documents",
  },
  {
    name: "SWAT Roster",
    href: "/documents/swatroster",
    permission: "documents",
  },
  {
    name: "MCD Roster",
    href: "/documents/mcdroster",
    permission: "documents",
  },
  {
    name: "TRU Roster",
    href: "/documents/truroster",
    permission: "documents",
  },
  {
    name: "FTD Roster",
    href: "/documents/ftdroster",
    permission: "documents",
  },
]

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [documentsOpen, setDocumentsOpen] = useState(false)

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

  /*
   * Close the Documents dropdown when clicking
   * anywhere outside of the dropdown.
   *
   * Clicks inside the dropdown are ignored.
   */
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
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    )

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
  const visibleDocuments =
    documentsItems.filter(canViewItem)

  const documentsActive = visibleDocuments.some(
    (item) =>
      window.location.pathname === item.href,
  )

  const closeMobileMenu = () => {
    setMobileOpen(false)
    setDocumentsOpen(false)
  }

  return (
    <header className="absolute left-0 top-0 z-50 w-full">
      <div className="mx-auto flex min-h-20 w-full items-center px-4 sm:px-6 lg:px-10">
        {/* LEFT — Logo */}
        <div className="flex min-w-0 flex-1 items-center">
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="flex min-w-0 items-center gap-2.5 sm:gap-3"
          >
            <img
              src="/logo.png"
              alt="Metro Police Department"
              className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
            />

            <span className="max-w-[180px] truncate text-sm font-bold text-foreground sm:max-w-none sm:text-lg">
              Metro Police Department
            </span>
          </Link>
        </div>

        {/* DESKTOP — Navigation */}
        <nav className="hidden items-center justify-center gap-7 whitespace-nowrap px-6 text-sm md:flex lg:gap-8">
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) =>
                `
                  font-medium
                  transition-colors
                  ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `
              }
            >
              {item.name}
            </NavLink>
          ))}

          {/* DOCUMENTS DROPDOWN */}
          {visibleDocuments.length > 0 && (
            <div
              ref={documentsRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() =>
                  setDocumentsOpen((open) => !open)
                }
                className={`
                  flex items-center gap-1.5
                  font-medium
                  transition-colors
                  ${
                    documentsActive || documentsOpen
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `}
                aria-expanded={documentsOpen}
                aria-haspopup="menu"
              >
                <span>Documents</span>

                <ChevronDown
                  className={`
                    h-4 w-4
                    transition-transform duration-200
                    ${
                      documentsOpen
                        ? "rotate-180"
                        : ""
                    }
                  `}
                />
              </button>

              {documentsOpen && (
                <div
                  className="
                    absolute left-1/2 top-full mt-3
                    min-w-[190px]
                    -translate-x-1/2
                    overflow-hidden
                    rounded-xl
                    border border-border
                    bg-background/95
                    p-1.5
                    shadow-xl
                    backdrop-blur-md
                  "
                  role="menu"
                >
                  {visibleDocuments.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={() =>
                        setDocumentsOpen(false)
                      }
                      className={({ isActive }) =>
                        `
                          block rounded-lg px-3 py-2.5
                          text-sm font-medium
                          transition-colors
                          ${
                            isActive
                              ? "bg-foreground/10 text-foreground"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                          }
                        `
                      }
                      role="menuitem"
                    >
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* RIGHT — Desktop */}
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex lg:gap-4">
          <ThemeToggle />

          {user ? (
            <Button
              variant="outline"
              className="
                h-8
                gap-2
                border-border
                bg-transparent
                px-3
                text-xs
                text-foreground
                transition-all
                hover:border-foreground
                hover:bg-foreground/10
                hover:text-foreground
              "
              onClick={() => {
                window.location.href =
                  "/api/auth/logout"
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          ) : (
            <Button
              asChild
              className="
                h-8
                gap-2
                border-border
                bg-foreground
                px-3
                text-xs
                text-background
                transition-all
                hover:bg-foreground/85
                hover:text-background
              "
            >
              <Link to="/sign-in">
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Link>
            </Button>
          )}
        </div>

        {/* MOBILE — Theme + Menu */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            aria-label={
              mobileOpen
                ? "Close menu"
                : "Open menu"
            }
            aria-expanded={mobileOpen}
            className="h-9 w-9"
            onClick={() =>
              setMobileOpen((open) => !open)
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

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="mx-4 mt-1 overflow-hidden rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur-md md:hidden">
          <nav className="flex flex-col p-2">
            {visibleItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `
                    rounded-lg px-4 py-3
                    text-sm font-medium
                    transition-colors
                    ${
                      isActive
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }
                  `
                }
              >
                {item.name}
              </NavLink>
            ))}

            {/* MOBILE DOCUMENTS DROPDOWN */}
            {visibleDocuments.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setDocumentsOpen(
                      (open) => !open,
                    )
                  }
                  className={`
                    flex w-full items-center justify-between
                    rounded-lg px-4 py-3
                    text-left text-sm font-medium
                    transition-colors
                    ${
                      documentsActive ||
                      documentsOpen
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }
                  `}
                  aria-expanded={documentsOpen}
                >
                  <span>Documents</span>

                  <ChevronDown
                    className={`
                      h-4 w-4
                      transition-transform duration-200
                      ${
                        documentsOpen
                          ? "rotate-180"
                          : ""
                      }
                    `}
                  />
                </button>

                {documentsOpen && (
                  <div className="ml-3 border-l border-border pl-2">
                    {visibleDocuments.map((item) => (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={closeMobileMenu}
                        className={({ isActive }) =>
                          `
                            block rounded-lg px-4 py-2.5
                            text-sm font-medium
                            transition-colors
                            ${
                              isActive
                                ? "bg-foreground/10 text-foreground"
                                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                            }
                          `
                        }
                      >
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="my-1 h-px bg-border" />

            {user ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/api/auth/logout"
                }}
                className="
                  flex w-full items-center gap-3
                  rounded-lg px-4 py-3
                  text-left text-sm font-medium
                  text-muted-foreground
                  transition-colors
                  hover:bg-foreground/5
                  hover:text-foreground
                "
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            ) : (
              <Link
                to="/sign-in"
                onClick={closeMobileMenu}
                className="
                  flex items-center gap-3
                  rounded-lg px-4 py-3
                  text-sm font-medium
                  text-muted-foreground
                  transition-colors
                  hover:bg-foreground/5
                  hover:text-foreground
                "
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
