import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  RotateCcw,
  Save,
  Shield,
} from "lucide-react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard/DashboardLayout"
import { Button } from "@/components/ui/button"

type Rank = {
  id: string
  name: string
}

type Requirement = {
  rankId: string
  rankName: string
  hours: number
  trainings: number
}

type RequirementsResponse = {
  success?: boolean
  requirements?: Record<string, Requirement>
  message?: string
  error?: string
}

/*
 * SWAT rank order.
 *
 * The order here is the official display order used by
 * SWAT Requirements and should not depend on MongoDB.
 *
 * rankId   = internal identifier
 * rankName = human-readable name
 */
const SWAT_RANKS: Rank[] = [
  {
    id: "commander",
    name: "Commander",
  },
  {
    id: "deputy-commander",
    name: "Deputy Commander",
  },
  {
    id: "assistant-commander",
    name: "Assistant Commander",
  },
  {
    id: "executive-commander",
    name: "Executive Commander",
  },
  {
    id: "chief-of-staff",
    name: "Chief Of Staff",
  },

  {
    id: "command",
    name: "Command",
  },
  {
    id: "captain",
    name: "Captain",
  },
  {
    id: "lieutenant",
    name: "Lieutenant",
  },

  {
    id: "strike-lead",
    name: "Strike Lead",
  },
  {
    id: "supervisory-operators",
    name: "Supervisory Operators",
  },
  {
    id: "sergeant",
    name: "Sergeant",
  },
  {
    id: "corporal",
    name: "Corporal",
  },

  {
    id: "master-operator",
    name: "Master Operator",
  },
  {
    id: "sr-operator",
    name: "Sr. Operator",
  },
  {
    id: "senior-operator",
    name: "Senior Operator",
  },
  {
    id: "operator",
    name: "Operator",
  },
]

const DIVISION = "swat"

function createEmptyRequirements(): Record<
  string,
  Requirement
> {
  return Object.fromEntries(
    SWAT_RANKS.map((rank) => [
      rank.id,
      {
        rankId: rank.id,
        rankName: rank.name,
        hours: 0,
        trainings: 0,
      },
    ]),
  )
}

function normalizeRequirements(
  loadedRequirements: Record<
    string,
    Requirement
  > = {},
): Record<string, Requirement> {
  const normalized =
    createEmptyRequirements()

  for (const rank of SWAT_RANKS) {
    const loaded =
      loadedRequirements[rank.id]

    const hours =
      typeof loaded?.hours === "number" &&
      Number.isFinite(loaded.hours)
        ? Math.max(
            0,
            Math.floor(loaded.hours),
          )
        : 0

    const trainings =
      typeof loaded?.trainings === "number" &&
      Number.isFinite(loaded.trainings)
        ? Math.max(
            0,
            Math.floor(loaded.trainings),
          )
        : 0

    /*
     * Never trust rankName from MongoDB.
     *
     * The frontend always uses the hardcoded
     * SWAT rank definition.
     */
    normalized[rank.id] = {
      rankId: rank.id,
      rankName: rank.name,
      hours,
      trainings,
    }
  }

  return normalized
}

function areRequirementsEqual(
  first: Record<string, Requirement>,
  second: Record<string, Requirement>,
) {
  return JSON.stringify(first) ===
    JSON.stringify(second)
}

function RequirementInput({
  label,
  value,
  onChange,
  onIncrease,
  onDecrease,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: string) => void
  onIncrease: () => void
  onDecrease: () => void
  disabled: boolean
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block whitespace-nowrap text-xs font-medium text-muted-foreground">
        {label}
      </label>

      <div className="flex h-11 w-full overflow-hidden rounded-lg border border-border bg-background">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          disabled={disabled}
          className="
            h-full
            min-w-0
            flex-1
            border-0
            bg-transparent
            px-2
            text-center
            text-sm
            font-semibold
            text-foreground
            outline-none
            focus:bg-muted/30
            disabled:cursor-not-allowed
            disabled:opacity-60
            [appearance:textfield]
            [&::-webkit-inner-spin-button]:appearance-none
            [&::-webkit-outer-spin-button]:appearance-none
          "
        />

        <div className="flex w-8 shrink-0 flex-col border-l border-border">
          <button
            type="button"
            onClick={onIncrease}
            disabled={disabled}
            className="
              flex h-1/2 items-center justify-center
              border-b border-border
              text-muted-foreground
              transition-colors
              hover:bg-blue-500/10
              hover:text-blue-500
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
            aria-label={`Increase ${label}`}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onDecrease}
            disabled={disabled}
            className="
              flex h-1/2 items-center justify-center
              text-muted-foreground
              transition-colors
              hover:bg-blue-500/10
              hover:text-blue-500
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
            aria-label={`Decrease ${label}`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SWATRequirements() {
  const rankConfig = useMemo(
    () => SWAT_RANKS,
    [],
  )

  const [requirements, setRequirements] =
    useState<Record<string, Requirement>>(
      createEmptyRequirements(),
    )

  const [savedRequirements, setSavedRequirements] =
    useState<Record<string, Requirement>>(
      createEmptyRequirements(),
    )

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setIsLoading(true)

        const response = await fetch(
          `/api/requirements/promotion/${DIVISION}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          },
        )

        const responseText =
          await response.text()

        let data: RequirementsResponse = {}

        if (responseText.trim()) {
          try {
            data =
              JSON.parse(
                responseText,
              ) as RequirementsResponse
          } catch {
            throw new Error(
              "The requirements API returned an invalid response.",
            )
          }
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              `Failed to load requirements (${response.status}).`,
          )
        }

        const loaded =
          data.requirements &&
          typeof data.requirements ===
            "object"
            ? data.requirements
            : {}

        const normalized =
          normalizeRequirements(loaded)

        if (cancelled) {
          return
        }

        setRequirements(normalized)
        setSavedRequirements({
          ...normalized,
        })
      } catch (err) {
        if (cancelled) {
          return
        }

        toast.error(
          "Failed to load requirements",
          {
            description:
              err instanceof Error
                ? err.message
                : "An unexpected error occurred while loading requirements.",
          },
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const hasChanges =
    !areRequirementsEqual(
      requirements,
      savedRequirements,
    )

  function updateRequirement(
    rankId: string,
    field: "hours" | "trainings",
    value: number,
  ) {
    const rank = rankConfig.find(
      (item) => item.id === rankId,
    )

    if (!rank) {
      return
    }

    setRequirements((current) => ({
      ...current,
      [rankId]: {
        ...(current[rankId] ??
          {
            rankId: rank.id,
            rankName: rank.name,
            hours: 0,
            trainings: 0,
          }),
        rankId: rank.id,
        rankName: rank.name,
        [field]: Math.max(
          0,
          Math.floor(value),
        ),
      },
    }))
  }

  function changeRequirement(
    rankId: string,
    field: "hours" | "trainings",
    amount: number,
  ) {
    const rank = rankConfig.find(
      (item) => item.id === rankId,
    )

    if (!rank) {
      return
    }

    const currentValue =
      requirements[rankId]?.[field] ?? 0

    updateRequirement(
      rankId,
      field,
      currentValue + amount,
    )
  }

  function setRequirement(
    rankId: string,
    field: "hours" | "trainings",
    value: string,
  ) {
    const rank = rankConfig.find(
      (item) => item.id === rankId,
    )

    if (!rank) {
      return
    }

    if (value === "") {
      updateRequirement(
        rankId,
        field,
        0,
      )
      return
    }

    const parsed =
      Number.parseInt(value, 10)

    updateRequirement(
      rankId,
      field,
      Number.isFinite(parsed)
        ? parsed
        : 0,
    )
  }

  async function handleSave() {
    if (
      isSaving ||
      !hasChanges ||
      rankConfig.length === 0
    ) {
      return
    }

    setIsSaving(true)

    const loadingToast =
      toast.loading(
        "Saving requirements...",
        {
          description:
            "Updating SWAT rank requirements.",
        },
      )

    try {
      /*
       * Always build the payload from the
       * frontend rank configuration.
       */
      const normalizedRequirements: Record<
        string,
        Requirement
      > = {}

      for (const rank of rankConfig) {
        const current =
          requirements[rank.id]

        normalizedRequirements[
          rank.id
        ] = {
          rankId: rank.id,
          rankName: rank.name,
          hours: Math.max(
            0,
            Math.floor(
              Number(
                current?.hours ?? 0,
              ),
            ),
          ),
          trainings: Math.max(
            0,
            Math.floor(
              Number(
                current?.trainings ?? 0,
              ),
            ),
          ),
        }
      }

      const response = await fetch(
        `/api/requirements/promotion/${DIVISION}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            requirements:
              normalizedRequirements,
          }),
        },
      )

      const responseText =
        await response.text()

      let data: RequirementsResponse = {}

      if (responseText.trim()) {
        try {
          data =
            JSON.parse(
              responseText,
            ) as RequirementsResponse
        } catch {
          throw new Error(
            "The server returned an invalid response.",
          )
        }
      }

      if (
        !response.ok ||
        data.success !== true
      ) {
        throw new Error(
          data.message ||
            data.error ||
            `Failed to save requirements (${response.status}).`,
        )
      }

      const savedData =
        data.requirements &&
        typeof data.requirements ===
          "object"
          ? data.requirements
          : normalizedRequirements

      const normalizedSaved =
        normalizeRequirements(
          savedData,
        )

      setRequirements(
        normalizedSaved,
      )

      setSavedRequirements({
        ...normalizedSaved,
      })

      toast.success(
        "Requirements saved successfully",
        {
          id: loadingToast,
          description:
            "SWAT rank requirements have been updated.",
        },
      )
    } catch (err) {
      toast.error(
        "Failed to save requirements",
        {
          id: loadingToast,
          description:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while saving requirements.",
        },
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleReset() {
    if (
      !hasChanges ||
      isSaving
    ) {
      return
    }

    setRequirements({
      ...savedRequirements,
    })

    toast.info("Changes reset", {
      description:
        "Your unsaved requirement changes have been discarded.",
    })
  }

  return (
    <DashboardLayout>
      <div
        className="
          min-w-0
          max-w-full
          space-y-6
          overflow-x-hidden
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {/* Header */}

        <div>
          <div className="flex items-center gap-3">
            <div
              className="
                flex h-11 w-11 shrink-0
                items-center justify-center
                rounded-xl border
                border-blue-500/20
                bg-blue-500/10
              "
            >
              <Shield className="h-5 w-5 text-blue-500" />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">
                SWAT Requirements
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Configure the required promotion
                hours and trainings for each
                SWAT rank.
              </p>
            </div>
          </div>
        </div>

        {/* Loading */}

        {isLoading ? (
          <div
            className="
              rounded-xl border border-border
              bg-card p-10 text-center
              shadow-sm
            "
          >
            <p className="text-sm text-muted-foreground">
              Loading requirements...
            </p>
          </div>
        ) : (
          <>
            {/* Requirements */}

            <section
              className="
                overflow-hidden
                rounded-xl border border-border
                bg-card shadow-sm
              "
            >
              <div
                className="
                  flex min-h-[66px]
                  items-center justify-between
                  border-b border-border
                  px-6 py-3
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex h-10 w-10 shrink-0
                      items-center justify-center
                      rounded-lg
                      border border-blue-500/20
                      bg-blue-500/10
                    "
                  >
                    <Clock3 className="h-5 w-5 text-blue-500" />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold">
                      SWAT Promotion Requirements
                    </h2>

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Set the minimum hours and
                      trainings required for each
                      rank.
                    </p>
                  </div>
                </div>

                <span className="text-sm text-muted-foreground">
                  {rankConfig.length}{" "}
                  {rankConfig.length === 1
                    ? "rank"
                    : "ranks"}
                </span>
              </div>

              <div>
                {rankConfig.map(
                  (rank, index) => {
                    const requirement =
                      requirements[
                        rank.id
                      ] ?? {
                        rankId: rank.id,
                        rankName: rank.name,
                        hours: 0,
                        trainings: 0,
                      }

                    return (
                      <div
                        key={rank.id}
                        className={`
                          px-6
                          py-5
                          transition-colors
                          hover:bg-muted/20
                          ${
                            index !==
                            rankConfig.length -
                              1
                              ? "border-b border-border"
                              : ""
                          }
                        `}
                      >
                        <div
                          className="
                            flex flex-col
                            gap-5
                            lg:flex-row
                            lg:items-center
                            lg:justify-between
                          "
                        >
                          <div
                            className="
                              flex min-w-0
                              items-center gap-4
                            "
                          >
                            <div
                              className="
                                flex h-10 w-10
                                shrink-0
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-blue-500/20
                                bg-blue-500/10
                              "
                            >
                              <Shield className="h-5 w-5 text-blue-500" />
                            </div>

                            <div className="min-w-0">
                              <p
                                className="
                                  text-base
                                  font-semibold
                                  leading-5
                                "
                              >
                                {rank.name}
                              </p>

                              <p
                                className="
                                  mt-1 text-sm
                                  text-muted-foreground
                                "
                              >
                                Configure promotion
                                requirements
                              </p>
                            </div>
                          </div>

                          <div
                            className="
                              grid w-full
                              grid-cols-1
                              gap-3
                              sm:grid-cols-2
                              lg:w-auto
                              lg:grid-cols-2
                            "
                          >
                            <RequirementInput
                              label="Promotion Hours"
                              value={
                                requirement.hours
                              }
                              onChange={(
                                value,
                              ) =>
                                setRequirement(
                                  rank.id,
                                  "hours",
                                  value,
                                )
                              }
                              onIncrease={() =>
                                changeRequirement(
                                  rank.id,
                                  "hours",
                                  1,
                                )
                              }
                              onDecrease={() =>
                                changeRequirement(
                                  rank.id,
                                  "hours",
                                  -1,
                                )
                              }
                              disabled={
                                isSaving
                              }
                            />

                            <RequirementInput
                              label="Trainings"
                              value={
                                requirement.trainings
                              }
                              onChange={(
                                value,
                              ) =>
                                setRequirement(
                                  rank.id,
                                  "trainings",
                                  value,
                                )
                              }
                              onIncrease={() =>
                                changeRequirement(
                                  rank.id,
                                  "trainings",
                                  1,
                                )
                              }
                              onDecrease={() =>
                                changeRequirement(
                                  rank.id,
                                  "trainings",
                                  -1,
                                )
                              }
                              disabled={
                                isSaving
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            </section>

            {/* Actions */}

            <div
              className="
                flex min-h-11
                items-center
                justify-end
                gap-4
              "
            >
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    handleReset
                  }
                  disabled={
                    !hasChanges ||
                    isSaving
                  }
                  className="h-10 rounded-md px-4"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    void handleSave()
                  }
                  disabled={
                    !hasChanges ||
                    isSaving
                  }
                  className="h-10 rounded-md px-4"
                >
                  <Save className="mr-2 h-4 w-4" />

                  {isSaving
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
