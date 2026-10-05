import "dotenv/config"

function required(
  name: string,
): string {
  const value =
    process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    )
  }

  return value
}

function optional(
  name: string,
  fallback = "",
): string {
  return (
    process.env[name]?.trim() ??
    fallback
  )
}

export const env = {
  /* ─────────────────────────────────────────────
     Discord
  ───────────────────────────────────────────── */

  discordClientId:
    required(
      "DISCORD_CLIENT_ID",
    ),

  discordClientSecret:
    required(
      "DISCORD_CLIENT_SECRET",
    ),

  discordRedirectUri:
    required(
      "DISCORD_REDIRECT_URI",
    ),

  /* ─────────────────────────────────────────────
     Google authentication
  ───────────────────────────────────────────── */

  googleServiceAccountEmail:
    required(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    ),

  googlePrivateKey:
    required(
      "GOOGLE_PRIVATE_KEY",
    ).replace(
      /\\n/g,
      "\n",
    ),

  /* ─────────────────────────────────────────────
     Existing Google roster/import system
  ───────────────────────────────────────────── */

  googleSheetId:
    required(
      "GOOGLE_SHEET_ID",
    ),

  rosterSheetName:
    required(
      "GOOGLE_SHEET_ROSTER_IMPORT",
    ),

  /* ─────────────────────────────────────────────
     Main Roster
  ───────────────────────────────────────────── */

  mainRoster: {
    spreadsheetId:
      required(
        "GOOGLE_MAINROSTER_SHEET_ID",
      ),

    spreadsheetUrl:
      required(
        "GOOGLE_MAINROSTER_SHEET_URL",
      ),

    publishedUrl:
      optional(
        "GOOGLE_MAINROSTER_PUBLISHED_URL",
      ),

    home: {
      name:
        required(
          "GOOGLE_MAINROSTER_SHEET_HOME",
        ),

      gid:
        required(
          "GOOGLE_MAINROSTER_GID_HOME",
        ),
    },

    departmentRoster: {
      name:
        required(
          "GOOGLE_MAINROSTER_SHEET_DEPARTMENTROSTER",
        ),

      gid:
        required(
          "GOOGLE_MAINROSTER_GID_DEPARTMENTROSTER",
        ),
    },

    employeeDatabase: {
      name:
        required(
          "GOOGLE_MAINROSTER_SHEET_EMPLOYEEDATA",
        ),

      gid:
        required(
          "GOOGLE_MAINROSTER_GID_EMPLOYEEDATA",
        ),
    },

    vehicleRoster: {
      name:
        required(
          "GOOGLE_MAINROSTER_SHEET_VEHICLEROSTER",
        ),

      gid:
        required(
          "GOOGLE_MAINROSTER_GID_VEHICLEROSTER",
        ),
    },

    uniformRoster: {
      name:
        required(
          "GOOGLE_MAINROSTER_SHEET_UNIFORMROSTER",
        ),

      gid:
        required(
          "GOOGLE_MAINROSTER_GID_UNIFORMROSTER",
        ),
    },
  },

  /* ─────────────────────────────────────────────
     Session
  ───────────────────────────────────────────── */

  sessionSecret:
    required(
      "SESSION_SECRET",
    ),

  /* ─────────────────────────────────────────────
     Wheel of Names
  ───────────────────────────────────────────── */

  wheelOfNamesApiKey:
    optional(
      "WHEEL_OF_NAMES_API_KEY",
    ),

  /* ─────────────────────────────────────────────
     Server
  ───────────────────────────────────────────── */

  port:
    Number(
      process.env.PORT ??
        3001,
    ),

  appOrigin:
    optional(
      "APP_ORIGIN",
      "http://localhost:5173",
    ),
} as const
