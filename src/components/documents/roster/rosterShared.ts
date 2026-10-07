import { Check, Square } from "lucide-react"
import type { ComponentType } from "react"

export type SheetRow = string[]

export type RosterColumn = {
  key: string
  label: string
  sourceIndex?: number
  width?: string
  kind?: "text" | "checkbox" | "discord" | "message"
}

export type RosterRecord = {
  id: string
  values: Record<string, string>
  copyName?: string
}

export type RosterSection = {
  id: string
  label: string
}

export type ParsedSheet = {
  rows: SheetRow[]
  headerRow: number
}

export const SHEET_ID =
  "1bJfy9jTbIuNNVVoqV7xaqtYsjIcV0CgCPRwUst6i0W8"

export const GIDS = {
  department: "0",
  employees: "1963323163",
  vehicles: "736782920",
  uniforms: "1205485740",
} as const

export function cleanValue(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
}

export function stripDiscordId(value: string) {
  return cleanValue(value)
    .replace(/^<@!?/, "")
    .replace(/>$/, "")
    .trim()
}

export function isChecked(value: string) {
  const normalized = cleanValue(value).toLowerCase()
  return [
    "true",
    "yes",
    "y",
    "1",
    "x",
    "check",
    "checked",
    "✓",
    "✔",
    "☑",
  ].includes(normalized)
}

export function parseGviz(raw: string): SheetRow[] {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")

  if (start < 0 || end <= start) {
    throw new Error("Google Sheets returned an invalid response.")
  }

  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    status?: string
    errors?: Array<{ message?: string; detailed_message?: string }>
    table?: {
      rows?: Array<{
        c?: Array<{ v?: unknown; f?: unknown } | null>
      }>
    }
  }

  if (parsed.errors?.length) {
    throw new Error(
      parsed.errors[0]?.detailed_message ||
        parsed.errors[0]?.message ||
        "Google Sheets returned an error.",
    )
  }

  if (parsed.status && parsed.status !== "ok") {
    throw new Error(
      `Google Sheets returned status "${parsed.status}".`,
    )
  }

  return (parsed.table?.rows ?? []).map((row) =>
    (row.c ?? []).map((cell) =>
      cleanValue(cell?.f ?? cell?.v ?? ""),
    ),
  )
}

export async function fetchSheet(gid: string) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?gid=${encodeURIComponent(gid)}` +
    `&headers=0` +
    `&tqx=out:json` +
    `&cacheBust=${Date.now()}`

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(
      `Google Sheets returned HTTP ${response.status}.`,
    )
  }

  const raw = await response.text()

  if (
    raw.includes("<html") ||
    raw.includes("<!DOCTYPE")
  ) {
    throw new Error(
      "Google Sheets did not return spreadsheet data. The sheet must be publicly viewable.",
    )
  }

  return parseGviz(raw)
}

export function findHeaderRow(
  rows: SheetRow[],
  requiredHeaders: string[],
  maxRows = 35,
) {
  const wanted = requiredHeaders.map(normalizeHeader)
  let bestIndex = -1
  let bestScore = 0

  rows.slice(0, maxRows).forEach((row, index) => {
    const values = row.map(normalizeHeader)
    const score = wanted.filter((header) =>
      values.includes(header),
    ).length

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  const minimum = Math.max(
    3,
    Math.ceil(requiredHeaders.length * 0.5),
  )

  if (bestIndex < 0 || bestScore < minimum) {
    throw new Error("Could not find the roster column headers.")
  }

  return bestIndex
}

export function normalizeHeader(value: string) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/["“”']/g, "")
    .replace(/\s+/g, " ")
}

export function sourceIndex(
  headerRow: SheetRow,
  name: string,
) {
  const wanted = normalizeHeader(name)
  return headerRow.findIndex(
    (value) => normalizeHeader(value) === wanted,
  )
}

export function getRowValue(
  row: SheetRow,
  index: number,
) {
  return cleanValue(row[index])
}

export function makeId(
  prefix: string,
  rowIndex: number,
  values: Record<string, string>,
) {
  return (
    `${prefix}-${rowIndex}-` +
    Object.values(values)
      .join("|")
      .slice(0, 80)
  )
}

export function displayRank(value: string) {
  const rank = cleanValue(value)
  const compact: Record<string, string> = {
    "Lieutenant Colonel": "Lt. Colonel",
    "Assistant Chief Of Police": "Asst. Chief",
    "Deputy Chief Of Police": "Dep. Chief",
    "Chief Of Police": "Chief",
  }

  return compact[rank] ?? rank
}

export function sectionLabel(value: string) {
  return cleanValue(value)
    .replace(/\*+/g, "")
    .trim()
}

export function isRankSection(value: string) {
  const normalized = normalizeHeader(sectionLabel(value))

  return [
    "high command",
    "trial high command",
    "low command",
    "supervisors",
    "supervisor",
    "officers",
    "trial supervisors",
    "trial low command",
  ].includes(normalized)
}

export function checkedIcon(checked: boolean) {
  return checked ? Check : Square
}

export const CHECKBOX_CLASS =
  "inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground"

export type IconType = ComponentType<{ className?: string }>
