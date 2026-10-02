import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ExternalLink,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import Navbar from "@/components/home/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type EventCategory =
  | "Activities"
  | "Patrol"
  | "Operations"
  | "Meetings"

type CalendarEvent = {
  id: string
  title: string
  description: string
  category: EventCategory
  date: string
  startTime: string
  endTime: string
  location: string
  discordUrl: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

type EventForm = {
  title: string
  description: string
  category: EventCategory
  date: string
  startTime: string
  endTime: string
  location: string
  discordUrl: string
}

const EVENT_CATEGORIES: EventCategory[] = [
  "Activities",
  "Patrol",
  "Operations",
  "Meetings",
]

const CATEGORY_FILTERS: Array<"All" | EventCategory> = [
  "All",
  ...EVENT_CATEGORIES,
]

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

const HOURS = Array.from(
  { length: 12 },
  (_, index) => String(index + 1).padStart(2, "0"),
)

const MINUTES = Array.from(
  { length: 60 },
  (_, index) => String(index).padStart(2, "0"),
)

const PERIODS = ["AM", "PM"] as const

type Period = (typeof PERIODS)[number]

const EMPTY_FORM: EventForm = {
  title: "",
  description: "",
  category: "Activities",
  date: "",
  startTime: "08:00",
  endTime: "09:00",
  location: "",
  discordUrl: "",
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number)

  return new Date(year, month - 1, day)
}

function formatLongDate(value: string) {
  return parseDateKey(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getCalendarDays(month: Date) {
  const firstDay = getMonthStart(month)
  const mondayIndex = (firstDay.getDay() + 6) % 7

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate()

  const totalCells =
    Math.ceil((mondayIndex + daysInMonth) / 7) * 7

  const days: Date[] = []

  for (let index = 0; index < totalCells; index += 1) {
    days.push(
      new Date(
        month.getFullYear(),
        month.getMonth(),
        1 - mondayIndex + index,
      ),
    )
  }

  return days
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function getCategoryClasses(category: EventCategory) {
  switch (category) {
    case "Activities":
      return "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-300"

    case "Patrol":
      return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300"

    case "Operations":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"

    case "Meetings":
      return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300"

    default:
      return "border-border bg-muted/60 text-muted-foreground"
  }
}

function getCategoryDotClasses(category: EventCategory) {
  switch (category) {
    case "Activities":
      return "bg-purple-500"

    case "Patrol":
      return "bg-blue-500"

    case "Operations":
      return "bg-emerald-500"

    case "Meetings":
      return "bg-amber-500"

    default:
      return "bg-muted-foreground"
  }
}

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(
      `${b.date} ${b.startTime}`,
    ),
  )
}

function parseTime(value: string) {
  const [hourString, minuteString] = value.split(":")

  const hour = Number(hourString)
  const minute = minuteString ?? "00"

  const period: Period = hour >= 12 ? "PM" : "AM"

  let displayHour = hour % 12

  if (displayHour === 0) {
    displayHour = 12
  }

  return {
    hour: String(displayHour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    period,
  }
}

function buildTime(
  hour: string,
  minute: string,
  period: Period,
) {
  let numericHour = Number(hour)

  if (period === "AM") {
    if (numericHour === 12) {
      numericHour = 0
    }
  } else if (numericHour !== 12) {
    numericHour += 12
  }

  return `${String(numericHour).padStart(2, "0")}:${String(
    Number(minute),
  ).padStart(2, "0")}`
}

/* -------------------------------------------------------------------------- */
/* Dropdown manager                                                           */
/* -------------------------------------------------------------------------- */

type DropdownContextValue = {
  openDropdown: string | null
  setOpenDropdown: (value: string | null) => void
}

const DropdownContext =
  createContext<DropdownContextValue | null>(null)

function DropdownProvider({
  children,
}: {
  children: ReactNode
}) {
  const [openDropdown, setOpenDropdown] =
    useState<string | null>(null)

  return (
    <DropdownContext.Provider
      value={{
        openDropdown,
        setOpenDropdown,
      }}
    >
      {children}
    </DropdownContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/* Custom dropdown                                                            */
/* -------------------------------------------------------------------------- */

function CustomSelect({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  renderOption,
}: {
  id: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  ariaLabel: string
  className?: string
  renderOption?: (
    option: string,
    selected: boolean,
  ) => ReactNode
}) {
  const dropdown = useContext(DropdownContext)

  if (!dropdown) {
    throw new Error(
      "CustomSelect must be used inside DropdownProvider.",
    )
  }

  const {
    openDropdown,
    setOpenDropdown,
  } = dropdown

  const open = openDropdown === id

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement

      if (
        !target.closest(
          `[data-custom-select="${id}"]`,
        )
      ) {
        setOpenDropdown(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdown(null)
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    )

    document.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      )

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [id, open, setOpenDropdown])

  return (
    <div
      className={["relative", className].join(" ")}
      data-custom-select={id}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() =>
          setOpenDropdown(open ? null : id)
        }
        className={[
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-all",
          "hover:border-blue-500/30 hover:bg-muted/40",
          "focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20",
          open
            ? "border-blue-500/50 ring-2 ring-blue-500/20"
            : "",
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2">
          {renderOption
            ? renderOption(value, true)
            : value}
        </span>

        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] max-h-60 overflow-y-auto rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          {options.map((option) => {
            const selected = option === value

            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option)
                  setOpenDropdown(null)
                }}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  selected
                    ? "bg-blue-500/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {renderOption
                    ? renderOption(option, selected)
                    : option}
                </span>

                {selected && (
                  <Check className="ml-3 h-4 w-4 shrink-0 text-blue-500" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Category selector                                                          */
/* -------------------------------------------------------------------------- */

function CategorySelect({
  value,
  onChange,
}: {
  value: EventCategory
  onChange: (value: EventCategory) => void
}) {
  return (
    <CustomSelect
      id="event-category"
      value={value}
      options={EVENT_CATEGORIES}
      ariaLabel="Event category"
      onChange={(next) =>
        onChange(next as EventCategory)
      }
      renderOption={(option) => {
        const category = option as EventCategory

        return (
          <>
            <span
              className={[
                "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background",
                getCategoryDotClasses(category),
              ].join(" ")}
            />

            <span>{category}</span>
          </>
        )
      }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Time selector                                                              */
/* -------------------------------------------------------------------------- */

function TimeSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const parsed = parseTime(value)

  function updateTime(
    nextHour = parsed.hour,
    nextMinute = parsed.minute,
    nextPeriod = parsed.period,
  ) {
    onChange(
      buildTime(
        nextHour,
        nextMinute,
        nextPeriod,
      ),
    )
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_0.9fr] gap-2">
      <CustomSelect
        id={`${id}-hour`}
        value={parsed.hour}
        options={HOURS}
        ariaLabel="Hour"
        onChange={(next) =>
          updateTime(next)
        }
      />

      <CustomSelect
        id={`${id}-minute`}
        value={parsed.minute}
        options={MINUTES}
        ariaLabel="Minute"
        onChange={(next) =>
          updateTime(parsed.hour, next)
        }
      />

      <CustomSelect
        id={`${id}-period`}
        value={parsed.period}
        options={PERIODS}
        ariaLabel="AM or PM"
        onChange={(next) =>
          updateTime(
            parsed.hour,
            parsed.minute,
            next as Period,
          )
        }
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Date picker                                                                */
/* -------------------------------------------------------------------------- */

function DateSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const dropdown = useContext(DropdownContext)

  if (!dropdown) {
    throw new Error(
      "DateSelect must be used inside DropdownProvider.",
    )
  }

  const {
    openDropdown,
    setOpenDropdown,
  } = dropdown

  const id = "event-date"
  const open = openDropdown === id

  const initialMonth = value
    ? getMonthStart(parseDateKey(value))
    : getMonthStart(new Date())

  const [visibleMonth, setVisibleMonth] =
    useState(initialMonth)

  useEffect(() => {
    if (open) {
      setVisibleMonth(initialMonth)
    }
    // The picker intentionally resets to the selected date whenever opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement

      if (
        !target.closest(
          `[data-date-select="${id}"]`,
        )
      ) {
        setOpenDropdown(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdown(null)
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    )
    document.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      )
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [id, open, setOpenDropdown])

  const calendarDays = useMemo(
    () => getCalendarDays(visibleMonth),
    [visibleMonth],
  )

  const selectedDay = value
    ? parseDateKey(value)
    : null

  const displayValue = value
    ? parseDateKey(value).toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        },
      )
    : "Select date"

  function selectDate(date: Date) {
    onChange(formatDateKey(date))
    setOpenDropdown(null)
  }

  function selectToday() {
    const today = new Date()
    onChange(formatDateKey(today))
    setVisibleMonth(getMonthStart(today))
    setOpenDropdown(null)
  }

  return (
    <div
      className="relative"
      data-date-select={id}
    >
      <button
        type="button"
        aria-label="Event date"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() =>
          setOpenDropdown(open ? null : id)
        }
        className={[
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-all",
          "hover:border-blue-500/30 hover:bg-muted/40",
          "focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20",
          open
            ? "border-blue-500/50 ring-2 ring-blue-500/20"
            : "",
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span
            className={
              value
                ? "truncate"
                : "truncate text-muted-foreground"
            }
          >
            {displayValue}
          </span>
        </span>

        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[110] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-3">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setVisibleMonth(
                  (month) =>
                    new Date(
                      month.getFullYear(),
                      month.getMonth() - 1,
                      1,
                    ),
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-sm font-semibold">
              {visibleMonth.toLocaleDateString(
                "en-GB",
                {
                  month: "long",
                  year: "numeric",
                },
              )}
            </div>

            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setVisibleMonth(
                  (month) =>
                    new Date(
                      month.getFullYear(),
                      month.getMonth() + 1,
                      1,
                    ),
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 pb-3 pt-2">
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {day.slice(0, 2)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dateKey = formatDateKey(day)
                const isCurrentMonth =
                  day.getMonth() ===
                    visibleMonth.getMonth() &&
                  day.getFullYear() ===
                    visibleMonth.getFullYear()

                const isSelected =
                  selectedDay !== null &&
                  isSameDay(day, selectedDay)

                const isToday = isSameDay(
                  day,
                  new Date(),
                )

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => selectDate(day)}
                    className={[
                      "relative flex h-9 w-full items-center justify-center rounded-lg text-xs font-medium transition-colors",
                      isCurrentMonth
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground/40 hover:bg-muted/50",
                      isSelected
                        ? "bg-blue-600 text-white hover:bg-blue-600"
                        : "",
                      !isSelected && isToday
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                        : "",
                    ].join(" ")}
                  >
                    {day.getDate()}

                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 h-0.5 w-0.5 rounded-full bg-blue-500" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
              <span className="text-[11px] text-muted-foreground">
                {value
                  ? displayValue
                  : "No date selected"}
              </span>

              <button
                type="button"
                onClick={selectToday}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-500 transition-colors hover:bg-blue-500/10"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Events() {
  const today = useMemo(() => new Date(), [])

  const [currentMonth, setCurrentMonth] =
    useState(getMonthStart(today))

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] =
    useState<"All" | EventCategory>("All")

  const [events, setEvents] =
    useState<CalendarEvent[]>([])

  const [loading, setLoading] = useState(true)

  const [canManageEvents, setCanManageEvents] =
    useState(false)

  const [showEventModal, setShowEventModal] =
    useState(false)

  const [editingEvent, setEditingEvent] =
    useState<CalendarEvent | null>(null)

  const [form, setForm] =
    useState<EventForm>(EMPTY_FORM)

  const [saving, setSaving] = useState(false)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  const [deleteEventTarget, setDeleteEventTarget] =
    useState<CalendarEvent | null>(null)

  /* ------------------------------------------------------------------------ */
  /* Load events                                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [
          eventsResponse,
          permissionResponse,
        ] = await Promise.all([
          fetch("/api/events", {
            credentials: "include",
          }),
          fetch(
            "/api/auth/check?permission=events",
            {
              credentials: "include",
            },
          ),
        ])

        if (!active) {
          return
        }

        if (!eventsResponse.ok) {
          throw new Error(
            "Failed to load events.",
          )
        }

        const data =
          await eventsResponse.json()

        setEvents(
          Array.isArray(data.events)
            ? data.events
            : [],
        )

        setCanManageEvents(
          permissionResponse.ok,
        )
      } catch (error) {
        console.error(error)

        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load events.",
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  /* ------------------------------------------------------------------------ */
  /* Lock page scrolling while modal is open                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const modalOpen =
      showEventModal ||
      Boolean(selectedDate) ||
      Boolean(deleteEventTarget)

    if (!modalOpen) {
      return
    }

    const previousBodyOverflow =
      document.body.style.overflow

    const previousHtmlOverflow =
      document.documentElement.style.overflow

    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow =
      "hidden"

    return () => {
      document.body.style.overflow =
        previousBodyOverflow

      document.documentElement.style.overflow =
        previousHtmlOverflow
    }
  }, [
    showEventModal,
    selectedDate,
    deleteEventTarget,
  ])

  /* ------------------------------------------------------------------------ */
  /* Calendar data                                                            */
  /* ------------------------------------------------------------------------ */

  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth),
    [currentMonth],
  )

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "All") {
      return sortEvents(events)
    }

    return sortEvents(
      events.filter(
        (event) =>
          event.category === categoryFilter,
      ),
    )
  }, [categoryFilter, events])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) {
      return []
    }

    return sortEvents(
      events.filter(
        (event) =>
          event.date === selectedDate &&
          (categoryFilter === "All" ||
            event.category === categoryFilter),
      ),
    )
  }, [categoryFilter, events, selectedDate])

  const upcomingEventCount = useMemo(() => {
    const todayKey = formatDateKey(today)

    return filteredEvents.filter(
      (event) => event.date >= todayKey,
    ).length
  }, [filteredEvents, today])

  const upcomingEvents = useMemo(() => {
    const todayKey = formatDateKey(today)

    return filteredEvents
      .filter(
        (event) => event.date >= todayKey,
      )
      .slice(0, 8)
  }, [filteredEvents, today])

  /* ------------------------------------------------------------------------ */
  /* Event modal                                                              */
  /* ------------------------------------------------------------------------ */

  function openAddEvent(
    date =
      selectedDate ??
      formatDateKey(today),
  ) {
    setEditingEvent(null)

    setForm({
      ...EMPTY_FORM,
      date,
    })

    setShowEventModal(true)
  }

  function openEditEvent(
    event: CalendarEvent,
  ) {
    setEditingEvent(event)

    setForm({
      title: event.title,
      description: event.description,
      category: event.category,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      discordUrl: event.discordUrl,
    })

    setShowEventModal(true)
  }

  function closeEventModal() {
    if (saving) {
      return
    }

    setShowEventModal(false)
    setEditingEvent(null)
    setForm(EMPTY_FORM)
  }

  /* ------------------------------------------------------------------------ */
  /* Save                                                                     */
  /* ------------------------------------------------------------------------ */

  async function saveEvent() {
    if (!form.title.trim()) {
      toast.error("Enter an event title.")
      return
    }

    if (!form.description.trim()) {
      toast.error(
        "Enter an event description.",
      )
      return
    }

    if (!form.date) {
      toast.error("Select an event date.")
      return
    }

    if (!form.startTime || !form.endTime) {
      toast.error(
        "Select a start and end time.",
      )
      return
    }

    if (form.endTime < form.startTime) {
      toast.error(
        "End time must be after the start time.",
      )
      return
    }

    setSaving(true)

    try {
      const response = await fetch(
        editingEvent
          ? `/api/events/${editingEvent.id}`
          : "/api/events",
        {
          method: editingEvent ? "PUT" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      )

      const data = await response
        .json()
        .catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save event.",
        )
      }

      if (!data.event) {
        throw new Error(
          "The server did not return the saved event.",
        )
      }

      if (editingEvent) {
        setEvents((current) =>
          current.map((event) =>
            event.id === editingEvent.id
              ? data.event
              : event,
          ),
        )

        toast.success("Event updated.")
      } else {
        setEvents((current) => [
          ...current,
          data.event,
        ])

        toast.success("Event created.")
      }

      setCurrentMonth(
        getMonthStart(
          parseDateKey(form.date),
        ),
      )

      setSelectedDate(form.date)
      setShowEventModal(false)
      setEditingEvent(null)
      setForm(EMPTY_FORM)
    } catch (error) {
      console.error(error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save event.",
      )
    } finally {
      setSaving(false)
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Delete                                                                   */
  /* ------------------------------------------------------------------------ */

  function requestDeleteEvent(
    event: CalendarEvent,
  ) {
    if (deletingId) {
      return
    }

    setDeleteEventTarget(event)
  }

  function closeDeleteModal() {
    if (deletingId) {
      return
    }

    setDeleteEventTarget(null)
  }

  async function confirmDeleteEvent() {
    if (!deleteEventTarget) {
      return
    }

    const event = deleteEventTarget

    setDeletingId(event.id)

    try {
      const response = await fetch(
        `/api/events/${event.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      )

      const data = await response
        .json()
        .catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete event.",
        )
      }

      setEvents((current) =>
        current.filter(
          (item) => item.id !== event.id,
        ),
      )

      setDeleteEventTarget(null)

      toast.success("Event deleted.")
    } catch (error) {
      console.error(error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete event.",
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />

      <main className="relative min-h-screen pt-20">
        <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-7">
          {/* Header */}
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
                <CalendarDays className="h-4 w-4" />
                COMMUNITY
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                View upcoming Metro Police
                Department activities, patrols,
                operations, and meetings.
              </p>
            </div>

            {canManageEvents && (
              <Button
                type="button"
                className="shrink-0"
                onClick={() => openAddEvent()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Event
              </Button>
            )}
          </div>

          {/* Calendar */}
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() =>
                    setCurrentMonth(
                      (month) =>
                        new Date(
                          month.getFullYear(),
                          month.getMonth() - 1,
                          1,
                        ),
                    )
                  }
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3 text-sm"
                  onClick={() =>
                    setCurrentMonth(
                      getMonthStart(today),
                    )
                  }
                >
                  Today
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() =>
                    setCurrentMonth(
                      (month) =>
                        new Date(
                          month.getFullYear(),
                          month.getMonth() + 1,
                          1,
                        ),
                    )
                  }
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <h2 className="ml-1 text-base font-semibold sm:ml-2 sm:text-lg">
                  {currentMonth.toLocaleDateString(
                    "en-GB",
                    {
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORY_FILTERS.map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() =>
                        setCategoryFilter(
                          filter,
                        )
                      }
                      className={[
                        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        categoryFilter === filter
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300"
                          : "border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-border/70">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:px-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dateKey = formatDateKey(day)

                const dayEvents =
                  filteredEvents.filter(
                    (event) =>
                      event.date === dateKey,
                  )

                const isCurrentMonth =
                  day.getMonth() ===
                  currentMonth.getMonth()

                const isToday = isSameDay(
                  day,
                  today,
                )

                const isSelected =
                  selectedDate === dateKey

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() =>
                      setSelectedDate(dateKey)
                    }
                    className={[
                      "group relative min-h-[72px] border-r border-b border-border/60 p-1.5 text-left transition-colors last:border-r-0 sm:min-h-[82px] sm:p-2",
                      isCurrentMonth
                        ? "bg-background/20 hover:bg-muted/50"
                        : "bg-muted/20 text-muted-foreground/50 hover:bg-muted/30",
                      isSelected
                        ? "bg-blue-500/5 ring-1 ring-inset ring-blue-500/40"
                        : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium",
                        isToday
                          ? "bg-blue-600 text-white"
                          : isSelected
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                            : "",
                      ].join(" ")}
                    >
                      {day.getDate()}
                    </span>

                    <div className="mt-1 space-y-1">
                      {dayEvents
                        .slice(0, 2)
                        .map((event) => (
                          <div
                            key={event.id}
                            className={[
                              "truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                              getCategoryClasses(
                                event.category,
                              ),
                            ].join(" ")}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}

                      {dayEvents.length > 2 && (
                        <div className="px-1 text-[10px] text-muted-foreground">
                          +{dayEvents.length - 2}{" "}
                          more
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <span className="shrink-0">
                  Click a date to view its events.
                </span>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {EVENT_CATEGORIES.map(
                    (category) => (
                      <span
                        key={category}
                        className="inline-flex items-center gap-1.5"
                      >
                        <span
                          className={[
                            "h-2 w-2 shrink-0 rounded-full",
                            getCategoryDotClasses(
                              category,
                            ),
                          ].join(" ")}
                        />

                        <span>{category}</span>
                      </span>
                    ),
                  )}
                </div>
              </div>

              <span className="shrink-0 font-medium text-foreground/70">
                {upcomingEventCount}{" "}
                {upcomingEventCount === 1
                  ? "upcoming event"
                  : "upcoming events"}
              </span>
            </div>
          </section>

          {/* Upcoming Events */}
          <section
            className={[
              "mt-6 overflow-hidden rounded-2xl bg-card/80 shadow-sm backdrop-blur",
              loading ||
              upcomingEvents.length === 0
                ? "border border-dashed border-border"
                : "border border-border/70",
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Upcoming Events
                </h2>

                <p className="mt-0.5 text-sm text-muted-foreground">
                  Scheduled events from today onwards.
                </p>
              </div>

              {categoryFilter !== "All" && (
                <span className="text-xs text-muted-foreground">
                  Filter: {categoryFilter}
                </span>
              )}
            </div>

            {loading ? (
              <div className="px-4 py-10 text-center">
                <CalendarDays className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />

                <p className="mt-3 text-sm font-medium">
                  Loading events...
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Please wait while the calendar is loaded.
                </p>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 text-sm font-medium">
                  No events scheduled
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  There are no events matching this filter.
                </p>

                {canManageEvents && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => openAddEvent()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Event
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-3 sm:p-4">
                <div className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-border/70 bg-background/60 p-3 transition-colors hover:border-blue-500/40 hover:bg-muted/30 sm:p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          onClick={() =>
                            setSelectedDate(
                              event.date,
                            )
                          }
                        >
                          <div
                            className={[
                              "flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-lg border",
                              getCategoryClasses(
                                event.category,
                              ),
                            ].join(" ")}
                          >
                            <span className="text-[9px] font-semibold uppercase opacity-80">
                              {parseDateKey(
                                event.date,
                              ).toLocaleDateString(
                                "en-GB",
                                {
                                  month: "short",
                                },
                              )}
                            </span>

                            <span className="text-lg font-semibold leading-none">
                              {parseDateKey(
                                event.date,
                              ).getDate()}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold sm:text-base">
                                {event.title}
                              </h3>

                              <span
                                className={[
                                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                  getCategoryClasses(
                                    event.category,
                                  ),
                                ].join(" ")}
                              >
                                {event.category}
                              </span>
                            </div>

                            {event.description && (
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                                {event.description}
                              </p>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock3 className="h-3.5 w-3.5" />
                                {event.startTime} -{" "}
                                {event.endTime}
                              </span>

                              {event.location && (
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5" />

                                  <span className="truncate">
                                    {event.location}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-2 sm:pl-2">
                          {event.discordUrl && (
                            <a
                              href={event.discordUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              onClick={(eventClick) =>
                                eventClick.stopPropagation()
                              }
                            >
                              Discord
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}

                          {canManageEvents && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() =>
                                  openEditEvent(
                                    event,
                                  )
                                }
                                aria-label={`Edit ${event.title}`}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:text-destructive"
                                disabled={
                                  deletingId ===
                                  event.id
                                }
                                onClick={() =>
                                  requestDeleteEvent(
                                    event,
                                  )
                                }
                                aria-label={`Delete ${event.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <Footer />
      </main>

      {/* -------------------------------------------------------------------- */}
      {/* Selected date modal                                                  */}
      {/* -------------------------------------------------------------------- */}

      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              setSelectedDate(null)
            }
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                  Events
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  {formatLongDate(selectedDate)}
                </h2>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setSelectedDate(null)
                }
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground" />

                <p className="mt-3 text-sm font-medium">
                  No events scheduled
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  There are no events scheduled for this date.
                </p>

                {canManageEvents && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() =>
                      openAddEvent(
                        selectedDate,
                      )
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Event
                  </Button>
                )}
              </div>
            ) : (
              <div className="max-h-[60vh] divide-y divide-border/70 overflow-y-auto">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">
                            {event.title}
                          </h3>

                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              getCategoryClasses(
                                event.category,
                              ),
                            ].join(" ")}
                          >
                            {event.category}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {event.description}
                        </p>
                      </div>

                      {canManageEvents && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              openEditEvent(
                                event,
                              )
                            }
                            aria-label={`Edit ${event.title}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={
                              deletingId ===
                              event.id
                            }
                            onClick={() =>
                              requestDeleteEvent(
                                event,
                              )
                            }
                            aria-label={`Delete ${event.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        {event.startTime} -{" "}
                        {event.endTime}
                      </span>

                      {event.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </span>
                      )}

                      {event.discordUrl && (
                        <a
                          href={event.discordUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-500 hover:underline"
                        >
                          Discord
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Add / edit modal                                                     */}
      {/* -------------------------------------------------------------------- */}

      {showEventModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
                event.target &&
              !saving
            ) {
              closeEventModal()
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-border/70 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-500">
                  Community
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  {editingEvent
                    ? "Edit Event"
                    : "Add Event"}
                </h2>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={closeEventModal}
                disabled={saving}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <DropdownProvider>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">
                      Title <span className="text-red-500">*</span>
                    </label>

                    <Input
                      value={form.title}
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setForm(
                          (current) => ({
                            ...current,
                            title:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder="Event title"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">
                      Description <span className="text-red-500">*</span>
                    </label>

                    <Textarea
                      value={form.description}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            description:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder="Describe the event..."
                      rows={4}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Category
                    </label>

                    <CategorySelect
                      value={form.category}
                      onChange={(category) =>
                        setForm(
                          (current) => ({
                            ...current,
                            category,
                          }),
                        )
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Date <span className="text-red-500">*</span>
                    </label>

                    <DateSelect
                      value={form.date}
                      onChange={(date) =>
                        setForm(
                          (current) => ({
                            ...current,
                            date,
                          }),
                        )
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Start Time <span className="text-red-500">*</span>
                    </label>

                    <TimeSelect
                      id="start-time"
                      value={form.startTime}
                      onChange={(startTime) =>
                        setForm(
                          (current) => ({
                            ...current,
                            startTime,
                          }),
                        )
                      }
                    />

                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Hour · Minute · AM/PM
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      End Time <span className="text-red-500">*</span>
                    </label>

                    <TimeSelect
                      id="end-time"
                      value={form.endTime}
                      onChange={(endTime) =>
                        setForm(
                          (current) => ({
                            ...current,
                            endTime,
                          }),
                        )
                      }
                    />

                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Hour · Minute · AM/PM
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Location <span className="text-red-500">*</span>
                    </label>

                    <Input
                      value={form.location}
                      required
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            location:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder="Location"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Discord URL <span className="text-muted-foreground">(optional)</span>
                    </label>

                    <Input
                      type="url"
                      value={form.discordUrl}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            discordUrl:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder="https://discord.com/..."
                    />
                  </div>
                </div>
              </DropdownProvider>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border/70 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeEventModal}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void saveEvent()
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingEvent
                    ? "Save Changes"
                    : "Create Event"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Delete confirmation modal                                            */}
      {/* -------------------------------------------------------------------- */}

      {deleteEventTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
                event.target &&
              !deletingId
            ) {
              closeDeleteModal()
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
            aria-describedby="delete-event-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2
                    id="delete-event-title"
                    className="text-base font-semibold"
                  >
                    Delete event?
                  </h2>

                  <p
                    id="delete-event-description"
                    className="mt-1.5 text-sm leading-6 text-muted-foreground"
                  >
                    This will permanently remove{" "}
                    <span className="font-medium text-foreground">
                      "{deleteEventTarget.title}"
                    </span>
                    {" "}from the Metro PD events calendar. This action cannot be undone.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={closeDeleteModal}
                  disabled={Boolean(deletingId)}
                  aria-label="Close delete confirmation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={() =>
                  void confirmDeleteEvent()
                }
                disabled={Boolean(deletingId)}
              >
                <Trash2 className="mr-2 h-4 w-4" />

                {deletingId
                  ? "Deleting..."
                  : "Delete Event"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
