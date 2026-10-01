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
    // Do not use the custom cursor on touch devices.
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
      className="pointer-events-none fixed z-[99999]"
      style={{
        left: cursor.x,
        top: cursor.y,
        width: "16px",
        height: "20px",
      }}
    >
      <svg
        width="16"
        height="16"
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
