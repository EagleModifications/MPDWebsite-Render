import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Images,
  Shield,
} from "lucide-react"
import { type ComponentType } from "react"
import { Link } from "react-router-dom"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { useRequireAuth } from "@/hooks/useRequireAuth"

type IconType = ComponentType<{ className?: string }>

export default function Dashboard() {
  const { loading, user } = useRequireAuth("view")

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">
          Loading...
        </p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        {/* Header */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10">
                    <Shield className="h-5 w-5 text-blue-500" />
                  </div>

                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">
                    Metro Police Department
                  </span>
                </div>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  Dashboard
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Welcome to the Metro Police Department member portal.
                  Access your department tools, rosters, requirements,
                  imports, and management systems from here.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Access */}
        <section>
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">
              Quick Access
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Access commonly used Metro PD tools.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Activity Roster"
              description="View and manage department activity and member records."
              icon={ClipboardCheck}
              href="/dashboard/activity/activityroster"
            />

            <DashboardCard
              title="Promotion Roster"
              description="Review promotion activity and department progression."
              icon={ClipboardCheck}
              href="/dashboard/promotion/promotionroster"
            />

            <DashboardCard
              title="Events"
              description="View upcoming Metro Police Department events."
              icon={CalendarDays}
              href="/events"
            />

            <DashboardCard
              title="Gallery"
              description="View Metro Police Department pictures and videos."
              icon={Images}
              href="/gallery"
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

type DashboardCardProps = {
  title: string
  description: string
  icon: IconType
  href: string
}

function DashboardCard({
  title,
  description,
  icon: Icon,
  href,
}: DashboardCardProps) {
  return (
    <Link
      to={href}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10">
          <Icon className="h-5 w-5 text-blue-500" />
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-500" />
      </div>

      <h3 className="mt-5 text-sm font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        {description}
      </p>
    </Link>
  )
}

type OverviewCardProps = {
  title: string
  value: string
  description: string
  icon: IconType
}

function OverviewCard({
  title,
  value,
  description,
  icon: Icon,
}: OverviewCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        {title}
      </p>

      <p className="mt-1 text-3xl font-bold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
