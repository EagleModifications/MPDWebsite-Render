import {
  Ban,
  Circle,
  Crosshair,
  Grab,
  Hand,
  Maximize2,
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
import {
  type ComponentType,
  useEffect,
  useState,
} from "react"

type CursorPosition = {
  x: number
  y: number
}

type CursorType =
  | "default"
  | "pointer"
  | "text"
  | "move"
  | "grab"
  | "grabbing"
  | "crosshair"
  | "col-resize"
  | "row-resize"
  | "nwse-resize"
  | "nesw-resize"
  | "zoom-in"
  | "zoom-out"
  | "not-allowed"
  | "wait"
  | "progress"
  | "help"

type CursorIcon = ComponentType<{
  className?: string
  strokeWidth?: number
}>

const cursorIcons: Record<CursorType, CursorIcon> = {
  default: MousePointer,
  pointer: MousePointer,
  text: Type,
  move: Move,
  grab: Grab,
  grabbing: Hand,
  crosshair: Crosshair,
  "col-resize": MoveHorizontal,
  "row-resize": MoveVertical,
  "nwse-resize": MoveDiagonal,
  "nesw-resize": MoveDiagonal,
  "zoom-in": ZoomIn,
  "zoom-out": ZoomOut,
  "not-allowed": Ban,
  wait: Circle,
  progress: Circle,
  help: Search,
}

function getCursorType(element: Element | null): CursorType {
  if (!element) {
    return "default"
  }

  const htmlElement = element as HTMLElement

  const computedStyle = window.getComputedStyle(htmlElement)
  const cursor = computedStyle.cursor as CursorType

  if (cursor === "auto") {
    return "default"
  }

  if (cursor in cursorIcons) {
    return cursor
  }

  return "default"
}

export default function CustomCursor() {
  const [position, setPosition] = useState<CursorPosition>({
    x: -100,
    y: -100,
  })

  const [visible, setVisible] = useState(false)
  const [cursorType, setCursorType] =
    useState<CursorType>("default")

  const [clicking, setClicking] = useState(false)

  useEffect(() => {
    const updateCursor = (
      clientX: number,
      clientY: number,
    ) => {
      setPosition({
        x: clientX,
        y: clientY,
      })

      const element = document.elementFromPoint(
        clientX,
        clientY,
      )

      setCursorType(getCursorType(element))
      setVisible(true)
    }

    const handleMouseMove = (event: MouseEvent) => {
      updateCursor(
        event.clientX,
        event.clientY,
      )
    }

    const handleMouseDown = () => {
      setClicking(true)
    }

    const handleMouseUp = () => {
      setClicking(false)
    }

    const handleMouseLeave = () => {
      setVisible(false)
      setClicking(false)
    }

    const handleMouseEnter = () => {
      setVisible(true)
    }

    const handleScroll = () => {
      const element = document.elementFromPoint(
        position.x,
        position.y,
      )

      setCursorType(getCursorType(element))
    }

    document.addEventListener(
      "mousemove",
      handleMouseMove,
    )

    document.addEventListener(
      "mousedown",
      handleMouseDown,
    )

    document.addEventListener(
      "mouseup",
      handleMouseUp,
    )

    document.addEventListener(
      "scroll",
      handleScroll,
      true,
    )

    document.documentElement.addEventListener(
      "mouseleave",
      handleMouseLeave,
    )

    document.documentElement.addEventListener(
      "mouseenter",
      handleMouseEnter,
    )

    return () => {
      document.removeEventListener(
        "mousemove",
        handleMouseMove,
      )

      document.removeEventListener(
        "mousedown",
        handleMouseDown,
      )

      document.removeEventListener(
        "mouseup",
        handleMouseUp,
      )

      document.removeEventListener(
        "scroll",
        handleScroll,
        true,
      )

      document.documentElement.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      )

      document.documentElement.removeEventListener(
        "mouseenter",
        handleMouseEnter,
      )
    }
  }, [position.x, position.y])

  const CursorIcon =
    cursorIcons[cursorType] ?? MousePointer

  return (
    <div
      aria-hidden="true"
      className={`
        pointer-events-none
        fixed
        left-0
        top-0
        z-[99999]
        hidden
        md:block
        transition-opacity
        duration-75
        ease-out
        ${
          visible
            ? "opacity-100"
            : "opacity-0"
        }
      `}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <CursorIcon
        className={`
          absolute
          left-0
          top-0
          h-[20px]
          w-[20px]
          text-blue-500
          drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]
          transition-transform
          duration-75
          ease-out
          ${
            clicking
              ? "scale-90"
              : "scale-100"
          }
        `}
        strokeWidth={2}
      />
    </div>
  )
}
