import { FileText } from "lucide-react"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"

/*
 * Google Docs viewer URL.
 */
const GOOGLE_DOC_URL =
  "https://docs.google.com/document/d/1ZfhE0RDj036Y6b56QJq_0KF0r-fl0dbNF7FZvyk5H64/preview"

export default function SOPs() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {/* Header */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
              <FileText className="h-4 w-4 shrink-0" />

              <span>METRO POLICE DEPARTMENT</span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Global Standard Operating Procedures
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Access California Roleplay Global Departments Standard Operating Procedures.
            </p>
          </div>

          {/* Google Doc */}
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            {/* Document header */}
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                <FileText className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold sm:text-base">
                  Global Standard Operating Procedures
                </h2>

                <p className="text-xs text-muted-foreground">
                  Google Docs
                </p>
              </div>
            </div>

            {/* Embedded document */}
            <div className="w-full overflow-hidden bg-background">
              <iframe
                src={GOOGLE_DOC_URL}
                title="Metro Police Department Standard Operating Procedures"
                className="block h-[800px] w-full border-0"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </section>
        </div>

        <Footer />
      </main>
    </div>
  )
}
