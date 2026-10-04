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
}

/** Fire-and-forget audit request. The server compacts the payload before MongoDB storage. */
export function logAction(input: ActionLogInput): void {
  void fetch("/api/action-logs", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  }).catch((error) => {
    console.warn("Action logging failed:", error)
  })
}
