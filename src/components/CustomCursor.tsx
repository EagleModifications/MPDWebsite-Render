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

  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches

    if (coarse) {
      setIsTouchDevice(true)
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      setPosition({
        x: event.clientX,
        y: event.clientY,
      })
    }

    document.addEventListener("mousemove", handleMouseMove)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  if (isTouchDevice) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className="custom-cursor"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <svg
        width="20"
        height="24"
        viewBox="0 0 20 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 1.5L18.2 16.7L11.2 17.4L15.2 23L11.8 24L7.8 18.2L3.2 22.2L2 1.5Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  )
}
