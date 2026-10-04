export type PromotionActionCategory =
  | "roster"
  | "import"
  | "requirements"
  | "navigation"

export type PromotionDivision =
  | "department"
  | "swat"
  | "mtf7"
  | "mcd"
  | "tru"
  | "teu"
  | "sar"

export type PromotionActionInput = {
  action: string
  category: PromotionActionCategory
  division?: PromotionDivision
  targetUserId?: string
  targetName?: string
  targetRank?: string
  summary: string
  details?: Record<string, unknown>
  path?: string
}

/**
 * Promotion audit logging is intentionally fire-and-forget.
 * A logging failure must never block the promotion workflow.
 */
export function logPromotionAction(
  input: PromotionActionInput,
): void {
  void fetch("/api/promotion/action-logs", {
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
    console.warn(
      "Promotion action logging failed:",
      error,
    )
  })
}
