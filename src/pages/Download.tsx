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
  "https://api.github.com/repos/EagleModifications/MPDWebsite-Render/releases?per_page=20"

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
  checksum_url: string | null
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
    >
      <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
      {compact
        ? getPlatformLabel(platform)
        : `Download for ${getPlatformLabel(platform)}`}
      <DownloadIcon className="ml-auto h-3.5 w-3.5" />
    </a>
  )
}


function ReleaseNotes({ body }: { body: string | null }) {
  const source = body
    ?.split(/\r?\n/)
    .filter((line) => !/^\s*full changelog\s*:/i.test(line))
    .join("\n")
    .trim()

  if (!source) {
    return (
      <p className="text-sm text-muted-foreground">
        No release description was provided for this release.
      </p>
    )
  }

  const lines = source.split(/\r?\n/)
  const blocks: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: "ul" | "ol" | null = null

  const flushList = () => {
    if (!listType || listItems.length === 0) return

    const items = listItems.map((item, index) => (
      <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
    ))

    blocks.push(
      listType === "ol" ? (
        <ol key={`ol-${blocks.length}`} className="my-3 list-decimal space-y-1 pl-6">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${blocks.length}`} className="my-3 list-disc space-y-1 pl-6">
          {items}
        </ul>
      ),
    )

    listItems = []
    listType = null
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      return
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushList()
      const level = heading[1].length
      const className =
        level === 1
          ? "mt-6 border-b border-border/70 pb-2 text-2xl font-bold"
          : level === 2
            ? "mt-6 border-b border-border/70 pb-2 text-xl font-bold"
            : level === 3
              ? "mt-5 text-lg font-bold"
              : "mt-4 text-base font-bold"

      blocks.push(
        <div key={`heading-${index}`} className={className}>
          {renderInlineMarkdown(heading[2])}
        </div>,
      )
      return
    }

    if (/^([-*_])(?:\s*\1){2,}$/.test(trimmed)) {
      flushList()
      blocks.push(<hr key={`hr-${index}`} className="my-5 border-border/70" />)
      return
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/)
    if (unordered) {
      if (listType !== "ul") {
        flushList()
        listType = "ul"
      }
      listItems.push(unordered[1])
      return
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/)
    if (ordered) {
      if (listType !== "ol") {
        flushList()
        listType = "ol"
      }
      listItems.push(ordered[1])
      return
    }

    flushList()
    blocks.push(
      <p key={`paragraph-${index}`} className="my-3 leading-7">
        {renderInlineMarkdown(trimmed)}
      </p>,
    )
  })

  flushList()
  return <div className="text-sm text-foreground/85">{blocks}</div>
}

function renderInlineMarkdown(value: string): React.ReactNode {
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
        >
          {link[1]}
        </a>
      )
    }

    return <span key={index}>{part}</span>
  })
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
        event.preventDefault()
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

            <div className="rounded-xl border border-border/70 bg-background/60 p-4 sm:p-5">
              <ReleaseNotes body={release.body} />
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
                        target="_blank"
                        rel="noopener noreferrer"
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
          <div className="flex flex-wrap items-center gap-3">
            {release.checksum_url && (
              <a
                href={release.checksum_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                SHA-256 checksums
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <a
              href={release.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              View this release on GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
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

      let validReleases: GitHubRelease[] | null = null
      let serviceError = ""

      // Prefer the same-origin release service. This keeps GitHub API
      // access off the browser when the server can reach GitHub normally.
      try {
        const response = await fetch("/api/releases", {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        })

        if (response.ok) {
          const payload = (await response.json()) as
            | { success?: boolean; releases?: GitHubRelease[] }
            | GitHubRelease[]

          const releases = Array.isArray(payload)
            ? payload
            : Array.isArray(payload.releases)
              ? payload.releases
              : []

          validReleases = releases
            .filter((release) => !release.draft)
            .map((release) => ({
              ...release,
              assets: Array.isArray(release.assets)
                ? release.assets.filter((asset) =>
                    /^https:\/\/github\.com\/EagleModifications\/MPDWebsite-Render\/releases\/download\//i.test(
                      asset.browser_download_url,
                    ) && getPlatform(asset.name) !== null,
                  )
                : [],
            }))
            .filter((release) => release.assets.length > 0)
        } else {
          serviceError = `The release service returned HTTP ${response.status}.`
        }
      } catch (serviceLoadError) {
        serviceError =
          serviceLoadError instanceof Error
            ? serviceLoadError.message
            : "The release service could not be reached."
      }

      // Fallback to the public GitHub Releases API. This is important on
      // hosts where outbound requests from the server are temporarily blocked
      // or GitHub rate-limits the hosting provider's shared IP.
      if (!validReleases) {
        const response = await fetch(GITHUB_RELEASES_API, {
          headers: {
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error(
            serviceError
              ? `${serviceError} GitHub also returned HTTP ${response.status}.`
              : `GitHub returned HTTP ${response.status}.`,
          )
        }

        const data = (await response.json()) as GitHubRelease[]

        if (!Array.isArray(data)) {
          throw new Error("GitHub returned an invalid release response.")
        }

        validReleases = data
          .filter((release) => !release.draft)
          .map((release) => ({
            ...release,
            assets: Array.isArray(release.assets)
              ? release.assets.filter((asset) =>
                  /^https:\/\/github\.com\/EagleModifications\/MPDWebsite-Render\/releases\/download\//i.test(
                    asset.browser_download_url,
                  ) && getPlatform(asset.name) !== null,
                )
              : [],
          }))
          .filter((release) => release.assets.length > 0)
      }

      validReleases.sort(
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
      console.error("[download] Failed to load releases:", loadError)

      setReleases([])
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load desktop releases.",
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

              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Download the Metro Police Department desktop application from
                its public GitHub release. Downloads are provided directly by
                GitHub and are only started when you choose a release asset.
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

          <section className="mb-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  MPD community download
                </p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                  This is a community roleplay project and is not affiliated with
                  any real police department, government agency, or law-enforcement
                  organisation. This page links to the project's public GitHub Releases.
                  The desktop application is optional and is not required to use the website.
                </p>
              </div>
              <a
                href="https://github.com/EagleModifications/MPDWebsite-Render"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-500/30 px-3 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/10"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View source on GitHub
              </a>
            </div>
          </section>

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
              <section
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRelease(latestRelease)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setSelectedRelease(latestRelease)
                  }
                }}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur transition-colors hover:border-blue-500/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
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
                    <div className="flex items-start gap-4 text-left">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center">
                        <img
                          src="/logo.png"
                          alt="Metro Police Department"
                          className="h-16 w-16 object-contain"
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
                    </div>

                    <div className="mt-4 block text-left">
                      <h3 className="text-base font-semibold">
                        Get the MPD desktop app
                      </h3>

                      <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">
                        The desktop application gives you the same Metro
                        Police Department website in a dedicated app window,
                        with desktop updates delivered through GitHub Releases.
                      </p>

                    </div>
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
                        <div
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <ReleaseAssetButton
                            release={latestRelease}
                            platform="windows"
                            compact
                          />
                        </div>
                        <div
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <ReleaseAssetButton
                            release={latestRelease}
                            platform="macos"
                            compact
                          />
                        </div>
                        <div
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <ReleaseAssetButton
                            release={latestRelease}
                            platform="linux"
                            compact
                          />
                        </div>
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
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRelease(release)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedRelease(release)
                          }
                        }}
                        className="group cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur transition-colors hover:border-blue-500/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                      >
                        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                          <div className="flex min-w-0 items-start justify-between gap-4">
                            <div className="min-w-0 text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-semibold sm:text-base">
                                  {release.name?.trim() ||
                                    `MPD Desktop ${release.tag_name}`}
                                </h3>

                                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                                  {release.tag_name}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-muted-foreground">
                                Released {formatDate(release.published_at)}
                              </p>
                            </div>

                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <ReleaseAssetButton
                                release={release}
                                platform="windows"
                                compact
                              />
                            </div>
                            <div
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <ReleaseAssetButton
                                release={release}
                                platform="macos"
                                compact
                              />
                            </div>
                            <div
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <ReleaseAssetButton
                                release={release}
                                platform="linux"
                                compact
                              />
                            </div>
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
