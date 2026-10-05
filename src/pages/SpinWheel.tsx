import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dices, X } from "lucide-react"
import confetti from "canvas-confetti"

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

const MAX_WHEELS = 10

type SpinResult = {
  id: string
  wheelId: string
  wheelName: string
  item: SpinWheelItem
}

const DEFAULT_ENTRIES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
]

function createWheel(index: number): WheelState {
  return {
    id: crypto.randomUUID(),
    name: `Wheel ${index}`,
    items: DEFAULT_ENTRIES.map((label, itemIndex) => ({
      id: crypto.randomUUID(),
      label,
      color: [
        "#3b82f6",
        "#64748b",
        "#0ea5e9",
        "#334155",
        "#60a5fa",
        "#94a3b8",
      ][itemIndex],
      weight: 1,
      hidden: false,
    })),
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

  /*
   * This is deliberately stored per wheel because the Customize wheel
   * dialog is also per wheel. Enabling "Animate winning entry" on Wheel 2
   * must not automatically enable it on Wheel 1.
   */
  const [animateWinningEntryByWheel, setAnimateWinningEntryByWheel] =
    useState<Record<string, boolean>>({})
  const [launchConfettiByWheel, setLaunchConfettiByWheel] =
    useState<Record<string, boolean>>({})
  const [afterSoundByWheel, setAfterSoundByWheel] =
    useState<Record<string, string>>({})
  const [afterVolumeByWheel, setAfterVolumeByWheel] =
    useState<Record<string, number>>({})
  const [spinSlowlyByWheel, setSpinSlowlyByWheel] =
    useState<Record<string, boolean>>({})
  const [spinTimeByWheel, setSpinTimeByWheel] =
    useState<Record<string, number>>({})
  const [centerImageByWheel, setCenterImageByWheel] =
    useState<Record<string, string | undefined>>({})
  const [imageSizeByWheel, setImageSizeByWheel] =
    useState<Record<string, "S" | "M" | "L">>({})

  /*
   * The large background winner animation is separate from the winner
   * popup. The popup remains exactly as before; this state only controls
   * the large winner name that grows and fades behind it.
   */
  const [animatedWinner, setAnimatedWinner] =
    useState<SpinResult | null>(null)

  const wheelAreaRef = useRef<HTMLDivElement | null>(null)
  const winnerAnimationTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const confettiEndRef = useRef(0)
  const confettiFrameRef = useRef<number | null>(null)
  const lastConfettiBurstRef = useRef(0)

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

  useEffect(() => {
    return () => {
      if (winnerAnimationTimeoutRef.current) {
        clearTimeout(winnerAnimationTimeoutRef.current)
      }
      if (confettiFrameRef.current !== null) {
        cancelAnimationFrame(confettiFrameRef.current)
      }
    }
  }, [])

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

  const launchWinnerCelebration = useCallback(() => {
    // Wheel of Names-style celebration: repeated fireworks from changing
    // positions for five seconds. Each burst then naturally falls away.
    const end = Date.now() + 5000
    confettiEndRef.current = end
    lastConfettiBurstRef.current = 0

    if (confettiFrameRef.current !== null) {
      cancelAnimationFrame(confettiFrameRef.current)
      confettiFrameRef.current = null
    }

    const frame = () => {
      const now = Date.now()
      if (now >= confettiEndRef.current) {
        confettiFrameRef.current = null
        return
      }

      // Fire a few bursts at a time rather than on every animation frame.
      // This gives the fireworks their separate "pop" moments without
      // flooding the canvas with thousands of particles.
      if (now - lastConfettiBurstRef.current >= 110) {
        lastConfettiBurstRef.current = now

        const bursts = 2 + Math.floor(Math.random() * 2)
        for (let i = 0; i < bursts; i += 1) {
          const x = 0.06 + Math.random() * 0.88
          const y = 0.08 + Math.random() * 0.62
          const direction = Math.random() > 0.5 ? 1 : -1

          confetti({
            particleCount: 30 + Math.floor(Math.random() * 20),
            angle: direction > 0
              ? 55 + Math.random() * 35
              : 95 + Math.random() * 35,
            spread: 42 + Math.random() * 60,
            startVelocity: 42 + Math.random() * 30,
            decay: 0.91 + Math.random() * 0.025,
            gravity: 0.78 + Math.random() * 0.28,
            drift: (Math.random() - 0.5) * 0.8,
            scalar: 0.75 + Math.random() * 0.45,
            ticks: 180 + Math.floor(Math.random() * 100),
            origin: { x, y },
            colors: [
              "#3b82f6", "#60a5fa", "#0ea5e9", "#22c55e",
              "#facc15", "#f97316", "#ef4444", "#a855f7",
            ],
            zIndex: 1000,
          })
        }
      }

      confettiFrameRef.current = requestAnimationFrame(frame)
    }

    frame()
  }, [])

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

      if (launchConfettiByWheel[wheelId]) {
        launchWinnerCelebration()
      }

      /*
       * "Animate winning entry" is the switch that controls this exact
       * animation. When it is disabled, the normal winner popup still
       * appears, but the large background winner text is not rendered.
       */
      if (animateWinningEntryByWheel[wheelId]) {
        if (winnerAnimationTimeoutRef.current) {
          clearTimeout(winnerAnimationTimeoutRef.current)
        }

        setAnimatedWinner(result)

        winnerAnimationTimeoutRef.current = setTimeout(() => {
          setAnimatedWinner(null)
          winnerAnimationTimeoutRef.current = null
        }, 1900)
      } else {
        setAnimatedWinner(null)

        if (winnerAnimationTimeoutRef.current) {
          clearTimeout(winnerAnimationTimeoutRef.current)
          winnerAnimationTimeoutRef.current = null
        }
      }
    },
    [animateWinningEntryByWheel, launchConfettiByWheel, launchWinnerCelebration, wheels],
  )

  const handleAnimateWinningEntryChange = useCallback(
    (wheelId: string, enabled: boolean) => {
      setAnimateWinningEntryByWheel((current) => ({
        ...current,
        [wheelId]: enabled,
      }))

      /*
       * If the user turns the option off while an animation is currently
       * playing, stop the animation immediately.
       */
      if (!enabled && animatedWinner?.wheelId === wheelId) {
        setAnimatedWinner(null)

        if (winnerAnimationTimeoutRef.current) {
          clearTimeout(winnerAnimationTimeoutRef.current)
          winnerAnimationTimeoutRef.current = null
        }
      }
    },
    [animatedWinner],
  )

  const handleLaunchConfettiChange = useCallback(
    (wheelId: string, enabled: boolean) => {
      setLaunchConfettiByWheel((current) => ({
        ...current,
        [wheelId]: enabled,
      }))
    },
    [],
  )

  const handleAfterSoundChange = useCallback(
    (wheelId: string, sound: string) => {
      setAfterSoundByWheel((current) => ({
        ...current,
        [wheelId]: sound,
      }))
    },
    [],
  )

  const handleAfterVolumeChange = useCallback(
    (wheelId: string, volume: number) => {
      setAfterVolumeByWheel((current) => ({
        ...current,
        [wheelId]: volume,
      }))
    },
    [],
  )

  const renameWheel = useCallback((wheelId: string, name: string) => {
    const trimmed = name.trim()

    if (!trimmed) {
      return
    }

    setWheels((current) =>
      current.map((wheel) =>
        wheel.id === wheelId
          ? { ...wheel, name: trimmed }
          : wheel,
      ),
    )
  }, [])

  const removeWheel = useCallback((wheelId: string) => {
    setWheels((current) => {
      if (current.length <= 1) {
        return current
      }

      const remaining = current.filter((wheel) => wheel.id !== wheelId)

      // Keep the automatic wheel names sequential after a deletion.
      // Custom names are left untouched.
      return remaining.map((wheel, index) =>
        /^Wheel \d+$/.test(wheel.name.trim())
          ? { ...wheel, name: `Wheel ${index + 1}` }
          : wheel,
      )
    })

    setActiveWheelId((active) => {
      if (active !== wheelId) {
        return active
      }

      return wheels.find(
        (wheel) => wheel.id !== wheelId,
      )?.id ?? ""
    })

    setAnimateWinningEntryByWheel((current) => {
      const next = { ...current }
      delete next[wheelId]
      return next
    })

    setLaunchConfettiByWheel((current) => {
      const next = { ...current }
      delete next[wheelId]
      return next
    })

    setAfterSoundByWheel((current) => {
      const next = { ...current }
      delete next[wheelId]
      return next
    })

    setAfterVolumeByWheel((current) => {
      const next = { ...current }
      delete next[wheelId]
      return next
    })

    setSpinSlowlyByWheel((current) => { const next = { ...current }; delete next[wheelId]; return next })
    setSpinTimeByWheel((current) => { const next = { ...current }; delete next[wheelId]; return next })
    setCenterImageByWheel((current) => { const next = { ...current }; delete next[wheelId]; return next })
    setImageSizeByWheel((current) => { const next = { ...current }; delete next[wheelId]; return next })

    setWinners((current) =>
      current.filter((winner) => winner.wheelId !== wheelId),
    )

    setResults((current) =>
      current.filter((result) => result.wheelId !== wheelId),
    )

    if (animatedWinner?.wheelId === wheelId) {
      setAnimatedWinner(null)

      if (winnerAnimationTimeoutRef.current) {
        clearTimeout(winnerAnimationTimeoutRef.current)
        winnerAnimationTimeoutRef.current = null
      }
    }
  }, [animatedWinner, wheels])

  const handleSpinSlowlyChange = useCallback((wheelId: string, enabled: boolean) => {
    setSpinSlowlyByWheel((current) => ({ ...current, [wheelId]: enabled }))
  }, [])

  const handleSpinTimeChange = useCallback((wheelId: string, seconds: number) => {
    setSpinTimeByWheel((current) => ({ ...current, [wheelId]: seconds }))
  }, [])

  const handleCenterImageChange = useCallback((wheelId: string, image: string | undefined) => {
    setCenterImageByWheel((current) => ({ ...current, [wheelId]: image }))
  }, [])

  const handleImageSizeChange = useCallback((wheelId: string, size: "S" | "M" | "L") => {
    setImageSizeByWheel((current) => ({ ...current, [wheelId]: size }))
  }, [])

  const addWheel = useCallback(() => {
    if (wheels.length >= MAX_WHEELS) {
      return
    }

    const nextWheel = createWheel(wheels.length + 1)

    setWheels((current) => {
      if (current.length >= MAX_WHEELS) {
        return current
      }

      return [...current, nextWheel]
    })

    setActiveWheelId(nextWheel.id)
    setSidebarOpen(true)
  }, [wheels.length])

  const spinAllWheels = useCallback(() => {
    const wheelButtons =
      wheelAreaRef.current?.querySelectorAll<HTMLDivElement>(
        '[role="button"][tabindex="0"]',
      )

    wheelButtons?.forEach((button) => button.click())
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  const closeWinnerPopup = useCallback(() => {
    setWinners([])
  }, [])

  const closeWinner = useCallback((resultId: string) => {
    setWinners((current) =>
      current.filter(
        (winner) => winner.id !== resultId,
      ),
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
      current.filter(
        (winner) => winner.id !== result.id,
      ),
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
      current.filter(
        (winner) => winner.id !== result.id,
      ),
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

    window.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      )
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
    <div className="flex h-dvh flex-col overflow-hidden bg-[#080b0e] text-foreground">
      <Navbar />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_35%_35%,rgba(33,70,82,0.42),transparent_45%),radial-gradient(circle_at_78%_25%,rgba(81,42,91,0.28),transparent_42%),linear-gradient(135deg,#07151b_0%,#080b0e_48%,#150b17_100%)]">
          <div
            className={`absolute inset-0 min-h-0 overflow-hidden transition-[padding] duration-300 ${
              sidebarOpen ? "lg:pr-[560px]" : ""
            }`}
          >
            <div
              ref={wheelAreaRef}
              className={`grid h-full min-h-0 w-full overflow-visible ${
                wheels.length === 1
                  ? "grid-cols-1 grid-rows-1 p-2"
                  : "grid-cols-2 auto-rows-fr gap-x-6 gap-y-4 p-5 lg:gap-x-8 lg:gap-y-5 lg:p-7"
              }`}
            >
              {wheels.map((wheel) => (
                <div
                  key={wheel.id}
                  className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-visible bg-transparent ${
                    wheels.length > 1 ? "p-2 lg:p-3" : ""
                  }`}
                >
                  <Wheel
                    items={wheel.items}
                    compact={wheels.length > 1}
                    afterSound={afterSoundByWheel[wheel.id] ?? "Subdued applause"}
                    afterVolume={afterVolumeByWheel[wheel.id] ?? 50}
                    spinSlowly={spinSlowlyByWheel[wheel.id] ?? false}
                    spinTime={spinTimeByWheel[wheel.id] ?? 10}
                    centerImage={centerImageByWheel[wheel.id]}
                    imageSize={imageSizeByWheel[wheel.id] ?? "S"}
                    onResult={(item) =>
                      handleResult(
                        wheel.id,
                        item,
                      )
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
            wheels.find(
              (wheel) =>
                wheel.id === activeWheelId,
            )?.items ?? []
          }
          results={results.map(
            (result) =>
              `${result.wheelName}: ${result.item.label}`,
          )}
          wheels={wheelSummaries}
          activeWheelId={activeWheelId}
          onSelectWheel={setActiveWheelId}
          onChange={(items) =>
            handleWheelChange(
              activeWheelId,
              items,
            )
          }
          onClearResults={clearResults}
          onRenameWheel={renameWheel}
          onRemoveWheel={removeWheel}
          onAddWheel={addWheel}
          canAddWheel={wheels.length < MAX_WHEELS}
          onSpinAllWheels={spinAllWheels}
          onOpenWheel={() =>
            setSidebarOpen(false)
          }
          animateWinningEntryByWheel={
            animateWinningEntryByWheel
          }
          onAnimateWinningEntryChange={
            handleAnimateWinningEntryChange
          }
          launchConfettiByWheel={
            launchConfettiByWheel
          }
          onLaunchConfettiChange={
            handleLaunchConfettiChange
          }
          afterSoundByWheel={afterSoundByWheel}
          afterVolumeByWheel={afterVolumeByWheel}
          onAfterSoundChange={handleAfterSoundChange}
          onAfterVolumeChange={handleAfterVolumeChange}
          spinSlowlyByWheel={spinSlowlyByWheel}
          onSpinSlowlyChange={handleSpinSlowlyChange}
          spinTimeByWheel={spinTimeByWheel}
          onSpinTimeChange={handleSpinTimeChange}
          centerImageByWheel={centerImageByWheel}
          onCenterImageChange={handleCenterImageChange}
          imageSizeByWheel={imageSizeByWheel}
          onImageSizeChange={handleImageSizeChange}
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
          className={`absolute top-1/2 z-[200] hidden h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-white/10 bg-black/50 text-muted-foreground shadow-xl backdrop-blur transition-[right] duration-300 hover:bg-black/70 hover:text-foreground lg:flex ${
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

        {/*
         * Wheel of Names-style background winner animation.
         *
         * It sits below the winner dialog (z-500) and above the wheel
         * content. The text starts small, grows very large, and fades
         * away. It is completely disabled unless the per-wheel setting
         * "Animate winning entry" is enabled.
         */}
        {animatedWinner && (
          <>
            <style>
              {`
                @keyframes mpdWinnerEntryAnimation {
                  0% {
                    transform: translate(-50%, -50%) scale(0.22);
                    opacity: 0;
                  }

                  12% {
                    opacity: 0.14;
                  }

                  48% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 0.12;
                  }

                  100% {
                    transform: translate(-50%, -50%) scale(3.15);
                    opacity: 0;
                  }
                }

                @media (prefers-reduced-motion: reduce) {
                  .mpd-winner-entry-animation {
                    animation: none !important;
                    opacity: 0 !important;
                  }
                }
              `}
            </style>

            <div
              key={animatedWinner.id}
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-[450] overflow-hidden"
            >
              <div
                className="mpd-winner-entry-animation absolute left-1/2 top-1/2 max-w-[95vw] whitespace-nowrap text-center text-[clamp(4rem,13vw,12rem)] font-extrabold leading-none tracking-[-0.06em] text-white"
                style={{
                  animation:
                    "mpdWinnerEntryAnimation 1.9s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                {animatedWinner.item.label}
              </div>
            </div>
          </>
        )}

        {orderedWinners.length > 0 && (
          <div
            className="fixed inset-0 z-[500] flex items-center justify-center p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
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
                {orderedWinners.map(
                  (result) => (
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
                            closeWinner(
                              result.id,
                            )
                          }
                          className="rounded px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/10"
                        >
                          Close
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeWinner(
                              result,
                            )
                          }
                          className="rounded-[2px] bg-[#5147bd] px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#5d53cf]"
                        >
                          Remove
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            hideWinner(
                              result,
                            )
                          }
                          className="rounded-[2px] bg-[#5147bd] px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#5d53cf]"
                        >
                          Hide
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
