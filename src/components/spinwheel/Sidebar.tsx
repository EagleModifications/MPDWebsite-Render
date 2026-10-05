import { useState } from "react"
import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import type { SpinWheelItem } from "./Wheel"

type SpinWheelSidebarProps = {
  items: SpinWheelItem[]
  onChange: (items: SpinWheelItem[]) => void
}

const COLORS = [
  "#3b82f6",
  "#64748b",
  "#0ea5e9",
  "#334155",
  "#60a5fa",
  "#94a3b8",
]

export default function SpinWheelSidebar({
  items,
  onChange,
}: SpinWheelSidebarProps) {
  const [value, setValue] = useState("")

  const addEntry = () => {
    const label = value.trim()

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

    setValue("")
  }

  const updateEntry = (id: string, label: string) => {
    onChange(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              label,
            }
          : item,
      ),
    )
  }

  const removeEntry = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const clearEntries = () => {
    onChange([])
  }

  return (
    <aside className="flex min-h-[620px] w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur lg:min-h-0 lg:w-[380px] xl:w-[410px]">
      <div className="border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold text-blue-500">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          WHEEL
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Entries</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add the names or options you want on the wheel.
            </p>
          </div>

          {items.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={clearEntries}
              aria-label="Clear entries"
              title="Clear entries"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-border/70 p-4">
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addEntry()
              }
            }}
            placeholder="Add an entry..."
            className="h-10"
          />

          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={addEntry}
            aria-label="Add entry"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/30 p-6 text-center">
            <div>
              <p className="text-sm font-medium">No entries yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Add your first entry above. It will appear on the wheel
                immediately.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="group flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 p-2 transition-colors hover:border-blue-500/30 hover:bg-muted/30"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />

                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      item.color ?? COLORS[index % COLORS.length],
                  }}
                />

                <Input
                  value={item.label}
                  onChange={(event) =>
                    updateEntry(item.id, event.target.value)
                  }
                  className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  aria-label={`Entry ${index + 1}`}
                />

                <button
                  type="button"
                  onClick={() => removeEntry(item.id)}
                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-destructive group-hover:opacity-100"
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {items.length} {items.length === 1 ? "entry" : "entries"}
          </span>

          <button
            type="button"
            onClick={clearEntries}
            disabled={!items.length}
            className="inline-flex items-center gap-1.5 font-medium text-foreground/70 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>
    </aside>
  )
}
