export type ActionLogModule = "promotion" | "activity"
export type ActionLogCategory =
  | "roster"
  | "import"
  | "requirements"
  | "navigation"
  | "management"

export type ActionLogDivision =
  | "department"
  | "swat"
  | "mtf7"
  | "mcd"
  | "tru"
  | "teu"
  | "sar"

export type ActionLogInput = {
  module: ActionLogModule
  action: string
  category: ActionLogCategory
  division?: ActionLogDivision
  targetUserId?: string
  targetName?: string
  targetRank?: string
  summary: string
  details?: Record<string, unknown>
  path?: string
}

/**
 * Client-side audit helper. Logging is fire-and-forget so an audit-log
 * failure can never break the dashboard action that the user is performing.
 * The server stores the entry in an in-memory Map, never MongoDB.
 */
export function logAction(input: ActionLogInput): void {
  void fetch("/api/action-logs", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...input,
      path:
        input.path ??
        `${window.location.pathname}${window.location.search}`,
    }),
  }).catch((error) => {
    console.warn("Action logging failed:", error, input)
  })
}
