import {
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  History,
  Maximize2,
  Plus,
  RotateCcw,
  Settings2,
  Shuffle,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Footer from "@/components/Footer"
import Navbar from "@/components/home/Navbar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const WHEEL_ORIGIN = "https://wheelofnames.com"

const DEFAULT_ENTRIES = [
  "Officer 1",
  "Officer 2",
  "Officer 3",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Master Sergeant",
  "2nd Lieutenant",
  "1st Lieutenant",
  "Captain",
  "Major",
  "Lieutenant Colonel",
  "Colonel",
  "Chief Of Staff",
  "Assistant Chief",
  "Deputy Chief",
  "Chief",
]

type HistoryEntry = {
  id: number
  winner: string
  timestamp: string
}

type WheelSettings = {
  spinTime: number
  confetti: boolean
  winnerDialog: boolean
  centerSize:
    | "XS"
    | "S"
    | "M"
    | "L"
    | "XL"
    | "XXL"
}

type AnimateResponse = {
  success?: boolean
  animation?: string
  imageFormat?: "gif" | "webp"
  winner?: string | null
  error?: string
}

function normalizeEntries(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getInitialEntries() {
  const params = new URLSearchParams(
    window.location.search,
  )

  const encoded = params.get("entries")

  if (encoded) {
    const parsed = normalizeEntries(encoded)

    if (parsed.length >= 2) {
      return parsed
    }
  }

  try {
    const saved = localStorage.getItem(
      "mpd-spin-wheel",
    )

    if (saved) {
      const parsed = JSON.parse(saved) as {
        entries?: unknown
      }

      if (
        Array.isArray(parsed.entries) &&
        parsed.entries.every(
          (entry) => typeof entry === "string",
        ) &&
        parsed.entries.length >= 2
      ) {
        return parsed.entries
      }
    }
  } catch {
    // Ignore invalid local storage.
  }

  return DEFAULT_ENTRIES
}

function getInitialSettings(): WheelSettings {
  try {
    const saved = localStorage.getItem(
      "mpd-spin-wheel-settings",
    )

    if (saved) {
      const parsed =
        JSON.parse(saved) as Partial<WheelSettings>

      return {
        spinTime:
          typeof parsed.spinTime === "number"
            ? Math.min(
                30,
                Math.max(1, parsed.spinTime),
              )
            : 5,

        confetti:
          typeof parsed.confetti === "boolean"
            ? parsed.confetti
            : true,

        winnerDialog:
          typeof parsed.winnerDialog === "boolean"
            ? parsed.winnerDialog
            : true,

        centerSize:
          parsed.centerSize === "XS" ||
          parsed.centerSize === "S" ||
          parsed.centerSize === "M" ||
          parsed.centerSize === "L" ||
          parsed.centerSize === "XL" ||
          parsed.centerSize === "XXL"
            ? parsed.centerSize
            : "M",
      }
    }
  } catch {
    // Ignore invalid local storage.
  }

  return {
    spinTime: 5,
    confetti: true,
    winnerDialog: true,
    centerSize: "M",
  }
}

function getInitialHistory(): HistoryEntry[] {
  try {
    const saved = localStorage.getItem(
      "mpd-spin-wheel-history",
    )

    if (!saved) return []

    const parsed = JSON.parse(saved)

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function buildWheelUrl(
  entries: string[],
  settings: WheelSettings,
) {
  const params = new URLSearchParams()

  params.set(
    "entries",
    entries.join(","),
  )

  params.set(
    "spinTime",
    String(settings.spinTime),
  )

  params.set(
    "confetti",
    String(settings.confetti),
  )

  params.set(
    "displayWinnerDialog",
    "false",
  )

  params.set(
    "hideOverlayText",
    "true",
  )

  params.set(
    "centerSize",
    settings.centerSize,
  )

  params.set(
    "removeBackground",
    "true",
  )

  return `${WHEEL_ORIGIN}/view?${params.toString()}`
}

export default function SpinWheel() {
  const [entries, setEntries] =
    useState<string[]>(getInitialEntries)

  const [draft, setDraft] =
    useState(() =>
      getInitialEntries().join("\n"),
    )

  const [settings, setSettings] =
    useState<WheelSettings>(
      getInitialSettings,
    )

  const [history, setHistory] =
    useState<HistoryEntry[]>(
      getInitialHistory,
    )

  const [animation, setAnimation] =
    useState<string | null>(null)

  const [animationFormat, setAnimationFormat] =
    useState<"gif" | "webp">("webp")

  const [winner, setWinner] =
    useState<string | null>(null)

  const [spinning, setSpinning] =
    useState(false)

  const [showWinner, setShowWinner] =
    useState(false)

  const [showSettings, setShowSettings] =
    useState(false)

  const [showHistory, setShowHistory] =
    useState(false)

  const [removeWinner, setRemoveWinner] =
    useState(false)

  const [showEntries, setShowEntries] =
    useState(true)

  const [fullscreen, setFullscreen] =
    useState(false)

  const wheelUrl = useMemo(
    () =>
      buildWheelUrl(
        entries,
        settings,
      ),
    [entries, settings],
  )

  useEffect(() => {
    localStorage.setItem(
      "mpd-spin-wheel",
      JSON.stringify({
        entries,
      }),
    )
  }, [entries])

  useEffect(() => {
    localStorage.setItem(
      "mpd-spin-wheel-settings",
      JSON.stringify(settings),
    )
  }, [settings])

  useEffect(() => {
    localStorage.setItem(
      "mpd-spin-wheel-history",
      JSON.stringify(history),
    )
  }, [history])

  useEffect(() => {
    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Enter" &&
        (event.ctrlKey ||
          event.metaKey)
      ) {
        event.preventDefault()

        void spin()
      }
    }

    window.addEventListener(
      "keydown",
      onKeyDown,
    )

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown,
      )
  })

  const updateEntries = () => {
    const next =
      normalizeEntries(draft)

    if (next.length < 2) {
      toast.error(
        "Add at least two entries before using the wheel.",
      )

      return
    }

    setEntries(next)
    setAnimation(null)
    setWinner(null)

    const params =
      new URLSearchParams(
        window.location.search,
      )

    params.set(
      "entries",
      next.join(","),
    )

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    )

    toast.success(
      `${next.length} entries loaded onto the wheel.`,
    )
  }

  const shuffleEntries = () => {
    const shuffled = [...entries]

    for (
      let index =
        shuffled.length - 1;
      index > 0;
      index -= 1
    ) {
      const random =
        crypto.getRandomValues(
          new Uint32Array(1),
        )[0] %
        (index + 1)

      ;[
        shuffled[index],
        shuffled[random],
      ] = [
        shuffled[random],
        shuffled[index],
      ]
    }

    setEntries(shuffled)
    setDraft(
      shuffled.join("\n"),
    )
    setAnimation(null)
    setWinner(null)

    toast.success(
      "Entries shuffled.",
    )
  }

  const sortEntries = () => {
    const sorted =
      [...entries].sort(
        (a, b) =>
          a.localeCompare(
            b,
            undefined,
            {
              numeric: true,
            },
          ),
      )

    setEntries(sorted)
    setDraft(
      sorted.join("\n"),
    )
    setAnimation(null)
    setWinner(null)

    toast.success(
      "Entries sorted.",
    )
  }

  const addEntry = () => {
    const next = [
      ...entries,
      `Entry ${entries.length + 1}`,
    ]

    setEntries(next)
    setDraft(
      next.join("\n"),
    )
  }

  const clearEntries = () => {
    setEntries([])
    setDraft("")
    setAnimation(null)
    setWinner(null)
  }

  const resetWheel = () => {
    setEntries(
      DEFAULT_ENTRIES,
    )

    setDraft(
      DEFAULT_ENTRIES.join("\n"),
    )

    setSettings({
      spinTime: 5,
      confetti: true,
      winnerDialog: true,
      centerSize: "M",
    })

    setRemoveWinner(false)
    setAnimation(null)
    setWinner(null)

    toast.success(
      "Wheel reset.",
    )
  }

  const spin = async () => {
    if (spinning) return

    if (entries.length < 2) {
      toast.error(
        "Add at least two entries before spinning.",
      )

      return
    }

    setSpinning(true)
    setShowWinner(false)
    setWinner(null)
    setAnimation(null)

    try {
      const response =
        await fetch(
          "/api/spin-wheel/animate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              entries,
              spinTime:
                settings.spinTime,
              maxNames: Math.min(
                120,
                entries.length,
              ),
              imageFormat:
                "webp",
            }),
          },
        )

      const data =
        (await response.json()) as AnimateResponse

      if (
        !response.ok ||
        !data.success ||
        !data.animation
      ) {
        throw new Error(
          data.error ||
            "Wheel of Names failed to create the spin.",
        )
      }

      const format =
        data.imageFormat ===
        "gif"
          ? "gif"
          : "webp"

      setAnimationFormat(
        format,
      )

      setAnimation(
        `data:image/${format};base64,${data.animation}`,
      )

      setWinner(
        data.winner ?? null,
      )

      if (data.winner) {
        setHistory(
          (current) => [
            {
              id: Date.now(),
              winner:
                data.winner as string,
              timestamp:
                new Date().toLocaleString(),
            },
            ...current,
          ],
        )
      }

      if (
        removeWinner &&
        data.winner
      ) {
        const next =
          entries.filter(
            (entry) =>
              entry !==
              data.winner,
          )

        setTimeout(
          () => {
            setEntries(next)
            setDraft(
              next.join("\n"),
            )
          },
          settings.spinTime *
            1000 +
            250,
        )
      }

      if (
        data.winner &&
        settings.winnerDialog
      ) {
        setTimeout(
          () =>
            setShowWinner(
              true,
            ),
          settings.spinTime *
            1000,
        )
      }
    } catch (error) {
      console.error(
        "Spin wheel request failed:",
        error,
      )

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to spin the wheel.",
      )

      setAnimation(null)
      setWinner(null)
    } finally {
      setSpinning(false)
    }
  }

  const copyShareLink =
    async () => {
      const url =
        `${window.location.origin}/spin-wheel?entries=` +
        encodeURIComponent(
          entries.join(","),
        )

      try {
        await navigator.clipboard.writeText(
          url,
        )

        toast.success(
          "Wheel link copied to clipboard.",
        )
      } catch {
        toast.error(
          "Unable to copy the wheel link.",
        )
      }
    }

  const openWheelOfNames =
    () => {
      window.open(
        wheelUrl,
        "_blank",
        "noopener,noreferrer",
      )
    }

  const downloadAnimation =
    () => {
      if (!animation) {
        toast.error(
          "Spin the wheel first.",
        )

        return
      }

      const link =
        document.createElement(
          "a",
        )

      link.href = animation

      link.download =
        `mpd-wheel-spin.${animationFormat}`

      document.body.appendChild(
        link,
      )

      link.click()

      link.remove()
    }

  const clearHistory = () => {
    setHistory([])

    toast.success(
      "Spin history cleared.",
    )
  }

  const toggleFullscreen =
    async () => {
      try {
        if (
          !document.fullscreenElement
        ) {
          await document.documentElement.requestFullscreen?.()

          setFullscreen(
            true,
          )
        } else {
          await document.exitFullscreen?.()

          setFullscreen(
            false,
          )
        }
      } catch {
        toast.error(
          "Fullscreen is not available in this browser.",
        )
      }
    }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white shadow-lg shadow-blue-600/20">
              MPD
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Spin the Wheel
              </h1>

              <p className="text-sm text-muted-foreground">
                Randomly select an officer,
                assignment, or entry.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={
                copyShareLink
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Share
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                setShowHistory(
                  true,
                )
              }
            >
              <History className="mr-2 h-4 w-4" />
              History

              {history.length >
                0 && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {history.length}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                setShowSettings(
                  true,
                )
              }
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Customize
            </Button>

            <Button
              variant="outline"
              onClick={
                openWheelOfNames
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Wheel of Names
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="overflow-hidden">
            <CardContent className="relative p-0">
              <div
                className={[
                  "relative min-h-[650px] overflow-hidden",
                  "bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.10),transparent_58%)]",
                  fullscreen
                    ? "fixed inset-0 z-[100] min-h-screen rounded-none bg-background p-6"
                    : "",
                ].join(" ")}
              >
                <div className="absolute right-4 top-4 z-20">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={
                      toggleFullscreen
                    }
                    title={
                      fullscreen
                        ? "Exit fullscreen"
                        : "Fullscreen"
                    }
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex min-h-[650px] items-center justify-center p-6">
                  <div className="relative aspect-square w-full max-w-[720px] overflow-hidden rounded-full">
                    <iframe
                      src={wheelUrl}
                      title="Wheel of Names"
                      className="pointer-events-none absolute inset-0 h-full w-full border-0"
                    />

                    {animation && (
                      <img
                        src={animation}
                        alt={
                          winner
                            ? `Wheel spinning to ${winner}`
                            : "Wheel spinning"
                        }
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    )}

                    {!animation && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-background/80 px-4 py-2 text-center text-xs font-medium text-muted-foreground shadow-lg backdrop-blur">
                          Press Spin to use the
                          Wheel of Names API
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
                  <Button
                    size="lg"
                    disabled={
                      spinning ||
                      entries.length < 2
                    }
                    onClick={() =>
                      void spin()
                    }
                    className="h-12 min-w-[170px] rounded-full bg-blue-600 px-8 text-base font-bold text-white shadow-xl shadow-blue-600/25 hover:bg-blue-700"
                  >
                    <Trophy className="mr-2 h-5 w-5" />

                    {spinning
                      ? "Spinning..."
                      : "Spin"}
                  </Button>
                </div>

                <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">
                  Click Spin or press Ctrl + Enter
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden">
              <CardHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Entries
                    </CardTitle>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {entries.length}{" "}
                      {entries.length === 1
                        ? "entry"
                        : "entries"}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={
                        addEntry
                      }
                      title="Add entry"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={
                        clearEntries
                      }
                      title="Clear entries"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setShowEntries(
                          (value) =>
                            !value,
                        )
                      }
                      title={
                        showEntries
                          ? "Collapse"
                          : "Expand"
                      }
                    >
                      <ChevronDown
                        className={[
                          "h-4 w-4 transition-transform",
                          showEntries
                            ? "rotate-180"
                            : "",
                        ].join(" ")}
                      />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {showEntries && (
                <CardContent className="space-y-3 p-4">
                  <Textarea
                    value={draft}
                    onChange={(
                      event,
                    ) =>
                      setDraft(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Enter one entry per line..."
                    className="min-h-[300px] resize-none font-mono text-sm"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      onClick={
                        shuffleEntries
                      }
                    >
                      <Shuffle className="mr-2 h-4 w-4" />
                      Shuffle
                    </Button>

                    <Button
                      variant="outline"
                      onClick={
                        updateEntries
                      }
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Apply
                    </Button>

                    <Button
                      variant="outline"
                      onClick={
                        resetWheel
                      }
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={
                      sortEntries
                    }
                  >
                    Sort entries
                  </Button>
                </CardContent>
              )}
            </Card>

            {winner &&
              !spinning && (
                <Card className="border-blue-500/30 bg-blue-500/[0.03]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                      Latest Winner
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="break-words text-2xl font-bold">
                      {winner}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={
                          downloadAnimation
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Save Spin
                      </Button>

                      <Button
                        onClick={() =>
                          setShowWinner(
                            true,
                          )
                        }
                      >
                        View Winner
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Wheel Settings
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <Button
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() =>
                    void spin()
                  }
                  disabled={
                    spinning ||
                    entries.length < 2
                  }
                >
                  <Trophy className="mr-2 h-4 w-4" />

                  {spinning
                    ? "Spinning..."
                    : "Spin Wheel"}
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    setShowSettings(
                      true,
                    )
                  }
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Customize
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      <Dialog
        open={
          showWinner &&
          Boolean(winner) &&
          !spinning &&
          settings.winnerDialog
        }
        onOpenChange={
          setShowWinner
        }
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Winner
            </DialogTitle>

            <DialogDescription>
              The Wheel of Names API selected:
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border bg-muted/40 px-6 py-10 text-center">
            <Trophy className="mx-auto mb-4 h-10 w-10 text-blue-600" />

            <p className="break-words text-3xl font-bold tracking-tight">
              {winner}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setShowWinner(
                  false,
                )
              }
            >
              Close
            </Button>

            <Button
              onClick={() => {
                setShowWinner(
                  false,
                )

                void spin()
              }}
            >
              Spin Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showSettings}
        onOpenChange={
          setShowSettings
        }
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              Customize Wheel
            </DialogTitle>

            <DialogDescription>
              These settings are sent to the
              Wheel of Names API for each spin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <Label>
                Spin time
              </Label>

              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={
                    settings.spinTime
                  }
                  onChange={(
                    event,
                  ) =>
                    setSettings(
                      (current) => ({
                        ...current,
                        spinTime:
                          Math.min(
                            30,
                            Math.max(
                              1,
                              Number(
                                event
                                  .target
                                  .value,
                              ) || 1,
                            ),
                          ),
                      }),
                    )
                  }
                />

                <span className="text-sm text-muted-foreground">
                  seconds
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                Center size
              </Label>

              <div className="grid grid-cols-6 gap-2">
                {(
                  [
                    "XS",
                    "S",
                    "M",
                    "L",
                    "XL",
                    "XXL",
                  ] as const
                ).map(
                  (size) => (
                    <Button
                      key={size}
                      type="button"
                      variant={
                        settings.centerSize ===
                        size
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setSettings(
                          (
                            current,
                          ) => ({
                            ...current,
                            centerSize:
                              size,
                          }),
                        )
                      }
                    >
                      {size}
                    </Button>
                  ),
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  Confetti
                </p>

                <p className="text-xs text-muted-foreground">
                  Enable the Wheel of Names winner celebration.
                </p>
              </div>

              <Switch
                checked={
                  settings.confetti
                }
                onCheckedChange={(
                  checked,
                ) =>
                  setSettings(
                    (
                      current,
                    ) => ({
                      ...current,
                      confetti:
                        checked,
                    }),
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  Winner dialog
                </p>

                <p className="text-xs text-muted-foreground">
                  Show the MPD winner popup after a spin.
                </p>
              </div>

              <Switch
                checked={
                  settings.winnerDialog
                }
                onCheckedChange={(
                  checked,
                ) =>
                  setSettings(
                    (
                      current,
                    ) => ({
                      ...current,
                      winnerDialog:
                        checked,
                    }),
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  Remove winner
                </p>

                <p className="text-xs text-muted-foreground">
                  Remove the selected entry from the next spin.
                </p>
              </div>

              <Switch
                checked={
                  removeWinner
                }
                onCheckedChange={
                  setRemoveWinner
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setShowSettings(
                  false,
                )
              }
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showHistory}
        onOpenChange={
          setShowHistory
        }
      >
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>
              Spin History
            </DialogTitle>

            <DialogDescription>
              Winners selected by the Wheel of Names API.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[450px] overflow-y-auto">
            {history.length ===
            0 ? (
              <div className="py-12 text-center">
                <History className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                <p className="font-medium">
                  No spins yet
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Your winners will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-600">
                          {index +
                            1}
                        </div>

                        <div>
                          <p className="font-medium">
                            {
                              item.winner
                            }
                          </p>

                          <p className="text-xs text-muted-foreground">
                            {
                              item.timestamp
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {history.length >
              0 && (
              <Button
                variant="destructive"
                onClick={
                  clearHistory
                }
              >
                Clear History
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() =>
                setShowHistory(
                  false,
                )
              }
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {fullscreen && (
        <Button
          variant="secondary"
          className="fixed bottom-6 right-6 z-[110]"
          onClick={
            toggleFullscreen
          }
        >
          <X className="mr-2 h-4 w-4" />
          Exit Fullscreen
        </Button>
      )}
    </div>
  )
}
