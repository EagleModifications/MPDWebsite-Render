import { useCallback, useEffect, useMemo, useState } from "react"
import { Dices, X } from "lucide-react"

import Navbar from "@/components/home/Navbar"
import Sidebar from "@/components/spinwheel/Sidebar"
import Wheel, {
  type SpinWheelItem,
} from "@/components/spinwheel/Wheel"

type WheelState = {
  id: string
  name: string
  items: SpinWheelItem[]
}

type SpinResult = {
  id: string
  wheelId: string
  wheelName: string
  item: SpinWheelItem
}

function createWheel(index: number): WheelState {
  return {
    id: crypto.randomUUID(),
    name: `Wheel ${index}`,
    items: [],
  }
}

export default function SpinWheel() {
  const [wheels, setWheels] = useState<WheelState[]>(() => [
    createWheel(1),
  ])
  const [activeWheelId, setActiveWheelId] = useState("")
  const [results, setResults] = useState<SpinResult[]>([])
  const [winners, setWinners] = useState<SpinResult[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!activeWheelId && wheels[0]) {
      setActiveWheelId(wheels[0].id)
      return
    }

    if (
      activeWheelId &&
      !wheels.some((wheel) => wheel.id === activeWheelId)
    ) {
      setActiveWheelId(wheels[0]?.id ?? "")
    }
  }, [activeWheelId, wheels])

  const handleWheelChange = useCallback(
    (wheelId: string, items: SpinWheelItem[]) => {
      setWheels((current) =>
        current.map((wheel) =>
          wheel.id === wheelId
            ? { ...wheel, items }
            : wheel,
        ),
      )
    },
    [],
  )

  const handleResult = useCallback(
    (wheelId: string, item: SpinWheelItem) => {
      const wheel = wheels.find(
        (entry) => entry.id === wheelId,
      )

      if (!wheel) {
        return
      }

      const result: SpinResult = {
        id: crypto.randomUUID(),
        wheelId,
        wheelName: wheel.name,
        item,
      }

      setResults((existing) => [
        ...existing,
        result,
      ])

      setWinners((existing) => [
        ...existing.filter(
          (winner) => winner.wheelId !== wheelId,
        ),
        result,
      ])
    },
    [wheels],
  )

  const addWheel = useCallback(() => {
    const next = createWheel(wheels.length + 1)
    setWheels((current) => [...current, next])
    setActiveWheelId(next.id)
  }, [wheels.length])

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  const closeWinnerPopup = useCallback(() => {
    setWinners([])
  }, [])

  const closeWinner = useCallback((resultId: string) => {
    setWinners((current) =>
      current.filter((winner) => winner.id !== resultId),
    )
  }, [])

  const removeWinner = useCallback((result: SpinResult) => {
    setWheels((current) =>
      current.map((wheel) =>
        wheel.id === result.wheelId
          ? {
              ...wheel,
              items: wheel.items.filter(
                (item) => item.id !== result.item.id,
              ),
            }
          : wheel,
      ),
    )

    setWinners((current) =>
      current.filter((winner) => winner.id !== result.id),
    )
  }, [])

  const hideWinner = useCallback((result: SpinResult) => {
    setWheels((current) =>
      current.map((wheel) =>
        wheel.id === result.wheelId
          ? {
              ...wheel,
              items: wheel.items.map((item) =>
                item.id === result.item.id
                  ? { ...item, hidden: true }
                  : item,
              ),
            }
          : wheel,
      ),
    )

    setWinners((current) =>
      current.filter((winner) => winner.id !== result.id),
    )
  }, [])

  useEffect(() => {
    if (winners.length === 0) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeWinnerPopup()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () =>
      window.removeEventListener("keydown", handleKeyDown)
  }, [closeWinnerPopup, winners.length])

  const orderedWinners = useMemo(
    () =>
      [...winners].sort((a, b) => {
        const aIndex = wheels.findIndex(
          (wheel) => wheel.id === a.wheelId,
        )
        const bIndex = wheels.findIndex(
          (wheel) => wheel.id === b.wheelId,
        )
        return aIndex - bIndex
      }),
    [winners, wheels],
  )

  const wheelSummaries = useMemo(
    () =>
      wheels.map((wheel) => ({
        id: wheel.id,
        name: wheel.name,
        items: wheel.items,
      })),
    [wheels],
  )

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b0e] text-foreground">
      <Navbar />

      <main className="relative h-[calc(100vh-5rem)] min-h-[650px] pt-20">
        <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_35%_35%,rgba(33,70,82,0.42),transparent_45%),radial-gradient(circle_at_78%_25%,rgba(81,42,91,0.28),transparent_42%),linear-gradient(135deg,#07151b_0%,#080b0e_48%,#150b17_100%)]">
          <div
            className={`absolute inset-0 overflow-auto transition-[padding] duration-300 ${
              sidebarOpen ? "lg:pr-[468px]" : ""
            }`}
          >
            <div
              className={`grid min-h-full gap-2 p-3 ${
                wheels.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-2 auto-rows-fr"
              }`}
            >
              {wheels.map((wheel) => (
                <div
                  key={wheel.id}
                  className="relative flex min-h-0 min-w-0 items-center justify-center"
                >
                  <Wheel
                    items={wheel.items}
                    compact={wheels.length > 1}
                    wheelCount={wheels.length}
                    onResult={(item) =>
                      handleResult(wheel.id, item)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <Sidebar
          open={sidebarOpen}
          items={
            wheels.find((wheel) => wheel.id === activeWheelId)
              ?.items ?? []
          }
          results={results.map(
            (result) =>
              `${result.wheelName}: ${result.item.label}`,
          )}
          wheels={wheelSummaries}
          activeWheelId={activeWheelId}
          onSelectWheel={setActiveWheelId}
          onChange={(items) =>
            handleWheelChange(activeWheelId, items)
          }
          onClearResults={clearResults}
          onNewWheel={addWheel}
        />

        <button
          type="button"
          onClick={() =>
            setSidebarOpen((open) => !open)
          }
          aria-label={
            sidebarOpen
              ? "Hide sidebar"
              : "Show sidebar"
          }
          title={
            sidebarOpen
              ? "Hide sidebar"
              : "Show sidebar"
          }
          className={`absolute top-1/2 z-[100] hidden h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-white/10 bg-black/50 text-muted-foreground shadow-xl backdrop-blur transition-[right] duration-300 hover:bg-black/70 hover:text-foreground lg:flex ${
            sidebarOpen
              ? "right-[468px]"
              : "right-0"
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

        <div className="pointer-events-none absolute left-5 top-5 z-20">
          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
              <Dices className="h-4 w-4" />
              MPD TOOLS
            </div>
          </div>
        </div>

        {orderedWinners.length > 0 && (
          <div
            className="fixed inset-0 z-[500] flex items-center justify-center p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeWinnerPopup()
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="winner-dialog-title"
              className="w-full max-w-[680px] overflow-hidden rounded-[4px] bg-[#191919] shadow-[0_18px_60px_rgba(0,0,0,0.7)] ring-1 ring-black/50"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="flex min-h-[54px] items-center justify-between bg-[#79d99f] px-4 text-[#111]">
                <h2
                  id="winner-dialog-title"
                  className="text-[16px] font-bold"
                >
                  {orderedWinners.length === 1
                    ? "We have a winner!"
                    : "We have winners!"}
                </h2>

                <button
                  type="button"
                  onClick={closeWinnerPopup}
                  aria-label="Close winner popup"
                  className="rounded p-1.5 text-black/70 transition hover:bg-black/10 hover:text-black"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {orderedWinners.map((result) => (
                  <div
                    key={result.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 sm:grid-cols-[110px_1fr_auto]"
                  >
                    <div className="text-xs font-bold uppercase tracking-wide text-white/45">
                      {result.wheelName}
                    </div>

                    <div className="min-w-0 truncate text-center text-[25px] font-normal tracking-[-0.5px] text-white sm:text-left">
                      {result.item.label}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                      <button
                        type="button"
                        onClick={() =>
                          closeWinner(result.id)
                        }
                        className="rounded px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/10"
                      >
                        Close
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeWinner(result)
                        }
                        className="rounded-[2px] bg-[#5147bd] px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#5d53cf]"
                      >
                        Remove
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          hideWinner(result)
                        }
                        className="rounded-[2px] bg-[#5147bd] px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#5d53cf]"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
