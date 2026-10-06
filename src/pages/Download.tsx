import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Apple,
  CalendarDays,
  Download as DownloadIcon,
  ExternalLink,
  FileDown,
  Monitor,
  Package,
  RefreshCw,
  Terminal,
  Tag,
  X,
} from "lucide-react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

const GITHUB_RELEASES_API =
  "https://api.github.com/repos/EagleModifications/MPDWebsite-Render/releases"

const GITHUB_RELEASE =
  "https://github.com/EagleModifications/MPDWebsite-Render/releases"

type ReleaseAsset = {
  id: number
  name: string
  browser_download_url: string
  size: number
  content_type: string
}

type GitHubRelease = {
  id: number
  name: string | null
  tag_name: string
  body: string | null
  html_url: string
  published_at: string | null
  created_at: string
  draft: boolean
  prerelease: boolean
  assets: ReleaseAsset[]
}

type Platform = "windows" | "macos" | "linux"

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown date"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return ""
  }

  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function getPlatform(assetName: string): Platform | null {
  const name = assetName.toLowerCase()

  if (name.endsWith(".exe")) {
    return "windows"
  }

  if (name.endsWith(".dmg")) {
    return "macos"
  }

  if (name.endsWith(".appimage")) {
    return "linux"
  }

  return null
}

function getAssets(release: GitHubRelease, platform: Platform) {
  return release.assets.filter(
    (asset) => getPlatform(asset.name) === platform,
  )
}

function getPrimaryAsset(
  release: GitHubRelease,
  platform: Platform,
) {
  const assets = getAssets(release, platform)

  if (assets.length === 0) {
    return null
  }

  if (platform !== "macos") {
    return assets[0]
  }

  const isAppleSilicon =
    typeof navigator !== "undefined" &&
    /arm|aarch/i.test(navigator.userAgent)

  return (
    assets.find((asset) =>
      isAppleSilicon
        ? /arm64|aarch64/i.test(asset.name)
        : /x64|amd64/i.test(asset.name),
    ) ?? assets[0]
  )
}

function getPlatformLabel(platform: Platform) {
  switch (platform) {
    case "windows":
      return "Windows"
    case "macos":
      return "macOS"
    case "linux":
      return "Linux"
  }
}

function PlatformIcon({
  platform,
  className = "h-4 w-4",
}: {
  platform: Platform
  className?: string
}) {
  if (platform === "windows") {
    return <Monitor className={className} />
  }

  if (platform === "macos") {
    return <Apple className={className} />
  }

  return <Terminal className={className} />
}

function ReleaseAssetButton({
  release,
  platform,
  compact = false,
}: {
  release: GitHubRelease
  platform: Platform
  compact?: boolean
}) {
  const asset = getPrimaryAsset(release, platform)
  const available = Boolean(asset)

  if (!available) {
    return (
      <button
        type="button"
        disabled
        className={[
          "inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-muted/20 text-xs font-semibold text-muted-foreground/45",
          compact
            ? "h-9 min-w-[118px] px-3"
            : "h-10 flex-1 px-3 sm:px-4",
        ].join(" ")}
      >
        <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
        {getPlatformLabel(platform)}
        <span className="text-[10px]">Not available</span>
      </button>
    )
  }

  return (
    <a
      href={asset.browser_download_url}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background text-xs font-semibold text-foreground transition-colors hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-400",
        compact
          ? "h-9 min-w-[118px] px-3"
          : "h-10 flex-1 px-3 sm:px-4",
      ].join(" ")}
      download
    >
      <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
      {compact
        ? getPlatformLabel(platform)
        : `Download for ${getPlatformLabel(platform)}`}
      <DownloadIcon className="ml-auto h-3.5 w-3.5" />
    </a>
  )
}

function ReleaseModal({
  release,
  onClose,
}: {
  release: GitHubRelease
  onClose: () => void
}) {
  const platformAssets = useMemo(
    () =>
      (["windows", "macos", "linux"] as Platform[]).flatMap((platform) =>
        getAssets(release, platform).map((asset) => ({
          platform,
          asset,
        })),
      ),
    [release],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const title = release.name?.trim() || `MPD Desktop ${release.tag_name}`

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} release details`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                <Tag className="h-3 w-3" />
                {release.tag_name}
              </span>

              {release.prerelease && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  Pre-release
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              {title}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Released {formatDate(release.published_at)}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                {release.assets.length} asset
                {release.assets.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Close release details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-500">
              Release notes
            </div>

            <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
              {release.body?.trim() ? (
                <div className="whitespace-pre-wrap break-words">
                  {release.body.trim()}
                </div>
              ) : (
                <p>No release description was provided for this release.</p>
              )}
            </div>
          </section>

          <section className="mt-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-500">
              Assets
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70">
              {platformAssets.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No downloadable assets were attached to this release.
                </div>
              ) : (
                <div className="divide-y divide-border/70">
                  {platformAssets.map(({ platform, asset }) => (
                    <div
                      key={asset.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-muted-foreground">
                          <PlatformIcon
                            platform={platform}
                            className="h-4 w-4"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {asset.name}
                          </p>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {getPlatformLabel(platform)}
                            {asset.size > 0
                              ? ` • ${formatSize(asset.size)}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <a
                        href={asset.browser_download_url}
                        download
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/15"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/70 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-xs text-muted-foreground">
            {release.tag_name} • Metro Police Department Desktop
          </span>

          <a
            href={release.html_url || GITHUB_RELEASE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border/70 px-3 text-xs font-semibold transition-colors hover:bg-muted/50"
          >
            Open on GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}

function ReleaseCard({
  release,
  onOpen,
}: {
  release: GitHubRelease
  onOpen: (release: GitHubRelease) => void
}) {
  const title = release.name?.trim() || `MPD Desktop ${release.tag_name}`

  return (
    <button
      type="button"
      onClick={() => onOpen(release)}
      className="group block w-full text-left"
      aria-label={`Open ${title} release details`}
    >
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur transition-colors hover:border-blue-500/30 hover:bg-card">
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold sm:text-base">
                {title}
              </h3>

              <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {release.tag_name}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Released {formatDate(release.published_at)}
              {" • "}
              {release.assets.length} asset
              {release.assets.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-muted-foreground transition-colors group-hover:text-blue-400 sm:inline">
              View release details
            </span>

            <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-400" />
          </div>
        </div>
      </div>
    </button>
  )
}

export default function Download() {
  const [releases, setReleases] = useState<GitHubRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [selectedRelease, setSelectedRelease] =
    useState<GitHubRelease | null>(null)

  const loadReleases = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError("")

      const response = await fetch(
        `${GITHUB_RELEASES_API}?per_page=20`,
        {
          headers: {
            Accept: "application/vnd.github+json",
          },
        },
      )

      if (!response.ok) {
        throw new Error(
          `GitHub returned HTTP ${response.status}.`,
        )
      }

      const data = (await response.json()) as GitHubRelease[]

      const validReleases = data
        .filter((release) => !release.draft)
        .sort(
          (a, b) =>
            new Date(
              b.published_at ?? b.created_at,
            ).getTime() -
            new Date(
              a.published_at ?? a.created_at,
            ).getTime(),
        )

      setReleases(validReleases)
    } catch (loadError) {
      console.error(loadError)

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load GitHub releases.",
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadReleases()
  }, [loadReleases])

  const latestRelease = releases[0]
  const previousReleases = releases.slice(1)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-7">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
                <DownloadIcon className="h-4 w-4" />
                DESKTOP APPLICATION
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Download
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Download the Metro Police Department desktop
                application for your computer.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadReleases(true)}
              disabled={loading || refreshing}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border/70 px-3 text-xs font-semibold transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={[
                  "h-3.5 w-3.5",
                  refreshing ? "animate-spin" : "",
                ].join(" ")}
              />
              {refreshing ? "Refreshing..." : "Refresh releases"}
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-4">
              <p className="text-sm font-semibold text-red-400">
                Failed to load releases
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error}
              </p>
            </div>
          )}

          {loading ? (
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
              <div className="px-4 py-12 text-center">
                <Package className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  Loading releases...
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Checking GitHub Releases for the latest desktop builds.
                </p>
              </div>
            </section>
          ) : !latestRelease ? (
            <section className="overflow-hidden rounded-2xl border border-dashed border-border bg-card/80 shadow-sm backdrop-blur">
              <div className="px-4 py-12 text-center">
                <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  No desktop releases available
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  There are currently no published desktop releases.
                </p>
              </div>
            </section>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Latest release
                  </span>

                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                    {latestRelease.tag_name}
                  </span>
                </div>

                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.05fr] lg:p-6">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedRelease(latestRelease)}
                      className="group flex items-start gap-4 text-left"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background">
                        <img
                          src="/logo.png"
                          alt="Metro Police Department"
                          className="h-11 w-11 object-contain"
                        />
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-lg font-bold tracking-tight group-hover:text-blue-400">
                          {latestRelease.name?.trim() ||
                            `MPD Desktop ${latestRelease.tag_name}`}
                        </h2>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Released {formatDate(latestRelease.published_at)}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRelease(latestRelease)}
                      className="mt-4 block text-left"
                    >
                      <h3 className="text-base font-semibold hover:text-blue-400">
                        Get the MPD desktop app
                      </h3>

                      <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">
                        The desktop application gives you the same Metro
                        Police Department website in a dedicated app window,
                        with desktop updates delivered through GitHub Releases.
                      </p>

                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                        View release details
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                    <div className="mb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Version
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {latestRelease.tag_name}
                      </p>
                    </div>

                    <div className="mb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Released
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatDate(latestRelease.published_at)}
                      </p>
                    </div>

                    <div className="mb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Downloads
                      </p>

                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        <ReleaseAssetButton
                          release={latestRelease}
                          platform="windows"
                        />
                        <ReleaseAssetButton
                          release={latestRelease}
                          platform="macos"
                        />
                        <ReleaseAssetButton
                          release={latestRelease}
                          platform="linux"
                        />
                      </div>
                    </div>

                    <div className="border-t border-border/70 pt-4">
                      <div className="grid gap-2 text-xs text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <FileDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span>
                            Download the installer and keep the app installed.
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span>
                            Desktop updates can install automatically from new
                            releases.
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span>
                            The app loads the live MPD website, so website
                            changes appear without reinstalling the app.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {previousReleases.length > 0 && (
                <section className="mt-6">
                  <div className="mb-3">
                    <h2 className="text-lg font-semibold">
                      Previous versions
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Older desktop releases from GitHub.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {previousReleases.map((release) => (
                      <div
                        key={release.id}
                        className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur"
                      >
                        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                          <div className="flex min-w-0 items-start justify-between gap-4">
                            <button
                              type="button"
                              onClick={() => setSelectedRelease(release)}
                              className="min-w-0 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-semibold sm:text-base">
                                  {release.name?.trim() ||
                                    `MPD Desktop ${release.tag_name}`}
                                </h3>

                                <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  {release.tag_name}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-muted-foreground">
                                Released {formatDate(release.published_at)}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedRelease(release)}
                              className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-blue-400 sm:inline-flex"
                            >
                              Release details
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <ReleaseAssetButton
                              release={release}
                              platform="windows"
                              compact
                            />
                            <ReleaseAssetButton
                              release={release}
                              platform="macos"
                              compact
                            />
                            <ReleaseAssetButton
                              release={release}
                              platform="linux"
                              compact
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {selectedRelease && (
        <ReleaseModal
          release={selectedRelease}
          onClose={() => setSelectedRelease(null)}
        />
      )}
    </div>
  )
}
