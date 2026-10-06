import { useState } from "react"

export default function WheelOfNames() {
  const [loading, setLoading] = useState(true)

  return (
    <main className="h-screen w-full overflow-hidden bg-black">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span className="text-sm text-white/70">
              Loading Wheel of Names...
            </span>
          </div>
        </div>
      )}

      <iframe
        title="Wheel of Names"
        src="/wheel/"
        className="block h-full w-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        onLoad={() => setLoading(false)}
      />
    </main>
  )
}
