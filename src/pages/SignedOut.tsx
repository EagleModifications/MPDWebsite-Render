import { useEffect } from "react"
import SignOutCard from "@/components/signout/SignOutCard"

export default function SignedOut() {
  const handleSignIn = () => {
    window.location.href = "/api/auth/login"
  }

  useEffect(() => {
  }, [])

  return (
    <main
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        overflow-hidden
        bg-background
        text-foreground
        transition-colors
        duration-200
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_center,var(--accent)_0%,transparent_55%)]
          opacity-30
        "
      />

      <div
        className="
          relative
          z-10
          flex
          w-full
          items-center
          justify-center
          px-6
        "
      >
        <SignOutCard onSignIn={handleSignIn} />
      </div>
    </main>
  )
}
