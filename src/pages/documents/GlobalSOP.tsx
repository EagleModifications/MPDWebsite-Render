import { FileText } from "lucide-react"

const PUBLISHED_DOC_URL =
  "PASTE_YOUR_PUBLISHED_GOOGLE_DOC_URL_HERE"

export default function SOPs() {
  return (
    <main className="min-h-screen bg-background">
      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        {/* Header */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
            <FileText className="h-4 w-4 shrink-0" />
            <span>METRO POLICE DEPARTMENT</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Standard Operating Procedures
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            View the Metro Police Department Standard Operating Procedures.
          </p>
        </div>

        {/* Google Doc */}
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/70 shadow-sm">
          <iframe
            src={PUBLISHED_DOC_URL}
            title="Metro Police Department Standard Operating Procedures"
            className="block h-[900px] w-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    </main>
  )
}
