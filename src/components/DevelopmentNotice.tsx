import { AlertTriangle } from "lucide-react"

interface DevelopmentNoticeProps {
  dashboard?: boolean
}

export default function DevelopmentNotice({
  dashboard = false,
}: DevelopmentNoticeProps) {
  return (
    <div
      role="status"
      className={[
        "relative z-40 flex w-full items-center justify-center",
        "border-b border-yellow-400/30",
        "bg-yellow-400/[0.10]",
        "shadow-[0_2px_14px_rgba(250,204,21,0.08)]",
        dashboard
          ? "min-h-11 px-4 py-2"
          : "min-h-14 px-4 py-3",
      ].join(" ")}
    >
      <div className="flex items-center justify-center gap-3 text-center">
        <AlertTriangle
          className={[
            "shrink-0 text-yellow-300",
            dashboard ? "h-4 w-4" : "h-5 w-5",
          ].join(" ")}
          strokeWidth={2.5}
        />

        <p
          className={[
            "leading-relaxed text-yellow-200",
            dashboard
              ? "text-sm font-medium"
              : "text-sm font-semibold sm:text-base",
          ].join(" ")}
        >
          <span className="font-bold text-yellow-300">
            Warning:
          </span>{" "}
          This site is still in development. Some features may be
          incomplete or subject to change.
        </p>

        <AlertTriangle
          className={[
            "shrink-0 text-yellow-300",
            dashboard ? "h-4 w-4" : "h-5 w-5",
          ].join(" ")}
          strokeWidth={2.5}
        />
      </div>
    </div>
  )
}
