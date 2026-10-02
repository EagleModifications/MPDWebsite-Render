import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { getSession, type User } from "@/lib/auth"

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

const CATEGORY_FILTERS: Array<
  "All" | EventCategory
> = [
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

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0")
  const day = String(
    date.getDate(),
  ).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseDateKey(value: string) {
  const [year, month, day] =
    value.split("-").map(Number)

  return new Date(
    year,
    month - 1,
    day,
  )
}

function formatLongDate(value: string) {
  return parseDateKey(value).toLocaleDateString(
    "en-GB",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  )
}

function getMonthStart(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  )
}

function getCalendarDays(month: Date) {
  const firstDay = getMonthStart(month)

  const mondayIndex =
    (firstDay.getDay() + 6) % 7

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate()

  const previousMonthDays =
    mondayIndex

  const totalCells =
    Math.ceil(
      (previousMonthDays +
        daysInMonth) /
        7,
    ) * 7

  const days: Date[] = []

  for (
    let index = 0;
    index < totalCells;
    index += 1
  ) {
    days.push(
      new Date(
        month.getFullYear(),
        month.getMonth(),
        1 -
          previousMonthDays +
          index,
      ),
    )
  }

  return days
}

function isSameDay(
  left: Date,
  right: Date,
) {
  return (
    left.getFullYear() ===
      right.getFullYear() &&
    left.getMonth() ===
      right.getMonth() &&
    left.getDate() ===
      right.getDate()
  )
}

function getCategoryClasses(
  category: EventCategory,
) {
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

function getCategoryDotClasses(
  category: EventCategory,
) {
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

function sortEvents(
  events: CalendarEvent[],
) {
  return [...events].sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(
      `${b.date} ${b.startTime}`,
    ),
  )
}

function formatTimeLabel(value: string) {
  if (!value) {
    return "Select time"
  }

  const [
    hoursString,
    minutesString,
  ] = value.split(":")

  const hours = Number(hoursString)
  const minutes = Number(minutesString)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return value
  }

  const period =
    hours >= 12 ? "PM" : "AM"

  const displayHours =
    hours % 12 === 0
      ? 12
      : hours % 12

  return `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`
}

function getTimeOptions() {
  const options: string[] = []

  for (
    let hour = 0;
    hour < 24;
    hour += 1
  ) {
    for (
      let minute = 0;
      minute < 60;
      minute += 15
    ) {
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      )
    }
  }

  return options
}

const TIME_OPTIONS =
  getTimeOptions()

function CategorySelect({
  value,
  onChange,
}: {
  value: EventCategory
  onChange: (
    value: EventCategory,
  ) => void
}) {
  const [open, setOpen] =
    useState(false)

  const ref =
    useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false)
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      )
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) => !current,
          )
        }
        className={[
          "flex h-9 w-full items-center rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none transition-colors",
          open
            ? "border-blue-500/50 ring-2 ring-blue-500/20"
            : "border-input hover:bg-muted/40",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={[
            "mr-2.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background",
            getCategoryDotClasses(
              value,
            ),
          ].join(" ")}
        />

        <span className="flex-1 text-left">
          {value}
        </span>

        <ChevronDown
          className={[
            "ml-2 h-4 w-4 text-muted-foreground transition-transform",
            open
              ? "rotate-180"
              : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          {EVENT_CATEGORIES.map(
            (category) => {
              const selected =
                value === category

              return (
                <button
                  key={category}
                  type="button"
                  role="option"
                  aria-selected={
                    selected
                  }
                  onClick={() => {
                    onChange(category)
                    setOpen(false)
                  }}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    selected
                      ? "bg-blue-500/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      getCategoryDotClasses(
                        category,
                      ),
                    ].join(" ")}
                  />

                  <span className="flex-1">
                    {category}
                  </span>

                  {selected && (
                    <Check className="h-4 w-4 text-blue-500" />
                  )}
                </button>
              )
            },
          )}
        </div>
      )}
    </div>
  )
}

function TimeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (
    value: string,
  ) => void
}) {
  const [open, setOpen] =
    useState(false)

  const ref =
    useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false)
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      )
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) => !current,
          )
        }
        className={[
          "flex h-9 w-full items-center rounded-md border bg-background px-3 text-sm shadow-xs outline-none transition-colors",
          open
            ? "border-blue-500/50 ring-2 ring-blue-500/20"
            : "border-input hover:bg-muted/40",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Clock3 className="mr-2.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <span className="flex-1 text-left font-medium">
          {formatTimeLabel(value)}
        </span>

        <ChevronDown
          className={[
            "ml-2 h-4 w-4 text-muted-foreground transition-transform",
            open
              ? "rotate-180"
              : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          {TIME_OPTIONS.map(
            (time) => {
              const selected =
                value === time

              return (
                <button
                  key={time}
                  type="button"
                  role="option"
                  aria-selected={
                    selected
                  }
                  onClick={() => {
                    onChange(time)
                    setOpen(false)
                  }}
                  className={[
                    "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "bg-blue-500/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <span className="flex-1">
                    {formatTimeLabel(
                      time,
                    )}
                  </span>

                  {selected && (
                    <Check className="h-4 w-4 text-blue-500" />
                  )}
                </button>
              )
            },
          )}
        </div>
      )}
    </div>
  )
}

function DateSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (
    value: string,
  ) => void
}) {
  const [open, setOpen] =
    useState(false)

  const [viewMonth, setViewMonth] =
    useState(() =>
      value
        ? getMonthStart(
            parseDateKey(value),
          )
        : getMonthStart(
            new Date(),
          ),
    )

  const ref =
    useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false)
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      )
    }
  }, [])

  const days =
    getCalendarDays(viewMonth)

  const selectedDate = value
    ? parseDateKey(value)
    : null

  const today = new Date()

  return (
    <div
      ref={ref}
      className="relative"
    >
      <button
        type="button"
        onClick={() => {
          if (value) {
            setViewMonth(
              getMonthStart(
                parseDateKey(value),
              ),
            )
          }

          setOpen(
            (current) => !current,
          )
        }}
        className={[
          "flex h-9 w-full items-center rounded-md border bg-background px-3 text-sm shadow-xs outline-none transition-colors",
          open
            ? "border-blue-500/50 ring-2 ring-blue-500/20"
            : "border-input hover:bg-muted/40",
        ].join(" ")}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays className="mr-2.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <span
          className={[
            "flex-1 text-left",
            value
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          ].join(" ")}
        >
          {value
            ? parseDateKey(
                value,
              ).toLocaleDateString(
                "en-GB",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                },
              )
            : "Select date"}
        </span>

        <ChevronDown
          className={[
            "ml-2 h-4 w-4 text-muted-foreground transition-transform",
            open
              ? "rotate-180"
              : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[80] w-[290px] overflow-hidden rounded-xl border border-border bg-popover p-3 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() =>
                setViewMonth(
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
            </button>

            <span className="text-sm font-semibold">
              {viewMonth.toLocaleDateString(
                "en-GB",
                {
                  month: "long",
                  year: "numeric",
                },
              )}
            </span>

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() =>
                setViewMonth(
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
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {[
              "M",
              "T",
              "W",
              "T",
              "F",
              "S",
              "S",
            ].map(
              (
                day,
                index,
              ) => (
                <div
                  key={`${day}-${index}`}
                  className="py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground"
                >
                  {day}
                </div>
              ),
            )}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const dateKey =
                formatDateKey(day)

              const isCurrentMonth =
                day.getMonth() ===
                  viewMonth.getMonth() &&
                day.getFullYear() ===
                  viewMonth.getFullYear()

              const isSelected =
                selectedDate !== null &&
                isSameDay(
                  day,
                  selectedDate,
                )

              const isToday =
                isSameDay(
                  day,
                  today,
                )

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    onChange(dateKey)
                    setOpen(false)
                  }}
                  className={[
                    "relative flex h-8 items-center justify-center rounded-md text-xs transition-colors",
                    !isCurrentMonth
                      ? "text-muted-foreground/35"
                      : "text-foreground hover:bg-muted",
                    isSelected
                      ? "bg-blue-600 text-white hover:bg-blue-600"
                      : "",
                    isToday &&
                    !isSelected
                      ? "font-bold text-blue-500"
                      : "",
                  ].join(" ")}
                >
                  {day.getDate()}

                  {isToday &&
                    !isSelected && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-blue-500" />
                    )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 border-t border-border/70 pt-2">
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-blue-500 transition-colors hover:bg-blue-500/10"
              onClick={() => {
                const todayKey =
                  formatDateKey(
                    today,
                  )

                onChange(todayKey)

                setViewMonth(
                  getMonthStart(
                    today,
                  ),
                )

                setOpen(false)
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Events() {
  const today = useMemo(
    () => new Date(),
    [],
  )

  const [user, setUser] =
    useState<User | null>(null)

  const [currentMonth, setCurrentMonth] =
    useState(
      getMonthStart(today),
    )

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] =
    useState<
      "All" | EventCategory
    >("All")

  const [events, setEvents] =
    useState<CalendarEvent[]>([])

  const [loading, setLoading] =
    useState(true)

  const [canManageEvents, setCanManageEvents] =
    useState(false)

  const [showEventModal, setShowEventModal] =
    useState(false)

  const [editingEvent, setEditingEvent] =
    useState<CalendarEvent | null>(null)

  const [form, setForm] =
    useState<EventForm>(EMPTY_FORM)

  const [saving, setSaving] =
    useState(false)

  const [deletingId, setDeletingId] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [
          session,
          eventsResponse,
          permissionResponse,
        ] = await Promise.all([
          getSession(),
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

        setUser(session)

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

  const calendarDays = useMemo(
    () =>
      getCalendarDays(
        currentMonth,
      ),
    [currentMonth],
  )

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "All") {
      return sortEvents(events)
    }

    return sortEvents(
      events.filter(
        (event) =>
          event.category ===
          categoryFilter,
      ),
    )
  }, [
    categoryFilter,
    events,
  ])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) {
      return []
    }

    return sortEvents(
      events.filter(
        (event) =>
          event.date === selectedDate &&
          (categoryFilter === "All" ||
            event.category ===
              categoryFilter),
      ),
    )
  }, [
    categoryFilter,
    events,
    selectedDate,
  ])

  const upcomingEvents = useMemo(() => {
    const todayKey =
      formatDateKey(today)

    return filteredEvents
      .filter(
        (event) =>
          event.date >= todayKey,
      )
      .slice(0, 8)
  }, [
    filteredEvents,
    today,
  ])

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

  async function saveEvent() {
    if (!form.title.trim()) {
      toast.error(
        "Enter an event title.",
      )
      return
    }

    if (!form.description.trim()) {
      toast.error(
        "Enter an event description.",
      )
      return
    }

    if (!form.date) {
      toast.error(
        "Select an event date.",
      )
      return
    }

    if (
      !form.startTime ||
      !form.endTime
    ) {
      toast.error(
        "Select a start and end time.",
      )
      return
    }

    if (
      form.endTime <
      form.startTime
    ) {
      toast.error(
        "End time must be after the start time.",
      )
      return
    }

    setSaving(true)

    try {
      const response =
        await fetch(
          editingEvent
            ? `/api/events/${editingEvent.id}`
            : "/api/events",
          {
            method:
              editingEvent
                ? "PUT"
                : "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              form,
            ),
          },
        )

      const data =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save event.",
        )
      }

      if (editingEvent) {
        setEvents((current) =>
          current.map((event) =>
            event.id ===
            editingEvent.id
              ? data.event
              : event,
          ),
        )

        toast.success(
          "Event updated.",
        )
      } else {
        setEvents((current) => [
          ...current,
          data.event,
        ])

        toast.success(
          "Event created.",
        )
      }

      setCurrentMonth(
        getMonthStart(
          parseDateKey(
            form.date,
          ),
        ),
      )

      setSelectedDate(
        form.date,
      )

      closeEventModal()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save event.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(
    event: CalendarEvent,
  ) {
    if (
      !window.confirm(
        `Delete "${event.title}"?`,
      )
    ) {
      return
    }

    setDeletingId(event.id)

    try {
      const response =
        await fetch(
          `/api/events/${event.id}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        )

      const data =
        await response
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
          (item) =>
            item.id !== event.id,
        ),
      )

      toast.success(
        "Event deleted.",
      )
    } catch (error) {
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
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
                <CalendarDays className="h-4 w-4" />
                COMMUNITY
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                View upcoming Metro Police Department
                activities, patrols, operations, and
                meetings.
              </p>
            </div>

            {canManageEvents && (
              <Button
                type="button"
                className="shrink-0"
                onClick={() =>
                  openAddEvent()
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Event
              </Button>
            )}
          </div>

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
                      getMonthStart(
                        today,
                      ),
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
                        categoryFilter ===
                        filter
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
              {WEEKDAYS.map(
                (day) => (
                  <div
                    key={day}
                    className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:px-2"
                  >
                    {day}
                  </div>
                ),
              )}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map(
                (day) => {
                  const dateKey =
                    formatDateKey(
                      day,
                    )

                  const dayEvents =
                    filteredEvents.filter(
                      (event) =>
                        event.date ===
                        dateKey,
                    )

                  const isCurrentMonth =
                    day.getMonth() ===
                    currentMonth.getMonth()

                  const isToday =
                    isSameDay(
                      day,
                      today,
                    )

                  const isSelected =
                    selectedDate ===
                    dateKey

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() =>
                        setSelectedDate(
                          dateKey,
                        )
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
                          .map(
                            (event) => (
                              <div
                                key={
                                  event.id
                                }
                                className={[
                                  "truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                                  getCategoryClasses(
                                    event.category,
                                  ),
                                ].join(
                                  " ",
                                )}
                                title={
                                  event.title
                                }
                              >
                                {
                                  event.title
                                }
                              </div>
                            ),
                          )}

                        {dayEvents.length >
                          2 && (
                          <div className="px-1 text-[10px] text-muted-foreground">
                            +
                            {dayEvents.length -
                              2}{" "}
                            more
                          </div>
                        )}
                      </div>
                    </button>
                  )
                },
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <span className="shrink-0">
                  Click a date to view its events.
                </span>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                    <span>Activities</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <span>Patrol</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span>Operations</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span>Meetings</span>
                  </span>
                </div>
              </div>

              <span className="shrink-0 font-medium text-foreground/70">
                {filteredEvents.length}{" "}
                {filteredEvents.length === 1
                  ? "event"
                  : "events"}
              </span>
            </div>
          </section>

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
                    onClick={() =>
                      openAddEvent()
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Event
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-3 sm:p-4">
                <div className="space-y-2">
                  {upcomingEvents.map(
                    (event) => (
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
                                  ].join(
                                    " ",
                                  )}
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
                                  {formatTimeLabel(
                                    event.startTime,
                                  )}{" "}
                                  -{" "}
                                  {formatTimeLabel(
                                    event.endTime,
                                  )}
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
                                href={
                                  event.discordUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                onClick={(
                                  eventClick,
                                ) =>
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
                                    void deleteEvent(
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
                    ),
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <Footer />
      </main>

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
                  {formatLongDate(
                    selectedDate,
                  )}
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

            {selectedDateEvents.length ===
            0 ? (
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
                {selectedDateEvents.map(
                  (event) => (
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
                              ].join(
                                " ",
                              )}
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
                                void deleteEvent(
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
                          {formatTimeLabel(
                            event.startTime,
                          )}{" "}
                          -{" "}
                          {formatTimeLabel(
                            event.endTime,
                          )}
                        </span>

                        {event.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                        )}

                        {event.discordUrl && (
                          <a
                            href={
                              event.discordUrl
                            }
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
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showEventModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.currentTarget ===
              event.target
            ) {
              closeEventModal()
            }
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
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
                onClick={
                  closeEventModal
                }
                disabled={saving}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    Title
                  </label>

                  <Input
                    value={form.title}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          title: event.target.value,
                        }),
                      )
                    }
                    placeholder="Event title"
                    autoFocus
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">
                    Description
                  </label>

                  <Textarea
                    value={
                      form.description
                    }
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
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Category
                  </label>

                  <CategorySelect
                    value={form.category}
                    onChange={(
                      category,
                    ) =>
                      setForm(
                        (current) => ({
                          ...current,
                          category,
                        }),
                      )
                    }
                  />

                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        getCategoryDotClasses(
                          form.category,
                        ),
                      ].join(" ")}
                    />

                    <span>
                      {form.category}{" "}
                      event
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Date
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
                    Start Time
                  </label>

                  <TimeSelect
                    value={
                      form.startTime
                    }
                    onChange={(
                      startTime,
                    ) =>
                      setForm(
                        (current) => ({
                          ...current,
                          startTime,
                        }),
                      )
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    End Time
                  </label>

                  <TimeSelect
                    value={
                      form.endTime
                    }
                    onChange={(
                      endTime,
                    ) =>
                      setForm(
                        (current) => ({
                          ...current,
                          endTime,
                        }),
                      )
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Location
                  </label>

                  <Input
                    value={
                      form.location
                    }
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
                    Discord URL
                  </label>

                  <Input
                    type="url"
                    value={
                      form.discordUrl
                    }
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
            </div>

            <div className="flex justify-end gap-2 border-t border-border/70 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={
                  closeEventModal
                }
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

      {!user && !loading
        ? null
        : null}
    </div>
  )
}
