import { useState } from "react"
import { Presentation, RefreshCw } from "lucide-react"

type ScreeningDocumentProps = {
  title: string
  url: string
}

export default function ScreeningDocument({ title, url }: ScreeningDocumentProps) {
  const [frameKey, setFrameKey] = useState(0)
  const embedUrl = `${url}${url.includes("?") ? "&" : "?"}rm=minimal&widget=false`

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
            <Presentation className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">Google Slides</p>
          </div>
        </div>
        <button type="button" onClick={() => setFrameKey((value) => value + 1)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
      <div className="w-full overflow-hidden bg-background">
        <iframe key={frameKey} src={embedUrl} title={title} className="block h-[800px] w-full border-0" loading="lazy" allowFullScreen />
      </div>
    </section>
  )
}
