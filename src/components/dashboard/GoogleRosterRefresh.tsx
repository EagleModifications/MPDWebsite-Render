import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

interface GoogleRosterRefreshProps {
  onRefreshed?: () => void | Promise<void>
}

export default function GoogleRosterRefresh({
  onRefreshed,
}: GoogleRosterRefreshProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    // Prevent any form submission or navigation.
    event.preventDefault()
    event.stopPropagation()

    if (refreshing) {
      return
    }

    setRefreshing(true)

    try {
      const response = await fetch(
        "/api/import/google/rosters",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Failed to synchronize Google Sheets.",
        )
      }

      /*
       * Do NOT reload the page.
       *
       * The parent component re-fetches its
       * data through onRefreshed().
       */
      if (onRefreshed) {
        await onRefreshed()
      }

      toast.success("Roster refreshed successfully", {
        description:
          "The latest roster information has been synchronized and loaded.",
      })
    } catch (error) {
      console.error(
        "[google-sync] Refresh failed:",
        error,
      )

      toast.error("Roster refresh failed", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to synchronize Google Sheets.",
      })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleRefresh}
      disabled={refreshing}
      className="gap-2"
    >
      <RefreshCw
        className={
          refreshing
            ? "size-4 animate-spin"
            : "size-4"
        }
      />

      {refreshing ? "Refreshing..." : "Refresh"}
    </Button>
  )
}
