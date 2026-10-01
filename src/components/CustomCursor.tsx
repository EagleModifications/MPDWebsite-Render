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

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setPosition({
        x: event.clientX,
        y: event.clientY,
      })

      setVisible(true)
    }

    const handleMouseLeave = () => {
      setVisible(false)
    }

    const handleMouseEnter = () => {
      setVisible(true)
    }

    document.addEventListener("mousemove", handleMouseMove)

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
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
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
      {/* Blue default-style pointer */}
      <path
        d="M2 2L7.2 21.2L11.4 13.1L19.8 17.4L21.8 13.7L13.3 9.5L20.4 5.8L2 2Z"
        fill="#3b82f6"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
