import { useEffect } from "react"

export default function WheelOfNames() {
  useEffect(() => {
    document.title = "Spin Wheel"
  }, [])

  return (
    <main className="fixed inset-0 h-screen w-full overflow-hidden bg-black">
      <iframe
        title="Spin Wheel"
        src="/wheel-app.html"
        className="block h-full w-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
      />
    </main>
  )
}
