import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}

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
          path="*"
          element={<NotFound />}
        />

        <Route
          path="/events"
          element={<Events />}
        />

        <Route
          path="/gallery"
          element={<Gallery />}
        />

        {/* Dashboards */}

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/activity/activityroster"
          element={<ActivityRoster />}
        />

        <Route
          path="/promotion/promotionroster"
          element={<PromotionRoster />}
        />

        {/* Imports */}

        <Route
          path="/activity/imports/department"
          element={<ActivityImportDepartment />}
        />

        <Route
          path="/activity/imports/mcd"
          element={<ActivityImportMCD />}
        />

        <Route
          path="/activity/imports/mtf-7"
          element={<ActivityImportMTF7 />}
        />

        <Route
          path="/activity/imports/sar"
          element={<ActivityImportSAR />}
        />

        <Route
          path="/activity/imports/swat"
          element={<ActivityImportSWAT />}
        />

        <Route
          path="/activity/imports/teu"
          element={<ActivityImportTEU />}
        />

        <Route
          path="/activity/imports/tru"
          element={<ActivityImportTRU />}
        />

        <Route
          path="/promotion/imports/department"
          element={<PromotionImportDepartment />}
        />

        <Route
          path="/promotion/imports/mcd"
          element={<PromotionImportMCD />}
        />

        <Route
          path="/promotion/imports/mtf-7"
          element={<PromotionImportMTF7 />}
        />

        <Route
          path="/promotion/imports/sar"
          element={<PromotionImportSAR />}
        />

        <Route
          path="/promotion/imports/swat"
          element={<PromotionImportSWAT />}
        />

        <Route
          path="/promotion/imports/teu"
          element={<PromotionImportTEU />}
        />

        <Route
          path="/promotion/imports/tru"
          element={<PromotionImportTRU />}
        />

        {/* Requirements */}

        <Route
          path="/activity/requirements/department"
          element={<ActivityRequirementsDepartment />}
        />

        <Route
          path="/activity/requirements/mcd"
          element={<ActivityRequirementsMCD />}
        />

        <Route
          path="/activity/requirements/mtf-7"
          element={<ActivityRequirementsMTF7 />}
        />

        <Route
          path="/activity/requirements/sar"
          element={<ActivityRequirementsSAR />}
        />

        <Route
          path="/activity/requirements/swat"
          element={<ActivityRequirementsSWAT />}
        />

        <Route
          path="/activity/requirements/teu"
          element={<ActivityRequirementsTEU />}
        />

        <Route
          path="/activity/requirements/tru"
          element={<ActivityRequirementsTRU />}
        />

        <Route
          path="/promotion/requirements/department"
          element={<PromotionRequirementsDepartment />}
        />

        <Route
          path="/promotion/requirements/mcd"
          element={<PromotionRequirementsMCD />}
        />

        <Route
          path="/promotion/requirements/mtf-7"
          element={<PromotionRequirementsMTF7 />}
        />

        <Route
          path="/promotion/requirements/sar"
          element={<PromotionRequirementsSAR />}
        />

        <Route
          path="/promotion/requirements/swat"
          element={<PromotionRequirementsSWAT />}
        />

        <Route
          path="/promotion/requirements/teu"
          element={<PromotionRequirementsTEU />}
        />

        <Route
          path="/promotion/requirements/tru"
          element={<PromotionRequirementsTRU />}
        />

        {/* Fallback */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>

      {/* Global notifications */}
      {/*
      Positions:
      top-left
      top-center
      top-right
      bottom-left
      bottom-center
      bottom-right

      Options:
      position (Where notifications appear)
      richColors (Uses colored success/error/warning/info styles)
      closeButton (Adds an X button to each notification)
      duration (duration={4000} - How long notifications stay open, in ms)
      expand (Keeps multiple notifications expanded)
      visibleToasts (visibleToasts={4} - Maximum visible notifications)
      gap (gap={8} - Space between notifications)
      offset (offset="24px" - Distance from the screen edge)
      theme (theme="dark" - Force dark/light/system theme)
      closeButtonAriaLabel (closeButtonAriaLabel="Close" - Accessibility label for close button)
      */}
      {/*<Toaster
        position="top-left"
        richColors
        closeButton
      />*/}
      {/*<Toaster
        position="top-center"
        richColors
        closeButton
      />*/}
      {/*<Toaster
        position="top-right"
        richColors
        closeButton
      />*/}

      {/*<Toaster
        position="bottom-left"
        richColors
        closeButton
      />*/}
      {/*<Toaster
        position="bottom-center"
        richColors
        closeButton
      />*/}
      <Toaster
        position="top-right"
        theme="system"
        closeButton
        icons={{
          success: <CheckCircle2 className="size-5 shrink-0 text-green-500" />,
          info: <Info className="size-5 shrink-0 text-blue-500" />,
          warning: <AlertTriangle className="size-5 shrink-0 text-yellow-500" />,
          error: <XCircle className="size-5 shrink-0 text-red-500" />,
        }}
        toastOptions={{
          classNames: {
            toast: "bg-background text-foreground border-border",
            title: "text-foreground",
            description: "text-muted-foreground",
          },
        }}
      />
    </BrowserRouter>
  )
}
