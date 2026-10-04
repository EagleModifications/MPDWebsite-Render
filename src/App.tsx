import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react"
import { Toaster } from "sonner"

import NotFound from "@/pages/NotFound"

import Home from "@/pages/Home"
import SignIn from "@/pages/SignIn"
import SignedOut from "@/pages/SignedOut"
import Verifying from "@/pages/Verifying"

import Events from "@/pages/Events"
import Gallery from "@/pages/Gallery"

import MainRoster from "@/pages/documents/MainRoster"
import PromotionRoster from "@/pages/documents/PromotionRoster"

import ActivityRoster from "@/pages/dashboard/activity/ActivityRoster"
import PromotionRosterDashboard from "@/pages/dashboard/promotion/PromotionRoster"

import DepartmentActivity from "@/pages/dashboard/activity/imports/Department"
import MCDActivity from "@/pages/dashboard/activity/imports/MCD"
import MTF7Activity from "@/pages/dashboard/activity/imports/MTF-7"
import SARActivity from "@/pages/dashboard/activity/imports/SAR"
import SWATActivity from "@/pages/dashboard/activity/imports/SWAT"
import TEUActivity from "@/pages/dashboard/activity/imports/TEU"
import TRUActivity from "@/pages/dashboard/activity/imports/TRU"

import DepartmentPromotion from "@/pages/dashboard/promotion/divisions/Department"
import MCDPromotion from "@/pages/dashboard/promotion/imports/MCD"
import MTF7Promotion from "@/pages/dashboard/promotion/imports/MTF-7"
import SARPromotion from "@/pages/dashboard/promotion/imports/SAR"
import SWATPromotion from "@/pages/dashboard/promotion/imports/SWAT"
import TEUPromotion from "@/pages/dashboard/promotion/imports/TEU"
import TRUPromotion from "@/pages/dashboard/promotion/imports/TRU"

import DepartmentActivityRequirements from "@/pages/dashboard/activity/requirements/Department"
import MCDActivityRequirements from "@/pages/dashboard/activity/requirements/MCD"
import MTF7ActivityRequirements from "@/pages/dashboard/activity/requirements/MTF-7"
import SARActivityRequirements from "@/pages/dashboard/activity/requirements/SAR"
import SWATActivityRequirements from "@/pages/dashboard/activity/requirements/SWAT"
import TEUActivityRequirements from "@/pages/dashboard/activity/requirements/TEU"
import TRUActivityRequirements from "@/pages/dashboard/activity/requirements/TRU"

import DepartmentPromotionRequirements from "@/pages/dashboard/promotion/requirements/Department"
import MCDPromotionRequirements from "@/pages/dashboard/promotion/requirements/MCD"
import MTF7PromotionRequirements from "@/pages/dashboard/promotion/requirements/MTF-7"
import SARPromotionRequirements from "@/pages/dashboard/promotion/requirements/SAR"
import SWATPromotionRequirements from "@/pages/dashboard/promotion/requirements/SWAT"
import TEUPromotionRequirements from "@/pages/dashboard/promotion/requirements/TEU"
import TRUPromotionRequirements from "@/pages/dashboard/promotion/requirements/TRU"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signed-out" element={<SignedOut />} />
        <Route path="/verifying" element={<Verifying />} />

        <Route path="/events" element={<Events />} />
        <Route path="/gallery" element={<Gallery />} />

        <Route
          path="/documents/mainroster"
          element={<MainRoster />}
        />

        <Route
          path="/documents/promotion-roster"
          element={<PromotionRoster />}
        />

        <Route
          path="/dashboard/activity"
          element={<ActivityRoster />}
        />

        <Route
          path="/dashboard/promotion"
          element={<PromotionRosterDashboard />}
        />

        <Route
          path="/dashboard/activity/department"
          element={<DepartmentActivity />}
        />
        <Route
          path="/dashboard/activity/mcd"
          element={<MCDActivity />}
        />
        <Route
          path="/dashboard/activity/mtf7"
          element={<MTF7Activity />}
        />
        <Route
          path="/dashboard/activity/sar"
          element={<SARActivity />}
        />
        <Route
          path="/dashboard/activity/swat"
          element={<SWATActivity />}
        />
        <Route
          path="/dashboard/activity/teu"
          element={<TEUActivity />}
        />
        <Route
          path="/dashboard/activity/tru"
          element={<TRUActivity />}
        />

        <Route
          path="/dashboard/promotion/department"
          element={<DepartmentPromotion />}
        />
        <Route
          path="/dashboard/promotion/mcd"
          element={<MCDPromotion />}
        />
        <Route
          path="/dashboard/promotion/mtf7"
          element={<MTF7Promotion />}
        />
        <Route
          path="/dashboard/promotion/sar"
          element={<SARPromotion />}
        />
        <Route
          path="/dashboard/promotion/swat"
          element={<SWATPromotion />}
        />
        <Route
          path="/dashboard/promotion/teu"
          element={<TEUPromotion />}
        />
        <Route
          path="/dashboard/promotion/tru"
          element={<TRUPromotion />}
        />

        <Route
          path="/dashboard/activity/requirements/department"
          element={<DepartmentActivityRequirements />}
        />
        <Route
          path="/dashboard/activity/requirements/mcd"
          element={<MCDActivityRequirements />}
        />
        <Route
          path="/dashboard/activity/requirements/mtf7"
          element={<MTF7ActivityRequirements />}
        />
        <Route
          path="/dashboard/activity/requirements/sar"
          element={<SARActivityRequirements />}
        />
        <Route
          path="/dashboard/activity/requirements/swat"
          element={<SWATActivityRequirements />}
        />
        <Route
          path="/dashboard/activity/requirements/teu"
          element={<TEUActivityRequirements />}
        />
        <Route
          path="/dashboard/activity/requirements/tru"
          element={<TRUActivityRequirements />}
        />

        <Route
          path="/dashboard/promotion/requirements/department"
          element={<DepartmentPromotionRequirements />}
        />
        <Route
          path="/dashboard/promotion/requirements/mcd"
          element={<MCDPromotionRequirements />}
        />
        <Route
          path="/dashboard/promotion/requirements/mtf7"
          element={<MTF7PromotionRequirements />}
        />
        <Route
          path="/dashboard/promotion/requirements/sar"
          element={<SARPromotionRequirements />}
        />
        <Route
          path="/dashboard/promotion/requirements/swat"
          element={<SWATPromotionRequirements />}
        />
        <Route
          path="/dashboard/promotion/requirements/teu"
          element={<TEUPromotionRequirements />}
        />
        <Route
          path="/dashboard/promotion/requirements/tru"
          element={<TRUPromotionRequirements />}
        />

        <Route
          path="*"
          element={<NotFound />}
        />
      </Routes>

      <Toaster
        position="top-right"
        expand={false}
        richColors
        closeButton
        icons={{
          success: <CheckCircle2 className="size-4" />,
          info: <Info className="size-4" />,
          warning: <AlertTriangle className="size-4" />,
          error: <XCircle className="size-4" />,
        }}
        toastOptions={{
          classNames: {
            toast:
              "border border-border bg-background text-foreground shadow-lg",
            title: "text-foreground",
            description: "text-muted-foreground",
            success:
              "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            info:
              "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
            warning:
              "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
            error:
              "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
          },
        }}
      />
    </BrowserRouter>
  )
}

export default App
