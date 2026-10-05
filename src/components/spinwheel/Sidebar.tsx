import { useRef, useState, type ChangeEvent } from "react"
import {
  ArrowUpDown,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Plus,
  Shuffle,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import type { SpinWheelItem } from "./Wheel"

type SidebarProps = {
  open: boolean
  items: SpinWheelItem[]
  results: string[]
  onChange: (items: SpinWheelItem[]) => void
  onClearResults: () => void
}

type Tab = "entries" | "results"

const COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
]

export default function Sidebar({
  open,
  items,
  results,
  onChange,
  onClearResults,
}: SidebarProps) {
  const [tab, setTab] = useState<Tab>("entries")
  const [advanced, setAdvanced] = useState(false)
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const [quickValue, setQuickValue] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const updateFromText = (text: string) => {
    const labels = text
      .split(/\r?\n/)
      .map((label) => label.trim())
      .filter(Boolean)

    onChange(
      labels.map((label, index) => ({
        id: items[index]?.id ?? crypto.randomUUID(),
        label,
        color:
          items[index]?.color ??
          COLORS[index % COLORS.length],
        weight: items[index]?.weight ?? 1,
      })),
    )
  }

  const shuffleEntries = () => {
    const shuffled = [...items]

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1))

      ;[shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ]
    }

    onChange(shuffled)
  }

  const sortEntries = () => {
    onChange(
      [...items].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          sensitivity: "base",
        }),
      ),
    )
  }

  const addEntry = () => {
    const label = quickValue.trim()

    if (!label) {
      return
    }

    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        label,
        color: COLORS[items.length % COLORS.length],
      },
    ])

    setQuickValue("")
  }

  const clearEntries = () => {
    onChange([])
  }

  const handleImageFiles = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? [])

    if (!files.length) {
      return
    }

    const imageEntries = files.map((file, index) => ({
      id: crypto.randomUUID(),
      label: file.name.replace(/\.[^/.]+$/, ""),
      color: COLORS[(items.length + index) % COLORS.length],
    }))

    onChange([...items, ...imageEntries])
    event.target.value = ""
    setImageMenuOpen(false)
  }

  const exportResults = () => {
    if (!results.length) {
      return
    }

    const blob = new Blob([results.join("\n")], {
      type: "text/plain;charset=utf-8",
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = "spin-wheel-results.txt"
    anchor.click()

    URL.revokeObjectURL(url)
  }

  return (
    <aside
      className={`absolute left-0 top-0 z-50 h-full w-[468px] max-w-[calc(100vw-8px)] border-r border-border/80 bg-[#171717]/[0.98] shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-11 shrink-0 items-end border-b border-border/80">
          <button
            type="button"
            onClick={() => setTab("entries")}
            className={`flex h-11 items-center gap-1.5 border-b-2 px-4 text-sm font-bold transition ${
              tab === "entries"
                ? "border-blue-400 text-white"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            Entries
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold leading-none text-foreground">
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("results")}
            className={`flex h-11 items-center gap-1.5 border-b-2 px-4 text-sm font-bold transition ${
              tab === "results"
                ? "border-blue-400 text-white"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            Results
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold leading-none text-foreground">
              {results.length}
            </span>
          </button>
        </div>

        {tab === "entries" ? (
          <>
            <div className="flex shrink-0 items-center gap-2 px-4 py-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={shuffleEntries}
                disabled={items.length < 2}
                className="h-8 gap-1.5 rounded-sm bg-[#41416b] px-3 text-xs font-bold text-white hover:bg-[#4d4d7d]"
              >
                <Shuffle className="h-4 w-4" />
                Shuffle
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={sortEntries}
                disabled={items.length < 2}
                className="h-8 gap-1.5 rounded-sm bg-[#41416b] px-3 text-xs font-bold text-white hover:bg-[#4d4d7d]"
              >
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </Button>

              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setImageMenuOpen((value) => !value)}
                  className="h-8 gap-1.5 rounded-sm bg-[#41416b] px-3 text-xs font-bold text-white hover:bg-[#4d4d7d]"
                >
                  <ImageIcon className="h-4 w-4" />
                  Add image
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      imageMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>

                {imageMenuOpen && (
                  <div className="absolute left-0 top-10 z-[80] w-48 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-muted"
                    >
                      <Upload className="h-4 w-4" />
                      Upload images
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageFiles}
                />
              </div>

              <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs font-semibold text-white">
                <input
                  type="checkbox"
                  checked={advanced}
                  onChange={(event) =>
                    setAdvanced(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-border accent-blue-500"
                />
                Advanced
              </label>
            </div>

            {advanced && (
              <div className="mx-4 mb-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                Advanced wheel settings can be added here.
              </div>
            )}

            <div className="min-h-0 flex-1 px-4 pb-4">
              <textarea
                value={items.map((item) => item.label).join("\n")}
                onChange={(event) => updateFromText(event.target.value)}
                placeholder="Enter one entry per line..."
                spellCheck={false}
                className="h-full min-h-[280px] w-full resize-none rounded-md border border-border bg-[#1d1d1d] p-2 text-sm leading-[22px] text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            <div className="shrink-0 border-t border-border/80 p-4">
              <div className="mb-3 flex gap-2">
                <Input
                  value={quickValue}
                  onChange={(event) =>
                    setQuickValue(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addEntry()
                    }
                  }}
                  placeholder="Add an entry..."
                  className="h-10 border-border bg-[#1d1d1d]"
                />

                <Button
                  type="button"
                  onClick={addEntry}
                  className="h-10 shrink-0 gap-1.5 bg-[#41416b] px-4 font-bold text-white hover:bg-[#4d4d7d]"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              <Button
                type="button"
                onClick={clearEntries}
                className="h-10 gap-2 rounded-sm bg-[#41416b] px-4 font-bold text-white hover:bg-[#4d4d7d]"
              >
                <Plus className="h-5 w-5" />
                Add wheel
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 px-4 py-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={results.length < 2}
                className="h-8 gap-1.5 rounded-sm bg-[#414141] px-3 text-xs font-bold text-white hover:bg-[#505050]"
              >
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClearResults}
                disabled={!results.length}
                className="h-8 gap-1.5 rounded-sm bg-[#414141] px-3 text-xs font-bold text-white hover:bg-[#505050]"
              >
                <X className="h-4 w-4" />
                Clear the list
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={exportResults}
                disabled={!results.length}
                className="h-8 gap-1.5 rounded-sm bg-[#414141] px-3 text-xs font-bold text-white hover:bg-[#505050]"
              >
                <Download className="h-4 w-4" />
                Export results
              </Button>
            </div>

            <div className="min-h-0 flex-1 px-4 pb-4">
              <div className="h-full min-h-[280px] overflow-y-auto rounded-md border border-border bg-[#1d1d1d] p-2">
                {results.map((result, index) => (
                  <div
                    key={`${result}-${index}`}
                    className="rounded px-1 text-sm leading-[22px] text-white"
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
