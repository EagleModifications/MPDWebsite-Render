import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react"
import { Toaster } from "sonner"

export default function Notifications() {
  return (
    <Toaster
      position="top-right"
      theme="system"

      /*
       * Sonner's native behaviour:
       *
       * - collapsed stack normally
       * - expands when hovered
       * - collapses again when mouse leaves
       */
      expand={false}

      /*
       * Number of notifications Sonner keeps available
       * in the stack.
       */
      visibleToasts={5}

      /*
       * Normal Sonner spacing when expanded.
       */
      gap={8}

      /*
       * Position from the viewport.
       */
      offset={{
        top: 24,
        right: 24,
      }}

      /*
       * Show the normal Sonner close buttons.
       */
      closeButton

      /*
       * Keep notifications below the custom cursor.
       */
      className="notifications-toaster"

      icons={{
        success: (
          <CheckCircle2 className="size-5 shrink-0 text-green-500" />
        ),

        info: (
          <Info className="size-5 shrink-0 text-blue-500" />
        ),

        warning: (
          <AlertTriangle className="size-5 shrink-0 text-yellow-500" />
        ),

        error: (
          <XCircle className="size-5 shrink-0 text-red-500" />
        ),
      }}

      toastOptions={{
        classNames: {
          toast:
            "bg-background text-foreground border-border",

          title:
            "text-foreground",

          description:
            "text-muted-foreground",
        },
      }}
    />
  )
}
