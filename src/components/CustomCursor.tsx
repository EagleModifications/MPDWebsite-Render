import { useEffect, useState } from "react"

export default function CustomCursor() {
  const [position, setPosition] = useState({
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

    window.addEventListener("mousemove", handleMouseMove)
    document.documentElement.addEventListener(
      "mouseleave",
      handleMouseLeave,
    )

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      document.documentElement.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      )
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed left-0 top-0 z-[99999] hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/40 bg-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.25)] backdrop-blur-md transition-opacity duration-150 md:block ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
      }}
    />
  )
}
