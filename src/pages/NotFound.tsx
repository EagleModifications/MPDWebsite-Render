import { Link } from "react-router-dom"
import { ArrowLeft, Home, SearchX } from "lucide-react"

import Navbar from "@/components/home/Navbar"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-20">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-220px] h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto w-full max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <SearchX className="h-7 w-7 text-blue-500" />
          </div>

          <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-blue-500">
            Error 404
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Page not found
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            The page you're looking for doesn't exist, has been moved, or you
            may have entered an incorrect URL.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <button onClick={() => window.history.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </button>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}