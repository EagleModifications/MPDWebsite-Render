import { useCallback, useEffect, useState } from "react"
import { getSession, hasPermission, type User } from "@/lib/auth"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const nextUser = await getSession()
    setUser(nextUser)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    hasPermission: (permission: string) => hasPermission(user, permission),
    refresh
  }
}
