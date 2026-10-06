import { useEffect, useState } from "react"
import { Download as DownloadIcon, Monitor, ShieldCheck } from "lucide-react"

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
  assets: GitHubAsset[]
}

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/EagleModifications/MPDWebsite-Render/releases/latest"

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return ""
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

export default function Download() {
  const [release, setRelease] = useState<GitHubRelease | null>(null)
  const [installer, setInstaller] = useState<GitHubAsset | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Download | Metro Police Department"

    let active = true

    async function loadLatestRelease() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(GITHUB_RELEASES_URL, {
          headers: {
            Accept: "application/vnd.github+json",
          },
        })

        if (!response.ok) {
          throw new Error("Unable to find the latest desktop release.")
        }

        const data = (await response.json()) as GitHubRelease

        if (!active) {
          return
        }

        const exe = data.assets.find(
          (asset) =>
            asset.name.toLowerCase().endsWith(".exe") &&
            asset.name.toLowerCase().includes("mpd"),
        )

        if (!exe) {
          throw new Error("The latest desktop installer is not available yet.")
        }

        setRelease(data)
        setInstaller(exe)
      } catch (loadError) {
        console.error(loadError)

        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the latest desktop release.",
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadLatestRelease()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-6 py-10 md:px-8 md:py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
              <DownloadIcon className="h-5 w-5 text-blue-500" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Download
              </h1>

              <p className="text-sm text-muted-foreground">
                Download the Metro Police Department desktop application.
              </p>
            </div>
          </div>
        </div>

        {/* Main download card */}
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                <Monitor className="h-4 w-4 text-blue-500" />
              </div>

              <div>
                <h2 className="text-base font-semibold">
                  Metro Police Department
                </h2>

                <p className="text-xs text-muted-foreground">
                  Desktop Application
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="text-sm text-muted-foreground">
                  Checking for the latest version...
                </div>
              </div>
            ) : error || !release || !installer ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                  <DownloadIcon className="h-5 w-5 text-red-500" />
                </div>

                <h3 className="text-base font-semibold">
                  Download unavailable
                </h3>

                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {error ??
                    "The latest desktop application could not be found. Please try again later."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                  <Monitor className="h-8 w-8 text-blue-500" />
                </div>

                <h2 className="mt-5 text-2xl font-bold">
                  Metro Police Department Desktop
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Download the latest Windows desktop application for the
                  Metro Police Department.
                </p>

                <Button
                  asChild
                  size="lg"
                  className="mt-6 gap-2 px-7"
                >
                  <a
                    href={installer.browser_download_url}
                    download
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Download for Windows
                  </a>
                </Button>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span>
                    Version{" "}
                    <span className="font-medium text-foreground">
                      {release.tag_name.replace(/^v/i, "")}
                    </span>
                  </span>

                  {installer.size > 0 && (
                    <span>{formatFileSize(installer.size)}</span>
                  )}

                  {release.published_at && (
                    <span>
                      Released {formatReleaseDate(release.published_at)}
                    </span>
                  )}
                </div>

                <div className="mt-8 grid w-full max-w-2xl gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/50 p-4 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                        <DownloadIcon className="h-4 w-4 text-blue-500" />
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold">
                          Download once
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Install the application on your Windows PC and use
                          it like a normal desktop application.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/50 p-4 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold">
                          Automatic updates
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          New desktop versions can be downloaded automatically
                          without manually reinstalling the application.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-6 text-xs text-muted-foreground">
                  Windows 10 and Windows 11 • 64-bit
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
