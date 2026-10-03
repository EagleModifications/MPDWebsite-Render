import { useEffect, useState } from "react"

type CursorPosition = {
  x: number
  y: number
}

export default function CustomCursor() {
  const [cursor, setCursor] =
    useState<CursorPosition>({
      x: -100,
      y: -100,
    })

  useEffect(() => {
    if (
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return
    }

    const handleMouseMove = (
      event: MouseEvent,
    ) => {
      setCursor({
        x: event.clientX,
        y: event.clientY,
      })
    }

    document.addEventListener(
      "mousemove",
      handleMouseMove,
    )

    return () => {
      document.removeEventListener(
        "mousemove",
        handleMouseMove,
      )
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="custom-cursor pointer-events-none fixed"
      style={{
        left: cursor.x,
        top: cursor.y,
        width: "20px",
        height: "24px",
      }}
    >
      <svg
        width="20"
        height="24"
        viewBox="0 0 16 20"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        <path
          d="M1 0.75L1.25 13.25L4.85 9.85L8.05 15.25L10.25 14L7.05 8.65L12.2 8.1L1 0.75Z"
          fill="#ffffff"
        />
      </svg>
    </div>
  )
}
