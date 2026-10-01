import { getRosterRows } from "../google/sheets"
import type { RosterUser } from "../types"

function clean(value: unknown): string {
  return String(value ?? "").trim()
}

export async function findRosterUser(discordId: string): Promise<RosterUser | null> {
  const rows = await getRosterRows()

  // Row 0 is assumed to be the header row.
  for (const row of rows.slice(1)) {
    const rowDiscordId = clean(row[6])

    if (rowDiscordId !== discordId) continue

    return {
      discordId,
      callsign: clean(row[0]),
      badgeNumber: clean(row[1]),
      name: clean(row[2]),
      rank: clean(row[3]),
      timeInDept: clean(row[4]),
      timeInRank: clean(row[5]),
      status: clean(row[7])
    }
  }

  return null
}
