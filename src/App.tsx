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
          path="/dashboard/activity/activityroster"
          element={<ActivityRoster />}
        />

        <Route
          path="/dashboard/promotion/promotionroster"
          element={<PromotionRoster />}
        />

        {/* Imports */}

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

        {/* Requirements */}

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
