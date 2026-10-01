import { useEffect, useState } from "react"
import { MousePointer2 } from "lucide-react"

type CursorState = {
  x: number
  y: number
}

export default function CustomCursor() {
  const [cursor, setCursor] = useState<CursorState>({
    x: -100,
    y: -100,
  })

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      setCursor({
        x: event.clientX,
        y: event.clientY,
      })
    }

    document.addEventListener("mousemove", handleMouseMove)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[99999]"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: "translate(-2px, -2px)",
      }}
    >
      <MousePointer2
        size={22}
        strokeWidth={2.5}
        className="text-blue-500"
      />
    </div>
  )
}
