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

      /*
       * Maximum number of notifications kept in the stack.
       */
      visibleToasts={5}

      /*
       * IMPORTANT:
       *
       * false = collapsed by default.
       *
       * Sonner automatically expands the stack while
       * the notification area is hovered.
       */
      expand={false}

      /*
       * Gap used when the stack is expanded.
       */
      gap={8}

      /*
       * Distance from the viewport.
       */
      offset={{
        top: 24,
        right: 24,
      }}

      /*
       * Use the current system theme.
       */
      theme="system"

      /*
       * Show close buttons.
       */
      closeButton

      /*
       * Give our toaster a unique class so the CSS below
       * only affects these notifications.
       */
      className="notifications-toaster"

      /*
       * Icons.
       */
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

      /*
       * Toast appearance.
       */
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
