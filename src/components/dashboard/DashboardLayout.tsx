import type { ReactNode } from "react"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import DashboardSidebar from "@/components/dashboard/Sidebar"
import DashboardNavbar from "@/components/dashboard/Navbar"
import DashboardFooter from "@/components/dashboard/Footer"

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
          <div className="flex min-h-screen flex-col">
            <DashboardNavbar />

            <main className="flex flex-1 flex-col gap-4 p-4">
              {children}
            </main>

            <DashboardFooter />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
