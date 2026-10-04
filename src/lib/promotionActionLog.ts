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
  })
    .then(async (response) => {
      if (response.ok) {
        return
      }

      let message = `HTTP ${response.status}`

      try {
        const data = (await response.json()) as {
          error?: string
        }

        if (data.error) {
          message = data.error
        }
      } catch {
        // Keep the HTTP status when the API did not return JSON.
      }

      console.warn(
        "Promotion action logging failed:",
        message,
        input,
      )
    })
    .catch((error) => {
      console.warn(
        "Promotion action logging failed:",
        error,
        input,
      )
    })
}
