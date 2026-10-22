// ─────────────────────────────────────────────
// lib/auth.ts
// 셀러 인증 훅
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase, type SellerUser } from '@/lib/supabase'

export function useSellerAuth() {
  const [user, setUser] = useState<SellerUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const checkAuth = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) { setLoading(false); return }

    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.replace('/login'); return }

    const { data: su } = await sb
      .from('seller_users')
      .select('*, seller:sellers(*)')
      .eq('auth_id', session.user.id)
      .single()

    if (!su || !su.is_active) {
      await sb.auth.signOut()
      router.replace('/login')
      return
    }

    setUser(su as SellerUser)
    // 마지막 로그인 업데이트
    await sb.from('seller_users').update({ last_login_at: new Date().toISOString() }).eq('id', su.id)
    setLoading(false)
  }, [router])

  useEffect(() => { void checkAuth() }, [checkAuth])

  async function logout() {
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
    router.replace('/login')
  }

  return { user, loading, logout, refetch: checkAuth }
}
