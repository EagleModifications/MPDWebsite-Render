import type { ReactNode } from "react"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import DashboardSidebar from "@/components/dashboard/Sidebar"
import DashboardNavbar from "@/components/dashboard/Navbar"
import DashboardFooter from "@/components/dashboard/Footer"

import DevelopmentNotice from "@/components/DevelopmentNotice"

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <DashboardSidebar />

        <SidebarInset className="min-w-0">
          <DashboardNavbar />

          <main className="min-h-[calc(100vh-4rem)] pb-16">
            <div className="flex flex-col gap-4 p-4">
              {children}
            </div>
          </main>

          <div className="fixed bottom-0 right-0 z-40 w-[calc(100%-var(--sidebar-width))]">
            <DashboardFooter />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
