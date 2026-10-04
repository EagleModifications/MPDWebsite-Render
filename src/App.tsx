import {
  useEffect,
  useState,
} from "react"

import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react"

import { Toaster } from "@/components/ui/sonner"

import Home from "@/pages/Home"
import SignIn from "@/pages/SignIn"
import SignedOut from "@/pages/SignedOut"
import Verifying from "@/pages/Verifying"
import NotFound from "@/pages/NotFound"
import NoPermission from "@/pages/NoPermission"
import ErrorPage from "@/pages/Error"
import Events from "@/pages/Events"
import Gallery from "@/pages/Gallery"

import MainRoster from "@/pages/documents/MainRoster"
import SWATRoster from "@/pages/documents/SWATRoster"
import MCDRoster from "@/pages/documents/MCDRoster"
import TRURoster from "@/pages/documents/TRURoster"
import FTDRoster from "@/pages/documents/FTDRoster"

import MetroSOP from "@/pages/documents/MetroSOP"
import SWATSOP from "@/pages/documents/SWATSOP"
import MCDSOP from "@/pages/documents/MCDSOP"
import TRUSOP from "@/pages/documents/TRUSOP"
import FTDSOP from "@/pages/documents/FTDSOP"
import GlobalSOP from "@/pages/documents/GlobalSOP"

import SupervisorDocs from "@/pages/documents/SupervisorDocs"
import CommandDocs from "@/pages/documents/CommandDocs"

import Dashboard from "@/pages/dashboard/Dashboard"
import AdminPermissions from "@/pages/dashboard/admin/Permissions"

import ActivityRoster from "@/pages/dashboard/activity/ActivityRoster"
import PromotionRoster from "@/pages/dashboard/promotion/PromotionRoster"

import ActivityImportDepartment from "@/pages/dashboard/activity/imports/Department"
import ActivityImportMCD from "@/pages/dashboard/activity/imports/MCD"
import ActivityImportMTF7 from "@/pages/dashboard/activity/imports/MTF-7"
import ActivityImportSAR from "@/pages/dashboard/activity/imports/SAR"
import ActivityImportSWAT from "@/pages/dashboard/activity/imports/SWAT"
import ActivityImportTEU from "@/pages/dashboard/activity/imports/TEU"
import ActivityImportTRU from "@/pages/dashboard/activity/imports/TRU"

import PromotionImportDepartment from "@/pages/dashboard/promotion/imports/Department"
import PromotionImportMCD from "@/pages/dashboard/promotion/imports/MCD"
import PromotionImportMTF7 from "@/pages/dashboard/promotion/imports/MTF-7"
import PromotionImportSAR from "@/pages/dashboard/promotion/imports/SAR"
import PromotionImportSWAT from "@/pages/dashboard/promotion/imports/SWAT"
import PromotionImportTEU from "@/pages/dashboard/promotion/imports/TEU"
import PromotionImportTRU from "@/pages/dashboard/promotion/imports/TRU"

import ActivityRequirementsDepartment from "@/pages/dashboard/activity/requirements/Department"
import ActivityRequirementsMCD from "@/pages/dashboard/activity/requirements/MCD"
import ActivityRequirementsMTF7 from "@/pages/dashboard/activity/requirements/MTF-7"
import ActivityRequirementsSAR from "@/pages/dashboard/activity/requirements/SAR"
import ActivityRequirementsSWAT from "@/pages/dashboard/activity/requirements/SWAT"
import ActivityRequirementsTEU from "@/pages/dashboard/activity/requirements/TEU"
import ActivityRequirementsTRU from "@/pages/dashboard/activity/requirements/TRU"

import PromotionRequirementsDepartment from "@/pages/dashboard/promotion/requirements/Department"
import PromotionRequirementsMCD from "@/pages/dashboard/promotion/requirements/MCD"
import PromotionRequirementsMTF7 from "@/pages/dashboard/promotion/requirements/MTF-7"
import PromotionRequirementsSAR from "@/pages/dashboard/promotion/requirements/SAR"
import PromotionRequirementsSWAT from "@/pages/dashboard/promotion/requirements/SWAT"
import PromotionRequirementsTEU from "@/pages/dashboard/promotion/requirements/TEU"
import PromotionRequirementsTRU from "@/pages/dashboard/promotion/requirements/TRU"

/* =========================================================
   APP PROTECTION
========================================================= */

type PageProtectionState =
  | "checking"
  | "allowed"
  | "unauthenticated"
  | "forbidden"
  | "error"

function PageProtection() {
  const location = useLocation()

  const [state, setState] =
    useState<PageProtectionState>("checking")

  /*
   * These pages must never be intercepted by the
   * page-protection system.
   *
   * Otherwise /verifying could redirect to itself
   * while the permission check is taking place.
   */
  const protectionExemptRoutes = [
    "/sign-in",
    "/signed-out",
    "/verifying",
    "/no-permission",
    "/error",
  ]

  const isProtectionExempt =
    protectionExemptRoutes.includes(location.pathname)

  useEffect(() => {
    /*
     * Do not perform page protection checks on
     * the system/redirect pages.
     */
    if (isProtectionExempt) {
      setState("allowed")
      return
    }

    let cancelled = false

    async function checkPageAccess() {
      setState("checking")

      try {
        const url =
          `${location.pathname}${location.search}`

        const response = await fetch(
          `/api/auth/check?url=${encodeURIComponent(url)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        )

        if (cancelled) {
          return
        }

        /*
         * The page is protected and the user
         * is not authenticated.
         */
        if (response.status === 401) {
          setState("unauthenticated")
          return
        }

        /*
         * The page is protected and the user
         * does not have the required permission.
         */
        if (response.status === 403) {
          setState("forbidden")
          return
        }

        /*
         * The permission check itself failed.
         */
        if (!response.ok) {
          setState("error")
          return
        }

        /*
         * Either:
         *
         * - The page is public because it is not in
         *   protectedUrls
         *
         * OR
         *
         * - The user has the required permission.
         */
        setState("allowed")
      } catch {
        if (!cancelled) {
          setState("error")
        }
      }
    }

    void checkPageAccess()

    return () => {
      cancelled = true
    }
  }, [
    location.pathname,
    location.search,
    isProtectionExempt,
  ])

  /*
   * The permission check is currently running.
   *
   * Send the user to the dedicated verifying page.
   */
  if (
    state === "checking" &&
    !isProtectionExempt
  ) {
    return (
      <Navigate
        to="/verifying"
        replace
        state={{
          from:
            location.pathname +
            location.search,
        }}
      />
    )
  }

  /*
   * Protected page but no active session.
   */
  if (state === "unauthenticated") {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{
          from:
            location.pathname +
            location.search,
        }}
      />
    )
  }

  /*
   * User is authenticated but does not have
   * the required web permission.
   */
  if (state === "forbidden") {
    return (
      <Navigate
        to="/no-permission"
        replace
        state={{
          from:
            location.pathname +
            location.search,
        }}
      />
    )
  }

  /*
   * Permission system/server error.
   */
  if (state === "error") {
    return (
      <Navigate
        to="/error"
        replace
        state={{
          from:
            location.pathname +
            location.search,
        }}
      />
    )
  }

  /*
   * Access has been granted.
   */
  if (state === "allowed") {
    return <Outlet />
  }

  return null
}

/* =========================================================
   SITE PROTECTION
========================================================= */

function useSiteProtection() {
  useEffect(() => {
    /*
     * Disable right-click context menu.
     */
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }

    /*
     * Disable common browser developer-tool shortcuts.
     *
     * This is only a client-side deterrent and is NOT
     * a security mechanism.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      const isF12 =
        event.key === "F12"

      const isDeveloperTools =
        event.ctrlKey &&
        event.shiftKey &&
        (
          key === "i" ||
          key === "j" ||
          key === "c"
        )

      const isViewSource =
        event.ctrlKey &&
        key === "u"

      if (
        isF12 ||
        isDeveloperTools ||
        isViewSource
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    /*
     * Prevent normal page content from being dragged.
     */
    const handleDragStart = (event: DragEvent) => {
      event.preventDefault()
    }

    document.addEventListener(
      "contextmenu",
      handleContextMenu,
    )

    document.addEventListener(
      "keydown",
      handleKeyDown,
      true,
    )

    document.addEventListener(
      "dragstart",
      handleDragStart,
    )

    return () => {
      document.removeEventListener(
        "contextmenu",
        handleContextMenu,
      )

      document.removeEventListener(
        "keydown",
        handleKeyDown,
        true,
      )

      document.removeEventListener(
        "dragstart",
        handleDragStart,
      )
    }
  }, [])
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  useSiteProtection()

  return (
    <BrowserRouter>
      <Routes>

        {/* =====================================================
            PUBLIC SYSTEM PAGES

            These MUST remain outside PageProtection so that
            redirects from the protection system cannot loop.
        ===================================================== */}

        <Route
          path="/sign-in"
          element={<SignIn />}
        />

        <Route
          path="/signed-out"
          element={<SignedOut />}
        />

        <Route
          path="/verifying"
          element={<Verifying />}
        />

        <Route
          path="/no-permission"
          element={<NoPermission />}
        />

        <Route
          path="/error"
          element={<ErrorPage />}
        />

        {/* =====================================================
            ALL NORMAL APPLICATION ROUTES

            protectedUrls in admin_permissions.json determines
            which of these actually require authentication and
            a MongoDB web permission.

            If a URL is NOT in protectedUrls, the API returns
            allowed=true and the page remains public.
        ===================================================== */}

        <Route element={<PageProtection />}>

          {/* ===================================================
              HOME
          =================================================== */}

          <Route
            path="/"
            element={<Home />}
          />

          {/* ===================================================
              PUBLIC CONTENT
          =================================================== */}

          <Route
            path="/events"
            element={<Events />}
          />

          <Route
            path="/gallery"
            element={<Gallery />}
          />

          {/* ===================================================
              ROSTERS
          =================================================== */}

          <Route
            path="/documents/rosters/metro-rosters"
            element={<MainRoster />}
          />

          <Route
            path="/documents/rosters/swat-rosters"
            element={<SWATRoster />}
          />

          <Route
            path="/documents/rosters/mcd-rosters"
            element={<MCDRoster />}
          />

          <Route
            path="/documents/rosters/tru-rosters"
            element={<TRURoster />}
          />

          <Route
            path="/documents/rosters/ftd-rosters"
            element={<FTDRoster />}
          />

          {/* ===================================================
              SOPS
          =================================================== */}

          <Route
            path="/documents/sops/metro-sops"
            element={<MetroSOP />}
          />

          <Route
            path="/documents/sops/swat-sops"
            element={<SWATSOP />}
          />

          <Route
            path="/documents/sops/mcd-sops"
            element={<MCDSOP />}
          />

          <Route
            path="/documents/sops/tru-sops"
            element={<TRUSOP />}
          />

          <Route
            path="/documents/sops/ftd-sops"
            element={<FTDSOP />}
          />

          <Route
            path="/documents/sops/global-sops"
            element={<GlobalSOP />}
          />

          {/* ===================================================
              SUPERVISOR / COMMAND DOCUMENTS
          =================================================== */}

          <Route
            path="/documents/supervisor/supervisor-docs"
            element={<SupervisorDocs />}
          />

          <Route
            path="/documents/command/command-docs"
            element={<CommandDocs />}
          />

          {/* ===================================================
              DASHBOARD
          =================================================== */}

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/dashboard/admin/permissions"
            element={<AdminPermissions />}
          />

          {/* ===================================================
              ACTIVITY ROSTER
          =================================================== */}

          <Route
            path="/dashboard/activity/activityroster"
            element={<ActivityRoster />}
          />

          {/* ===================================================
              PROMOTION ROSTER
          =================================================== */}

          <Route
            path="/dashboard/promotion/promotionroster"
            element={<PromotionRoster />}
          />

          {/* ===================================================
              ACTIVITY IMPORTS
          =================================================== */}

          <Route
            path="/dashboard/activity/department-import"
            element={<ActivityImportDepartment />}
          />

          <Route
            path="/dashboard/activity/mcd-import"
            element={<ActivityImportMCD />}
          />

          <Route
            path="/dashboard/activity/mtf7-import"
            element={<ActivityImportMTF7 />}
          />

          <Route
            path="/dashboard/activity/sar-import"
            element={<ActivityImportSAR />}
          />

          <Route
            path="/dashboard/activity/swat-import"
            element={<ActivityImportSWAT />}
          />

          <Route
            path="/dashboard/activity/teu-import"
            element={<ActivityImportTEU />}
          />

          <Route
            path="/dashboard/activity/tru-import"
            element={<ActivityImportTRU />}
          />

          {/* ===================================================
              PROMOTION IMPORTS
          =================================================== */}

          <Route
            path="/dashboard/promotion/department-import"
            element={<PromotionImportDepartment />}
          />

          <Route
            path="/dashboard/promotion/mcd-import"
            element={<PromotionImportMCD />}
          />

          <Route
            path="/dashboard/promotion/mtf7-import"
            element={<PromotionImportMTF7 />}
          />

          <Route
            path="/dashboard/promotion/sar-import"
            element={<PromotionImportSAR />}
          />

          <Route
            path="/dashboard/promotion/swat-import"
            element={<PromotionImportSWAT />}
          />

          <Route
            path="/dashboard/promotion/teu-import"
            element={<PromotionImportTEU />}
          />

          <Route
            path="/dashboard/promotion/tru-import"
            element={<PromotionImportTRU />}
          />

          {/* ===================================================
              ACTIVITY REQUIREMENTS
          =================================================== */}

          <Route
            path="/dashboard/activity/department-requirements"
            element={<ActivityRequirementsDepartment />}
          />

          <Route
            path="/dashboard/activity/mcd-requirements"
            element={<ActivityRequirementsMCD />}
          />

          <Route
            path="/dashboard/activity/mtf7-requirements"
            element={<ActivityRequirementsMTF7 />}
          />

          <Route
            path="/dashboard/activity/sar-requirements"
            element={<ActivityRequirementsSAR />}
          />

          <Route
            path="/dashboard/activity/swat-requirements"
            element={<ActivityRequirementsSWAT />}
          />

          <Route
            path="/dashboard/activity/teu-requirements"
            element={<ActivityRequirementsTEU />}
          />

          <Route
            path="/dashboard/activity/tru-requirements"
            element={<ActivityRequirementsTRU />}
          />

          {/* ===================================================
              PROMOTION REQUIREMENTS
          =================================================== */}

          <Route
            path="/dashboard/promotion/department-requirements"
            element={<PromotionRequirementsDepartment />}
          />

          <Route
            path="/dashboard/promotion/mcd-requirements"
            element={<PromotionRequirementsMCD />}
          />

          <Route
            path="/dashboard/promotion/mtf7-requirements"
            element={<PromotionRequirementsMTF7 />}
          />

          <Route
            path="/dashboard/promotion/sar-requirements"
            element={<PromotionRequirementsSAR />}
          />

          <Route
            path="/dashboard/promotion/swat-requirements"
            element={<PromotionRequirementsSWAT />}
          />

          <Route
            path="/dashboard/promotion/teu-requirements"
            element={<PromotionRequirementsTEU />}
          />

          <Route
            path="/dashboard/promotion/tru-requirements"
            element={<PromotionRequirementsTRU />}
          />

          {/* ===================================================
              404
          =================================================== */}

          <Route
            path="*"
            element={<NotFound />}
          />

        </Route>
      </Routes>

      {/* =====================================================
          GLOBAL NOTIFICATIONS
      ===================================================== */}

      <Toaster
        position="top-right"
        visibleToasts={5}
        gap={6}
        theme="system"
        closeButton
        icons={{
          success: (
            <CheckCircle2 className="size-5 shrink-0 text-green-500" />
          ),
          info: (
            <Info className="size-5 shrink-0 text-blue-500" />
          ),
          warning: (
            <AlertTriangle className="size-5 shrink-0 text-yellow-500" />
          ),
          error: (
            <XCircle className="size-5 shrink-0 text-red-500" />
          ),
        }}
        toastOptions={{
          classNames: {
            toast:
              "bg-background text-foreground border-border pr-12",
            title:
              "text-foreground",
            description:
              "text-muted-foreground",
          },
        }}
      />
    </BrowserRouter>
  )
}
