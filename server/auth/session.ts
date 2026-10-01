import { SignJWT, jwtVerify } from "jose"
import type { Response, Request } from "express"
import type { AuthUser } from "../types"
import { env } from "../config"

const COOKIE_NAME = "mpd_session"
const secret = new TextEncoder().encode(env.sessionSecret)

export async function createSession(user: AuthUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret)
}

export async function readSession(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)

    if (!payload.user || typeof payload.user !== "object") {
      return null
    }

    return payload.user as unknown as AuthUser
  } catch {
    return null
  }
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000
  })
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  })
}

export async function getRequestUser(request: Request): Promise<AuthUser | null> {
  return readSession(request.cookies?.[COOKIE_NAME])
}
