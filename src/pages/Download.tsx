import { useEffect, useMemo, useState } from "react"
import {
  Apple,
  CheckCircle2,
  Download as DownloadIcon,
  ExternalLink,
  Loader2,
  Monitor,
  Package,
  ShieldCheck,
  Terminal,
} from "lucide-react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

type ReleaseAsset = {
  name: string
  size: number
  browser_download_url: string
}

type Release = {
  id: number
  tag_name: string
  name: string | null
  draft: boolean
  prerelease: boolean
  published_at: string | null
  html_url: string
  assets: ReleaseAsset[]
}

type Platform = "windows" | "macos" | "linux"

const RELEASES_API =
  "https://api.github.com/repos/EagleModifications/MPDWebsite-Render/releases?per_page=20"

const RELEASES_URL =
  "https://github.com/EagleModifications/MPDWebsite-Render/releases"

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"

  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(value: string | null) {
  if (!value) return "Unknown date"

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

function versionNumber(release: Release) {
  return release.tag_name.replace(/^v/i, "")
}

function findAsset(release: Release, platform: Platform) {
  const assets = release.assets ?? []

  if (platform === "windows") {
    return assets.find((asset) => /\.exe$/i.test(asset.name)) ?? null
  }

  if (platform === "macos") {
    return assets.find((asset) => /\.dmg$/i.test(asset.name)) ?? null
  }

  return assets.find((asset) => /\.AppImage$/i.test(asset.name)) ?? null
}

function platformName(platform: Platform) {
  if (platform === "windows") return "Windows"
  if (platform === "macos") return "macOS"
  return "Linux"
}

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === "windows") return <Monitor className="h-4 w-4" />
  if (platform === "macos") return <Apple className="h-4 w-4" />
  return <Terminal className="h-4 w-4" />
}

function PlatformDownload({
  platform,
  asset,
  primary = false,
}: {
  platform: Platform
  asset: ReleaseAsset | null
  primary?: boolean
}) {
  const name = platformName(platform)

  if (!asset) {
    return (
      <div className="flex h-10 items-center justify-between rounded-md border border-border/60 bg-background/30 px-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <PlatformIcon platform={platform} />
          {name}
        </span>
        <span className="text-xs">Not available</span>
      </div>
    )
  }

  return (
    <a
      href={asset.browser_download_url}
      target="_blank"
      rel="noreferrer"
      className={[
        "flex h-10 items-center justify-between rounded-md border px-3 text-sm font-medium transition-colors",
        primary
          ? "border-blue-500/60 bg-blue-600 text-white hover:bg-blue-500"
          : "border-border/70 bg-background/40 text-foreground hover:border-blue-500/40 hover:bg-white/[0.03]",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        <PlatformIcon platform={platform} />
        Download for {name}
      </span>
      <DownloadIcon className="h-4 w-4" />
    </a>
  )
}

function ReleaseRow({ release }: { release: Release }) {
  return (
    <div className="border-b border-border/50 px-4 py-4 last:border-b-0 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">
              {release.name || "Metro Police Department Desktop"}
            </h3>
            <span className="rounded-md border border-border/70 bg-background/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              v{versionNumber(release)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Released {formatDate(release.published_at)}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:w-[520px]">
          <PlatformDownload platform="windows" asset={findAsset(release, "windows")} />
          <PlatformDownload platform="macos" asset={findAsset(release, "macos")} />
          <PlatformDownload platform="linux" asset={findAsset(release, "linux")} />
        </div>
      </div>
    </div>
  )
}

export default function Download() {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadReleases() {
      try {
        setError(false)

        const response = await fetch(RELEASES_API, {
          headers: { Accept: "application/vnd.github+json" },
          cache: "no-store",
        })

        if (!response.ok) throw new Error(`GitHub returned ${response.status}`)

        const data = (await response.json()) as Release[]

        const visible = data
          .filter((release) => !release.draft && !release.prerelease)
          .sort((a, b) => {
            const aDate = a.published_at ? Date.parse(a.published_at) : 0
            const bDate = b.published_at ? Date.parse(b.published_at) : 0
            return bDate - aDate
          })

        if (!cancelled) setReleases(visible)
      } catch (loadError) {
        console.error("Failed to load desktop releases:", loadError)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadReleases()

    return () => {
      cancelled = true
    }
  }, [])

  const latest = releases[0] ?? null
  const previous = useMemo(() => releases.slice(1), [releases])
  const windowsAsset = latest ? findAsset(latest, "windows") : null
  const macAsset = latest ? findAsset(latest, "macos") : null
  const linuxAsset = latest ? findAsset(latest, "linux") : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-7">
          {/* Page heading — matches Events/Gallery */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-500">
              <DownloadIcon className="h-4 w-4" />
              <span>Desktop Application</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Download
            </h1>

            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Download the Metro Police Department desktop application for your computer.
            </p>
          </div>

          {loading ? (
            <section className="rounded-xl border border-border/60 bg-card/30 p-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
              <p className="mt-3 text-sm text-muted-foreground">
                Loading releases...
              </p>
            </section>
          ) : error ? (
            <section className="rounded-xl border border-border/60 bg-card/30 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Unable to load releases</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    GitHub releases could not be loaded right now.
                  </p>
                </div>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border/70 px-3 text-sm font-medium hover:bg-white/[0.04]"
                >
                  GitHub
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </section>
          ) : !latest ? (
            <section className="rounded-xl border border-border/60 bg-card/30 p-10 text-center">
              <Package className="mx-auto h-6 w-6 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">No releases yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Published desktop releases will appear here automatically.
              </p>
            </section>
          ) : (
            <>
              {/* Latest release — same compact card language as Gallery */}
              <section className="overflow-hidden rounded-xl border border-border/60 bg-card/30">
                <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">
                      Metro Police Department Desktop
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Latest published desktop application
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">
                    v{versionNumber(latest)}
                  </span>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/50">
                        <img
                          src="/logo.png"
                          alt="Metro Police Department"
                          className="h-full w-full object-contain p-2"
                        />
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold">
                          Get the MPD desktop app
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          The Metro Police Department website in a dedicated desktop application window.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      <PlatformDownload
                        platform="windows"
                        asset={windowsAsset}
                        primary
                      />
                      <PlatformDownload platform="macos" asset={macAsset} />
                      <PlatformDownload platform="linux" asset={linuxAsset} />
                    </div>
                  </div>

                  <div className="border-t border-border/60 bg-background/20 p-5 lg:border-l lg:border-t-0">
                    <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Version
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          v{versionNumber(latest)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Released
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatDate(latest.published_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Windows
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {windowsAsset ? formatBytes(windowsAsset.size) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 border-t border-border/60 p-4 sm:grid-cols-3">
                  <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/20 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-medium">Download once</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        Keep the app installed.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/20 p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-medium">Automatic updates</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        Desktop releases can update automatically.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/20 p-3">
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-medium">Live website</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        Website changes appear without reinstalling.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Previous versions — compact list like Events/Gallery sections */}
              <section className="mt-6">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Previous Versions</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Earlier Metro Police Department desktop releases.
                    </p>
                  </div>

                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400 sm:flex"
                  >
                    View releases
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/60 bg-card/30">
                  {previous.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">
                        No previous versions are available.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Older releases will appear here when new versions are published.
                      </p>
                    </div>
                  ) : (
                    previous.map((release) => (
                      <ReleaseRow key={release.id} release={release} />
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
