import { useEffect, useState } from "react"
import SignInCard from "@/components/signin/SignInCard"

export default function SignIn() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {

    const params = new URLSearchParams(window.location.search)
    const code = params.get("error")

    const messages: Record<string, string> = {
      oauth_verification_failed:
        "The Discord sign-in could not be verified. Please try again.",
      authentication_failed:
        "Discord sign-in could not be completed. Please try again.",
    }

    if (code) {
      setError(
        messages[code] ??
          "Sign-in could not be completed. Please try again.",
      )
    }
  }, [])

  const handleSignIn = () => {
    window.location.href = "/api/auth/login"
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent)_0%,transparent_55%)] opacity-30" />

      <div className="relative z-10 flex w-full items-center justify-center px-6">
        <div className="w-full max-w-md">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-500">
              {error}
            </div>
          )}

          <SignInCard onSignIn={handleSignIn} />
        </div>
      </div>
    </main>
  )
}
