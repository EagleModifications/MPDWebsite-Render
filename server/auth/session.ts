import type { Request, Response } from "express"
import { jwtVerify, SignJWT } from "jose"

import { env } from "../config"
import {
  refreshAuthUserPermissions,
} from "../permissions/permissions"
import type { AuthUser } from "../types"

const COOKIE_NAME = "mpd_session"
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000

function sessionSecret() {
  return new TextEncoder().encode(env.sessionSecret)
}

export async function createSession(user: AuthUser) {
  return new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionSecret())
}

export function setSessionCookie(
  res: Response,
  token: string,
) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
}

function payloadToAuthUser(
  payload: Record<string, unknown>,
): Omit<AuthUser, "permissions"> | null {
  const discordId = String(payload.discordId ?? "").trim()
  const rank = String(payload.rank ?? "").trim()

  if (!discordId || !rank) return null

  return {
    discordId,
    callsign: String(payload.callsign ?? ""),
    badgeNumber: String(payload.badgeNumber ?? ""),
    name: String(payload.name ?? ""),
    rank,
    timeInDept: String(payload.timeInDept ?? ""),
    timeInRank: String(payload.timeInRank ?? ""),
    status: String(payload.status ?? ""),
    username: String(payload.username ?? ""),
    displayName: String(payload.displayName ?? ""),
    ...(typeof payload.avatar === "string"
      ? { avatar: payload.avatar }
      : {}),
  }
}

export async function getRequestUser(
  req: Request,
): Promise<AuthUser | null> {
  const token = req.cookies?.[COOKIE_NAME]

  if (!token) return null

  try {
    const { payload } = await jwtVerify(
      token,
      sessionSecret(),
    )

    const baseUser = payloadToAuthUser(
      payload as Record<string, unknown>,
    )

    if (!baseUser) return null

    // Re-resolve permissions on every authenticated request.
    // This means admin changes take effect without waiting for users
    // to log out and back in.
    return await refreshAuthUserPermissions(baseUser)
  } catch {
    return null
  }
}
