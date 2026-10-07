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
        "border-b border-yellow-500/20",
        "bg-yellow-500/[0.06]",
        dashboard
          ? "h-9"
          : "min-h-9 px-4 py-2",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 text-center">
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-yellow-400"
        />

        <p className="text-xs font-medium text-yellow-300">
          <span className="font-bold">
            Warning:
          </span>{" "}
          This site is still in development. Some features may be
          incomplete or subject to change.
        </p>

        <AlertTriangle
          className="h-4 w-4 shrink-0 text-yellow-400"
        />
      </div>
    </div>
  )
}
