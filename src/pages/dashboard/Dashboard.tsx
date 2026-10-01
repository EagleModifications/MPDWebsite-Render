import {
  ArrowRight,
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Shield,
  Users,
} from "lucide-react"
import { Link } from "react-router-dom"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { useRequireAuth } from "@/hooks/useRequireAuth"

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
      <div className="space-y-8">
        {/* Welcome */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="absolute right-[-100px] top-[-120px] h-[300px] w-[300px] rounded-full bg-blue-600/10 blur-[100px]" />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10">
                    <Shield className="h-4 w-4 text-blue-500" />
                  </div>

                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                    Metro Police Department
                  </span>
                </div>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Welcome back
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Your Metro PD dashboard. Access department tools,
                  activity management, audits, requirements, and more
                  from one place.
                </p>
              </div>

              <Link
                to="/activity/activityroster"
                className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-6 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
              >
                Activity Roster
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* Quick Access */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              Quick Access
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Jump straight into the tools you use most.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QuickAccessCard
              title="Activity Roster"
              description="View and manage department activity."
              icon={Users}
              href="/activity/activityroster"
            />

            <QuickAccessCard
              title="Master Audit"
              description="Review department activity compliance."
              icon={ClipboardCheck}
              href="/activity/masteraudit"
            />

            <QuickAccessCard
              title="Requirements"
              description="View department and division requirements."
              icon={FileCheck2}
              href="/departmentrequirements"
            />

            <QuickAccessCard
              title="Events"
              description="View upcoming Metro PD events."
              icon={CalendarDays}
              href="/events"
            />
          </div>
        </section>

        {/* Overview */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              Department Overview
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              A quick look at your department dashboard.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              title="Department Members"
              value="0"
              description="Active members"
            />

            <StatCard
              icon={ClipboardCheck}
              title="Audits"
              value="0"
              description="Completed audits"
            />

            <StatCard
              icon={FileCheck2}
              title="Audit Failures"
              value="0"
              description="Items requiring review"
            />

            <StatCard
              icon={Bell}
              title="Notifications"
              value="0"
              description="Unread notifications"
            />
          </div>
        </section>

        {/* Recent Activity + Notice */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Recent Activity
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Recent department activity will appear here.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              </div>

              <p className="mt-3 text-sm font-medium">
                No recent activity
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Department activity will appear here as it is recorded.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <h2 className="mt-4 text-lg font-semibold">
              Metro PD Portal
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use the navigation menu to access department management
              tools, rosters, audits, requirements, and other resources.
            </p>

            <div className="mt-5 border-t border-border pt-5">
              <Link
                to="/notifications"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-blue-500 transition-colors hover:text-blue-400"
              >
                View notifications
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}

type QuickAccessCardProps = {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}

function QuickAccessCard({
  title,
  description,
  icon: Icon,
  href,
}: QuickAccessCardProps) {
  return (
    <Link
      to={href}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10">
          <Icon className="h-5 w-5 text-blue-500" />
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-500" />
      </div>

      <h3 className="mt-5 font-semibold">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        {description}
      </p>
    </Link>
  )
}

type StatCardProps = {
  title: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: StatCardProps) {
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
