import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Presentation,
  RefreshCw,
} from "lucide-react"

interface ScreeningDocumentProps {
  title: string
  url: string
}

function getPresentationId(url: string): string | null {
  const match = url.match(/\/presentation\/d\/([^/]+)/)
  return match?.[1] ?? null
}

export default function ScreeningDocument({
  title,
  url,
}: ScreeningDocumentProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  const presentationId = useMemo(
    () => getPresentationId(url),
    [url],
  )

  const embedUrl = presentationId
    ? `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`
    : url

  return (
    <div className="w-full min-w-0">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card/95 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
              <Presentation className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-xs text-muted-foreground">
                Interactive presentation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />
            Refresh
          </button>
        </div>

        <div className="relative w-full overflow-hidden bg-background">
          <iframe
            key={refreshKey}
            src={embedUrl}
            title={title}
            className="block h-[800px] w-full border-0"
            loading="lazy"
            allowFullScreen
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-11 items-center border-t border-border/70 bg-background/95 px-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-1.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-black/70 text-blue-400">
                <ChevronLeft className="h-4 w-4" />
              </span>

              <span
                aria-label="Current page"
                className="flex h-8 min-w-10 items-center justify-center rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 text-sm font-medium text-blue-400"
              >
                1
              </span>

              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-black/70 text-blue-400">
                <ChevronRight className="h-4 w-4" />
              </span>

              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-black/70 text-blue-400">
                <MoreVertical className="h-4 w-4 text-blue-400" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
