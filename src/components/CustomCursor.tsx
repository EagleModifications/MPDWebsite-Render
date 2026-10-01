import { useEffect, useState } from "react"

import {
  Ban,
  Circle,
  Grab,
  Hand,
  MousePointer2,
  Move,
  MoveDiagonal,
  MoveHorizontal,
  MoveVertical,
  Search,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

type CursorType =
  | "default"
  | "pointer"
  | "text"
  | "move"
  | "grab"
  | "grabbing"
  | "crosshair"
  | "ew-resize"
  | "ns-resize"
  | "nesw-resize"
  | "nwse-resize"
  | "zoom-in"
  | "zoom-out"
  | "not-allowed"
  | "wait"
  | "progress"
  | "help"

type CursorState = {
  x: number
  y: number
  type: CursorType
}

const cursorIcons = {
  default: MousePointer2,
  pointer: Hand,
  text: Type,
  move: Move,
  grab: Grab,
  grabbing: Hand,
  crosshair: Circle,
  "ew-resize": MoveHorizontal,
  "ns-resize": MoveVertical,
  "nesw-resize": MoveDiagonal,
  "nwse-resize": MoveDiagonal,
  "zoom-in": ZoomIn,
  "zoom-out": ZoomOut,
  "not-allowed": Ban,
  wait: Circle,
  progress: Circle,
  help: Search,
} satisfies Record<CursorType, typeof MousePointer2>

function getCursorType(element: Element | null): CursorType {
  let current = element

  while (current) {
    /*
     * Explicit cursor from the element.
     */
    const cursor = window.getComputedStyle(current).cursor

    switch (cursor) {
      case "pointer":
        return "pointer"

      case "text":
      case "vertical-text":
        return "text"

      case "move":
      case "all-scroll":
        return "move"

      case "grab":
        return "grab"

      case "grabbing":
        return "grabbing"

      case "crosshair":
        return "crosshair"

      case "ew-resize":
        return "ew-resize"

      case "ns-resize":
        return "ns-resize"

      case "nesw-resize":
        return "nesw-resize"

      case "nwse-resize":
        return "nwse-resize"

      case "zoom-in":
        return "zoom-in"

      case "zoom-out":
        return "zoom-out"

      case "not-allowed":
      case "no-drop":
        return "not-allowed"

      case "wait":
        return "wait"

      case "progress":
        return "progress"

      case "help":
        return "help"

      default:
        break
    }

    /*
     * React/Tailwind elements can sometimes report
     * cursor:auto even though their semantic element
     * tells us what they are supposed to do.
     */

    if (
      current instanceof HTMLAnchorElement ||
      current instanceof HTMLButtonElement ||
      current.getAttribute("role") === "button"
    ) {
      return "pointer"
    }

    if (
      current instanceof HTMLInputElement ||
      current instanceof HTMLTextAreaElement ||
      current instanceof HTMLSelectElement ||
      current.getAttribute("contenteditable") === "true"
    ) {
      return "text"
    }

    /*
     * Look for common drag/drop indicators.
     */
    if (
      current.hasAttribute("draggable") &&
      current.getAttribute("draggable") === "true"
    ) {
      return "grab"
    }

    /*
     * Continue through parent elements.
     */
    current = current.parentElement
  }

  return "default"
}

export default function CustomCursor() {
  const [cursor, setCursor] = useState<CursorState>({
    x: -100,
    y: -100,
    type: "default",
  })

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const x = event.clientX
      const y = event.clientY

      const element = document.elementFromPoint(x, y)

      setCursor({
        x,
        y,
        type: getCursorType(element),
      })
    }

    document.addEventListener("mousemove", handleMouseMove)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  const Icon = cursorIcons[cursor.type]

  /*
   * Pointer-style cursors have a natural hotspot near
   * the upper-left corner.
   *
   * Other cursor types are centered on the mouse.
   */
  const isPointer =
    cursor.type === "default" ||
    cursor.type === "pointer"

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[99999]"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: isPointer
          ? "translate(-2px, -2px)"
          : "translate(-50%, -50%)",
      }}
    >
      <Icon
        size={22}
        strokeWidth={2.5}
        className="text-blue-500"
      />
    </div>
  )
}
