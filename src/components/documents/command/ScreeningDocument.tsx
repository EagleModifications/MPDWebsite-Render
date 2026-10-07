import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreVertical,
  Presentation,
  RefreshCw,
} from "lucide-react"

type ScreeningDocumentProps = {
  title: string
  url: string
}

function getPresentationId(url: string) {
  const match = url.match(/\/presentation\/d\/([^/]+)/)
  return match?.[1] ?? ""
}

export default function ScreeningDocument({
  title,
  url,
}: ScreeningDocumentProps) {
  const [frameKey, setFrameKey] = useState(0)

  const presentationId = getPresentationId(url)

  const embedUrl = presentationId
    ? `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`
    : url

  const openUrl = presentationId
    ? `https://docs.google.com/presentation/d/${presentationId}/edit`
    : url

  const refresh = () => {
    setFrameKey((value) => value + 1)
  }

  const controlClass =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/95 shadow-sm"

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
            <Presentation className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">
              Interactive presentation
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4 text-blue-400" />
            Open Presentation
          </a>

          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />
            Refresh
          </button>
        </div>
      </div>

      <div className="border-b border-border/70 bg-blue-500/[0.025] px-4 py-2 text-xs text-muted-foreground sm:px-5">
        Use the page controls to move through the presentation. You can also
        click directly inside the presentation.
      </div>

      <div className="relative w-full overflow-hidden bg-background">
        <iframe
          key={frameKey}
          src={embedUrl}
          title={title}
          className="block h-[800px] w-full border-0"
          loading="lazy"
          allowFullScreen
        />

        {/*
         * Google Slides is cross-origin, so its native navigation cannot be
         * restyled from React. This Metro PD control bar sits over the native
         * viewer controls but does not capture pointer events. The real Google
         * controls underneath therefore remain clickable while the visible
         * controls match the site's UI.
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-11 items-center border-t border-border/70 bg-background/95 px-3 backdrop-blur-sm"
        >
          <div className="flex items-center gap-1.5">
            <span className={controlClass}>
              <ChevronLeft className="h-4 w-4 text-blue-400" />
            </span>

            <span className="flex h-8 min-w-10 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 text-xs font-semibold text-blue-400">
              1
            </span>

            <span className={controlClass}>
              <ChevronRight className="h-4 w-4 text-blue-400" />
            </span>

            <span className={controlClass}>
              <MoreVertical className="h-4 w-4 text-blue-400" />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
