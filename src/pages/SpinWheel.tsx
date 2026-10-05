import { useCallback, useState } from "react"
import { Dices } from "lucide-react"

import Navbar from "@/components/home/Navbar"
import Sidebar from "@/components/spinwheel/Sidebar"
import Wheel, {
  type SpinWheelItem,
} from "@/components/spinwheel/Wheel"

export default function SpinWheel() {
  const [items, setItems] = useState<SpinWheelItem[]>([])
  const [results, setResults] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleResult = useCallback((item: SpinWheelItem) => {
    setResults((current) => [item.label, ...current])
  }, [])

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative h-[calc(100vh-5rem)] min-h-[650px] pt-20">
        {/* Wheel area */}
        <div
          className={`absolute inset-0 transition-[padding] duration-300 ${
            sidebarOpen ? "pr-0 lg:pr-[468px]" : "pr-0"
          }`}
        >
          <Wheel
            items={items}
            onResult={handleResult}
          />
        </div>

        {/* Right sidebar */}
        <Sidebar
          open={sidebarOpen}
          items={items}
          results={results}
          onChange={setItems}
          onClearResults={() => setResults([])}
        />

        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={
            sidebarOpen ? "Hide sidebar" : "Show sidebar"
          }
          title={
            sidebarOpen ? "Hide sidebar" : "Show sidebar"
          }
          className={`absolute top-1/2 z-[70] hidden h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-border/70 bg-card/95 text-muted-foreground shadow-xl backdrop-blur transition-[right] duration-300 hover:bg-muted hover:text-foreground lg:flex ${
            sidebarOpen ? "right-[468px]" : "right-0"
          }`}
        >
          <span
            className={`text-2xl leading-none transition-transform duration-300 ${
              sidebarOpen ? "" : "rotate-180"
            }`}
          >
            ‹
          </span>
        </button>

        {/* Small MPD tool badge */}
        <div className="pointer-events-none absolute left-5 top-5 z-20">
          <div className="rounded-xl border border-border/70 bg-card/80 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-500">
              <Dices className="h-4 w-4" />
              MPD TOOLS
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
