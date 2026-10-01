import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Infinity } from "lucide-react"

type VerificationState = "verifying" | "verified" | "failed"

export default function Verifying() {
  const [status, setStatus] = useState<VerificationState>("verifying")
  const navigate = useNavigate()

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        })

        if (response.ok) {
          setStatus("verified")

          // Keep the verifying screen visible for 3 seconds.
          setTimeout(() => {
            navigate("/", { replace: true })
          }, 1000)
        } else {
          setStatus("failed")

          setTimeout(() => {
            navigate("/signed-out", { replace: true })
          }, 3000)
        }
      } catch {
        setStatus("failed")

        setTimeout(() => {
          navigate("/signed-out", { replace: true })
        }, 3000)
      }
    }

    void verify()
  }, [navigate])

  return (
    <>
      <style>{`
        .verification-infinity svg {
          overflow: visible;
        }

        .verification-infinity svg path {
          stroke-dasharray: 70 70;
          stroke-dashoffset: 0;
          animation: infinity-draw 2.5s linear infinite;
        }

        @keyframes infinity-draw {
          from {
            stroke-dashoffset: 0;
          }

          to {
            stroke-dashoffset: -139;
          }
        }
      `}</style>

      <main className="flex min-h-screen items-center justify-center bg-[#090a0c] text-white">
        <div className="flex flex-col items-center justify-center">
          <div className="verification-infinity mb-5 text-blue-500">
            <Infinity
              className="h-14 w-14"
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </div>

          <p className="text-sm font-normal tracking-wide text-zinc-400">
            Verifying Session...
          </p>
        </div>
      </main>
    </>
  )
}