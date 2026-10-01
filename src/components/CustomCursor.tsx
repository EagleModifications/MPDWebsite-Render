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
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setPosition({
        x: event.clientX,
        y: event.clientY,
      })

      setVisible(true)

      const target = event.target as HTMLElement | null

      if (
        target?.closest(
          "a, button, [role='button'], input, textarea, select, [data-cursor-hover]",
        )
      ) {
        setHovering(true)
      } else {
        setHovering(false)
      }
    }

    const handleMouseLeave = () => {
      setVisible(false)
    }

    const handleMouseEnter = () => {
      setVisible(true)
    }

    document.addEventListener(
      "mousemove",
      handleMouseMove,
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
        h-7
        w-7
        -translate-x-1/2
        -translate-y-1/2
        rounded-full
        border
        border-blue-400/70
        bg-blue-500/10
        shadow-[0_0_20px_rgba(59,130,246,0.45)]
        backdrop-blur-[2px]
        transition-[width,height,background-color,border-color,box-shadow,opacity]
        duration-150
        ease-out
        md:block
        ${
          visible
            ? "opacity-100"
            : "opacity-0"
        }
        ${
          hovering
            ? "h-10 w-10 border-blue-400 bg-blue-500/15 shadow-[0_0_30px_rgba(59,130,246,0.65)]"
            : ""
        }
      `}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
      }}
    >
      <span
        className="
          absolute
          left-1/2
          top-1/2
          h-1.5
          w-1.5
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-blue-400
          shadow-[0_0_10px_rgba(96,165,250,0.9)]
        "
      />

      <span
        className="
          absolute
          inset-[-5px]
          rounded-full
          border
          border-blue-400/10
        "
      />
    </div>
  )
}
