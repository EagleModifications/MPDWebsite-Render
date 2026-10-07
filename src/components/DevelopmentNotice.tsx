import { AlertTriangle } from "lucide-react"

interface DevelopmentNoticeProps {
  dashboard?: boolean
}

export default function DevelopmentNotice({
  dashboard = false,
}: DevelopmentNoticeProps) {
  return (
    <div
      className={[
        "flex w-full items-center justify-center",
        "border-b border-yellow-500/40",
        "bg-yellow-500/[0.10]",
        dashboard
          ? "min-h-12 px-4 py-2"
          : "min-h-12 px-4 py-2.5",
      ].join(" ")}
    >
      <div className="flex items-center justify-center gap-3 text-center">
        <AlertTriangle
          className="h-5 w-5 shrink-0 text-yellow-300"
        />

        <p className="text-sm font-semibold leading-5 text-yellow-200 sm:text-base">
          <span className="font-bold text-yellow-300">
            Warning:
          </span>{" "}
          This site is still in development. Some features may be
          incomplete or subject to change.
        </p>

        <AlertTriangle
          className="h-5 w-5 shrink-0 text-yellow-300"
        />
      </div>
    </div>
  )
}
