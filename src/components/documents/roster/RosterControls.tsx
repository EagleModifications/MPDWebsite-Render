import {
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  Filter,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

type FilterOption = {
  id: string
  label: string
}

type FilterDropdownProps = {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
  icon?: typeof Filter
}

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  icon: Icon = Filter,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", close)
    return () =>
      document.removeEventListener("mousedown", close)
  }, [])

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    )
  }

  return (
    <div
      ref={ref}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 text-sm font-medium text-foreground transition-colors hover:border-blue-500/40"
      >
        <Icon className="h-4 w-4 text-blue-500" />
        <span>{label}</span>
        <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[11px] text-blue-400">
          {selected.length || "All"}
        </span>
        <ChevronDown
          className={[
            "h-3.5 w-3.5 text-blue-500 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[210px] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="max-h-72 overflow-y-auto p-1.5">
            {options.map((option) => {
              const checked = selected.includes(option.id)

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                >
                  <span
                    className={[
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-border bg-background",
                    ].join(" ")}
                  >
                    {checked && (
                      <Check className="h-3 w-3" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>

          {selected.length > 0 && (
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear {label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-border/70 bg-background/70 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-blue-500/50"
      />
    </div>
  )
}

export function CopyButton({
  value,
  label,
}: {
  value: string
  label?: string
}) {
  const copy = async () => {
    if (!value) return

    await navigator.clipboard.writeText(value)
    toast.success(
      label ? `${label} copied` : "Copied",
    )
  }

  return (
    <button
      type="button"
      disabled={!value}
      onClick={copy}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-blue-500 transition-colors hover:bg-blue-500/10 disabled:cursor-default disabled:opacity-40"
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  )
}

type CopyMenuProps = {
  items: Array<{
    label: string
    value: string
  }>
}

export function CopyMenu({ items }: CopyMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", close)
    return () =>
      document.removeEventListener("mousedown", close)
  }, [])

  const copy = async (label: string, value: string) => {
    if (!value) return

    await navigator.clipboard.writeText(value)
    setOpen(false)
    toast.success(`${label} copied`)
  }

  return (
    <div
      ref={ref}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-background/70 px-2 text-[11px] font-medium text-foreground hover:border-blue-500/40"
      >
        <Copy className="h-3 w-3 text-blue-500" />
        <span>Copy</span>
        <ChevronDown className="h-3 w-3 text-blue-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+5px)] z-50 min-w-[190px] overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={!item.value}
              onClick={() => void copy(item.label, item.value)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-muted disabled:cursor-default disabled:opacity-40"
            >
              <Clipboard className="h-3.5 w-3.5 text-blue-500" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
