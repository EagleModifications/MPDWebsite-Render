import { ArrowLeft, Check, LogIn } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

type SignOutCardProps = {
  onSignIn: () => void
}

export default function SignOutCard({
  onSignIn,
}: SignOutCardProps) {
  return (
    <div className="w-full max-w-md">
      <div
        className="
          w-full
          rounded-2xl
          border
          border-border
          bg-card
          p-10
          text-center
          text-card-foreground
          shadow-2xl
          transition-colors
          duration-200
        "
      >
        <div className="mb-5 flex justify-center">
          <div
            className="
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-full
              border-[3px]
              border-emerald-500/70
            "
          >
            <Check
              className="
                h-7
                w-7
                rotate-[-5deg]
                stroke-[3]
                text-emerald-500
              "
            />
          </div>
        </div>

        <p
          className="
            text-xs
            font-medium
            uppercase
            tracking-[0.2em]
            text-blue-500
          "
        >
          Metro Police Department
        </p>

        <h1 className="mt-2 whitespace-nowrap text-[26px] font-bold tracking-tight">
          <span className="text-card-foreground">
            SEE YOU IN{" "}
          </span>

          <span className="text-blue-500">
            THE DEPARTMENT
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-md text-sm text-muted-foreground">
          You&apos;ve been signed out from all services.
        </p>

        <Button
          onClick={onSignIn}
          className="
            mt-7
            h-12
            w-full
            rounded-lg
            bg-blue-600
            text-sm
            font-semibold
            text-white
            shadow-lg
            shadow-blue-600/20
            transition-all
            hover:bg-blue-700
          "
        >
          <LogIn className="mr-2 h-5 w-5" />
          Sign In Again
        </Button>

        <Link
          to="/"
          className="
            mt-5
            inline-flex
            items-center
            gap-2
            text-sm
            text-muted-foreground
            transition-colors
            hover:text-foreground
          "
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </div>
  )
}