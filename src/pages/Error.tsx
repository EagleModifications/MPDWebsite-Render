import { Link } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Home,
} from "lucide-react"

import Navbar from "@/components/home/Navbar"
import { Button } from "@/components/ui/button"

export default function ErrorPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-20">
        <div className="relative mx-auto w-full max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <AlertTriangle className="h-7 w-7 text-blue-500" />
          </div>

          <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-blue-500">
            Error 500
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Something went wrong
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            We were unable to verify your access to this page. Please try
            again, or return to the home page if the problem continues.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 min-w-[210px] px-8 text-sm font-semibold uppercase tracking-wide"
            >
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-12 min-w-[210px] px-8 text-sm font-semibold uppercase tracking-wide"
            >
              <button
                type="button"
                onClick={() => window.history.back()}
              >
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
