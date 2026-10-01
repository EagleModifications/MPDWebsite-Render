import { useEffect, useState } from "react"

type CursorPosition = {
  x: number
  y: number
}

export default function CustomCursor() {
  const [position, setPosition] = useState<CursorPosition>({
    x: -100,
    y: -100,
  })

  const [visible, setVisible] = useState(false)
  const [clicking, setClicking] = useState(false)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setPosition({
        x: event.clientX,
        y: event.clientY,
      })

      setVisible(true)
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

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mouseup", handleMouseUp)

    document.documentElement.addEventListener(
      "mouseleave",
      handleMouseLeave,
    )

    document.documentElement.addEventListener(
      "mouseenter",
      handleMouseEnter,
    )

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mouseup", handleMouseUp)

      document.documentElement.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      )

      document.documentElement.removeEventListener(
        "mouseenter",
        handleMouseEnter,
      )
    }
  }, [])

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
        duration-150
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
      {/* Soft outer glow */}
      <div
        className={`
          pointer-events-none
          absolute
          left-0
          top-0
          h-11
          w-11
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-blue-500/[0.04]
          blur-[7px]
          transition-[width,height,opacity]
          duration-200
          ease-out
          ${
            clicking
              ? "h-12 w-12 opacity-90"
              : "opacity-70"
          }
        `}
      />

      {/* Outer ring */}
      <div
        className={`
          pointer-events-none
          absolute
          left-0
          top-0
          h-7
          w-7
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border
          border-blue-400/65
          transition-[width,height,border-color]
          duration-150
          ease-out
          ${
            clicking
              ? "h-8 w-8 border-blue-400/85"
              : ""
          }
        `}
        style={{
          boxShadow: `
            0 0 6px rgba(59, 130, 246, 0.18),
            0 0 14px rgba(59, 130, 246, 0.12)
          `,
        }}
      />

      {/* Clear gap around the click point */}
      <div
        className="
          pointer-events-none
          absolute
          left-0
          top-0
          h-[9px]
          w-[9px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-transparent
        "
      />

      {/* Exact mouse / click point */}
      <span
        className={`
          pointer-events-none
          absolute
          left-0
          top-0
          h-[5px]
          w-[5px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-blue-400
          transition-[width,height,background-color,box-shadow]
          duration-100
          ease-out
          ${
            clicking
              ? "h-[6px] w-[6px] bg-blue-300"
              : ""
          }
        `}
        style={{
          boxShadow: clicking
            ? `
                0 0 4px rgba(147, 197, 253, 0.9),
                0 0 8px rgba(96, 165, 250, 0.65)
              `
            : `
                0 0 3px rgba(147, 197, 253, 0.9),
                0 0 7px rgba(96, 165, 250, 0.55)
              `,
        }}
      />
    </div>
  )
}
