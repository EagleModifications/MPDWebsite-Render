import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Download as DownloadIcon,
  Monitor,
  Package,
  RefreshCw,
} from "lucide-react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"

type GitHubAsset = {
  name: string
  browser_download_url: string
  size: number
}

type GitHubRelease = {
  tag_name: string
  name: string
  published_at: string
  prerelease: boolean
  draft: boolean
  assets: GitHubAsset[]
}

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/EagleModifications/MPDWebsite-Render/releases"

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return ""
  }

  const mb = bytes / 1024 / 1024

  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`
  }

  return `${mb.toFixed(1)} MB`
}

function formatReleaseDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function cleanVersion(tag: string) {
  return tag.replace(/^v/i, "")
}

function findInstaller(release: GitHubRelease) {
  return (
    release.assets.find((asset) =>
      asset.name.toLowerCase().endsWith(".exe"),
    ) ?? null
  )
}

export default function Download() {
  const [releases, setReleases] = useState<GitHubRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadReleases() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(GITHUB_RELEASES_URL, {
        headers: {
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Unable to load the desktop releases.")
      }

      const data = (await response.json()) as GitHubRelease[]

      const usableReleases = data
        .filter((release) => !release.draft)
        .map((release) => ({
          release,
          installer: findInstaller(release),
        }))
        .filter(
          (
            item,
          ): item is {
            release: GitHubRelease
            installer: GitHubAsset
          } => Boolean(item.installer),
        )
        .map((item) => item.release)

      setReleases(usableReleases)
    } catch (loadError) {
      console.error(loadError)

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the desktop releases.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = "Download | Metro Police Department"

    void loadReleases()
  }, [])

  const latestRelease = releases[0] ?? null

  const previousReleases = useMemo(() => {
    return releases.slice(1)
  }, [releases])

  const latestInstaller = latestRelease
    ? findInstaller(latestRelease)
    : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-28 md:px-8">
        {/* ------------------------------------------------------- */}
        {/* HEADER                                                   */}
        {/* ------------------------------------------------------- */}

        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
              <DownloadIcon className="h-5 w-5 text-blue-500" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Downloads
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Download the Metro Police Department desktop application.
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- */}
        {/* LOADING                                                  */}
        {/* ------------------------------------------------------- */}

        {loading && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking for available releases...
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------- */}
        {/* ERROR                                                    */}
        {/* ------------------------------------------------------- */}

        {!loading && error && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
              <Package className="h-5 w-5 text-red-500" />
            </div>

            <h2 className="mt-4 text-base font-semibold">
              Downloads unavailable
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {error}
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => void loadReleases()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------- */}
        {/* RELEASES                                                 */}
        {/* ------------------------------------------------------- */}

        {!loading && !error && releases.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />

            <h2 className="mt-4 text-base font-semibold">
              No desktop releases available
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              The Metro Police Department desktop application has not been
              released yet.
            </p>
          </div>
        )}

        {!loading && !error && latestRelease && latestInstaller && (
          <>
            {/* --------------------------------------------------- */}
            {/* LATEST VERSION                                      */}
            {/* --------------------------------------------------- */}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {/* top bar */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                    <Monitor className="h-4 w-4 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold">
                      Metro Police Department
                    </h2>

                    <p className="text-xs text-muted-foreground">
                      Windows Desktop Application
                    </p>
                  </div>
                </div>

                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                  Latest
                </span>
              </div>

              {/* latest release */}
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold">
                        MPD Desktop
                      </h2>

                      <span className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs font-medium">
                        v{cleanVersion(latestRelease.tag_name)}
                      </span>
                    </div>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      The latest Metro Police Department desktop application
                      for Windows.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Monitor className="h-3.5 w-3.5" />
                        Windows 10 / 11
                      </span>

                      <span>
                        {formatFileSize(latestInstaller.size)}
                      </span>

                      <span>
                        Released{" "}
                        {formatReleaseDate(latestRelease.published_at)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Button
                      asChild
                      size="lg"
                      className="w-full gap-2 md:w-auto"
                    >
                      <a
                        href={latestInstaller.browser_download_url}
                        download
                      >
                        <DownloadIcon className="h-4 w-4" />
                        Download for Windows
                      </a>
                    </Button>
                  </div>
                </div>

                {/* update information */}
                <div className="mt-7 flex items-start gap-3 rounded-lg border border-blue-500/15 bg-blue-500/5 px-4 py-3.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

                  <div>
                    <p className="text-sm font-medium">
                      Automatic updates included
                    </p>

                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      Once installed, future desktop releases can be installed
                      automatically without downloading the application again.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------- */}
            {/* PREVIOUS VERSIONS                                   */}
            {/* --------------------------------------------------- */}

            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">
                  Previous Versions
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Download an earlier version of the Metro Police Department
                  desktop application.
                </p>
              </div>

              {previousReleases.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
                  <Package className="mx-auto h-6 w-6 text-muted-foreground" />

                  <p className="mt-3 text-sm text-muted-foreground">
                    No previous versions are available.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {/* table heading */}
                  <div className="hidden grid-cols-[1fr_140px_130px_130px] items-center gap-4 border-b border-border bg-muted/20 px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
                    <span>Version</span>
                    <span>Released</span>
                    <span>Size</span>
                    <span className="text-right">Download</span>
                  </div>

                  <div className="divide-y divide-border">
                    {previousReleases.map((release) => {
                      const installer = findInstaller(release)

                      if (!installer) {
                        return null
                      }

                      return (
                        <div
                          key={release.tag_name}
                          className="grid gap-4 px-5 py-4 transition-colors hover:bg-muted/20 md:grid-cols-[1fr_140px_130px_130px] md:items-center"
                        >
                          {/* version */}
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                MPD Desktop
                              </p>

                              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                v{cleanVersion(release.tag_name)}
                              </p>
                            </div>
                          </div>

                          {/* mobile metadata */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:contents">
                            <div>
                              <span className="mr-1 md:hidden">
                                Released:
                              </span>
                              {formatReleaseDate(release.published_at)}
                            </div>

                            <div>
                              <span className="mr-1 md:hidden">
                                Size:
                              </span>
                              {formatFileSize(installer.size)}
                            </div>
                          </div>

                          {/* desktop download */}
                          <div className="md:text-right">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="w-full gap-2 md:w-auto"
                            >
                              <a
                                href={installer.browser_download_url}
                                download
                              >
                                <DownloadIcon className="h-3.5 w-3.5" />
                                Download
                              </a>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
