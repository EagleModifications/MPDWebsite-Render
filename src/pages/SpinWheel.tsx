import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { ChevronDown, FilePlus2, FolderOpen, Palette, Pencil, Save, Share2, X } from "lucide-react"
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
    useState<Record<string, "XS" | "S" | "M" | "L" | "XL" | "XXL">>({})

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
  const [customizeRequest, setCustomizeRequest] = useState(0)
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const [newConfirmOpen, setNewConfirmOpen] = useState(false)
  const [titleDialogOpen, setTitleDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [wheelTitle, setWheelTitle] = useState("Spin Wheel")
  const [wheelDescription, setWheelDescription] = useState(
    "Create and spin custom wheels for Metro Police Department activities, selections, and more.",
  )
  const [draftTitle, setDraftTitle] = useState("Spin Wheel")
  const [draftDescription, setDraftDescription] = useState(
    "Create and spin custom wheels for Metro Police Department activities, selections, and more.",
  )
  const openFileInputRef = useRef<HTMLInputElement | null>(null)

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
    /* One small fireworks burst every ~1/3 second for five seconds. */
    const end = Date.now() + 5000

    if (confettiFrameRef.current !== null) {
      cancelAnimationFrame(confettiFrameRef.current)
      confettiFrameRef.current = null
    }

    confettiEndRef.current = end
    lastConfettiBurstRef.current = 0

    const fire = () => {
      const now = Date.now()

      if (now >= confettiEndRef.current) {
        confettiFrameRef.current = null
        return
      }

      if (now - lastConfettiBurstRef.current >= 333) {
        lastConfettiBurstRef.current = now

        const x = 0.05 + Math.random() * 0.90
        const y = 0.05 + Math.random() * 0.78

        confetti({
          particleCount: 34 + Math.floor(Math.random() * 10),
          angle: 90,
          spread: 360,
          startVelocity: 27 + Math.random() * 8,
          decay: 0.90 + Math.random() * 0.025,
          gravity: 0.90 + Math.random() * 0.25,
          drift: (Math.random() - 0.5) * 0.45,
          scalar: 0.70 + Math.random() * 0.28,
          ticks: 55 + Math.floor(Math.random() * 20),
          origin: { x, y },
          colors: [
            '#3b82f6', '#60a5fa', '#0ea5e9', '#22c55e',
            '#facc15', '#f97316', '#ef4444', '#a855f7',
            '#f472b6',
          ],
          zIndex: 1000,
        })
      }

      confettiFrameRef.current = requestAnimationFrame(fire)
    }

    fire()
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

  const handleImageSizeChange = useCallback((wheelId: string, size: "XS" | "S" | "M" | "L" | "XL" | "XXL") => {
    setImageSizeByWheel((current) => ({ ...current, [wheelId]: size }))
  }, [])

  const openTitleDialog = useCallback(() => {
    setDraftTitle(wheelTitle)
    setDraftDescription(wheelDescription)
    setTitleDialogOpen(true)
  }, [wheelTitle, wheelDescription])

  const encodeSharePayload = useCallback((value: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(value))
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
  }, [])

  const createShareLink = useCallback(() => {
    const payload = {
      version: 2,
      title: wheelTitle,
      description: wheelDescription,
      wheels,
      settings: {
        animateWinningEntryByWheel,
        launchConfettiByWheel,
        afterSoundByWheel,
        afterVolumeByWheel,
        spinSlowlyByWheel,
        spinTimeByWheel,
        centerImageByWheel,
        imageSizeByWheel,
      },
    }
    return `${window.location.origin}${window.location.pathname}#share=${encodeSharePayload(payload)}`
  }, [
    afterSoundByWheel, afterVolumeByWheel, animateWinningEntryByWheel,
    centerImageByWheel, encodeSharePayload, imageSizeByWheel, launchConfettiByWheel,
    spinSlowlyByWheel, spinTimeByWheel, wheelDescription, wheelTitle, wheels,
  ])

  const openShareDialog = useCallback(() => {
    setShareCopied(false)
    setShareDialogOpen(true)
  }, [])

  const copyShareLink = useCallback(async () => {
    const link = createShareLink()
    try {
      await navigator.clipboard.writeText(link)
      setShareCopied(true)
    } catch {
      window.prompt("Copy this wheel link:", link)
    }
  }, [createShareLink])

  const resetToNewWheel = useCallback(() => {
    const nextWheel = createWheel(1)

    setWheels([nextWheel])
    setActiveWheelId(nextWheel.id)
    setResults([])
    setWinners([])
    setAnimateWinningEntryByWheel({})
    setLaunchConfettiByWheel({})
    setAfterSoundByWheel({})
    setAfterVolumeByWheel({})
    setSpinSlowlyByWheel({})
    setSpinTimeByWheel({})
    setCenterImageByWheel({})
    setImageSizeByWheel({})
    setWheelTitle("Spin Wheel")
    setWheelDescription("Create and spin custom wheels for Metro Police Department activities, selections, and more.")
    setSidebarOpen(true)
    setSaveMenuOpen(false)
  }, [])

  const requestCustomize = useCallback(() => {
    setCustomizeRequest((value) => value + 1)
  }, [])

  const openWheelFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    void file.text().then((raw) => {
      try {
        const parsed = JSON.parse(raw) as {
          version?: number
          title?: string
          description?: string
          wheels?: WheelState[]
          settings?: {
            animateWinningEntryByWheel?: Record<string, boolean>
            launchConfettiByWheel?: Record<string, boolean>
            afterSoundByWheel?: Record<string, string>
            afterVolumeByWheel?: Record<string, number>
            spinSlowlyByWheel?: Record<string, boolean>
            spinTimeByWheel?: Record<string, number>
            centerImageByWheel?: Record<string, string | undefined>
            imageSizeByWheel?: Record<string, "XS" | "S" | "M" | "L" | "XL" | "XXL">
          }
        }

        if (!Array.isArray(parsed.wheels) || parsed.wheels.length === 0 || parsed.wheels.length > MAX_WHEELS) {
          throw new Error("Invalid wheel file")
        }

        const loaded = parsed.wheels.map((wheel, index) => ({
          id: typeof wheel.id === "string" ? wheel.id : crypto.randomUUID(),
          name: typeof wheel.name === "string" && wheel.name.trim() ? wheel.name : `Wheel ${index + 1}`,
          items: Array.isArray(wheel.items)
            ? wheel.items.map((item) => ({
                id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
                label: typeof item.label === "string" ? item.label : String(item.label ?? ""),
                color: item.color,
                weight: typeof item.weight === "number" ? item.weight : 1,
                hidden: Boolean(item.hidden),
              }))
            : [],
        }))

        setWheels(loaded)
        setWheelTitle(typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "Spin Wheel")
        setWheelDescription(typeof parsed.description === "string" ? parsed.description : "Create and spin custom wheels for Metro Police Department activities, selections, and more.")
        setActiveWheelId(loaded[0].id)
        setResults([])
        setWinners([])

        const settings = parsed.settings ?? {}
        setAnimateWinningEntryByWheel(settings.animateWinningEntryByWheel ?? {})
        setLaunchConfettiByWheel(settings.launchConfettiByWheel ?? {})
        setAfterSoundByWheel(settings.afterSoundByWheel ?? {})
        setAfterVolumeByWheel(settings.afterVolumeByWheel ?? {})
        setSpinSlowlyByWheel(settings.spinSlowlyByWheel ?? {})
        setSpinTimeByWheel(settings.spinTimeByWheel ?? {})
        setCenterImageByWheel(settings.centerImageByWheel ?? {})
        setImageSizeByWheel(settings.imageSizeByWheel ?? {})
        setSidebarOpen(true)
      } catch {
        window.alert("That file is not a valid wheel file.")
      }
    })
  }, [])

  const saveWheelFile = useCallback((extension: "wheel" | "json") => {
    const payload = {
      version: 2,
      title: wheelTitle,
      description: wheelDescription,
      wheels,
      settings: {
        animateWinningEntryByWheel,
        launchConfettiByWheel,
        afterSoundByWheel,
        afterVolumeByWheel,
        spinSlowlyByWheel,
        spinTimeByWheel,
        centerImageByWheel,
        imageSizeByWheel,
      },
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `metro-pd-wheel.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setSaveMenuOpen(false)
  }, [
    wheels,
    animateWinningEntryByWheel,
    launchConfettiByWheel,
    afterSoundByWheel,
    afterVolumeByWheel,
    spinSlowlyByWheel,
    spinTimeByWheel,
    centerImageByWheel,
    imageSizeByWheel,
  ])

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

    // Every newly-created wheel starts with the same Wheel of Names-style
    // defaults. Keep these explicitly per-wheel so a new wheel never inherits
    // the settings of whichever wheel was active before it was added.
    setAnimateWinningEntryByWheel((current) => ({
      ...current,
      [nextWheel.id]: false,
    }))
    setLaunchConfettiByWheel((current) => ({
      ...current,
      [nextWheel.id]: false,
    }))
    setAfterSoundByWheel((current) => ({
      ...current,
      [nextWheel.id]: "Subdued applause",
    }))
    setAfterVolumeByWheel((current) => ({
      ...current,
      [nextWheel.id]: 50,
    }))
    setSpinSlowlyByWheel((current) => ({
      ...current,
      [nextWheel.id]: false,
    }))
    setSpinTimeByWheel((current) => ({
      ...current,
      [nextWheel.id]: 10,
    }))
    setCenterImageByWheel((current) => ({
      ...current,
      [nextWheel.id]: undefined,
    }))
    setImageSizeByWheel((current) => ({
      ...current,
      [nextWheel.id]: "S",
    }))

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

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith("#share=")) return
    try {
      const encoded = hash.slice(7).replace(/-/g, "+").replace(/_/g, "/")
      const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4)
      const binary = atob(padded)
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { title?: string; description?: string; wheels?: WheelState[]; settings?: Record<string, unknown> }
      if (!Array.isArray(parsed.wheels) || parsed.wheels.length < 1 || parsed.wheels.length > MAX_WHEELS) return
      setWheels(parsed.wheels)
      setActiveWheelId(parsed.wheels[0].id)
      setWheelTitle(parsed.title?.trim() || "Spin Wheel")
      setWheelDescription(parsed.description ?? "")
      const settings = parsed.settings ?? {}
      setAnimateWinningEntryByWheel((settings.animateWinningEntryByWheel as Record<string, boolean>) ?? {})
      setLaunchConfettiByWheel((settings.launchConfettiByWheel as Record<string, boolean>) ?? {})
      setAfterSoundByWheel((settings.afterSoundByWheel as Record<string, string>) ?? {})
      setAfterVolumeByWheel((settings.afterVolumeByWheel as Record<string, number>) ?? {})
      setSpinSlowlyByWheel((settings.spinSlowlyByWheel as Record<string, boolean>) ?? {})
      setSpinTimeByWheel((settings.spinTimeByWheel as Record<string, number>) ?? {})
      setCenterImageByWheel((settings.centerImageByWheel as Record<string, string | undefined>) ?? {})
      setImageSizeByWheel((settings.imageSizeByWheel as Record<string, "XS" | "S" | "M" | "L" | "XL" | "XXL">) ?? {})
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
    } catch {
      // Ignore malformed share links and keep the normal new wheel.
    }
  }, [])

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
    <div className="relative min-h-screen overflow-x-hidden bg-[#080b0e] text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="pointer-events-none absolute inset-x-0 top-[64px] z-[220] h-12">
          <button
            type="button"
            onClick={openTitleDialog}
            className="pointer-events-auto absolute right-[calc(468px+12px)] top-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white shadow-[0_8px_24px_rgba(0,0,0,0.42)] backdrop-blur-xl transition hover:bg-black/75"
            aria-label="Edit title and description"
            title="Edit title and description"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <div className="pointer-events-auto absolute right-3 top-0 flex items-center gap-1">
            <button type="button" onClick={requestCustomize} className="flex h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold text-white transition hover:bg-white/10">
              <Palette className="h-4 w-4" /> Customize
            </button>
            <button type="button" onClick={() => setNewConfirmOpen(true)} className="flex h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold text-white transition hover:bg-white/10">
              <FilePlus2 className="h-4 w-4" /> New
            </button>
            <button type="button" onClick={() => openFileInputRef.current?.click()} className="flex h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold text-white transition hover:bg-white/10">
              <FolderOpen className="h-4 w-4" /> Open
            </button>
            <div className="relative">
              <button type="button" onClick={() => setSaveMenuOpen((value) => !value)} className="flex h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold text-white transition hover:bg-white/10">
                <Save className="h-4 w-4" /> Save <ChevronDown className={`h-3.5 w-3.5 transition-transform ${saveMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {saveMenuOpen && (
                <div className="absolute right-0 top-11 z-[300] w-36 overflow-hidden rounded-md border border-white/10 bg-[#181818] p-1 shadow-2xl">
                  <button type="button" onClick={() => saveWheelFile("wheel")} className="flex h-9 w-full items-center rounded-md px-3 text-left text-xs font-semibold text-white hover:bg-white/10">Save .wheel</button>
                  <button type="button" onClick={() => saveWheelFile("json")} className="flex h-9 w-full items-center rounded-md px-3 text-left text-xs font-semibold text-white hover:bg-white/10">Save .json</button>
                </div>
              )}
            </div>
            <button type="button" onClick={openShareDialog} className="flex h-10 items-center gap-2 rounded-md px-3 text-xs font-semibold text-white transition hover:bg-white/10">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>

          <input ref={openFileInputRef} type="file" accept=".wheel,.json,application/json" className="hidden" onChange={openWheelFile} />
        </div>
        <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_35%_35%,rgba(33,70,82,0.42),transparent_45%),radial-gradient(circle_at_78%_25%,rgba(81,42,91,0.28),transparent_42%),linear-gradient(135deg,#07151b_0%,#080b0e_48%,#150b17_100%)]">
          <div
            className={`absolute inset-0 min-h-0 overflow-hidden pt-28 transition-[padding] duration-300 ${
              sidebarOpen ? "lg:pr-[500px]" : ""
            }`}
          >
            <div
              ref={wheelAreaRef}
              className="grid h-full min-h-0 w-full grid-rows-1 gap-x-2 overflow-visible p-2 lg:gap-x-3 lg:p-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, wheels.length)}, minmax(0, 1fr))`,
              }}
            >
              {wheels.map((wheel) => (
                <div
                  key={wheel.id}
                  className="relative flex min-h-0 min-w-0 items-center justify-center overflow-visible bg-transparent"
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
          customizeRequest={customizeRequest}
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
          className={`absolute top-[64px] z-[260] hidden h-12 w-9 items-center justify-center rounded-l-lg border border-r-0 border-white/10 bg-[#111318]/95 text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-[right] duration-300 hover:bg-[#181b22] lg:flex ${sidebarOpen ? "right-[468px]" : "right-0"}`}
        >
          <span className="relative flex h-7 w-5 items-center justify-center">
            <span className="absolute inset-0 translate-x-[2px] translate-y-[2px] text-black/70">{sidebarOpen ? "›" : "‹"}</span>
            <span className="relative text-[26px] font-bold leading-none text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{sidebarOpen ? "›" : "‹"}</span>
          </span>
        </button>

        {/*
         * Wheel of Names-style background winner animation.
         *
         * It sits below the winner dialog (z-500) and above the wheel
         * content. The text starts small, grows very large, and fades
         * away. It is completely disabled unless the per-wheel setting
         * "Animate winning entry" is enabled.
         */}
        {newConfirmOpen && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewConfirmOpen(false) }}>
            <div role="dialog" aria-modal="true" className="w-full max-w-[460px] overflow-hidden rounded-xl border border-white/10 bg-[#191919] shadow-[0_20px_70px_rgba(0,0,0,0.7)]">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-base font-semibold text-white">Start a new wheel?</h2>
                <p className="mt-1 text-sm text-white/55">This will replace your current wheels, entries, and results.</p>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4">
                <button type="button" onClick={() => setNewConfirmOpen(false)} className="h-9 rounded-md px-4 text-xs font-semibold text-white/75 transition hover:bg-white/10">Cancel</button>
                <button type="button" onClick={() => { setNewConfirmOpen(false); resetToNewWheel() }} className="h-9 rounded-md bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500">New wheel</button>
              </div>
            </div>
          </div>
        )}

        {titleDialogOpen && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setTitleDialogOpen(false) }}>
            <div role="dialog" aria-modal="true" className="w-full max-w-[580px] overflow-hidden rounded-xl border border-white/10 bg-[#191919] shadow-[0_20px_70px_rgba(0,0,0,0.7)]">
              <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
                <Pencil className="h-4 w-4 text-white/80" />
                <h2 className="text-base font-semibold text-white">Edit title and description</h2>
                <button type="button" onClick={() => setTitleDialogOpen(false)} className="ml-auto rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div><label className="mb-1.5 block text-xs font-semibold text-white/70">Wheel title</label><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-[#2b2b2b] px-3 text-sm text-white outline-none focus:border-blue-500" /></div>
                <div><label className="mb-1.5 block text-xs font-semibold text-white/70">Wheel description</label><textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} rows={4} className="w-full resize-none rounded-md border border-white/10 bg-[#2b2b2b] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" /></div>
              </div>
              <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
                <button type="button" onClick={() => setTitleDialogOpen(false)} className="h-9 rounded-md px-4 text-xs font-semibold text-white/75 hover:bg-white/10">Cancel</button>
                <button type="button" onClick={() => { setWheelTitle(draftTitle.trim() || "Spin Wheel"); setWheelDescription(draftDescription.trim()); setTitleDialogOpen(false) }} className="h-9 rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500">OK</button>
              </div>
            </div>
          </div>
        )}

        {shareDialogOpen && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareDialogOpen(false) }}>
            <div role="dialog" aria-modal="true" className="w-full max-w-[620px] overflow-hidden rounded-xl border border-white/10 bg-[#191919] shadow-[0_20px_70px_rgba(0,0,0,0.7)]">
              <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4"><Share2 className="h-4 w-4 text-white/80" /><h2 className="text-base font-semibold text-white">Share wheel</h2><button type="button" onClick={() => setShareDialogOpen(false)} className="ml-auto rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>
              <div className="space-y-3 px-5 py-5"><p className="text-sm text-white/55">Anyone with this link can open the wheel with the same settings.</p><input readOnly value={createShareLink()} className="h-10 w-full rounded-md border border-white/10 bg-[#2b2b2b] px-3 text-xs text-white/75 outline-none" /></div>
              <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4"><button type="button" onClick={() => setShareDialogOpen(false)} className="h-9 rounded-md px-4 text-xs font-semibold text-white/75 hover:bg-white/10">Close</button><button type="button" onClick={() => void copyShareLink()} className="h-9 rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500">{shareCopied ? "Copied" : "Copy link"}</button></div>
            </div>
          </div>
        )}

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
