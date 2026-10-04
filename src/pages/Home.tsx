import {
  ArrowRight,
  LayoutDashboard,
  LogIn,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import Footer from "@/components/Footer"
import Navbar from "@/components/home/Navbar"

export default function Home() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [canViewDashboard, setCanViewDashboard] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        const sessionResponse = await fetch(
          "/api/auth/session",
          {
            credentials: "include",
          },
        )

        if (!sessionResponse.ok) {
          if (mounted) {
            setIsAuthenticated(false)
            setCanViewDashboard(false)
          }

          return
        }

        const sessionData =
          await sessionResponse.json()

        if (!mounted) {
          return
        }

        const authenticated =
          Boolean(sessionData?.user)

        setIsAuthenticated(authenticated)

        if (!authenticated) {
          setCanViewDashboard(false)
          return
        }

        try {
          const permissionResponse =
            await fetch(
              "/api/auth/check?permission=view",
              {
                credentials: "include",
              },
            )

          if (!mounted) {
            return
          }

          setCanViewDashboard(
            permissionResponse.ok,
          )
        } catch {
          if (mounted) {
            setCanViewDashboard(false)
          }
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false)
          setCanViewDashboard(false)
        }
      } finally {
        if (mounted) {
          setAuthChecked(true)
        }
      }
    }

    void checkAuth()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <Navbar />

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Blue glow */}
        <div className="absolute left-1/2 top-[42%] h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[140px]" />

        <div className="absolute left-[15%] top-[30%] h-[250px] w-[250px] rounded-full bg-blue-500/5 blur-[100px]" />

        <div className="absolute right-[10%] top-[25%] h-[300px] w-[300px] rounded-full bg-blue-400/5 blur-[120px]" />

        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-background via-background/80 to-transparent" />

        {/* Small atmospheric lights */}
        <div className="absolute left-[12%] top-[35%] h-1 w-1 rounded-full bg-blue-400/50" />

        <div className="absolute left-[22%] top-[48%] h-1 w-1 rounded-full bg-blue-500/30" />

        <div className="absolute right-[16%] top-[38%] h-1 w-1 rounded-full bg-blue-400/40" />

        <div className="absolute right-[9%] top-[50%] h-1 w-1 rounded-full bg-blue-500/30" />
      </div>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col">
        <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
          <div className="flex w-full max-w-5xl flex-col items-center text-center">
            {/* Brand */}
            <div className="mb-7 flex items-center gap-3">
              <img
                src="/logo.png"
                alt="MPD"
                className="h-9 w-9 object-contain"
              />

              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em]">
                <span className="text-foreground">
                  METRO POLICE DEPARTMENT
                </span>

                <span className="text-blue-500">
                  •
                </span>

                <span className="text-muted-foreground">
                  CALIFORNIA ROLEPLAY
                </span>
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-4xl font-black uppercase leading-[0.88] tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
              <span className="block">
                METRO POLICE
              </span>

              <span className="mt-2 block bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                DEPARTMENT
              </span>
            </h1>

            {/* Description */}
            <p className="mt-8 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              The Metro Police Department is built
              around immersive law enforcement,
              dedicated officers, community
              interaction, and unforgettable stories
              across CaliRP.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              {/* Join Metro PD */}
              <a
                href="https://discord.gg/metropd"
                className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
              >
                <span>
                  Join Metro PD
                </span>

                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>

              {/* Authentication / Dashboard */}
              {authChecked &&
                !isAuthenticated && (
                  <Link
                    to="/sign-in"
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    <LogIn className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />

                    <span>
                      Member Login
                    </span>
                  </Link>
                )}

              {authChecked &&
                isAuthenticated &&
                canViewDashboard && (
                  <Link
                    to="/dashboard"
                    className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md border border-white/15 bg-white/[0.04] px-8 text-sm font-semibold uppercase tracking-wide text-foreground transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    <LayoutDashboard className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />

                    <span>
                      Dashboard
                    </span>
                  </Link>
                )}
            </div>

            {/* Secondary links */}
            <div className="mt-7 flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <a
                href="https://discord.gg/metropd"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-blue-500"
              >
                Discord
              </a>

              <span className="text-muted-foreground/30">
                •
              </span>

              <Link
                to="/events"
                className="transition-colors hover:text-blue-500"
              >
                Events
              </Link>

              <span className="text-muted-foreground/30">
                •
              </span>

              <Link
                to="/gallery"
                className="transition-colors hover:text-blue-500"
              >
                Gallery
              </Link>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border/60" />

            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />

            <div className="h-px flex-1 bg-border/60" />
          </div>
        </div>

        {/* Final Discord CTA */}
        <section className="relative mt-16 overflow-hidden border-t border-border/40">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-background to-background" />

          {/* Blue atmospheric glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[130px]" />

          {/* Content */}
          <div className="relative mx-auto flex min-h-[390px] w-full max-w-6xl items-center justify-center px-6 py-20 text-center">
            <div className="relative z-10 max-w-4xl">
              {/* Heading */}
              <h2 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="text-foreground">
                  THE METRO POLICE DEPARTMENT{" "}
                </span>

                <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                  IS WAITING
                </span>
              </h2>

              {/* Description */}
              <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Join the Discord, create a ticket,
                and start a story worth telling.
              </p>

              {/* Discord Button */}
              <div className="mt-8 flex justify-center">
                <a
                  href="https://discord.gg/metropd"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-md bg-blue-600 px-8 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25"
                >
                  <span>
                    Join Discord
                  </span>

                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>

          {/* City Skyline */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-40">
            <div className="absolute bottom-0 left-[2%] h-12 w-20 bg-black/60" />

            <div className="absolute bottom-0 left-[9%] h-20 w-12 bg-black/60" />

            <div className="absolute bottom-0 left-[15%] h-14 w-24 bg-black/60" />

            <div className="absolute bottom-0 left-[25%] h-24 w-16 bg-black/60" />

            <div className="absolute bottom-0 left-[34%] h-16 w-28 bg-black/60" />

            <div className="absolute bottom-0 left-[46%] h-28 w-20 bg-black/60" />

            <div className="absolute bottom-0 left-[57%] h-14 w-24 bg-black/60" />

            <div className="absolute bottom-0 left-[67%] h-22 w-16 bg-black/60" />

            <div className="absolute bottom-0 left-[77%] h-28 w-20 bg-black/60" />

            <div className="absolute bottom-0 left-[88%] h-18 w-28 bg-black/60" />

            <div className="absolute bottom-0 right-[1%] h-12 w-16 bg-black/60" />
          </div>

          {/* Bottom blue glow */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-blue-500/30" />
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
