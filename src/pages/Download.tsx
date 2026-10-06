import { useEffect, useMemo, useState } from 'react'
import {
  Apple,
  CheckCircle2,
  Download as DownloadIcon,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Laptop,
} from 'lucide-react'

import Navbar from '@/components/home/Navbar'
import Footer from '@/components/Footer'

const GITHUB_RELEASES_API =
  'https://api.github.com/repos/EagleModifications/MPDWebsite-Render/releases?per_page=20'

const GITHUB_RELEASES_URL =
  'https://github.com/EagleModifications/MPDWebsite-Render/releases'

type ReleaseAsset = {
  name: string
  size: number
  browser_download_url: string
}

type Release = {
  id: number
  tag_name: string
  name: string | null
  body: string | null
  draft: boolean
  prerelease: boolean
  published_at: string | null
  html_url: string
  assets: ReleaseAsset[]
}

type Platform = 'windows' | 'macos' | 'linux'

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown date'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function versionNumber(release: Release) {
  return release.tag_name.replace(/^v/i, '')
}

function findAsset(release: Release, platform: Platform) {
  const assets = release.assets ?? []

  if (platform === 'windows') {
    return assets.find((asset) => /\.exe$/i.test(asset.name)) ?? null
  }

  if (platform === 'macos') {
    return assets.find((asset) => /\.dmg$/i.test(asset.name)) ?? null
  }

  return assets.find((asset) => /\.AppImage$/i.test(asset.name)) ?? null
}

function platformLabel(platform: Platform) {
  if (platform === 'windows') return 'Windows'
  if (platform === 'macos') return 'macOS'
  return 'Linux'
}

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === 'windows') {
    return <Laptop className="h-5 w-5" />
  }

  if (platform === 'macos') {
    return <Apple className="h-5 w-5" />
  }

  return <Terminal className="h-5 w-5" />
}

function DownloadButton({
  platform,
  asset,
  primary = false,
}: {
  platform: Platform
  asset: ReleaseAsset | null
  primary?: boolean
}) {
  const label = platformLabel(platform)

  if (!asset) {
    return (
      <div className="flex min-h-12 items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-3">
          <PlatformIcon platform={platform} />
          {label}
        </span>

        <span>Not available</span>
      </div>
    )
  }

  return (
    <a
      href={asset.browser_download_url}
      target="_blank"
      rel="noreferrer"
      className={[
        'flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm font-medium transition-all',
        primary
          ? 'border-blue-500/60 bg-blue-500 text-white shadow-lg shadow-blue-500/10 hover:bg-blue-400'
          : 'border-border/70 bg-background/50 text-foreground hover:border-blue-500/40 hover:bg-foreground/[0.04]',
      ].join(' ')}
    >
      <span className="flex items-center gap-3">
        <PlatformIcon platform={platform} />
        Download for {label}
      </span>

      <DownloadIcon className="h-4 w-4" />
    </a>
  )
}

export default function Download() {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadReleases(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      setError(null)

      const response = await fetch(GITHUB_RELEASES_API, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`GitHub returned ${response.status}`)
      }

      const data = (await response.json()) as Release[]

      const visible = data
        .filter(
          (release) =>
            !release.draft && !release.prerelease,
        )
        .sort((a, b) => {
          const aDate = a.published_at
            ? Date.parse(a.published_at)
            : 0

          const bDate = b.published_at
            ? Date.parse(b.published_at)
            : 0

          return bDate - aDate
        })

      setReleases(visible)
    } catch (loadError) {
      console.error(
        'Failed to load desktop releases:',
        loadError,
      )

      setError(
        'GitHub releases could not be loaded right now.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadReleases()
  }, [])

  const latest = releases[0] ?? null

  const previous = useMemo(
    () => releases.slice(1),
    [releases],
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto max-w-[1600px] px-6 pb-24 pt-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-blue-500">
                Desktop application
              </p>

              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Download
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Download the Metro Police Department desktop
                application for your computer.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadReleases(true)}
              disabled={loading || refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-border/70 bg-background/50 px-4 text-sm font-medium transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}

              Refresh releases
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-500" />

              <p className="mt-4 text-sm text-muted-foreground">
                Loading releases...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8">
              <div className="flex items-start gap-4">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />

                <div>
                  <h2 className="font-semibold">
                    Unable to load releases
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {error}
                  </p>

                  <a
                    href={GITHUB_RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-500 hover:text-blue-400"
                  >
                    Open GitHub releases
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : !latest ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
              <p className="font-medium">
                No desktop releases are available yet.
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                Once a GitHub release is published, its
                downloads will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              <section className="overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-2xl shadow-black/10">
                <div className="border-b border-border/60 px-6 py-5 sm:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Latest release
                      </p>

                      <h2 className="mt-1 text-xl font-semibold">
                        Metro Police Department Desktop
                      </h2>
                    </div>

                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-500">
                      v{versionNumber(latest)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-lg">
                      <img
                        src="/desktop-icon.png"
                        alt="Metro Police Department"
                        className="h-full w-full object-contain p-3"
                      />
                    </div>

                    <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                      Get the MPD desktop app
                    </h3>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                      The desktop application gives you the
                      same Metro Police Department website in
                      a dedicated app window, with desktop
                      updates delivered through GitHub
                      Releases.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <DownloadButton
                        platform="windows"
                        asset={findAsset(
                          latest,
                          'windows',
                        )}
                        primary
                      />

                      <DownloadButton
                        platform="macos"
                        asset={findAsset(
                          latest,
                          'macos',
                        )}
                      />

                      <DownloadButton
                        platform="linux"
                        asset={findAsset(
                          latest,
                          'linux',
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/40 p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Version
                        </p>

                        <p className="mt-1 font-semibold">
                          v{versionNumber(latest)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Released
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatDate(
                            latest.published_at,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Windows installer
                        </p>

                        <p className="mt-1 font-semibold">
                          {findAsset(
                            latest,
                            'windows',
                          )
                            ? formatBytes(
                                findAsset(
                                  latest,
                                  'windows',
                                )!.size,
                              )
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
                      <div className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

                        <span className="text-muted-foreground">
                          Download once and keep the app
                          installed.
                        </span>
                      </div>

                      <div className="flex items-start gap-3 text-sm">
                        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

                        <span className="text-muted-foreground">
                          Desktop shell updates can install
                          automatically from new releases.
                        </span>
                      </div>

                      <div className="flex items-start gap-3 text-sm">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

                        <span className="text-muted-foreground">
                          The app loads the live MPD website,
                          so website changes appear without
                          reinstalling the app.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-12">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Previous versions
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Older desktop releases remain available
                      from GitHub.
                    </p>
                  </div>

                  <a
                    href={GITHUB_RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden items-center gap-2 text-sm font-medium text-blue-500 hover:text-blue-400 sm:flex"
                  >
                    View all releases
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                {previous.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-card/30 p-6 text-sm text-muted-foreground">
                    This is the first published desktop
                    release.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {previous.map((release) => (
                      <div
                        key={release.id}
                        className="rounded-2xl border border-border/60 bg-card/30 p-5 transition hover:border-border"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="font-semibold">
                                {release.name ||
                                  `Release v${versionNumber(
                                    release,
                                  )}`}
                              </h3>

                              <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                                v{versionNumber(release)}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-muted-foreground">
                              Released{' '}
                              {formatDate(
                                release.published_at,
                              )}
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
                            <DownloadButton
                              platform="windows"
                              asset={findAsset(
                                release,
                                'windows',
                              )}
                            />

                            <DownloadButton
                              platform="macos"
                              asset={findAsset(
                                release,
                                'macos',
                              )}
                            />

                            <DownloadButton
                              platform="linux"
                              asset={findAsset(
                                release,
                                'linux',
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
