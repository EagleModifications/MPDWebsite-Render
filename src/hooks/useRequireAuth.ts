import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "./useAuth"

export function useRequireAuth(permission?: string) {
  const navigate = useNavigate()
  const auth = useAuth()

  useEffect(() => {
    if (auth.loading) return

    if (!auth.user) {
      navigate("/sign-in", { replace: true })
      return
    }

    if (permission && !auth.hasPermission(permission)) {
      navigate("/", { replace: true })
    }
  }, [auth.loading, auth.user, auth.hasPermission, navigate, permission])

  return auth
}
