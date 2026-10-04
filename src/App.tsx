import {
  useEffect,
  useState,
  type ReactNode,
} from "react"

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"

import {
  CheckCircle2,
  Info,
  AlertTriangle,
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

import Dashboard from "@/pages/dashboard/Dashboard"

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

type PageProtectionState =
  | "checking"
  | "allowed"
  | "unauthenticated"
  | "forbidden"
  | "error"

function PageProtection({
  children,
}: {
  children: ReactNode
}) {
  const location = useLocation()

  const [state, setState] =
    useState<PageProtectionState>("checking")

  useEffect(() => {
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
         * The requested page is protected and the user
         * is not authenticated.
         */
        if (response.status === 401) {
          setState("unauthenticated")
          return
        }

        /*
         * The user is authenticated but does not have
         * the required permission.
         */
        if (response.status === 403) {
          setState("forbidden")
          return
        }

        /*
         * Any other non-success response means the
         * permission check itself failed.
         */
        if (!response.ok) {
          setState("error")
          return
        }

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
  ])

  /*
   * Access is being checked.
   *
   * Do NOT show a loading screen here.
   * Send the user to the existing /verifying page.
   */
  if (state === "checking") {
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
   * Protected page but user is not logged in.
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
   * User is logged in but does not have
   * the required page permission.
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
   * Permission system/server failure.
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

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <PageProtection>
        <Routes>
          {/* =========================================================
              PUBLIC
          ========================================================= */}

          <Route
            path="/"
            element={<Home />}
          />

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

          <Route
            path="/events"
            element={<Events />}
          />

          <Route
            path="/gallery"
            element={<Gallery />}
          />

          {/* =========================================================
              DASHBOARD
          ========================================================= */}

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/dashboard/admin/permissions"
            element={<Permissions />}
          />

          <Route
            path="/dashboard/activity/activityroster"
            element={<ActivityRoster />}
          />

          <Route
            path="/dashboard/promotion/promotionroster"
            element={<PromotionRoster />}
          />

          {/* =========================================================
              ACTIVITY IMPORTS
          ========================================================= */}

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

          {/* =========================================================
              PROMOTION IMPORTS
          ========================================================= */}

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

          {/* =========================================================
              ACTIVITY REQUIREMENTS
          ========================================================= */}

          <Route
            path="/dashboard/activity/requirements/department"
            element={<ActivityRequirementsDepartment />}
          />

          <Route
            path="/dashboard/activity/requirements/mcd"
            element={<ActivityRequirementsMCD />}
          />

          <Route
            path="/dashboard/activity/requirements/mtf7"
            element={<ActivityRequirementsMTF7 />}
          />

          <Route
            path="/dashboard/activity/requirements/sar"
            element={<ActivityRequirementsSAR />}
          />

          <Route
            path="/dashboard/activity/requirements/swat"
            element={<ActivityRequirementsSWAT />}
          />

          <Route
            path="/dashboard/activity/requirements/teu"
            element={<ActivityRequirementsTEU />}
          />

          <Route
            path="/dashboard/activity/requirements/tru"
            element={<ActivityRequirementsTRU />}
          />

          {/* =========================================================
              PROMOTION REQUIREMENTS
          ========================================================= */}

          <Route
            path="/dashboard/promotion/requirements/department"
            element={<PromotionRequirementsDepartment />}
          />

          <Route
            path="/dashboard/promotion/requirements/mcd"
            element={<PromotionRequirementsMCD />}
          />

          <Route
            path="/dashboard/promotion/requirements/mtf7"
            element={<PromotionRequirementsMTF7 />}
          />

          <Route
            path="/dashboard/promotion/requirements/sar"
            element={<PromotionRequirementsSAR />}
          />

          <Route
            path="/dashboard/promotion/requirements/swat"
            element={<PromotionRequirementsSWAT />}
          />

          <Route
            path="/dashboard/promotion/requirements/teu"
            element={<PromotionRequirementsTEU />}
          />

          <Route
            path="/dashboard/promotion/requirements/tru"
            element={<PromotionRequirementsTRU />}
          />

          {/* =========================================================
              404
          ========================================================= */}

          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
      </PageProtection>

      <Toaster />
    </BrowserRouter>
  )
}
