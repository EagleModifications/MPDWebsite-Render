import { useEffect, useRef, useState } from "react"

import {
  Ban,
  Circle,
  Crosshair,
  Grab,
  Hand,
  MousePointer,
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
  visible: boolean
}

const cursorIcons = {
  default: MousePointer,
  pointer: Hand,
  text: Type,
  move: Move,
  grab: Grab,
  grabbing: Hand,
  crosshair: Crosshair,
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
} satisfies Record<CursorType, typeof MousePointer>

function getCursorType(element: Element | null): CursorType {
  let current: Element | null = element

  while (current) {
    const computedCursor = window.getComputedStyle(current).cursor

    if (
      computedCursor &&
      computedCursor !== "auto" &&
      computedCursor !== "inherit" &&
      computedCursor !== "initial"
    ) {
      switch (computedCursor) {
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

        case "default":
          return "default"

        default:
          break
      }
    }

    current = current.parentElement
  }

  return "default"
}

export default function CustomCursor() {
  const [cursor, setCursor] = useState<CursorState>({
    x: -100,
    y: -100,
    type: "default",
    visible: false,
  })

  const positionRef = useRef({
    x: -100,
    y: -100,
  })

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const { clientX, clientY } = event

      positionRef.current = {
        x: clientX,
        y: clientY,
      }

      const element = document.elementFromPoint(clientX, clientY)

      setCursor({
        x: clientX,
        y: clientY,
        type: getCursorType(element),
        visible: true,
      })
    }

    const handleMouseLeave = () => {
      setCursor((current) => ({
        ...current,
        visible: false,
      }))
    }

    const handleMouseEnter = (event: MouseEvent) => {
      const { clientX, clientY } = event

      positionRef.current = {
        x: clientX,
        y: clientY,
      }

      const element = document.elementFromPoint(clientX, clientY)

      setCursor({
        x: clientX,
        y: clientY,
        type: getCursorType(element),
        visible: true,
      })
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseleave", handleMouseLeave)
    document.addEventListener("mouseenter", handleMouseEnter)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseleave", handleMouseLeave)
      document.removeEventListener("mouseenter", handleMouseEnter)
    }
  }, [])

  if (!cursor.visible) {
    return null
  }

  const Icon = cursorIcons[cursor.type]

  /*
   * MousePointer's visual tip is slightly inside its SVG viewBox.
   * Offset it so the arrow tip sits directly on the actual mouse
   * position rather than appearing a few pixels down/right.
   */
  const isPointer =
    cursor.type === "default" || cursor.type === "pointer"

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[99999]"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: isPointer
          ? "translate(-3px, -3px)"
          : "translate(-50%, -50%)",
      }}
    >
      <Icon
        className="text-blue-500 drop-shadow-[0_0_5px_rgba(59,130,246,0.45)]"
        size={20}
        strokeWidth={2}
      />
    </div>
  )
}
